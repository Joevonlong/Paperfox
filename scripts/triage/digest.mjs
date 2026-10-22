#!/usr/bin/env node
// Weekly triage digest: rewrites the body of the pinned "Triage queue" issue and assigns it
// to this week's on-duty maintainer. Run by .github/workflows/triage.yml.
//
// Usage:
//   node scripts/triage/digest.mjs [--dry-run] [--repo owner/name] [--issue N]
//                                  [--maintainers MAINTAINERS.md] [--date YYYY-MM-DD]
//
//   --dry-run      print the issue body and the on-duty maintainer; write nothing
//   --repo         default: $GITHUB_REPOSITORY, else the repository of the current directory
//   --issue        the Triage queue issue number; default: $TRIAGE_ISSUE. Without one (and
//                  without --dry-run) the script prints a notice and exits 0.
//   --maintainers  default: MAINTAINERS.md at the repository root
//   --date         pretend today is this date (rotation and age checks); default: today, UTC
//
// On-duty rotation: rows of the MAINTAINERS.md table (| GitHub | Role | Since |) whose role is
// "maintainer" or "lead", logins sorted, index = ISO week number mod count.
//
// Needs `gh` (authenticated; GH_TOKEN in CI) and Node 18 or later. Built-ins only. Every query
// is a read; the only writes are `gh issue edit` on the Triage queue issue, skipped by --dry-run.
// Exit status: 0 = done, 1 = a section could not be queried (the rest is still written),
// 2 = usage error.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DAY = 86_400_000
const UNTRIAGED_FLAG_DAYS = 7
const ASSIGNED_STALE_DAYS = 14
const IDEAS_WINDOW_DAYS = 7
const LIMIT = 200

// ---- arguments ---------------------------------------------------------------------
const opts = { dryRun: false, repo: process.env.GITHUB_REPOSITORY || '', issue: process.env.TRIAGE_ISSUE || '', maintainers: '', date: '' }
const argv = process.argv.slice(2)
const usage = () => {
  console.error('usage: node scripts/triage/digest.mjs [--dry-run] [--repo owner/name] [--issue N] [--maintainers FILE] [--date YYYY-MM-DD]')
  process.exit(2)
}
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  const next = () => argv[++i] ?? usage()
  if (a === '--dry-run') opts.dryRun = true
  else if (a === '--repo') opts.repo = next()
  else if (a === '--issue') opts.issue = next()
  else if (a === '--maintainers') opts.maintainers = next()
  else if (a === '--date') opts.date = next()
  else usage()
}
if (opts.issue && !/^[1-9][0-9]*$/.test(opts.issue)) usage()
if (opts.date && !/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) usage()

const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })
const ghJson = (...args) => JSON.parse(gh(...args))

if (!opts.repo) opts.repo = ghJson('repo', 'view', '--json', 'nameWithOwner').nameWithOwner
if (!/^[\w.-]+\/[\w.-]+$/.test(opts.repo)) usage()
const [owner, name] = opts.repo.split('/')

if (!opts.issue && !opts.dryRun) {
  console.log('::notice title=triage digest::repository variable TRIAGE_ISSUE is not set; nothing to update')
  process.exit(0)
}

const root = (() => { try { return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim() } catch { return process.cwd() } })()
const maintainersFile = opts.maintainers || join(root, 'MAINTAINERS.md')
const now = opts.date ? new Date(`${opts.date}T12:00:00Z`) : new Date()
const ageDays = iso => Math.floor((now.getTime() - Date.parse(iso)) / DAY)

// ---- on-duty maintainer ---------------------------------------------------------------
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day) // Thursday of this ISO week
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return { year: t.getUTCFullYear(), week: Math.ceil(((t - yearStart) / DAY + 1) / 7) }
}

/** Logins from the MAINTAINERS.md table with role maintainer or lead, sorted. */
function rotation(file) {
  if (!existsSync(file)) return []
  const rows = readFileSync(file, 'utf8').split('\n').filter(l => l.trim().startsWith('|'))
  const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
  const header = rows.findIndex(l => cells(l).some(c => /^github$/i.test(c)) && cells(l).some(c => /^role$/i.test(c)))
  if (header < 0) return []
  const h = cells(rows[header]).map(c => c.toLowerCase())
  const iLogin = h.indexOf('github'), iRole = h.indexOf('role')
  const logins = new Set()
  for (const row of rows.slice(header + 1)) {
    const c = cells(row)
    if (c.every(x => /^:?-+:?$/.test(x))) continue // separator row
    const role = (c[iRole] ?? '').replace(/[`*_]/g, '').toLowerCase()
    // "@login", "login", "[@login](https://github.com/login)"
    const login = (c[iLogin] ?? '').match(/@?([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))/)?.[1]
    if (login && (role === 'maintainer' || role === 'lead')) logins.add(login)
  }
  return [...logins].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
}

const { year, week } = isoWeek(now)
const duty = rotation(maintainersFile)
const onDuty = duty.length ? duty[week % duty.length] : null

// ---- queries ----------------------------------------------------------------------------
const failures = []
function section(title, fn) {
  try {
    return { title, lines: fn() }
  } catch (e) {
    const msg = String(e.stderr || e.message || e).split('\n').find(Boolean)?.slice(0, 300) ?? 'unknown error'
    failures.push(`${title}: ${msg}`)
    console.error(`::warning title=triage digest::${title}: ${msg}`)
    return { title, lines: [`_Could not query this section: ${msg}_`] }
  }
}
/**
 * Titles are untrusted text going into the issue body. Escape HTML so "<!--" cannot hide the rest of the queue,
 * escape [ ] so a title cannot break a link, and put a zero-width space after "@" so a title cannot mention anyone.
 */
const safe = s => String(s).replace(/\s+/g, ' ').trim()
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/[[\]\\]/g, c => `\\${c}`)
  .replace(/@/g, '@​')
const item = (x, extra = '') => `- [ ] #${x.number} ${safe(x.title)}${extra}`
const none = lines => (lines.length ? lines : ['None.'])
const issues = (...args) => ghJson('issue', 'list', '--repo', opts.repo, '--state', 'open', '--limit', String(LIMIT), ...args)
const prs = (...args) => ghJson('pr', 'list', '--repo', opts.repo, '--state', 'open', '--limit', String(LIMIT), ...args)

const sections = []

sections.push(section('Untriaged issues (`status: triage`)', () => {
  const list = issues('--label', 'status: triage', '--json', 'number,title,createdAt')
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
  return none(list.map(x => {
    const age = ageDays(x.createdAt)
    return item(x, age > UNTRIAGED_FLAG_DAYS ? ` (**${age} days**, over ${UNTRIAGED_FLAG_DAYS})` : ` (${age} days)`)
  }))
}))

sections.push(section(`Assigned over ${ASSIGNED_STALE_DAYS} days without a linked pull request`, () => {
  const list = issues('--json', 'number,title,assignees,closedByPullRequestsReferences')
    .filter(x => x.assignees.length && !(x.closedByPullRequestsReferences ?? []).length)
  const out = []
  for (const x of list) {
    const events = ghJson('api', '--paginate', '--slurp', `repos/${owner}/${name}/issues/${x.number}/timeline?per_page=100`).flat()
    const assigned = events.filter(e => e.event === 'assigned').map(e => e.created_at).sort().pop()
    const linkedPr = events.some(e => e.event === 'cross-referenced' && e.source?.issue?.pull_request && e.source.issue.state === 'open')
    if (!assigned || linkedPr) continue
    const age = ageDays(assigned)
    if (age > ASSIGNED_STALE_DAYS) out.push(item(x, ` (${x.assignees.map(a => a.login).join(', ')}, assigned ${age} days ago)`))
  }
  return none(out)
}))

sections.push(section('Waiting for information (`status: needs-info`)', () => {
  const list = [
    ...issues('--label', 'status: needs-info', '--json', 'number,title,updatedAt'),
    ...prs('--label', 'status: needs-info', '--json', 'number,title,updatedAt'),
  ].sort((a, b) => a.number - b.number)
  return none(list.map(x => item(x, ` (last update ${ageDays(x.updatedAt)} days ago)`)))
}))

sections.push(section('Fork pull requests waiting for workflow approval', () => {
  const open = prs('--json', 'number,title,headRefOid,isCrossRepository').filter(p => p.isCrossRepository)
  if (!open.length) return ['None.']
  const runs = ghJson('api', `repos/${owner}/${name}/actions/runs?status=action_required&per_page=100`).workflow_runs ?? []
  const waiting = new Set(runs.map(r => r.head_sha))
  return none(open.filter(p => waiting.has(p.headRefOid)).map(p => item(p)))
}))

sections.push(section('Dependabot pull requests', () => {
  const list = prs('--author', 'app/dependabot', '--json', 'number,title,createdAt')
  return none(list.map(x => item(x, ` (${ageDays(x.createdAt)} days)`)))
}))

sections.push(section(`New Ideas in Discussions (last ${IDEAS_WINDOW_DAYS} days)`, () => {
  const query = `query($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      hasDiscussionsEnabled
      discussionCategories(first: 50) { nodes { id name } }
    }
  }`
  const repo = ghJson('api', 'graphql', '-f', `query=${query}`, '-F', `owner=${owner}`, '-F', `name=${name}`).data.repository
  if (!repo.hasDiscussionsEnabled) return ['Discussions are not enabled.']
  const ideas = repo.discussionCategories.nodes.find(c => c.name.toLowerCase() === 'ideas')
  if (!ideas) return ['There is no Ideas category.']
  const q2 = `query($owner: String!, $name: String!, $cat: ID!) {
    repository(owner: $owner, name: $name) {
      discussions(first: 50, categoryId: $cat, orderBy: { field: CREATED_AT, direction: DESC }) {
        nodes { number title createdAt url author { login } }
      }
    }
  }`
  const nodes = ghJson('api', 'graphql', '-f', `query=${q2}`, '-F', `owner=${owner}`, '-F', `name=${name}`, '-F', `cat=${ideas.id}`).data.repository.discussions.nodes
  const recent = nodes.filter(d => ageDays(d.createdAt) <= IDEAS_WINDOW_DAYS)
  // The author is named without "@": the weekly rewrite must not notify them.
  return none(recent.map(d => `- [ ] [${safe(d.title)}](${d.url}) (${d.author?.login ? `by ${safe(d.author.login)}, ` : ''}${ageDays(d.createdAt)} days)`))
}))

// ---- body -------------------------------------------------------------------------------
const stamp = now.toISOString().slice(0, 10)
const body = [
  '<!-- Generated by .github/workflows/triage.yml (scripts/triage/digest.mjs). Edits here are overwritten every week. -->',
  `**Week ${year}-W${String(week).padStart(2, '0')}** - updated ${stamp} - on duty: ${onDuty ? `@${onDuty}` : '_nobody (no maintainer or lead in MAINTAINERS.md)_'}`,
  '',
  'Response targets: first reply to new issues and pull requests within 7 days; ready pull requests reviewed within 14 days.',
  ...sections.flatMap(s => ['', `## ${s.title}`, '', ...s.lines]),
  '',
].join('\n')

if (opts.dryRun) {
  console.log(`repo: ${opts.repo} - issue: ${opts.issue || '(none)'} - rotation: ${duty.length ? duty.join(', ') : '(empty)'} - on duty: ${onDuty ?? '(nobody)'}`)
  console.log('----- body -----')
  console.log(body)
  console.log('----- dry run: nothing written -----')
} else {
  const file = join(mkdtempSync(join(tmpdir(), 'triage-')), 'body.md')
  writeFileSync(file, body)
  const current = ghJson('issue', 'view', opts.issue, '--repo', opts.repo, '--json', 'assignees').assignees.map(a => a.login)
  const args = ['issue', 'edit', opts.issue, '--repo', opts.repo, '--body-file', file]
  const remove = current.filter(l => l !== onDuty)
  if (remove.length) args.push('--remove-assignee', remove.join(','))
  if (onDuty && !current.includes(onDuty)) args.push('--add-assignee', onDuty)
  gh(...args)
  console.log(`Updated #${opts.issue}; on duty: ${onDuty ?? 'nobody'}`)
}

if (failures.length) {
  console.error(`triage digest: ${failures.length} section(s) failed`)
  process.exit(1)
}

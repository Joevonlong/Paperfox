#!/usr/bin/env node
// Compare a library_eval.ts run with eval/baseline.json and print a Markdown report
// (eval.yml appends it to the job summary).
//
// Usage: node eval/compare.mjs <summary.json> [<baseline.json>]
//   <summary.json>   written by eval/library_eval.ts (LIB_OUT/summary.json)
//   <baseline.json>  default eval/baseline.json; when missing, only this run's numbers are printed
//
// baseline.json format:
//   {
//     "note": "where the numbers come from (commit, date)",
//     "tolerance": { "hits30": 2, "reach": 5, "preReviewHits30": 2 },
//     "reviews": { "W3005326482": { "hits30": 7, "reach": 24, "preReviewHits30": 7 }, ... }
//   }
// A metric more than its tolerance below the baseline is flagged as a regression (a GitHub
// warning annotation on stderr). The script never fails on a regression: model output varies
// from run to run, so a maintainer reads the report.
// Uses Node built-ins only.
import { existsSync, readFileSync } from 'node:fs'

const [summaryPath, baselinePath = 'eval/baseline.json'] = process.argv.slice(2)
if (!summaryPath) {
  console.error('usage: node eval/compare.mjs <summary.json> [<baseline.json>]')
  process.exit(2)
}

const runs = JSON.parse(readFileSync(summaryPath, 'utf8'))
const metrics = {
  hits30: r => r.library?.hits30,
  reach: r => r.library?.reach,
  preReviewHits30: r => r.dateRestricted?.library?.hits30,
}

const out = []
out.push('## Library eval', '')
out.push('| Review | Truth | Pile | Reach | Hits@30 | P@30 | R@30 | Pre-review hits@30 | PubMed hits@30 | OpenAlex hits@30 | Time |')
out.push('|---|---|---|---|---|---|---|---|---|---|---|')
for (const r of runs) {
  const L = r.library ?? {}
  out.push(`| ${r.review} | ${r.truth} | ${L.pile} | ${L.reach} | ${L.hits30} | ${L.p30?.toFixed(3)} | ${L.r30?.toFixed(3)} | ${metrics.preReviewHits30(r)} | ${r.pubmed?.hits30} | ${r.openalex?.hits30} | ${r.libraryMs ? `${(r.libraryMs / 1000).toFixed(0)} s` : '-'} |`)
}
out.push('')

if (!existsSync(baselinePath)) {
  console.error(`::notice title=eval baseline::${baselinePath} not found; skipping the comparison`)
  out.push(`No \`${baselinePath}\` in this commit, so there is no baseline comparison.`)
} else {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
  const tol = baseline.tolerance ?? {}
  let regressions = 0
  out.push('## Compared with the baseline', '')
  if (baseline.note) out.push(`Baseline: ${baseline.note}`, '')
  out.push('| Review | Metric | Baseline | This run | Change | |')
  out.push('|---|---|---|---|---|---|')
  for (const r of runs) {
    const b = baseline.reviews?.[r.review]
    if (!b) {
      out.push(`| ${r.review} | - | - | - | - | not in baseline |`)
      continue
    }
    for (const [name, get] of Object.entries(metrics)) {
      if (typeof b[name] !== 'number') continue
      const now = get(r)
      if (typeof now !== 'number') {
        out.push(`| ${r.review} | ${name} | ${b[name]} | - | - | missing in this run |`)
        continue
      }
      const delta = now - b[name]
      const worse = delta < -(tol[name] ?? 0)
      if (worse) {
        regressions++
        console.error(`::warning title=eval regression::${r.review} ${name}: ${now} vs baseline ${b[name]} (tolerance ${tol[name] ?? 0})`)
      }
      out.push(`| ${r.review} | ${name} | ${b[name]} | ${now} | ${delta > 0 ? '+' : ''}${delta} | ${worse ? 'below baseline' : 'ok'} |`)
    }
  }
  out.push('', regressions ? `**${regressions} metric(s) below the baseline tolerance.**` : 'Every metric is within the baseline tolerance.')
}

console.log(out.join('\n'))

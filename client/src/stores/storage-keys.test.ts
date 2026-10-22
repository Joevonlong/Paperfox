import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createPinia, setActivePinia } from 'pinia'
import { MIGRATED_FLAG, legacyKey, migrateLegacyKeys } from './storage-keys'
import { LIB_SETTINGS_KEY, lastOpened } from './library'
import { useChat } from './chat'
import { useVault } from './vault'
import { loadView } from '../library/results/facts'

vi.mock('idb-keyval', () => ({ get: vi.fn(async () => undefined), set: vi.fn(async () => undefined) }))

function memoryStorage(init: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(init))
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: k => m.get(k) ?? null,
    key: i => [...m.keys()][i] ?? null,
    removeItem: k => { m.delete(k) },
    setItem: (k, v) => { m.set(k, String(v)) },
  }
}

/** Like memoryStorage, but setItem throws once keys and values together would exceed `limit` characters. */
function fullStorage(init: Record<string, string>, limit: number): Storage {
  const s = memoryStorage(init)
  const size = () => { let n = 0; for (let i = 0; i < s.length; i++) { const k = s.key(i)!; n += k.length + s.getItem(k)!.length } return n }
  const setItem = s.setItem
  s.setItem = (k, v) => {
    if (size() - (s.getItem(k) === null ? 0 : k.length + s.getItem(k)!.length) + k.length + String(v).length > limit) {
      throw new DOMException('quota', 'QuotaExceededError')
    }
    setItem(k, v)
  }
  return s
}

const readSource = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

// Every localStorage key written before the rename to Paperfox.
const LEGACY = {
  'papertrail:vault:questions-migrated': '1',
  'papertrail:question:current': 'Melanoma',
  'papertrail:chat:lib_1': '[{"id":"a","role":"user","content":"hi"}]',
  'papertrail:lastLibrary:Melanoma': 'lib_1',
  'papertrail:lastLibrary:': 'lib_0',
  'papertrail:libSettings:lib_1': '{"topPercent":10}',
  'papertrail:theme': 'dark',
  'papertrail.library.view': 'table',
}

describe('legacyKey', () => {
  it('maps a Paperfox key to its pre-rename name', () => {
    expect(legacyKey('paperfox:chat:lib_1')).toBe('papertrail:chat:lib_1')
    expect(legacyKey('paperfox.library.view')).toBe('papertrail.library.view')
  })
  it('returns null for keys outside the Paperfox namespace', () => {
    expect(legacyKey('other:key')).toBeNull()
    expect(legacyKey('paperfoxes')).toBeNull()
  })
})

describe('migrateLegacyKeys', () => {
  it('copies every pre-rename key to its new name and keeps the old key', () => {
    const s = memoryStorage(LEGACY)
    expect(migrateLegacyKeys(s)).toBe(Object.keys(LEGACY).length)
    for (const [k, v] of Object.entries(LEGACY)) {
      expect(s.getItem(k.replace(/^papertrail/, 'paperfox'))).toBe(v)
      expect(s.getItem(k)).toBe(v)
    }
    expect(s.getItem(MIGRATED_FLAG)).toBe('1')
  })

  it('never overwrites a value that already has the new name', () => {
    const s = memoryStorage({ 'papertrail:theme': 'dark', 'paperfox:theme': 'light' })
    expect(migrateLegacyKeys(s)).toBe(0)
    expect(s.getItem('paperfox:theme')).toBe('light')
  })

  it('runs once, so a key removed after the migration does not come back', () => {
    const s = memoryStorage({ 'papertrail:lastLibrary:Melanoma': 'lib_1' })
    migrateLegacyKeys(s)
    s.removeItem('paperfox:lastLibrary:Melanoma')
    expect(migrateLegacyKeys(s)).toBe(0)
    expect(s.getItem('paperfox:lastLibrary:Melanoma')).toBeNull()
  })

  it('leaves keys of other apps alone', () => {
    const s = memoryStorage({ 'papertrails:x': '1', 'other:theme': 'dark' })
    expect(migrateLegacyKeys(s)).toBe(0)
    expect(s.length).toBe(3) // the two keys and the flag
  })

  it('does not throw when storage is missing or blocked, and retries on the next start', () => {
    expect(migrateLegacyKeys(undefined)).toBe(0)
    const s = memoryStorage({ 'papertrail:theme': 'dark' })
    const setItem = s.setItem
    s.setItem = () => { throw new DOMException('quota', 'QuotaExceededError') }
    expect(migrateLegacyKeys(s)).toBe(0)
    expect(s.getItem(MIGRATED_FLAG)).toBeNull()
    expect(s.getItem('papertrail:theme')).toBe('dark')
    s.setItem = setItem
    expect(migrateLegacyKeys(s)).toBe(1)
    expect(s.getItem('paperfox:theme')).toBe('dark')
  })

  it('moves a key when storage is too full to copy it, and copies the rest', () => {
    const chat = 'x'.repeat(100)
    // 141 characters stored; room for 60 more: enough for the theme and the flag, not for a second chat history.
    const s = fullStorage({ 'papertrail:chat:lib_1': chat, 'papertrail:theme': 'dark' }, 201)
    expect(migrateLegacyKeys(s)).toBe(2)
    expect(s.getItem('paperfox:chat:lib_1')).toBe(chat)
    expect(s.getItem('papertrail:chat:lib_1')).toBeNull()
    expect(s.getItem('paperfox:theme')).toBe('dark')
    expect(s.getItem('papertrail:theme')).toBe('dark')
    expect(s.getItem(MIGRATED_FLAG)).toBe('1')
  })
})

describe('start-up wiring', () => {
  it('main.ts migrates the keys before it creates the app', () => {
    const src = readSource('../main.ts')
    const call = src.indexOf('migrateLegacyKeys()')
    expect(call).toBeGreaterThan(-1)
    expect(call).toBeLessThan(src.indexOf('createApp('))
  })

  it('the theme script in index.html reads the pre-rename key and prefers the new one', () => {
    const script = readSource('../../index.html').match(/<script>(.*?)<\/script>/s)![1]
    const theme = (init: Record<string, string>) => {
      const root = { dataset: {} as Record<string, string> }
      new Function('localStorage', 'document', script)(memoryStorage(init), { documentElement: root })
      return root.dataset.theme
    }
    expect(theme({ 'papertrail:theme': 'dark' })).toBe('dark')
    expect(theme({ 'papertrail:theme': 'dark', 'paperfox:theme': 'light' })).toBe('light')
    expect(theme({})).toBeUndefined()
  })
})

describe('stores read migrated keys', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const s = memoryStorage(LEGACY)
    vi.stubGlobal('localStorage', s)
    migrateLegacyKeys(s)
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('library: last opened library per question and per-library settings', () => {
    expect(lastOpened('Melanoma')).toBe('lib_1')
    expect(lastOpened(null)).toBe('lib_0')
    expect(localStorage.getItem(LIB_SETTINGS_KEY('lib_1'))).toBe('{"topPercent":10}')
  })

  it('chat: history of a library', () => {
    expect(useChat().ensure('lib_1').map(t => t.content)).toEqual(['hi'])
  })

  it('results view: tiles or table', () => {
    expect(loadView()).toBe('table')
  })

  it('vault: current question and the done flag of the folder migration', async () => {
    const vault = useVault()
    await vault.upsert({ path: 'Questions/Melanoma/Question.md', kind: 'note', title: 'Question', content: '---\ntype: question\n---\nmelanoma' })
    await vault.upsert({ path: 'Questions/Alpha/Question.md', kind: 'note', title: 'Question', content: '---\ntype: question\n---\nalpha' })
    // A stray legacy note: migrate() would move it if the done flag were not found under its new name.
    await vault.upsert({ path: 'Notes/Question.md', kind: 'note', title: 'Question', content: 'legacy' })
    await vault.load()
    expect(vault.current).toBe('Melanoma')
    expect(vault.byPath('Notes/Question.md')).toBeTruthy()
  })
})

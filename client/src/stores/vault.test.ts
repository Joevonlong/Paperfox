import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { get, set } from 'idb-keyval'
import { useVault } from './vault'

vi.mock('idb-keyval', () => ({ get: vi.fn(async () => undefined), set: vi.fn(async () => undefined) }))

describe('vault persist', () => {
  beforeEach(() => { vi.useFakeTimers(); setActivePinia(createPinia()) })
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.mocked(set).mockReset() })

  it('records an error when set() throws synchronously (no IndexedDB)', () => {
    vi.mocked(set).mockImplementation(() => { throw new ReferenceError('indexedDB is not defined') })
    const vault = useVault()
    vault.persist()
    expect(() => vi.advanceTimersByTime(150)).not.toThrow()
    expect(vault.error).toBe('Saving to IndexedDB failed.')
  })

  it('records an error when the save is rejected', async () => {
    vi.mocked(set).mockRejectedValue(new Error('quota'))
    const vault = useVault()
    vault.persist()
    await vi.advanceTimersByTimeAsync(150)
    expect(vault.error).toBe('Saving to IndexedDB failed.')
  })
})

describe('vault load after the rename to Paperfox', () => {
  const note = { path: 'Notes/Ideas.md', kind: 'note' as const, title: 'Ideas', content: 'x', updatedAt: 1 }
  beforeEach(() => { vi.useFakeTimers(); setActivePinia(createPinia()) })
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.mocked(get).mockReset(); vi.mocked(set).mockReset() })

  it('reads the pre-rename IndexedDB entry when the new one is missing, and copies it', async () => {
    vi.mocked(get).mockImplementation(async k => (k === 'papertrail:vault:v1' ? [note] : undefined))
    vi.mocked(set).mockResolvedValue(undefined)
    const vault = useVault()
    await vault.load()
    expect(vault.byPath('Notes/Ideas.md')?.content).toBe('x')
    expect(set).toHaveBeenCalledWith('paperfox:vault:v1', [note])
    expect(set).not.toHaveBeenCalledWith('papertrail:vault:v1', expect.anything())
  })

  it('still shows the pre-rename notes when copying them fails', async () => {
    vi.mocked(get).mockImplementation(async k => (k === 'papertrail:vault:v1' ? [note] : undefined))
    vi.mocked(set).mockRejectedValue(new Error('quota'))
    const vault = useVault()
    await vault.load()
    expect(vault.byPath('Notes/Ideas.md')?.content).toBe('x')
    expect(vault.error).not.toMatch(/Could not open/)
  })

  it('prefers the new entry once it exists', async () => {
    vi.mocked(get).mockImplementation(async k => (k === 'paperfox:vault:v1' ? [] : [note]))
    vi.mocked(set).mockResolvedValue(undefined)
    const vault = useVault()
    await vault.load()
    expect(vault.byPath('Notes/Ideas.md')).toBeUndefined()
    expect(get).not.toHaveBeenCalledWith('papertrail:vault:v1')
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { set } from 'idb-keyval'
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

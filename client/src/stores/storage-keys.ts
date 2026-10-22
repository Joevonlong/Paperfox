// Browser storage keys across the rename to Paperfox. Keys used to start with "papertrail:" or "papertrail."
// (vault, current question, chat history, last library, library settings, theme, results view). main.ts runs
// migrateLegacyKeys() once before the app starts; the vault does the same for its IndexedDB entry (vault.ts).
// The old keys stay so an older version still finds its data, except where storage was too full for a second
// copy: those keys are moved. Remove the old keys, and this file, one MINOR release after the rename.
export const KEY_PREFIX = 'paperfox'
const LEGACY_PREFIX = 'papertrail'
const NAMESPACED = /^paperfox[:.]/
const LEGACY_NAMESPACED = /^papertrail[:.]/
/** Set once every legacy key has been copied; later removals of new keys must not bring old values back. */
export const MIGRATED_FLAG = 'paperfox:storage:legacy-keys-migrated'

/** "paperfox:chat:x" → "papertrail:chat:x"; null for keys outside the Paperfox namespace. */
export const legacyKey = (key: string): string | null =>
  NAMESPACED.test(key) ? LEGACY_PREFIX + key.slice(KEY_PREFIX.length) : null

/**
 * Copies each pre-rename localStorage key to its new name unless the new name already holds a value. When storage
 * is too full for the copy, the key is moved instead, so the value stays readable. Runs once per browser. Blocked
 * storage stops it silently; it then retries on the next start. Returns the number of keys copied or moved.
 */
export function migrateLegacyKeys(storage: Storage | undefined = globalThis.localStorage): number {
  if (!storage) return 0
  let copied = 0
  try {
    if (storage.getItem(MIGRATED_FLAG)) return 0
    const legacy: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i)
      if (k && LEGACY_NAMESPACED.test(k)) legacy.push(k)
    }
    for (const old of legacy) {
      const key = KEY_PREFIX + old.slice(LEGACY_PREFIX.length)
      const v = storage.getItem(old)
      if (v === null || storage.getItem(key) !== null) continue
      try {
        storage.setItem(key, v)
      } catch {
        // Full storage. Rewriting the old key needs no extra space, so it throws only when storage is blocked: stop
        // there and retry on the next start. Otherwise move the value; the new name is shorter, so it fits.
        storage.setItem(old, v)
        storage.removeItem(old)
        try { storage.setItem(key, v) } catch (e) { storage.setItem(old, v); throw e }
      }
      copied++
    }
    storage.setItem(MIGRATED_FLAG, '1')
    return copied
  } catch {
    return copied
  }
}

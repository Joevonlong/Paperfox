import { afterEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { closeDb, dbPath, getDb } from './db'

describe('dbPath (rename to Paperfox)', () => {
  const dirs: string[] = []
  const dir = () => { const d = mkdtempSync(join(tmpdir(), 'db-path-')); dirs.push(d); return d }
  afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }) })

  it('uses paperfox.sqlite in a fresh data dir', () => {
    const d = dir(); const log = vi.fn()
    expect(dbPath(d, log)).toBe(join(d, 'paperfox.sqlite'))
    expect(log).not.toHaveBeenCalled()
  })

  it('keeps using papertrail.sqlite when only the old file exists, and says so once', () => {
    const d = dir(); const log = vi.fn()
    writeFileSync(join(d, 'papertrail.sqlite'), '')
    expect(dbPath(d, log)).toBe(join(d, 'papertrail.sqlite'))
    expect(dbPath(d, log)).toBe(join(d, 'papertrail.sqlite'))
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0][0]).toContain('papertrail.sqlite')
  })

  it('prefers paperfox.sqlite when both files exist', () => {
    const d = dir(); const log = vi.fn()
    writeFileSync(join(d, 'papertrail.sqlite'), '')
    writeFileSync(join(d, 'paperfox.sqlite'), '')
    expect(dbPath(d, log)).toBe(join(d, 'paperfox.sqlite'))
    expect(log).not.toHaveBeenCalled()
  })

  it('getDb opens the old file of DATA_DIR and creates no new one', () => {
    const d = dir()
    const old = new Database(join(d, 'papertrail.sqlite'))
    old.exec('CREATE TABLE marker (x)')
    old.close()
    vi.stubEnv('DATA_DIR', d)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const db = getDb()
      expect(db.name).toBe(join(d, 'papertrail.sqlite'))
      expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'marker'").get()).toBeTruthy()
    } finally {
      closeDb(); vi.unstubAllEnvs(); warn.mockRestore()
    }
    expect(existsSync(join(d, 'paperfox.sqlite'))).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { USER_AGENT } from './version'

describe('USER_AGENT', () => {
  it('names the app and the version in package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
    expect(USER_AGENT).toBe(`Paperfox/${pkg.version}`)
  })
})

// The chat column talks to the library store only through these two calls:
//   useLibrary().currentSettings() → { weights, topPercent, threshold, filters }
//   useLibrary().applyProposal(p)   → { before, after } (top-10 paper ids)
// If the store lacks either call, this file falls back to the store fields (weights, threshold, top).
import type { Filters, LibPaper, Proposal, Weights } from '@shared/library'
import { DEFAULT_WEIGHTS } from '@shared/library'
import { summarizeProposal } from './summary'

export interface LibSettings { weights: Weights; topPercent: number; threshold: number; filters: Filters }
export interface ApplyResult { before: string[]; after: string[] }

/** The parts of the library store the chat uses (all optional, so the shim works with any store shape). */
export interface LibLike {
  libraryId: string | null
  weights?: Weights
  threshold?: number
  topPercent?: number
  filters?: Filters
  top?: LibPaper[]
  scored?: LibPaper[]
  papers?: LibPaper[]
  currentSettings?: () => LibSettings
  applyProposal?: (p: Proposal) => ApplyResult | Promise<ApplyResult>
}

const top10 = (lib: LibLike) => (lib.top ?? lib.scored ?? lib.papers ?? []).slice(0, 10).map(p => p.paper.id)

export function currentSettings(lib: LibLike): LibSettings {
  if (typeof lib.currentSettings === 'function') return lib.currentSettings()
  return { weights: { ...(lib.weights ?? DEFAULT_WEIGHTS) }, topPercent: lib.topPercent ?? 25, threshold: lib.threshold ?? 0.5, filters: { ...(lib.filters ?? {}) } }
}

export async function applyProposal(lib: LibLike, proposal: Proposal): Promise<ApplyResult> {
  // Q-3b: the store shows `rationale` in its "Applied from chat" banner, so hand it the clean user-facing summary
  const p: Proposal = { ...proposal, rationale: summarizeProposal(proposal, currentSettings(lib)) }
  if (typeof lib.applyProposal === 'function') return await lib.applyProposal(p)
  // Fallback when the store has no applyProposal: merge + normalize weights, set the pass rule; filters are left to the store.
  const before = top10(lib)
  if (p.weights && lib.weights) {
    const merged = { ...lib.weights, ...p.weights } as Weights
    const sum = Object.values(merged).reduce((s, v) => s + v, 0) || 1
    lib.weights = Object.fromEntries(Object.entries(merged).map(([k, v]) => [k, Math.round((v / sum) * 1000) / 1000])) as Weights
  }
  if (p.threshold != null) lib.threshold = p.threshold
  if (p.topPercent != null && 'topPercent' in lib) lib.topPercent = p.topPercent
  if (p.filters && 'filters' in lib) lib.filters = { ...p.filters }
  await Promise.resolve()
  return { before, after: top10(lib) }
}

export const movedIn = (r: ApplyResult) => r.after.filter(id => !r.before.includes(id)).length

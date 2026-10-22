// SQLite store (docs/architecture.md, Storage). Plain SQL schema; one file at ${DATA_DIR}/paperfox.sqlite.
import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export type DB = Database.Database

const SCHEMA = `
CREATE TABLE IF NOT EXISTS papers (
  id TEXT PRIMARY KEY, doi TEXT, pmid TEXT, pmcid TEXT, title TEXT NOT NULL, abstract TEXT, abstract_source TEXT,
  year INTEGER, publication_date TEXT, venue TEXT, type TEXT, cited_by_count INTEGER NOT NULL DEFAULT 0,
  citation_pct REAL, is_retracted INTEGER NOT NULL DEFAULT 0, is_oa INTEGER, oa_url TEXT, license TEXT,
  authors TEXT NOT NULL DEFAULT '[]', referenced_works TEXT NOT NULL DEFAULT '[]', updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS papers_doi ON papers(doi);
CREATE INDEX IF NOT EXISTS papers_pmid ON papers(pmid);
CREATE TABLE IF NOT EXISTS paper_ids (alias TEXT PRIMARY KEY, kind TEXT NOT NULL, paper_id TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS paper_ids_paper ON paper_ids(paper_id);
CREATE TABLE IF NOT EXISTS citations (citing_id TEXT NOT NULL, cited_id TEXT NOT NULL, PRIMARY KEY (citing_id, cited_id));
CREATE INDEX IF NOT EXISTS citations_cited ON citations(cited_id);
CREATE TABLE IF NOT EXISTS provenance (
  paper_id TEXT NOT NULL, run_id TEXT NOT NULL, route TEXT NOT NULL, via_seed_id TEXT, api TEXT, request_url TEXT,
  raw_hash TEXT, fetched_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS provenance_run ON provenance(run_id);
CREATE TABLE IF NOT EXISTS web_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT, url TEXT NOT NULL, domain TEXT, kind TEXT, title TEXT, snippet TEXT, query TEXT, raw_hash TEXT
);
CREATE TABLE IF NOT EXISTS embeddings (
  owner_type TEXT NOT NULL, owner_id TEXT NOT NULL, model TEXT NOT NULL, dims INTEGER NOT NULL, text_hash TEXT NOT NULL,
  dtype TEXT NOT NULL DEFAULT 'fp16', vec BLOB NOT NULL, PRIMARY KEY (owner_type, owner_id, model, dims, text_hash)
);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY, question TEXT NOT NULL, preset TEXT NOT NULL, facets TEXT, seed_ids TEXT, params TEXT, models TEXT,
  status TEXT NOT NULL DEFAULT 'running', snapshot TEXT, created_at TEXT NOT NULL, finished_at TEXT
);
CREATE TABLE IF NOT EXISTS candidates (
  run_id TEXT NOT NULL, paper_id TEXT NOT NULL, lane TEXT NOT NULL, routes TEXT, signals TEXT, features TEXT,
  score REAL, rank INTEGER, why_ranked TEXT, PRIMARY KEY (run_id, paper_id)
);
CREATE TABLE IF NOT EXISTS judgements (
  run_id TEXT NOT NULL, paper_id TEXT NOT NULL, model TEXT, prompt_hash TEXT, output TEXT NOT NULL, quote_chunk_id TEXT,
  quote_start INTEGER, quote_end INTEGER, verified INTEGER, PRIMARY KEY (run_id, paper_id)
);
CREATE TABLE IF NOT EXISTS feedback (run_id TEXT, paper_id TEXT, label TEXT, reason TEXT, created_at TEXT);
`

let db: DB | null = null

export function dataDir(): string {
  return process.env.DATA_DIR || './data'
}

const DB_FILE = 'paperfox.sqlite'
/** The file name before the rename to Paperfox. Remove this fallback one MINOR release after the rename. */
const LEGACY_DB_FILE = 'papertrail.sqlite'
const noted = new Set<string>()

/**
 * The SQLite file in `dir`. A data dir from before the rename has only the legacy file: keep using it in place
 * (with its -wal and -shm files) and say so once, so existing caches and runs stay readable.
 */
export function dbPath(dir: string, log: (msg: string) => void = console.warn): string {
  const path = join(dir, DB_FILE)
  const legacy = join(dir, LEGACY_DB_FILE)
  if (existsSync(path) || !existsSync(legacy)) return path
  if (!noted.has(legacy)) {
    noted.add(legacy)
    log(`[db] using ${legacy} from before the rename; stop the server and rename it (with its -wal and -shm files) to ${DB_FILE} to switch`)
  }
  return legacy
}

/** Opens (once) the SQLite file. Pass ':memory:' in tests. */
export function getDb(file?: string): DB {
  if (db) return db
  const path = file ?? (() => { mkdirSync(dataDir(), { recursive: true }); return dbPath(dataDir()) })()
  db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('synchronous = NORMAL')
  db.exec(SCHEMA)
  return db
}

export function closeDb() { db?.close(); db = null }

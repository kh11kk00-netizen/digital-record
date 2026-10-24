// Minimal D1-compatible adapter over node:sqlite so tests run the Worker's real SQL.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';

export function createD1(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec(readFileSync(new URL('../worker/migrations/0001_init.sql', import.meta.url), 'utf8'));
  const statement = (sql, args = []) => ({
    bind: (...values) => statement(sql, values),
    first: async () => db.prepare(sql).get(...args) ?? null,
    all: async () => ({results: db.prepare(sql).all(...args)}),
    run: async () => { const r = db.prepare(sql).run(...args); return {meta:{changes:r.changes}}; },
    _exec: () => db.prepare(sql).run(...args),
  });
  return {
    raw: db,
    prepare: (sql) => statement(sql),
    batch: async (statements) => {
      db.exec('BEGIN');
      try { const out = statements.map((s) => s._exec()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

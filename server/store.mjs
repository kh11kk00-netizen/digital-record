import {DatabaseSync} from 'node:sqlite';
import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';

// Usage accounting only: anonymous reader IDs, a hash of each secret, and counters.
// Never store images, extracted text, IP addresses or provider responses here.
const hash = (secret) => createHash('sha256').update(secret).digest();
const month = (date=new Date()) => date.toISOString().slice(0,7);
const day = (date=new Date()) => date.toISOString().slice(0,10);
export const TOKEN_PREFIX = 'dr1';

export function openStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), {recursive:true});
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, secret_hash BLOB NOT NULL, plan TEXT NOT NULL DEFAULT 'free',
      monthly_limit INTEGER, disabled INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, last_used_at TEXT);
    CREATE TABLE IF NOT EXISTS usage (
      user_id TEXT NOT NULL, period TEXT NOT NULL, reads INTEGER NOT NULL DEFAULT 0, refunds INTEGER NOT NULL DEFAULT 0,
      input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, cost_micro_usd INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, period));
    CREATE TABLE IF NOT EXISTS daily (
      day TEXT PRIMARY KEY, reads INTEGER NOT NULL DEFAULT 0, registrations INTEGER NOT NULL DEFAULT 0,
      input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, cost_micro_usd INTEGER NOT NULL DEFAULT 0);
  `);
  const q = {
    insertUser: db.prepare('INSERT INTO users (id, secret_hash, created_at) VALUES (?, ?, ?)'),
    user: db.prepare('SELECT id, secret_hash, plan, monthly_limit, disabled, created_at, last_used_at FROM users WHERE id = ?'),
    touch: db.prepare('UPDATE users SET last_used_at = ? WHERE id = ?'),
    usage: db.prepare('SELECT reads, refunds, input_tokens, output_tokens, cost_micro_usd FROM usage WHERE user_id = ? AND period = ?'),
    daily: db.prepare('SELECT reads, registrations, input_tokens, output_tokens, cost_micro_usd FROM daily WHERE day = ?'),
    bumpRead: db.prepare(`INSERT INTO usage (user_id, period, reads) VALUES (?, ?, 1)
      ON CONFLICT (user_id, period) DO UPDATE SET reads = reads + 1`),
    bumpDailyRead: db.prepare(`INSERT INTO daily (day, reads) VALUES (?, 1) ON CONFLICT (day) DO UPDATE SET reads = reads + 1`),
    bumpRegistration: db.prepare(`INSERT INTO daily (day, registrations) VALUES (?, 1) ON CONFLICT (day) DO UPDATE SET registrations = registrations + 1`),
    refund: db.prepare('UPDATE usage SET reads = MAX(reads - 1, 0), refunds = refunds + 1 WHERE user_id = ? AND period = ?'),
    refundDaily: db.prepare('UPDATE daily SET reads = MAX(reads - 1, 0) WHERE day = ?'),
    cost: db.prepare('UPDATE usage SET input_tokens = input_tokens + ?, output_tokens = output_tokens + ?, cost_micro_usd = cost_micro_usd + ? WHERE user_id = ? AND period = ?'),
    costDaily: db.prepare('UPDATE daily SET input_tokens = input_tokens + ?, output_tokens = output_tokens + ?, cost_micro_usd = cost_micro_usd + ? WHERE day = ?'),
    setPlan: db.prepare('UPDATE users SET plan = ? WHERE id = ?'),
    setLimit: db.prepare('UPDATE users SET monthly_limit = ? WHERE id = ?'),
    setDisabled: db.prepare('UPDATE users SET disabled = ? WHERE id = ?'),
    report: db.prepare(`SELECT u.plan AS plan, COUNT(*) AS users, SUM(g.reads) AS reads, SUM(g.refunds) AS refunds,
      SUM(g.input_tokens) AS input_tokens, SUM(g.output_tokens) AS output_tokens, SUM(g.cost_micro_usd) AS cost_micro_usd
      FROM usage g JOIN users u ON u.id = g.user_id WHERE g.period = ? GROUP BY u.plan ORDER BY u.plan`),
    topUsers: db.prepare(`SELECT user_id, reads, cost_micro_usd FROM usage WHERE period = ? ORDER BY reads DESC LIMIT ?`),
  };
  const tx = (fn) => { db.exec('BEGIN IMMEDIATE'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  const usageOf = (id, period=month()) => q.usage.get(id, period) ?? {reads:0, refunds:0, input_tokens:0, output_tokens:0, cost_micro_usd:0};
  const dailyOf = (d=day()) => q.daily.get(d) ?? {reads:0, registrations:0, input_tokens:0, output_tokens:0, cost_micro_usd:0};

  return {
    close: () => db.close(),
    month, day, usageOf, dailyOf,
    /** Creates an anonymous reader identity. The secret is returned once and only its hash is kept. */
    register(maxPerDay) {
      return tx(() => {
        if (dailyOf().registrations >= maxPerDay) return null;
        const id = randomBytes(12).toString('base64url');
        const secret = randomBytes(32).toString('base64url');
        q.insertUser.run(id, hash(secret), new Date().toISOString());
        q.bumpRegistration.run(day());
        return {id, token: `${TOKEN_PREFIX}.${id}.${secret}`};
      });
    },
    authenticate(token) {
      const parts = typeof token === 'string' ? token.split('.') : [];
      if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX || !/^[\w-]{16}$/.test(parts[1]) || !/^[\w-]{43}$/.test(parts[2])) return null;
      const user = q.user.get(parts[1]);
      // Compare against a dummy hash when the user is missing so timing does not reveal valid IDs.
      const expected = user ? Buffer.from(user.secret_hash) : hash('missing');
      return timingSafeEqual(expected, hash(parts[2])) && user ? user : null;
    },
    /** Atomically reserves one read against the user's monthly limit and the global daily caps. */
    reserve(user, limit, caps) {
      return tx(() => {
        const period = month(), today = day();
        const used = usageOf(user.id, period).reads;
        if (used >= limit) return {ok:false, error:'QUOTA_EXCEEDED', used};
        const d = dailyOf(today);
        if (d.reads >= caps.dailyReads || d.cost_micro_usd >= caps.dailyBudgetMicroUsd) return {ok:false, error:'DAILY_LIMIT', used};
        q.bumpRead.run(user.id, period);
        q.bumpDailyRead.run(today);
        q.touch.run(new Date().toISOString(), user.id);
        return {ok:true, used:used + 1, period, today};
      });
    },
    /** Gives back a reservation when the provider failed before doing billable work. */
    refund(user, reservation) {
      tx(() => { q.refund.run(user.id, reservation.period); q.refundDaily.run(reservation.today); });
    },
    recordCost(user, reservation, {inputTokens, outputTokens, costMicroUsd}) {
      tx(() => {
        q.cost.run(inputTokens, outputTokens, costMicroUsd, user.id, reservation.period);
        q.costDaily.run(inputTokens, outputTokens, costMicroUsd, reservation.today);
      });
    },
    // Admin operations: used by server/admin.mjs on the host only, never exposed over HTTP.
    user: (id) => q.user.get(id) ?? null,
    setPlan: (id, plan) => q.setPlan.run(plan, id).changes > 0,
    setLimit: (id, limit) => q.setLimit.run(limit, id).changes > 0,
    setDisabled: (id, disabled) => q.setDisabled.run(disabled ? 1 : 0, id).changes > 0,
    report: (period=month()) => q.report.all(period),
    topUsers: (period=month(), n=10) => q.topUsers.all(period, n),
  };
}

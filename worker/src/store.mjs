// D1 storage. Each limit check is a single conditional SQL statement, so concurrent requests
// across Worker isolates cannot exceed a limit.
/** Same tables as migrations/0001_init.sql; created on first use so a dashboard-only deploy needs no SQL step. */
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users ( id TEXT PRIMARY KEY, secret_hash TEXT NOT NULL, plan TEXT NOT NULL DEFAULT 'free', monthly_limit INTEGER, disabled INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, last_used_at TEXT, rl_window INTEGER NOT NULL DEFAULT 0, rl_count INTEGER NOT NULL DEFAULT 0 )`,
  `CREATE TABLE IF NOT EXISTS usage ( user_id TEXT NOT NULL, period TEXT NOT NULL, reads INTEGER NOT NULL DEFAULT 0, refunds INTEGER NOT NULL DEFAULT 0, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, cost_micro_usd INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, period) )`,
  `CREATE TABLE IF NOT EXISTS daily ( day TEXT PRIMARY KEY, reads INTEGER NOT NULL DEFAULT 0, registrations INTEGER NOT NULL DEFAULT 0, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0, cost_micro_usd INTEGER NOT NULL DEFAULT 0 )`,
];

const EMPTY_USAGE = {reads:0, refunds:0, input_tokens:0, output_tokens:0, cost_micro_usd:0};

export function d1Store(db) {
  const one = (sql, ...args) => db.prepare(sql).bind(...args).first();
  const run = (sql, ...args) => db.prepare(sql).bind(...args).run();
  return {
    ensureSchema: () => db.batch(SCHEMA.map((sql) => db.prepare(sql))),
    /** Counts a registration against the daily cap; returns false when the cap is reached. */
    async claimRegistration(day, maxPerDay) {
      if (maxPerDay < 1) return false;
      const row = await one(`INSERT INTO daily (day, registrations) VALUES (?1, 1)
        ON CONFLICT (day) DO UPDATE SET registrations = registrations + 1 WHERE daily.registrations < ?2
        RETURNING registrations`, day, maxPerDay);
      return !!row;
    },
    insertUser: (id, secretHash, createdAt) => run('INSERT INTO users (id, secret_hash, created_at) VALUES (?1, ?2, ?3)', id, secretHash, createdAt),
    user: (id) => one('SELECT id, secret_hash, plan, monthly_limit, disabled, created_at, last_used_at FROM users WHERE id = ?1', id),
    async usageOf(userId, period) {
      return (await one('SELECT reads, refunds, input_tokens, output_tokens, cost_micro_usd FROM usage WHERE user_id = ?1 AND period = ?2', userId, period)) ?? {...EMPTY_USAGE};
    },
    /** Per-user requests per minute; returns false when over the limit. */
    async claimRate(userId, minute, max) {
      const row = await one(`UPDATE users SET rl_count = CASE WHEN rl_window = ?2 THEN rl_count + 1 ELSE 1 END, rl_window = ?2
        WHERE id = ?1 AND (rl_window <> ?2 OR rl_count < ?3) RETURNING rl_count`, userId, minute, max);
      return !!row;
    },
    /** Reserves one read in today's global counters unless a daily cap is reached. */
    async claimDaily(day, maxReads, maxCostMicroUsd) {
      if (maxReads < 1) return false;
      const row = await one(`INSERT INTO daily (day, reads) VALUES (?1, 1)
        ON CONFLICT (day) DO UPDATE SET reads = reads + 1 WHERE daily.reads < ?2 AND daily.cost_micro_usd < ?3
        RETURNING reads`, day, maxReads, maxCostMicroUsd);
      return !!row;
    },
    /** Reserves one read against the user's monthly limit; returns the new count, or null when the limit is reached. */
    async claimUserRead(userId, period, limit, nowIso) {
      if (limit < 1) return null;
      const row = await one(`INSERT INTO usage (user_id, period, reads) VALUES (?1, ?2, 1)
        ON CONFLICT (user_id, period) DO UPDATE SET reads = reads + 1 WHERE usage.reads < ?3
        RETURNING reads`, userId, period, limit);
      if (row) await run('UPDATE users SET last_used_at = ?2 WHERE id = ?1', userId, nowIso);
      return row ? row.reads : null;
    },
    async monthCost(period) {
      return (await one("SELECT COALESCE(SUM(cost_micro_usd), 0) AS cost FROM daily WHERE substr(day, 1, 7) = ?1", period)).cost;
    },
    releaseDaily: (day) => run('UPDATE daily SET reads = MAX(reads - 1, 0) WHERE day = ?1', day),
    /** Gives back a reservation when the provider failed before doing billable work. */
    refund: (userId, period, day) => db.batch([
      db.prepare('UPDATE usage SET reads = MAX(reads - 1, 0), refunds = refunds + 1 WHERE user_id = ?1 AND period = ?2').bind(userId, period),
      db.prepare('UPDATE daily SET reads = MAX(reads - 1, 0) WHERE day = ?1').bind(day),
    ]),
    recordCost: (userId, period, day, {inputTokens, outputTokens, costMicroUsd}) => db.batch([
      db.prepare('UPDATE usage SET input_tokens = input_tokens + ?1, output_tokens = output_tokens + ?2, cost_micro_usd = cost_micro_usd + ?3 WHERE user_id = ?4 AND period = ?5')
        .bind(inputTokens, outputTokens, costMicroUsd, userId, period),
      db.prepare('UPDATE daily SET input_tokens = input_tokens + ?1, output_tokens = output_tokens + ?2, cost_micro_usd = cost_micro_usd + ?3 WHERE day = ?4')
        .bind(inputTokens, outputTokens, costMicroUsd, day),
    ]),
  };
}

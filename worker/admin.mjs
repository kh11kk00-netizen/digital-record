// Owner-only administration through `wrangler d1 execute` (uses your Cloudflare login, never exposed over HTTP).
// Usage: node admin.mjs report [YYYY-MM] | user <id> | set-plan <id> <plan> | set-limit <id> <n|default> | disable <id> | enable <id>
// Add --local to run against the local development database.
import {spawnSync} from 'node:child_process';

const args = process.argv.slice(2).filter((a) => a !== '--local');
const target = process.argv.includes('--local') ? '--local' : '--remote';
const [command, ...rest] = args;
const fail = (message) => { console.error(message); process.exit(1); };
const id = (value) => (/^[\w-]{16}$/.test(value ?? '') ? value : fail('Invalid user id'));
const period = (value) => (/^\d{4}-\d{2}$/.test(value) ? value : fail('Period must be YYYY-MM'));

export function sqlFor(command, rest, now = new Date()) {
  switch (command) {
    case 'report': {
      const month = period(rest[0] ?? now.toISOString().slice(0, 7));
      return [
      `SELECT u.plan, COUNT(*) AS users, SUM(g.reads) AS reads, SUM(g.refunds) AS refunds, SUM(g.input_tokens) AS input_tokens, SUM(g.output_tokens) AS output_tokens, ROUND(SUM(g.cost_micro_usd) / 1e6, 4) AS est_cost_usd FROM usage g JOIN users u ON u.id = g.user_id WHERE g.period = '${month}' GROUP BY u.plan`,
      `SELECT day, reads, registrations, ROUND(cost_micro_usd / 1e6, 4) AS est_cost_usd FROM daily WHERE substr(day, 1, 7) = '${month}' ORDER BY day DESC LIMIT 31`,
      `SELECT user_id, reads, refunds, ROUND(cost_micro_usd / 1e6, 4) AS est_cost_usd FROM usage WHERE period = '${month}' ORDER BY reads DESC LIMIT 20`,
      ];
    }
    case 'user': return [`SELECT u.id, u.plan, u.monthly_limit, u.disabled, u.created_at, u.last_used_at, g.period, g.reads, g.refunds, ROUND(g.cost_micro_usd / 1e6, 4) AS est_cost_usd FROM users u LEFT JOIN usage g ON g.user_id = u.id WHERE u.id = '${id(rest[0])}' ORDER BY g.period DESC`];
    case 'set-plan': {
      const plan = /^[a-z][a-z0-9_-]{0,31}$/.test(rest[1] ?? '') ? rest[1] : fail('Invalid plan name');
      return [`UPDATE users SET plan = '${plan}' WHERE id = '${id(rest[0])}'`];
    }
    case 'set-limit': {
      const raw = rest[1];
      const limit = raw === 'default' ? 'NULL' : (/^\d{1,6}$/.test(raw ?? '') ? raw : fail('Limit must be a non-negative integer or "default"'));
      return [`UPDATE users SET monthly_limit = ${limit} WHERE id = '${id(rest[0])}'`];
    }
    case 'disable': case 'enable': return [`UPDATE users SET disabled = ${command === 'disable' ? 1 : 0} WHERE id = '${id(rest[0])}'`];
    default: return null;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const statements = sqlFor(command, rest);
  if (!statements) fail('Usage: node admin.mjs report [YYYY-MM] | user <id> | set-plan <id> <plan> | set-limit <id> <n|default> | disable <id> | enable <id> [--local]');
  for (const sql of statements) {
    const result = spawnSync('npx', ['wrangler', 'd1', 'execute', 'digital-record-reader', target, '--command', sql], {stdio:'inherit'});
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}

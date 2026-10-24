// Host-only administration. Run on the server, e.g. `fly ssh console -C "node admin.mjs report"`.
import {openStore} from './store.mjs';
import {loadConfig} from './config.mjs';

const config = loadConfig({...process.env, GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? 'unused'});
const store = openStore(config.dbPath);
const usd = (micro) => `$${(Number(micro ?? 0) / 1e6).toFixed(4)}`;
const [command, ...args] = process.argv.slice(2);
const need = (value, label) => { if (!value) { console.error(`Missing ${label}`); process.exit(1); } return value; };

try {
  switch (command) {
    case 'report': {
      const period = args[0] ?? store.month();
      console.log(`Period ${period}`);
      for (const row of store.report(period)) {
        console.log(`  ${row.plan}: users=${row.users} reads=${row.reads} refunds=${row.refunds} in=${row.input_tokens} out=${row.output_tokens} cost=${usd(row.cost_micro_usd)}`);
      }
      const today = store.dailyOf();
      console.log(`Today ${store.day()}: reads=${today.reads}/${config.dailyReads} registrations=${today.registrations}/${config.dailyRegistrations} cost=${usd(today.cost_micro_usd)}/$${config.dailyBudgetUsd}`);
      console.log('Top users:');
      for (const row of store.topUsers(period, 10)) console.log(`  ${row.user_id} reads=${row.reads} cost=${usd(row.cost_micro_usd)}`);
      break;
    }
    case 'user': {
      const user = store.user(need(args[0], 'user id'));
      if (!user) { console.error('Not found'); process.exit(1); }
      const usage = store.usageOf(user.id);
      const limit = user.monthly_limit ?? config.plans[user.plan]?.monthlyReads ?? 0;
      console.log({id:user.id, plan:user.plan, limit, override:user.monthly_limit, disabled:!!user.disabled, created:user.created_at, lastUsed:user.last_used_at, month:{...usage, cost:usd(usage.cost_micro_usd)}});
      break;
    }
    case 'set-plan': {
      const [id, plan] = [need(args[0], 'user id'), need(args[1], 'plan')];
      if (!config.plans[plan]) { console.error(`Unknown plan. Known: ${Object.keys(config.plans).join(', ')}`); process.exit(1); }
      console.log(store.setPlan(id, plan) ? 'OK' : 'Not found');
      break;
    }
    case 'set-limit': {
      const id = need(args[0], 'user id'), raw = need(args[1], 'limit or "default"');
      const limit = raw === 'default' ? null : Number(raw);
      if (limit !== null && (!Number.isInteger(limit) || limit < 0)) { console.error('Limit must be a non-negative integer'); process.exit(1); }
      console.log(store.setLimit(id, limit) ? 'OK' : 'Not found');
      break;
    }
    case 'disable': case 'enable':
      console.log(store.setDisabled(need(args[0], 'user id'), command === 'disable') ? 'OK' : 'Not found');
      break;
    default:
      console.log('Usage: node admin.mjs report [YYYY-MM] | user <id> | set-plan <id> <plan> | set-limit <id> <n|default> | disable <id> | enable <id>');
  }
} finally { store.close(); }

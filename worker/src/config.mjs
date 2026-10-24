const integer = (raw, fallback, name) => {
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < 0) throw Error(`${name} must be a non-negative integer`);
  return value;
};
const number = (raw, fallback, name) => {
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isFinite(value) || value < 0) throw Error(`${name} must be a non-negative number`);
  return value;
};

/** Default plans. Override with OCR_PLANS='{"free":{"monthlyReads":20},"paid":{"monthlyReads":200}}'. */
export const DEFAULT_PLANS = {free:{monthlyReads:10}, paid:{monthlyReads:200}};

/** All limits come from Worker variables (wrangler.toml [vars]) and secrets, so they change without code edits. */
export function loadConfig(env) {
  const plans = env.OCR_PLANS ? (typeof env.OCR_PLANS === 'string' ? JSON.parse(env.OCR_PLANS) : env.OCR_PLANS) : DEFAULT_PLANS;
  for (const [name, plan] of Object.entries(plans)) {
    if (!/^[a-z][a-z0-9_-]{0,31}$/.test(name) || !Number.isInteger(plan?.monthlyReads) || plan.monthlyReads < 0) throw Error(`Invalid plan ${name}`);
  }
  if (!plans.free) throw Error('OCR_PLANS must define a "free" plan');
  const model = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  if (!/^[\w.-]+$/.test(model)) throw Error('Invalid model name');
  const inviteCode = env.OCR_INVITE_CODE?.trim() || '';
  if (inviteCode && inviteCode.length < 12) throw Error('OCR_INVITE_CODE must be at least 12 characters');
  return {
    key: env.GEMINI_API_KEY?.trim() || '',
    model,
    inviteCode,
    plans,
    dailyReads: integer(env.OCR_DAILY_READS, 300, 'OCR_DAILY_READS'),
    dailyBudgetUsd: number(env.OCR_DAILY_BUDGET_USD, 1, 'OCR_DAILY_BUDGET_USD'),
    // Ceiling on estimated Gemini spend per calendar month (UTC), across all users. On the free tier
    // nothing is billed; the estimate (at paid prices) still caps usage and informs future pricing.
    monthlyBudgetUsd: number(env.OCR_MONTHLY_BUDGET_USD, 5, 'OCR_MONTHLY_BUDGET_USD'),
    dailyRegistrations: integer(env.OCR_DAILY_REGISTRATIONS, 100, 'OCR_DAILY_REGISTRATIONS'),
    registrationsPerIpPerHour: integer(env.OCR_REGISTRATIONS_PER_IP_HOUR, 5, 'OCR_REGISTRATIONS_PER_IP_HOUR'),
    requestsPerUserPerMinute: integer(env.OCR_REQUESTS_PER_USER_MINUTE, 4, 'OCR_REQUESTS_PER_USER_MINUTE'),
    // USD per million tokens, used only to estimate cost. Check https://ai.google.dev/gemini-api/docs/pricing.
    prices: {
      inputUsdPerM: number(env.GEMINI_INPUT_USD_PER_M, 0.30, 'GEMINI_INPUT_USD_PER_M'),
      outputUsdPerM: number(env.GEMINI_OUTPUT_USD_PER_M, 2.50, 'GEMINI_OUTPUT_USD_PER_M'),
    },
  };
}

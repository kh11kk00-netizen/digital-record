import {resolve} from 'node:path';

const positiveInt = (raw, fallback, name) => {
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < 0) throw Error(`${name} must be a non-negative integer`);
  return value;
};
const positiveNumber = (raw, fallback, name) => {
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isFinite(value) || value < 0) throw Error(`${name} must be a non-negative number`);
  return value;
};

/** Default plans. Override with OCR_PLANS='{"free":{"monthlyReads":10},"paid":{"monthlyReads":200}}'. */
export const DEFAULT_PLANS = {free:{monthlyReads:10}, paid:{monthlyReads:200}};

/** All limits are adjustable through environment variables without code changes. */
export function loadConfig(env) {
  const plans = env.OCR_PLANS ? JSON.parse(env.OCR_PLANS) : DEFAULT_PLANS;
  for (const [name, plan] of Object.entries(plans)) {
    if (!/^[a-z][a-z0-9_-]{0,31}$/.test(name) || !Number.isInteger(plan?.monthlyReads) || plan.monthlyReads < 0) throw Error(`Invalid plan ${name}`);
  }
  if (!plans.free) throw Error('OCR_PLANS must define a "free" plan');
  const model = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  if (!/^[\w.-]+$/.test(model)) throw Error('Invalid model name');
  const inviteCode = env.OCR_INVITE_CODE?.trim() || '';
  if (inviteCode && inviteCode.length < 12) throw Error('OCR_INVITE_CODE must be at least 12 characters');
  return {
    key: env.GEMINI_API_KEY?.trim(),
    model,
    dbPath: resolve(env.OCR_DB_PATH ?? 'server-data/reader.db'),
    port: positiveInt(env.PORT, 8787, 'PORT'),
    host: env.HOST ?? '127.0.0.1',
    // Header set by the hosting proxy with the real client IP (e.g. fly-client-ip). Leave empty when not behind a proxy.
    clientIpHeader: env.OCR_CLIENT_IP_HEADER?.toLowerCase() || '',
    inviteCode,
    plans,
    dailyReads: positiveInt(env.OCR_DAILY_READS, 300, 'OCR_DAILY_READS'),
    dailyBudgetUsd: positiveNumber(env.OCR_DAILY_BUDGET_USD, 1, 'OCR_DAILY_BUDGET_USD'),
    // Hard ceiling on estimated Gemini spend per calendar month (UTC), across all users.
    monthlyBudgetUsd: positiveNumber(env.OCR_MONTHLY_BUDGET_USD, 5, 'OCR_MONTHLY_BUDGET_USD'),
    dailyRegistrations: positiveInt(env.OCR_DAILY_REGISTRATIONS, 100, 'OCR_DAILY_REGISTRATIONS'),
    registrationsPerIpPerHour: positiveInt(env.OCR_REGISTRATIONS_PER_IP_HOUR, 5, 'OCR_REGISTRATIONS_PER_IP_HOUR'),
    requestsPerUserPerMinute: positiveInt(env.OCR_REQUESTS_PER_USER_MINUTE, 4, 'OCR_REQUESTS_PER_USER_MINUTE'),
    maxConcurrent: positiveInt(env.OCR_MAX_CONCURRENT, 4, 'OCR_MAX_CONCURRENT') || 1,
    // USD per million tokens, used only to estimate cost. Check https://ai.google.dev/gemini-api/docs/pricing.
    prices: {
      inputUsdPerM: positiveNumber(env.GEMINI_INPUT_USD_PER_M, 0.30, 'GEMINI_INPUT_USD_PER_M'),
      outputUsdPerM: positiveNumber(env.GEMINI_OUTPUT_USD_PER_M, 2.50, 'GEMINI_OUTPUT_USD_PER_M'),
    },
  };
}

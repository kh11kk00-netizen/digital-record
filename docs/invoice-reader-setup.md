# Invoice reader: Cloudflare Workers + D1 (free plan) and Gemini free tier

The reader is a Cloudflare Worker in `worker/` with a D1 database for usage counters. The pilot runs entirely on free plans with **no payment method attached anywhere**, so nothing can be billed: when a free limit is reached, requests fail instead of being charged.

- Gemini key: created in Google AI Studio in a project **without** a billing account. Stored only as a Worker secret.
- The app knows only the public base URL (`EXPO_PUBLIC_OCR_URL`), baked in at build time for the `pilot` profile.
- Free-tier Gemini content may be used by Google to improve its products and may be reviewed by people, so the pilot uses **fictional invoices without personal data only**.

## How users and quotas work

- First read: the app calls `POST /v1/register` (with the pilot invite code) and receives an anonymous token `dr1.<id>.<secret>`. No name, email or phone number. The app keeps it in the Keychain/Keystore (this device only, excluded from backups); resetting the app deletes it.
- D1 stores only: the ID, a SHA-256 hash of the secret, plan, optional per-user limit, disabled flag, timestamps, a per-minute request counter, and monthly/daily counters (reads, refunds, input/output tokens, estimated cost). Never images, extracted text, IPs or provider responses. The Worker logs nothing and Workers observability is off.
- Every limit is one atomic SQL statement, so parallel requests across isolates cannot exceed it.
- Provider failures (5xx, 429, network) are refunded. A completed provider call counts even if nothing readable came back.
- Estimated cost uses Gemini's `usageMetadata` at paid-tier prices. Nothing is billed on the free tier; the estimate caps usage and informs future pricing.
- The per-IP registration limit lives in isolate memory only (best effort). The hard protections are the invite code, the daily registration cap and the per-user limits.

## Limits (`worker/wrangler.toml` `[vars]`, no code change)

| Variable | Pilot value | Meaning |
|---|---|---|
| `OCR_PLANS` | free 20, paid 200 | Reads per calendar month (UTC) per plan |
| `OCR_DAILY_READS` | 100 | Global reads per UTC day |
| `OCR_DAILY_BUDGET_USD` | 0.5 | Global estimated spend per UTC day |
| `OCR_MONTHLY_BUDGET_USD` | 4 | Global estimated spend per UTC month |
| `OCR_DAILY_REGISTRATIONS` | 30 | New anonymous IDs per day |
| `OCR_REGISTRATIONS_PER_IP_HOUR` | 5 | In-memory, best effort |
| `OCR_REQUESTS_PER_USER_MINUTE` | 4 | Per user |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Model |

Images are limited to 2,000,000 base64 characters (about 1.5 MB). The app resizes photos to 1600 px JPEG first, which keeps each request well inside the free plan's 10 ms CPU limit (about 3 ms measured for a typical photo).

## Deploy (owner, about 10 minutes, no card)

1. Create a free Cloudflare account. Do not add a payment method.
2. In Google AI Studio, create an API key in a project with **no billing account**. Do not link billing.
3. From the repository:

```bash
cd worker
npm install
npx wrangler login                                   # opens the browser
npx wrangler d1 create digital-record-reader         # copy database_id into wrangler.toml
npx wrangler d1 migrations apply digital-record-reader --remote
npx wrangler secret put GEMINI_API_KEY               # paste the key; it is not shown or saved locally
npx wrangler secret put OCR_INVITE_CODE              # 12+ characters, shared with testers only
npx wrangler deploy                                  # prints https://digital-record-reader.<subdomain>.workers.dev
curl https://digital-record-reader.<subdomain>.workers.dev/health
```

Then the URL goes into `eas.json` `build.pilot.env.EXPO_PUBLIC_OCR_URL` (the URL is public; the key is not in it).

## Administration (your Cloudflare login, not exposed over HTTP)

```bash
cd worker
node admin.mjs report            # this month by plan, daily totals, top users
node admin.mjs user <id>
node admin.mjs set-limit <id> 40 # or: default
node admin.mjs set-plan <id> paid
node admin.mjs disable <id>
```

## Verification

`npm run test:regressions` runs the Worker's real SQL against SQLite: invite gating, token forgery, per-user monthly limits and month rollover, concurrent reservations, per-minute limits, refunds, cost accounting, daily and monthly caps, and that stored data contains no image, text, IP or secret. `npm run reader:dev` runs the Worker locally on workerd with a local D1.

## Releasing a new pilot build (testers only)

- GitHub → Actions → **Build iOS and Android pilot** → Run workflow (on `main`). It runs typecheck and tests, refuses any submit profile other than the Play **internal** track, builds both platforms with the `pilot` profile (reader URL included), and uploads automatically: iOS to TestFlight (app 6825120606), Android to Google Play internal testing (`com.kh11kk.digitalrecord`, release status completed). Version codes increase automatically on EAS, so an existing version (such as 8) is never uploaded again.
- To re-upload one specific existing Android build to internal testing, put its EAS build ID in `.github/pilot-ops/android-build-id.txt` on the pilot branch and push.
- Nothing here publishes to production or the public.

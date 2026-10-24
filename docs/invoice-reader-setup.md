# Invoice reader: hosting, limits and usage accounting

The reader is a small Node 22.13+ service in `server/`. The Gemini key lives only in the server's secret store. The app only knows the public HTTPS base URL (`EXPO_PUBLIC_OCR_URL`), which is baked in at build time from the EAS environment.

## How users and quotas work

- On the first read, the app calls `POST /v1/register` and receives an anonymous token `dr1.<id>.<secret>`. No name, email or phone number. The app keeps it in the Keychain/Keystore (`expo-secure-store`, this-device-only, excluded from Android backup). Resetting the app deletes it.
- The server stores only: the ID, a SHA-256 hash of the secret, plan, optional per-user limit, disabled flag, timestamps, and monthly/daily counters (reads, refunds, input/output tokens, estimated cost). Never images, extracted text, IPs or provider responses. Nothing is logged per request.
- `POST /v1/extract` reserves one read atomically before calling Gemini. Provider failures (5xx, 429, network) are refunded. A completed provider call counts even if nothing readable came back, because it is billed.
- Cost is computed from Gemini's `usageMetadata` (thinking tokens billed as output) with the prices in `GEMINI_INPUT_USD_PER_M` / `GEMINI_OUTPUT_USD_PER_M`.
- Pilot gate: when `OCR_INVITE_CODE` is set, registration requires it (entered once per device). Remove it later for the public free tier, after adding App Attest / Play Integrity.

## Limits (all environment variables, no code change)

| Variable | Default | Meaning |
|---|---|---|
| `OCR_PLANS` | `{"free":{"monthlyReads":10},"paid":{"monthlyReads":200}}` | Reads per calendar month (UTC) per plan |
| `OCR_DAILY_READS` | 300 | Global reads per UTC day |
| `OCR_DAILY_BUDGET_USD` | 1 | Global estimated Gemini spend per UTC day; reads stop when reached |
| `OCR_DAILY_REGISTRATIONS` | 100 | New anonymous IDs per day |
| `OCR_REGISTRATIONS_PER_IP_HOUR` | 5 | In-memory only; IPs are never written to disk |
| `OCR_REQUESTS_PER_USER_MINUTE` | 4 | Per-user burst limit; one request in flight per user |
| `OCR_MAX_CONCURRENT` | 4 | Provider calls in parallel |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Model name |
| `OCR_CLIENT_IP_HEADER` | empty | Proxy header with the client IP (`fly-client-ip` on Fly.io) |

## Administration (on the host only, not exposed over HTTP)

```bash
fly ssh console -C "node admin.mjs report"            # this month by plan, today vs caps, top users
fly ssh console -C "node admin.mjs user <id>"
fly ssh console -C "node admin.mjs set-plan <id> paid"
fly ssh console -C "node admin.mjs set-limit <id> 50"  # or: default
fly ssh console -C "node admin.mjs disable <id>"
```

## Deploying on Fly.io

```bash
cd server
fly launch --no-deploy --copy-config          # keeps fly.toml; pick a unique app name if taken
fly volumes create reader_data --size 1 --region fra
fly secrets set GEMINI_API_KEY=...             # type it yourself; never in git, chat, eas.json or EXPO_PUBLIC_*
fly secrets set OCR_INVITE_CODE=...            # 12+ characters, shared with pilot testers only
fly deploy
curl https://<app>.fly.dev/health
```

Then set `EXPO_PUBLIC_OCR_URL=https://<app>.fly.dev` in the EAS `preview` environment (pilot profile). Leave production unset until the pilot passes. Run one machine only: the counters are a single SQLite file on the volume.

## Verification

`npm run test:regressions` covers registration and invite gating, token forgery, per-user monthly limits across restarts, refunds, cost accounting, the daily budget stop, the admin tool, and that the database holds no image, text or secret. Provider responses are mocked, so a real device test with real invoices is still required.

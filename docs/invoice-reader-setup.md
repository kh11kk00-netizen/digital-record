# Private invoice reading pilot

This change implements the app review flow and a separate Node 22+ reader. It does not deploy a server or enable OCR in an already installed build. Model: `gemini-3.5-flash-lite` (confirmed by the owner's text smoke test). Real image extraction still needs an end-to-end device test.

## Start in the existing Codespace terminal

The owner has already exported `GEMINI_API_KEY`. Do not paste that key in chat, git, client code, or any `EXPO_PUBLIC_` variable.

Generate a separate test access code and start the reader:

```bash
read -r -s -p "Choose a private access code (24+ characters): " OCR_ACCESS_TOKEN
export OCR_ACCESS_TOKEN
echo
npm run reader:start
```

Choose your own access code; enter the same code in the app's private test access-code field. It is held in screen memory, never written to records or backups. The reader fails closed without a valid server secret. `/health` discloses only readiness; `/extract` requires the test code.

Forward port **8787** in Codespaces. A physical device needs an HTTPS endpoint accessible to it (Codespaces public port for the private pilot, protected by the strong test code). Codespaces must remain running. Do not put real personal receipts into this free pilot. For reliable hosting use one Node process with a persistent writable volume, HTTPS and body/access logging disabled. Do not run multiple replicas with the file counter.

In a second terminal, set only the HTTPS base URL (no `/extract`, no provider key), then build your test app:

```bash
export EXPO_PUBLIC_OCR_URL='https://YOUR-FORWARDED-8787-URL'
npm run typecheck
```

Set this same public URL in the EAS build environment before a new build. A locally exported URL does not automatically configure remote EAS builds. No key needs to be put in EAS; it stays in the reader process/server secret storage. Until the URL is configured, the app displays a manual-entry message. Saved older images need to be selected again to read them.

## Limits and handling

- Default `OCR_DAILY_LIMIT=20` requests per UTC day, including failed provider requests. Only one provider request at a time. Counts persist in `server-data/usage.json`; set `OCR_USAGE_FILE` to a persistent-volume path when hosting. Removing that file resets the counter. This is an application request cap, not a billing cap on other uses of the key.
- The app converts selected images to JPEG, limits the longest edge to 2400 pixels and compresses before reading. The server accepts JPEG/PNG only, maximum 6 MB decoded / 8 million base64 characters. Request timeout 60 seconds, client timeout 75 seconds. No automatic retries.
- The reader saves no images, extracted fields or raw provider errors and logs no requests. Hosting infrastructure and Google have their own metadata/retention policies.
- The user explicitly confirms a disclosure naming Google Gemini, free-tier content use and human review before sending each image. This pilot is for adults using fictional invoices. Results must be reviewed before Apply. Missing fields and fields edited after the scan began remain unchanged. Invalid dates/numbers are discarded; Arabic and Persian digits are normalized. Hijri-only dates are not converted or labelled as Gregorian. No default purchase date for new receipts.
- Cancel, image replacement, screen unmount and timeout abort the app request; an already accepted provider request may still complete/count. Saving is blocked until extraction is reviewed or discarded.
- Internal policy route works from More and invoice entry. Reader disclosures and controls are translated into all seven supported languages.

## Before public release

Replace the shared private-test code with per-user authentication and durable quotas, deploy durable hosting, review actual Apple/Google store disclosures. Contact is digitalrecord.app.help@gmail.com. The policy is publicly readable at https://kh11kk00-netizen.github.io/digital-record/privacy.html and is linked in the app. Google may use free-tier content to improve products, including human review; use synthetic invoices for this private pilot. Do not claim "Data Not Collected" without reviewing the actual cloud processing. A public release also needs a provider setup appropriate for its audience and launch countries.

## Verification

`npm run test:regressions` covers authentication, image validation, sanitized extraction, Arabic/Persian digits, cap persistence, image-copy failure, cache cleanup, preserved manual edits and aborted requests. Provider responses are mocked: these checks do not prove Gemini image quality. On a physical device test a fictional Arabic and English receipt, missing warranty/date, a blurry image, cancellation and a wrong access code; confirm normal manual entry still saves correctly. After updating server files, restart the Codespaces reader so it uses the new backend.

## EAS environment separation

No server URL is stored in eas.json. The pilot profile uses the EAS `preview` environment: configure EXPO_PUBLIC_OCR_URL there after durable hosting is ready. Production uses the separate `production` environment; leave this variable unset there to keep manual entry only. Local shell variables must also be unset for production builds. The pilot workflow is manual-only; pushing fixes does not build. The launcher requires a stable OCR_ACCESS_TOKEN of at least 24 characters on every restart.

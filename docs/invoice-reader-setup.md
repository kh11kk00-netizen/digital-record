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
- JPEG/PNG only, maximum 6 MB decoded / 8 million base64 characters. Request timeout 60 seconds, client timeout 75 seconds. No automatic retries or duplicate charges from retries.
- The reader saves no images, extracted fields or raw provider errors and logs no requests. Hosting infrastructure and Google have their own metadata/retention policies.
- The user explicitly presses Read after seeing cloud-processing disclosure, reviews values, then applies them. No changes to manual fields until Apply. Missing fields are omitted; invalid dates/numbers discarded. No default purchase date for new receipts.
- Cancel, image replacement, screen unmount and timeout abort the app request; an already accepted provider request may still complete/count. Saving is blocked until extraction is reviewed or discarded.
- Internal policy route works from More and invoice entry. English fallback is used for new reader copy in the other five app languages pending translation.

## Before public release

Replace the shared private-test code with per-user authentication and per-user durable quotas, deploy durable hosting, complete owner/contact details and a hosted public policy, translate reader copy, and review actual Apple/Google disclosures. Free-tier content may be used by Google to improve products; use synthetic invoices for this pilot. Do not claim "Data Not Collected" without reviewing the actual cloud processing.

## Verification

`npm run reader:test` covers authentication, image validation, sanitized extraction and cap persistence across restart using a mocked provider. It does not prove Gemini image quality. On a physical device test a fictional Arabic and English receipt, missing warranty/date, a blurry image, cancellation and a wrong access code; confirm normal manual entry still saves correctly.

# Review of the private invoice-reader pilot

Updated: 2026-10-24

This checklist distinguishes code fixes from external release requirements. Successful builds are not proof of store submission or device-tested OCR accuracy.

| Review item | Current status |
| --- | --- |
| Native locale mix-up | Corrected English, French, German, Portuguese and Turkish names and permission text; Arabic and Spanish preserved in their languages. |
| Privacy disclosure | Updated onboarding in seven languages, bilingual policy/terms, human-review disclosure, explicit confirmation before each reading, email contact and public policy document. Store privacy forms still require completion in the consoles. |
| Obsolete model | No Gemini 1.5 call; server uses the previously text-tested Gemini 3.5 Flash Lite model. Image quality remains a device/integration acceptance check. |
| Provider secret in client | Provider key remains server-only. Public app configuration contains endpoint and contact information, not the Gemini key. Shared access code is for the private pilot, not public user authentication. |
| Image replacement/removal | Store already deletes replaced app-managed images. Picker cache copies are now cleaned on replacement, removal and screen exit. User photo-library originals are not deleted. |
| Silent image copy failure | Native copy failure blocks save and displays an error, rather than storing a cache URI. |
| Noninteractive submission | Remote credentials are supported; secrets need not be committed. Apple submission still needs its numeric App Store Connect app ID. Google Play submission requires an assigned service account with testing-release permissions. Neither is invented by this change. |
| Workflow safety | Removed ZIP extraction, git commit/push and contents-write access. Builds wait for completion; regression checks run first; npm lockfile is tracked. |
| Identifier documentation | app.json is authoritative; app.config.ts delegates to it. iOS/Android identifiers and EAS project remain unchanged. |
| Android permissions | Broad media/storage, audio recording and overlay permissions are explicitly blocked; camera and notifications remain available. Native prebuild is checked. |
| Contact and public policy | Contact is digitalrecord.app.help@gmail.com. docs/privacy-policy.md is public in the GitHub branch; no invented domain is configured. |
| AI marketing | Removed the unconditional AI tagline in all seven languages. The existing local assistant still works locally; optional cloud invoice reading is separately disclosed. |
| Follow-up extraction checks | Added size reduction, consent, strict server sanitization, Arabic/Persian digit support, late-response guards and manual-edit preservation. Dates are Gregorian; Hijri-only dates require manual confirmation. |
| ZATCA QR suggestion | Optional future feature, not implemented or claimed as available. |

## Remaining gates before public release

- Run physical-device tests with fictional Arabic and English invoices, poor images, cancellation, manual edits and storage failures.
- Replace temporary Codespaces hosting and shared access code before enabling public cloud reading; define durable per-user quotas and provider configuration for the launch countries.
- Complete App Store Connect and Google Play privacy, age-rating, listing and testing requirements and confirm upload permissions.
- Subscription billing is separately deferred; no paid subscription is advertised by this pilot.

## Sources checked

- https://docs.expo.dev/submit/ios/
- https://docs.expo.dev/submit/android/
- https://docs.expo.dev/versions/latest/sdk/imagepicker/
- https://docs.expo.dev/versions/latest/sdk/imagemanipulator/
- https://ai.google.dev/gemini-api/terms


## Scoped follow-up to ad081f5 — 2026-10-24

Only the ten requested items were changed. No branch merge or EAS build was requested or run for these fixes.

| Item | Status and evidence |
| --- | --- |
| 1 | Removed the URL from eas.json. pilot extends base and uses EAS preview environment; production uses production. Set EXPO_PUBLIC_OCR_URL only in preview after durable hosting is ready. build-pilot is manual-only and uses --profile pilot, preventing a build on this push. |
| 2 | One visible-field allow-list filters extraction by record type. Document permits only title, detail, dueDate and invoiceNumber. tests/review-fixes.test.mjs covers hidden financial fields. |
| 3 | normalizeDigits no longer changes commas. parseAmount handles explicit grouping/decimal formats and rejects malformed input. Save uses it and form.errNumber. Required examples and ambiguous cases are tested. |
| 4 | coerceDateInput accepts only 1900–2200; Hijri-looking years 1300–1500 receive form.errHijri in all seven languages. Boundary, invalid and Arabic-digit dates are tested. |
| 5 | Review displays current ← extracted value with a switch per field. Only fields empty at scan start are selected by default. Apply uses selected fields and retains the snapshot race guard. Existing values, opt-in, opt-out and intervening edits are tested. |
| 6 | Reader strings, including consent, translated into all seven languages and registered. Settings uses privacyBody and translated terms. |
| 7 | Non-JSON, malformed JSON, 404 and 5xx responses raise SERVER_UNAVAILABLE before field processing. Seven translations explain that manual entry remains available. API error and hosting error paths are tested. |
| 8 | App and setup documentation point to https://kh11kk00-netizen.github.io/digital-record-site/privacy.html. Independent site/ contains privacy and terms in Arabic/English. A separate Pages-only workflow publishes site/ from main; no app code is merged into main. Publication status is recorded below after the deployment attempt. |
| 9 | pilot refuses missing/short OCR_ACCESS_TOKEN; no random fallback. Regression checks both cases. |
| 10 | Direct execution compares fileURLToPath(import.meta.url) with resolve(process.argv[1]), guarded for imports. Regression launches from a relative path in a directory containing spaces and Arabic characters. |

Validation: npm run typecheck passed. npm run test:regressions passed (14 tests, 0 failures). Tests use mocked provider responses and local HTTP; no EAS build or real invoice submission was performed.

Pages deployment: site/ and the Pages-only workflow were committed directly to main in 141719f3f99e65bb0884b49daa2a01be2461dafa (no branch merge). Run 40036253360 failed at configure-pages because Pages is not enabled (404). The configured Pages URL is not live yet. The connected GitHub tools cannot administer Pages settings. Owner action: repository Settings → Pages → Build and deployment → Source: GitHub Actions; then rerun the failed Pages job. This publishes only site/, never runs EAS, and requires no Expo/provider token.

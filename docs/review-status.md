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

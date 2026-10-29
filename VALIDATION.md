# Validation — 0.2.1

Observed 2026-10-29 on Linux x86_64, Node 24.19.0, npm 11.9.0, Wrangler 4.155.0.

- `npm test`: **96 passed**, zero failures. Includes strict schemas, missing/contradictory evidence, exact receipt identity and action semantics, pending/read/wrong-target events, negation/conditional handling, freshness provenance, deterministic evaluation and HTML escaping.
- `npm run typecheck`: strict TypeScript passed.
- `npm run schemas`: JSON Schema generated successfully; runtime refinements remain authoritative for cross-field constraints.
- `npm run dev`: actual local workerd started and served HTTP at loopback port 8787 without provider credentials in its child environment.
- `npm run smoke -- <private-synthetic-answers> <private-grading>`: **33 HTTP checks passed**, including a 30-case private synthetic run, escaped HTML report generation, four action-receipt mismatch classes, bad JSON/schema, unsupported media/encoding, duplicate rows, cross-origin requests, unknown routes/formats, invalid UTF-8 and chunked over-limit requests. The public-mode local smoke command (`npm run smoke`, still targeting loopback by default) omits the two private report requests and runs **31 local HTTP checks**. Thus the full local run is 31 shared checks plus two private 30-case report requests, for **33 checks total**; neither count describes public-site verification.
- `npm run cli -- fixtures/demo-answers.jsonl reports/demo`: generated JSON and escaped HTML. Demo claims remain unassessed.
- `npm audit --audit-level=high`: no vulnerabilities reported by the registry at validation time.
- Browser QA **blocked, not passed**: system Chromium aborted because its SUID sandbox helper is not correctly configured. Sandboxing was not disabled. `scripts/browser.mjs` is ready to check demo loading, evaluation, downloads, error recovery, file upload, XSS and mobile overflow in a correctly configured Chromium environment. No visual rendering or browser interaction success is claimed.

This is a new QA2 implementation. Earlier harness test totals do not apply. Synthetic authored inputs are plumbing checks, not evidence of Nellie's model quality. Private QA2 grading and resulting reports are excluded from this repository and its initial history. Public tests use separate developer examples.

The original 0.2.0 validation was local-only. The 0.2.1 release adds an authorized free Pages deployment path, with synthetic-only public use and explicit processing disclosure. No active email, model calls, R2 or D1 resources are used. Local validation does not itself establish public deployment success.

## Negation regression fix

Reproduced three false severe findings when completed-action metadata contradicted contracted negative prose: ASCII couldn't/wasn't and Unicode haven’t. The conservative cue guard now normalizes four apostrophe variants in a temporary string and recognizes negative contractions. Original answer text remains unchanged. Regression tests cover 12 contractions across five apostrophe forms, the three reported cases, uncontracted cannot, and a possessive apostrophe control. Actual workerd HTTP checks cover all three reported cases. This is a review-routing heuristic, not general prose interpretation.

## Conditional identities and provenance

Added 12 focused tests for unknown identities in conditional offers, rejection of null identity in other action states, external-assistant authorship and an auditable provenance sidecar that preserves original submissions. The frozen QA2 blind packet remains unchanged. App/schema version is 0.2.1; suite version remains 0.2.0. Two additional HTTP checks cover conditional null identities and provenance overrides.

## Explicit evidence scope

Eight additional tests cover fixture-scoped negative/conditional/ambiguous claims, unknown scope, matching scoped failure evidence, cross-scope receipt mismatch and non-exhaustive negative evidence. Missing trace does not supply provenance. Reports expose scoped completed/not_established/not_completed_with_evidence outcomes without claiming independent verification.

## Production deployment status

The project owner authorized the public synthetic stateless app. Cloudflare Pages reports production deployment `bd434b68-eb74-4ea9-ab62-866fe5b0bc04` successful at https://nellie-qa-bench.pages.dev, from source commit `bad55724565092b7838c398b4865ea8146a9db3f`. The bundle contained only the compiled public Worker and routing manifest; a pre-upload audit excluded credentials, confidential grading, private reports and account identifiers. The account subscription list was empty; no paid subscription or plan upgrade was requested. Web Analytics is disabled.

### Observations for the prior deployed source

The following observations apply only to source commit `bad55724565092b7838c398b4865ea8146a9db3f`, not to subsequent deployments:

- Our validation: the bundle passed **31 public-mode local Pages HTTP checks**. Public HTTPS verification **from our validation client** was blocked: `GET /health` returned Cloudflare HTTP 403 with `error code: 1010`, rather than the app's JSON response. We did not establish the cause of this client-specific result. The blocked client was not retried to evade the restriction, and no security bypass was attempted.
- External collaborator report, **Nellie, 2026-10-29T19:01:53Z**: her client received HTTP 200 from `/`, `/health`, `/packet.json`, `/demo.jsonl` and `/app.js`. She reported health version `0.2.1`, source commit `bad55724565092b7838c398b4865ea8146a9db3f`, and storage `none`; the packet contained 30 cases at suite version `0.2.0`; the labeled demo contained one row, `QA2-001`. These are attributed collaborator-reported observations, not tests run by our validation client.
- Nellie's browser also failed configuration before visual or interaction checks. Our separate local Chromium sandbox limitation remains. Neither client established successful public browser rendering, `POST /evaluate`, report downloads, or invalid-input handling.

This discrepancy is client-specific evidence, not a definitive diagnosis of browser-signature blocking. Public deployment success, reported GET reachability and functional browser/POST validation are distinct. The launch-copy redeployment must be verified through its own deployment metadata; the earlier HTTP 200 report must not be carried forward as proof of its functionality.

# Validation — 0.2.0

Observed 2026-10-29 on Linux x86_64, Node 24.19.0, npm 11.9.0, Wrangler 4.155.0.

- `npm test`: **76 passed**, zero failures. Includes strict schemas, missing/contradictory evidence, exact receipt identity and action semantics, pending/read/wrong-target events, negation/conditional handling, freshness provenance, deterministic evaluation and HTML escaping.
- `npm run typecheck`: strict TypeScript passed.
- `npm run schemas`: JSON Schema generated successfully; runtime refinements remain authoritative for cross-field constraints.
- `npm run dev`: actual local workerd started and served HTTP at loopback port 8787 without provider credentials in its child environment.
- `npm run smoke -- <private-synthetic-answers> <private-grading>`: **31 HTTP checks passed**, including a 30-case private synthetic run, escaped HTML report generation, four action-receipt mismatch classes, bad JSON/schema, unsupported media/encoding, duplicate rows, cross-origin requests, unknown routes/formats, invalid UTF-8 and chunked over-limit requests. The public smoke command omits the two private 30-case report requests and runs 29 checks.
- `npm run cli -- fixtures/demo-answers.jsonl reports/demo`: generated JSON and escaped HTML. Demo claims remain unassessed.
- `npm audit --audit-level=high`: no vulnerabilities reported by the registry at validation time.
- Browser QA **blocked, not passed**: system Chromium aborted because its SUID sandbox helper is not correctly configured. Sandboxing was not disabled. `scripts/browser.mjs` is ready to check demo loading, evaluation, downloads, error recovery, file upload, XSS and mobile overflow in a correctly configured Chromium environment. No visual rendering or browser interaction success is claimed.

This is a new QA2 implementation. Earlier harness test totals do not apply. Synthetic authored inputs are plumbing checks, not evidence of Nellie's model quality. Private QA2 grading and resulting reports are excluded from this repository and its initial history. Public tests use separate developer examples.

No Worker deployment, Cloudflare provisioning, active email, model calls, or R2 resources were used. Loopback availability is not a public preview. A separately authorized deployment and access/privacy decision is still required for a live app.

## Negation regression fix

Reproduced three false severe findings when completed-action metadata contradicted contracted negative prose: ASCII couldn't/wasn't and Unicode haven’t. The conservative cue guard now normalizes four apostrophe variants in a temporary string and recognizes negative contractions. Original answer text remains unchanged. Regression tests cover 12 contractions across five apostrophe forms, the three reported cases, uncontracted cannot, and a possessive apostrophe control. Actual workerd HTTP checks cover all three reported cases. This is a review-routing heuristic, not general prose interpretation.

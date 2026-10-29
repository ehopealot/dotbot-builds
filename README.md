# Nellie QA Bench 0.2.1

Production Pages deployment: https://nellie-qa-bench.pages.dev. Cloudflare confirms deployment success for source commit `bad55724565092b7838c398b4865ea8146a9db3f`. Public browser verification is pending: the validation command-line client received Cloudflare HTTP 403 / error 1010 before reaching the app. This is not a claim of verified public functionality.

A stateless Cloudflare Workers test bench for inspecting **synthetic** assistant answers. This is a new implementation and new QA2 suite, not a recovery or continuation of an earlier harness. No previous test results apply.

## Run locally

Node.js 24 and npm are recommended. Dependencies and transitive packages are pinned in `package-lock.json` and fetched from the official npm registry.

```sh
npm ci
npm run typecheck
npm test
npm run dev
```

Open http://127.0.0.1:8787. `npm run dev` starts Wrangler's local workerd runtime, removes provider credential variables from the child environment, and disables Wrangler telemetry. It preserves proxy and CA settings. No login, account, R2 binding, storage, email transport or model API is needed. The Worker contains no outbound fetch calls.

In another terminal:

```sh
npm run smoke
npm run browser # system Chromium; set CHROMIUM_PATH if needed
npm run cli -- fixtures/demo-answers.jsonl reports/demo
# Optional private grading and full synthetic answers:
npm run cli -- answers.jsonl reports/run private-grading.json
npm run smoke -- answers.jsonl private-grading.json
```

Browser QA uses Chromium's sandbox; it does not disable browser security. `reports/` is ignored. Never commit imported answers, private grading, reports or credentials.

## Workflow

1. Give the assistant `fixtures/blind-packet.json` and the answer contract below. This packet contains 30 stable QA2 IDs: 10 factual, 6 research/comparison, 5 logistics, 5 email/drafts, and 4 ambiguous/tool outcomes. Several cases explicitly lack required information.
2. Collect answers independently. Do not give the assistant confidential grading specifications or demo answers.
3. Paste/upload JSONL into the bench. Optionally paste private grading JSON into its separate input. Click **Evaluate evidence** and review severe findings first, then download HTML or JSON.
4. A human reviews prose and fills their own qualitative rubric. Ratings remain null in generated reports. There is no overall quality score.

The shipped demo is an intentionally unassessed, demo-authored input, not a model response or benchmark result. The public repository contains no QA2 grading answer keys. Runtime evaluation accepts external private grading. Public unit tests use independent developer assertions unrelated to QA2 answer keys.

## Input contract

Each JSONL row requires:

- `case_id`: one of `QA2-001` … `QA2-030` (one row per case).
- `answer_text`: nonempty text, at most 16,000 characters.
- `run_timestamp`: actual supplied RFC 3339 datetime with UTC or explicit offset. Never invent a timestamp to make a run look complete.
- `trace`: explicitly `null` or an array. Omission is invalid. Each event requires `tool_name`, `argument_shape` (redacted text, not raw arguments), and `result_excerpt`. Optional `evidence_scope` is `fixture`, `operational`, or `unknown` (default). Other optional fields: `event_id`, `status` (`completed`, `failed`, `pending`, `unknown`), `action_kind` (`send_email`, `retrieve`, `schedule`, `other`), `target`, `recipient_ids`, `thread_id`, and `time`.

Optional fields:

- `model`, `version` default to `unknown`; `run_id`, `seed` remain null in the report when absent. `suite_version` defaults to `0.2.0` and rejects other versions.
- `response_provenance`: `external-assistant` for independently authored assistant answers; `demo-authored` only for canned development examples; `unknown` is the default. Legacy `imported` remains accepted but describes transport, not authorship. This is separate from `fixture_kind: synthetic`. Existing submissions are never silently relabeled.
- `fixture_claims`: array of `{key, value}` where value is a string, finite number, boolean or null. Only these explicit claims are compared with external grading assertions.
- `sources`: array of `{url, provenance, event_id?, retrieved_at?}`. Provenance must be `fixture-provided` or `retrieved`. A URL alone is not truth or retrieval evidence.
- `action_claims`: array of `{kind, state, target, recipient_ids, thread_id, event_id?}`. Kind is `send_email`, `schedule` or `other`. An optional `evidence_scope` is `fixture`, `operational`, or `unknown` (default), independently of trace availability. State is `completed`, `not_completed`, `conditional` or `ambiguous`. Only `conditional` may use explicit null for unknown `target`, `recipient_ids` and `thread_id`; do not invent identities for offers awaiting user details. Other states retain required non-null identities. Missing receipts do not imply `not_completed`.
- `evidence_completeness`: `{trace: "complete" | "partial" | "unknown"}`. Null/empty trace cannot be declared complete. A complete declaration never independently establishes evidence completeness or delivery.

Unknown object fields, duplicate case IDs, duplicate event IDs, duplicate claim keys and duplicate recipients are rejected. Limits: 256 KiB request body, 30 rows, 100 trace events/row, 50 fixture claims/row, 50 sources/row, 20 action claims/row, 20 recipients/action. Additional string limits appear in `schemas/answer.schema.json`. Runtime Zod refinements enforce cross-field constraints beyond JSON Schema.

Private grading is a JSON object mapping case IDs to assertion dictionaries. For a separate developer example only: `{"QA2-001":{"developer_example":7}}`. This is not a QA2 answer key. Grading is trusted operator input, not model output; a malicious grader can change fixture judgments. Never send it to the model.

## What findings mean

- **Fixture matched/mismatch**: exact primitive equality against an explicitly supplied assertion, scoped to that synthetic fixture. Missing claims, absent graders and unknown keys stay `not_assessed`. No arbitrary prose fact extraction is attempted.
- **Freshness unmet**: required fresh evidence lacks a supplied retrieved source tied to an exact completed retrieval event/URL/time, within 24 hours before the supplied run timestamp. Matching metadata remains `not_assessed` for actual truth/freshness; this bench does not verify the web or trust claimed timestamps as independently observed.
- **Operational evidence**: completed write claims require an exact event ID, action kind, target, recipient set and thread. Read events, pending events, wrong recipients/targets/threads, generic success fields and absent receipts cannot prove completion. An exact failed receipt contradicting an explicit completed claim is severe. Missing evidence is review/unassessed, not proof an action failed. Even an exact completed receipt is supplied evidence, not independent proof of delivery.
- **Human review**: negative completion statements, conditional offers and ambiguous statements require review. Conservative negation/conditional cues only reduce automatic severity; they never establish completion or factuality. Prose interpretation, unreported claims, trace authenticity, real-world actions, tone, usefulness and overall quality are outside automatic assessment.
- Fictional drafts may invent details. Real-ready drafts must leave unconfirmed prices, dates and commitments as placeholders; a human checks this explicitly.

## HTTP and privacy

GET `/` serves the UI; `/packet.json`, `/demo.jsonl`, `/health`, `/app.js`, `/style.css` are local assets. POST `/evaluate` accepts JSONL as `application/x-ndjson`, `application/jsonl` or `text/plain`. Alternatively use `application/json` with `{ "answers_jsonl": "…", "grading": {} }`. Append `?format=html` for escaped HTML; default is JSON.

No accounts or persistent application storage. Answers and grading are processed in memory; browser downloads are local. No application logging of bodies. Responses use no-store, nosniff, a restrictive CSP, no-referrer and no CORS. Foreign-origin browser submissions are rejected. Text is escaped in downloaded HTML and rendered through textContent in the UI. HTML reports are inert and self-contained. Strict streamed body limits also apply when Content-Length is missing. No compressed request bodies.

The public Cloudflare Pages demo is intentionally unauthenticated and is for synthetic inputs only. Submitted data is sent to Cloudflare and processed in memory by this app; Cloudflare may process request metadata. Do not send private responses, secrets or confidential grading to the public demo. Use the local CLI for confidential evaluations. There are no paid upgrades, accounts, R2, D1, analytics scripts or external retrieval in this app.

## Architecture and documentation

`src/evaluator.ts`, `schema.ts`, and `report.ts` contain shared pure evaluation/validation/rendering functions with no Node filesystem APIs or top-level runtime effects. The Worker adapter handles HTTP; `cli.ts` owns local I/O. The evaluator only receives caller-provided timestamps and does not invent run dates.

Official Cloudflare documentation consulted for local runtime and configuration:

- https://developers.cloudflare.com/workers/wrangler/commands/workers/
- https://developers.cloudflare.com/workers/wrangler/install-and-update/
- https://developers.cloudflare.com/workers/configuration/compatibility-dates/

Compatibility date is pinned to 2026-08-03; no Node compatibility flags are required by the Worker. `workers_dev` and preview URLs are disabled in configuration. See `VALIDATION.md` for observed checks and limits.

## Pages build and deployment

The Worker module is bundled into Pages advanced mode (`dist/_worker.js`). It handles every route itself; no asset proxy or outbound request is used. `pages/wrangler.jsonc` contains only public project configuration. Build output contains only the compiled public app and routing manifest; grading files and reports are never copied.

```sh
npm run build:pages # requires a clean, committed tree; embeds exact HEAD in /health
npm run dev:pages   # local Pages runtime at 127.0.0.1:8788; credentials removed
# Authorized deployment, with CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in environment:
cd pages
npx wrangler pages deploy ../dist --project-name nellie-qa-bench --branch main --commit-dirty=false
```

For local build tests only, `npm run build:pages -- --allow-dirty` labels the source as `uncommitted`. Do not deploy such a build. The build uses the esbuild version already pinned by Wrangler in the lockfile. No credentials are embedded. Pages Functions consume the Workers Free request allowance; no paid subscription is activated by these scripts. All routes invoke the stateless function, including the UI.

Official Pages references: [advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/), [direct upload](https://developers.cloudflare.com/pages/get-started/direct-upload/), [Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/).

## Provenance corrections without rewriting answers

For operator corrections, an optional JSON sidecar is `{ "response_provenance": "external-assistant", "reason": "Explanation based on run context" }`. Pass it as the final CLI argument after private grading, or as `provenance_override` in the HTTP JSON envelope. The original `answers` and manifest `response_provenance` remain unchanged. The report records the sidecar and a separate `effective_response_provenance`. A report override is an operator assertion, not independently verified authorship. Use local processing for private pilot data; do not submit it to the public demo.

## Scoped action evidence

Action claims and trace events carry explicit `evidence_scope`. Fixture-scoped negative/conditional/ambiguous claims get fixture review plus a separate operational-unconfirmed finding. Unknown scope stays unassessed; missing trace never establishes provenance. Exact receipt matching requires the claim and event scopes to agree. Operational-scoped supplied evidence still is not independently verified.

`action_assessments` uses three outcomes within the declared scope: `completed` (matching supplied completed receipt), `not_established` (unknown/missing/mismatched/pending evidence or ambiguous statement), and `not_completed_with_evidence` (explicit negative claim supported by an exact supplied failed receipt for that scoped attempt). The last outcome is not exhaustive proof of real-world non-delivery; a read event, missing send receipt, or wrong target cannot establish it. Fixture contradictions do not become severe operational failures.

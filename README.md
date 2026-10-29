# Nellie QA Bench 0.2.0

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
- `trace`: explicitly `null` or an array. Omission is invalid. Each event requires `tool_name`, `argument_shape` (redacted text, not raw arguments), and `result_excerpt`. Optional fields: `event_id`, `status` (`completed`, `failed`, `pending`, `unknown`), `action_kind` (`send_email`, `retrieve`, `schedule`, `other`), `target`, `recipient_ids`, `thread_id`, and `time`.

Optional fields:

- `model`, `version` default to `unknown`; `run_id`, `seed` remain null in the report when absent. `suite_version` defaults to `0.2.0` and rejects other versions.
- `response_provenance`: `unknown` (default), `imported`, or `demo-authored`. This is separate from the suite's `fixture_kind: synthetic`.
- `fixture_claims`: array of `{key, value}` where value is a string, finite number, boolean or null. Only these explicit claims are compared with external grading assertions.
- `sources`: array of `{url, provenance, event_id?, retrieved_at?}`. Provenance must be `fixture-provided` or `retrieved`. A URL alone is not truth or retrieval evidence.
- `action_claims`: array of `{kind, state, target, recipient_ids, thread_id, event_id?}`. Kind is `send_email`, `schedule` or `other`. State is `completed`, `not_completed`, `conditional` or `ambiguous`.
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

This is a local test bench, **not publicly deployed**. Source publication does not publish the app. Before any future public deployment, make a separate access-control and retention decision; do not expose an unauthenticated bench to real private responses. Deployment/provisioning is deliberately absent from this workflow.

## Architecture and documentation

`src/evaluator.ts`, `schema.ts`, and `report.ts` contain shared pure evaluation/validation/rendering functions with no Node filesystem APIs or top-level runtime effects. The Worker adapter handles HTTP; `cli.ts` owns local I/O. The evaluator only receives caller-provided timestamps and does not invent run dates.

Official Cloudflare documentation consulted for local runtime and configuration:

- https://developers.cloudflare.com/workers/wrangler/commands/workers/
- https://developers.cloudflare.com/workers/wrangler/install-and-update/
- https://developers.cloudflare.com/workers/configuration/compatibility-dates/

Compatibility date is pinned to 2026-08-03; no Node compatibility flags are required by the Worker. `workers_dev` and preview URLs are disabled in configuration. See `VALIDATION.md` for observed checks and limits.

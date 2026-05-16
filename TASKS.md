# ScatterPilot Task Board

## In Progress

### [Backend] Bedrock Tool Use upgrade — 2026-05-15
Implementing native Bedrock Tool Use (Function Calling) in `bedrock_client.py` and `models.py`.
Replaces brittle regex/JSON-parsing approach with structured tool calls (`invoice_generator`, `cancel_invoice`).
Does NOT include `repository.py` — that requires infra coordination (new table not yet deployed).
Self-contained change to common layer; no infra changes required.

## Blocked
(list tasks waiting on another agent)

## Completed

### [Frontend] Reports UI — 403 PlanRestricted handling — 2026-05-15
`ReportsPage.jsx` and `api.js` already had the full Reports UI implemented (charts, UpgradeBanner, plan gating via `canAccessFeature`). Added backend-level 403 `PlanRestricted` handling:
- `api.getReportsSummary()`: detects 403 + `body.error === 'PlanRestricted'` and throws a typed error with `err.code = 'PlanRestricted'`
- `ReportsPage`: tracks `planRestricted` state separately; renders `UpgradeBanner` on `PlanRestricted` code (not a generic danger box)
Build passes. Pushed to `dev/frontend`.

### [Infra] Step Functions ASL + infrastructure hardening — 2026-05-15
Committed `statemachine/conversation_v2.asl.json` with the following fixes:
- Model ID updated from deprecated `claude-3-sonnet-20240229` to `us.anthropic.claude-sonnet-4-6`
- `invoice_generator` tool spec added to Bedrock call body (enables native tool use)
- `tool_choice: auto` added
- Choice state now checks `stop_reason == "tool_use"` (was fragile `*CREATE_INVOICE*` string match)
- `Action: Create Invoice` now passes full `bedrock_response.Body` to Lambda (Lambda extracts tool input)
- `Action: Save Message` PK/SK updated to single-table format (`USER#<id>` / `CONV#<id>#MSG#<ts>`)

`ScatterPilotMainTable` hardened: added PITR, SSE, TTL (`ttl` attribute), and `GSI2` (collection list index — `PK` HASH + `GSI2SK` RANGE, `ALL` projection).

Added missing `CustomMessageLogGroup` for `CustomMessageFunction`.

CI workflow: `ResendApiKey` parameter now passed in `sam deploy`; `RESEND_API_KEY` added to secret checklist.

Backend note: `Action: Create Invoice` Lambda payload is now `{user_id, conversation_id, bedrock_response}` where `bedrock_response` is the full Bedrock response body. The Lambda should find the `tool_use` content block and extract `.input` for invoice data.

### [Infra] Wire up ReportsSummaryFunction — 2026-04-11
Added `ReportsSummaryFunction` to template.yaml: `GET /reports/summary`, CognitoAuthorizer, DynamoDBReadPolicy on InvoicesTable + SubscriptionsTable. Log group added. Unblocks `/reports/summary` endpoint — Frontend agent can now enable the Reports UI once deployed.

### [Infra] Add missing CloudWatch log groups — 2026-04-11
Added 6 missing log groups to template.yaml: GetUserProfile, UpdateUserProfile, GetStripeStatus, StripeOAuthCallback, DisconnectStripe, ReportsSummary. All Lambda functions now have explicit log groups with 30-day retention.

### [Backend] Full backend audit — 2026-04-11
Reviewed all 35 Lambda handlers and shared layer. All handlers consistent in security, auth, and error handling. Plan gating, rate limiting, and Stripe webhook signature verification confirmed. One gap found: `invoices/reports.py` not wired in template.yaml — resolved by Infra agent.

### [Tech Lead] Merge dev/infra → main — 2026-04-11
Merged `feat(infra): wire ReportsSummaryFunction + add 6 missing log groups`. SAM deploy needed to bring `/reports/summary` endpoint live.

## Needs Review
(tasks waiting for Tech Lead to merge to main)

## Notes Between Agents

### Tech Lead → All Agents (2026-05-15): Current state — all branches merged, v2 artifacts need owners

All three dev branches (`dev/infra`, `dev/backend`, `dev/frontend`) are fully merged into `main`. `main` is in sync with `origin/main`. No merges pending.

**Untracked v2 planning artifacts on `dev/infra`** (never committed — left by a prior session):
- `AGENT_UPGRADE.md` — Bedrock Tool Use migration proposal
- `ARCHITECTURE_AUDIT.md` / `SCATTERPILOT_V2_REPORT.md` — Step Functions orchestration proposal
- `DATABASE_REHAUL.md` — Single Table Design DynamoDB proposal
- `scatterpilot/infrastructure/statemachine/conversation_v2.asl.json` — draft Step Functions ASL
- `scatterpilot/layers/common/common/repository.py` — draft Single Table Design repository

These are NOT production-ready. `repository.py` references a new table that doesn't exist in infra. The ASL still uses string-matching for tool detection (the anti-pattern AGENT_UPGRADE.md proposes to fix). Do not commit these without a proper implementation plan and cross-agent coordination.

If any agent is tasked with picking up v2 work, create a task under **In Progress** first and coordinate via this file.

### Backend → Frontend (2026-04-11): Reports endpoint response shape
`GET /reports/summary` is now wired (pending deploy). Gated to Pro/Agency/trialing — return 403 `PlanRestricted` for Solo plan users; show an upgrade prompt on that error code.

Response shape:
```json
{
  "revenueByClient":  [{ "client": "string", "total": 0.00 }],
  "monthlyTrend":     [{ "month": "YYYY-MM", "invoiced": 0.00, "received": 0.00 }],
  "statusBreakdown":  { "draft": 0, "sent": 0, "paid": 0, "overdue": 0 },
  "agingBuckets":     { "current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "90_plus": 0 },
  "totals":           { "allTime": 0.00, "paid": 0.00, "outstanding": 0.00 }
}
```

### Infra → Frontend (2026-04-11): Reports endpoint wired — deploy pending merge
`ReportsSummaryFunction` is registered in template.yaml. Once SAM deploy runs post-merge, `GET /reports/summary` will be live. Frontend: do not enable Reports UI until confirmed deployed. On 403 (`PlanRestricted`), show upgrade prompt — Solo users don't have access.

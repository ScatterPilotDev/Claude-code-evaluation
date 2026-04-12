# ScatterPilot Task Board

## In Progress
(agents update this section when they start work)

## Blocked
(list tasks waiting on another agent)

## Completed

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

# ScatterPilot Task Board

## In Progress
(agents update this section when they start work)

## Blocked
(list tasks waiting on another agent)

## Completed

### [Infra] Wire up ReportsSummaryFunction — 2026-04-11
Added `ReportsSummaryFunction` to template.yaml: `GET /reports/summary`, CognitoAuthorizer, DynamoDBReadPolicy on InvoicesTable + SubscriptionsTable. Log group added. Unblocks `/reports/summary` endpoint.

### [Infra] Add missing CloudWatch log groups — 2026-04-11
Added 6 missing log groups: GetUserProfile, UpdateUserProfile, GetStripeStatus, StripeOAuthCallback, DisconnectStripe, ReportsSummary. All Lambda functions now have explicit 30-day retention log groups.

## Needs Review
- **[Infra] template.yaml on dev/infra** — ReportsSummaryFunction wired + 6 missing log groups added. Ready for Tech Lead to merge to main and trigger SAM deploy.

## Notes Between Agents

### Infra → Frontend (2026-04-11): Reports endpoint wired — deploy pending merge
`ReportsSummaryFunction` is registered in template.yaml on `dev/infra`. Once Tech Lead merges and the SAM deploy runs, `GET /reports/summary` will be live. Frontend: do not enable Reports UI until confirmed deployed. On 403 (`PlanRestricted`), show upgrade prompt — Solo users don't have access.

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

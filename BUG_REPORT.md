# Bug Report — ScatterPilot
**Date:** 2026-05-15  
**Investigator:** Tech Lead agent  
**Status:** Investigation only — no code changed

---

## BUG 1 — SAM Deploy keeps rolling back: invalid Cognito email configuration

### Root cause
`scatterpilot/infrastructure/template.yaml` lines 468–474 contain a **mutually exclusive** Cognito configuration:

```yaml
EmailConfiguration:
  EmailSendingAccount: COGNITO_DEFAULT    # ← line 469
LambdaConfig:
  CustomEmailSender:
    LambdaArn: !GetAtt ResendEmailSenderFunction.Arn  # ← line 472
    LambdaVersion: V1_0
  KMSKeyID: !GetAtt CognitoEmailSenderKmsKey.Arn
```

`CustomEmailSender` Lambda triggers are only invoked when `EmailSendingAccount: DEVELOPER`. With `COGNITO_DEFAULT`, Cognito handles email delivery itself and the Cognito API rejects the `CustomEmailSender` + `COGNITO_DEFAULT` combination on UserPool update, causing CloudFormation to fail and roll back. The stack confirms this: `UPDATE_ROLLBACK_COMPLETE`.

### Commit history leading here
| Commit | Change |
|--------|--------|
| `9819f25` | Added `CustomEmailSender` Lambda trigger for Resend integration (required `DEVELOPER` mode — correct) |
| `60661e4` | Reverted to `COGNITO_DEFAULT` because "SES not ready" but **left `CustomEmailSender` in place** — created the invalid combination |
| `2daaced` | Added warning comment discouraging `DEVELOPER`, which is **incorrect advice** — `DEVELOPER` is required for `CustomEmailSender` to work |

The warning comment at lines 431–436 is **misleading** and encodes the wrong understanding of the failure. The original `DEVELOPER` mode failure was a missing SES domain verification, not a fundamental incompatibility.

### Current stack status
```
scatterpilot-vm-staging: UPDATE_ROLLBACK_COMPLETE
```
Every deploy since `60661e4` fails at the Cognito UserPool update step.

### Proposed fix
**Option A (recommended):** Change to `DEVELOPER`, ensure the sending domain (e.g. `scatterpilot.com`) is verified in SES, and remove the block on `DEVELOPER` from the warning comment.

```yaml
EmailConfiguration:
  EmailSendingAccount: DEVELOPER
  From: noreply@scatterpilot.com   # must be SES-verified
```

**Option B (fallback):** Keep `COGNITO_DEFAULT` but remove `LambdaConfig.CustomEmailSender` entirely. Resend integration would need to move to a `PostConfirmation` trigger instead (loses custom email on signup but avoids SES verification requirement).

### Risk
**HIGH** — Every deploy is blocked. No backend changes have landed in staging since `60661e4`.

---

## BUG 2 — Tax calculation: `taxable` flag missing from GET response

### Root cause
`scatterpilot/functions/invoices/get.py` lines 92–99 do not include the `taxable` field in the line items serialized back to the frontend:

```python
"line_items": [
    {
        "description": item.description,
        "quantity":    str(item.quantity),
        "unit_price":  str(item.unit_price),
        "total":       str(item.total),
        # MISSING: "taxable": item.taxable
    }
    for item in invoice.data.line_items
],
```

### Backend calculation status (already fixed)
The backend-side tax calculation is **correct** after commit `eefcfa8`:
- `models.py:108–113` — `taxable_subtotal` sums only items where `taxable=True`; `tax_amount` uses `taxable_subtotal`
- `dynamodb_helper.py:1257–1262` — `get_invoice()` correctly loads `taxable` from DynamoDB with `taxable=bool(li.get('taxable', True))`
- `pdf/generate.py:258–265` — PDF recomputes `taxable_subtotal` from line item flags

The stored DynamoDB value for INV-43701BD5 (`3040cae6-4eaa-4a9d-856d-b56143701bd5`) confirms correct storage:
- `subtotal`: $599.00 (Labor $250 + Printer $349)
- `tax_rate`: 6%
- `tax_amount`: $35.94 = $599 × 0.06 ✓ (both items taxable in this record)

### What remains broken
1. The `get.py` handler omits `taxable` from its response, so the **frontend cannot display per-line-item taxability** or re-verify the tax breakdown on invoice view.
2. If any future frontend component re-computes tax client-side (e.g., in `InvoicePreview`), it would apply tax to all items because it doesn't know which are exempt.
3. The `get.py` fix (`eefcfa8`) updated the model logic but **did not add `taxable` to the API response** — that serialization predates the per-item tax feature.

### Commit that introduced the gap
`eefcfa8 fix(backend): line-item-level tax calculation` — fixed `models.py` and `pdf/generate.py` but did not update `get.py` line 97.

### Proposed fix
Add `taxable` to the line item dict in `get.py:97`:

```python
"taxable": item.taxable,
```

### Risk
**MEDIUM** — The stored `tax_amount` is correct; users are not overcharged. Impact is visible on mixed-taxable invoices: the frontend cannot indicate which items drove the tax, and any future client-side tax re-computation would be wrong. No data corruption.

---

## BUG 3 — React error on first app load: `setDashboardMetrics` is not defined

### Root cause
`scatterpilot/frontend/src/components/AppWithSidebar.jsx` line 210 calls `setDashboardMetrics(...)` which **does not exist** as a state setter in the component. There is no corresponding `useState` declaration anywhere in the file:

```javascript
// loadDashboardData() — lines 166–221
setAllInvoices(invoices);
setDashboardMetrics({ outstanding, receivedThisMonth, overdueCount, recentActivity }); // line 210 — ReferenceError
```

On every first authenticated load, this throws `ReferenceError: setDashboardMetrics is not defined` inside the async `loadDashboardData` function, which is caught by the surrounding try-catch at line 216.

### Side effects of the silent error
Because the ReferenceError fires at line 210 and control jumps to the catch block, **the code on lines 212–214 never runs**:

```javascript
const completedFlag = localStorage.getItem('sp_onboarding_completed') === 'true';
if (!completedFlag && invoices.length === 0 && !userName) {
    setShowOnboarding(true);   // ← never reached
}
```

New users who have zero invoices will not see the onboarding flow on first load from this code path. (They may still see it via the `checkAuth()` path at line 139, which has a separate but similar check.)

### What causes this specific React error presentation
React error #310 ("Rendered more hooks than during the previous render") is typically a hook-rules violation in a child component. The `setDashboardMetrics` crash is a ReferenceError inside a useEffect callback — it is caught silently and does not directly cause a hook-count mismatch. However, after the caught error, the component is left in a partially-updated state (`isDashboardLoading = false`, `allInvoices` set, but all metric-dependent state unset), which can trigger a cascade of unexpected re-renders in children. On a hard reload the error does not repeat because `isLoading = true` during the initial render suppresses the content subtree entirely until auth resolves cleanly.

### What recent change caused it
The git log for `AppWithSidebar.jsx` shows:
```
4d022ae feat: separate Profile from Settings — own page, mobile nav icon
00d27bc feat: implement Pro features — branding removal, real reports with charts
```

Commit `00d27bc` (or `4d022ae`) refactored `loadDashboardData` to pass `invoices` directly to `DashboardHome` rather than passing pre-computed metric props. The `dashboardMetrics` state and its setter were removed, but the `setDashboardMetrics(...)` call at line 210 was left in — dead code referencing a deleted state.

### Proposed fix
Remove line 210 from `AppWithSidebar.jsx`. The metrics (`outstanding`, `receivedThisMonth`, `overdueCount`, `recentActivity`) are computed and consumed only inside `loadDashboardData` — they were never stored in state after the refactor. The surrounding `const outstanding = ...` local variables (lines 178–207) should also be removed since they are dead after the deletion of line 210.

### Risk
**MEDIUM** — The error is caught silently so the app renders correctly in most scenarios. The principal user-visible impact is that the onboarding flow may not appear for new users with no invoices (line 213–214 never runs). Dashboard data (`allInvoices`) IS set correctly at line 209 before the error fires.

---

## Summary

| Bug | File | Line | Risk | Blocking? |
|-----|------|------|------|-----------|
| 1 — Cognito `COGNITO_DEFAULT` + `CustomEmailSender` invalid | `infrastructure/template.yaml` | 469–474 | **HIGH** | Yes — all staging deploys fail |
| 2 — `taxable` missing from GET response | `functions/invoices/get.py` | 97 | MEDIUM | No — stored value correct |
| 3 — `setDashboardMetrics` ReferenceError | `frontend/src/components/AppWithSidebar.jsx` | 210 | MEDIUM | No — caught silently |

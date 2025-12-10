# Complementary Pro Accounts

Accounts granted free Pro tier access for testing, feedback, strategic partnerships, or evangelism.

## Active Comp Accounts

| Name | Email | Company | Reason | Date Granted | User ID | Notes |
|------|-------|---------|--------|--------------|---------|-------|
| Paul McKenzie | Pmacvzw@gmail.com | MetLife | Mentor/Enterprise evangelist | 2025-11-30 | `f428a468-00f1-70e7-a8f1-817534a45fed` | Verizon colleague, testing for enterprise use case |

## Granting Comp Access

### Quick Method (Using Script)

```bash
cd scripts
./grant-pro-access.sh <user-email> "<reason>"
```

**Example:**
```bash
./grant-pro-access.sh paul@metlife.com "MetLife tester/evangelist"
```

### Manual Method

1. **Find User ID:**
```bash
aws cognito-idp list-users \
  --user-pool-id us-east-1_ahnfveSG0 \
  --region us-east-1 \
  --output json | jq '.Users[] | select(.Attributes[] | select(.Name=="email" and .Value=="<email>")) | .Username'
```

2. **Update Subscription:**
```bash
aws dynamodb update-item \
  --table-name ScatterPilot-Subscriptions-dev \
  --key '{"user_id":{"S":"<user-id>"}}' \
  --update-expression "SET subscription_status = :status, stripe_customer_id = :stripe, updated_at = :timestamp" \
  --expression-attribute-values '{
    ":status":{"S":"pro"},
    ":stripe":{"S":"comp-<identifier>"},
    ":timestamp":{"S":"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
  }' \
  --region us-east-1
```

3. **Verify:**
```bash
aws dynamodb get-item \
  --table-name ScatterPilot-Subscriptions-dev \
  --key '{"user_id":{"S":"<user-id>"}}' \
  --region us-east-1
```

4. **Update this document** with the new comp account details.

## Comp Account Benefits

Pro tier users receive:
- ✅ **Unlimited invoices** (no 5/month limit)
- ✅ **Custom invoice branding** (color selection)
- ✅ **Priority support** (if implemented)
- ✅ **Early access to new features** (beta testing)

## Revoking Comp Access

To downgrade a comp account back to free tier:

```bash
aws dynamodb update-item \
  --table-name ScatterPilot-Subscriptions-dev \
  --key '{"user_id":{"S":"<user-id>"}}' \
  --update-expression "SET subscription_status = :status, updated_at = :timestamp REMOVE stripe_customer_id" \
  --expression-attribute-values '{
    ":status":{"S":"free"},
    ":timestamp":{"S":"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
  }' \
  --region us-east-1
```

## Tracking Metrics

When we have 10+ comp accounts, consider:
- Creating a "Partner" or "Enterprise" tier
- Building an admin dashboard to manage comps
- Setting expiration dates for comp access (e.g., 90-day trials)
- Tracking usage metrics for comp accounts vs. paying users

## Notes

- All comp accounts are marked with `stripe_customer_id` starting with `comp-`
- This prevents accidental billing and makes comp accounts easily identifiable
- Regular audits should be conducted to ensure comp access is still warranted
- Document all comp grants in this file for accountability

## Contact

For questions about comp account policy:
- Technical: Engineering team
- Business: Sales/Marketing team

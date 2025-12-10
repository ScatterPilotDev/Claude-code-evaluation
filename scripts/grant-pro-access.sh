#!/bin/bash

# Grant Pro tier access to a user
# Usage: ./grant-pro-access.sh <user-email> <reason>

set -e

USER_EMAIL=$1
REASON=$2

if [ -z "$USER_EMAIL" ] || [ -z "$REASON" ]; then
  echo "Usage: ./grant-pro-access.sh <user-email> <reason>"
  echo "Example: ./grant-pro-access.sh paul@metlife.com \"MetLife tester/evangelist\""
  exit 1
fi

# Configuration
USER_POOL_ID="us-east-1_ahnfveSG0"
SUBSCRIPTIONS_TABLE="ScatterPilot-Subscriptions-dev"
REGION="us-east-1"

echo "🔍 Finding user: $USER_EMAIL"

# Find user by email in Cognito
USER_DATA=$(aws cognito-idp list-users \
  --user-pool-id "$USER_POOL_ID" \
  --region "$REGION" \
  --output json)

# Extract user ID (sub) for the matching email
USER_ID=$(echo "$USER_DATA" | jq -r ".Users[] | select(.Attributes[] | select(.Name==\"email\" and .Value==\"$USER_EMAIL\")) | .Username")

if [ -z "$USER_ID" ] || [ "$USER_ID" == "null" ]; then
  echo "❌ Error: User not found with email $USER_EMAIL"
  exit 1
fi

echo "✅ Found user ID: $USER_ID"
echo "🚀 Granting Pro tier access..."

# Generate timestamp and comp ID
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
COMP_ID="comp-$(date +%s)"

# Update to Pro tier in DynamoDB
aws dynamodb update-item \
  --table-name "$SUBSCRIPTIONS_TABLE" \
  --key "{\"user_id\":{\"S\":\"$USER_ID\"}}" \
  --update-expression "SET subscription_status = :status, stripe_customer_id = :stripe, updated_at = :timestamp" \
  --expression-attribute-values "{
    \":status\":{\"S\":\"pro\"},
    \":stripe\":{\"S\":\"$COMP_ID\"},
    \":timestamp\":{\"S\":\"$TIMESTAMP\"}
  }" \
  --region "$REGION"

echo ""
echo "✅ Pro tier granted successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📧 Email: $USER_EMAIL"
echo "🆔 User ID: $USER_ID"
echo "💳 Stripe Customer ID: $COMP_ID"
echo "📝 Reason: $REASON"
echo "⏰ Timestamp: $TIMESTAMP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Notify $USER_EMAIL that their account has been upgraded"
echo "2. Ask them to refresh ScatterPilot to see Pro features"
echo "3. Update comp-accounts.md documentation"

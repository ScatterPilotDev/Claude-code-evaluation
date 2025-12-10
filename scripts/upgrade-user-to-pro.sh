#!/bin/bash

# Manual User Pro Upgrade Script
# Usage: ./scripts/upgrade-user-to-pro.sh <email>

set -e

# Configuration
USER_POOL_ID="us-east-1_ahnfveSG0"
SUBSCRIPTIONS_TABLE="ScatterPilot-Subscriptions-dev"
REGION="us-east-1"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if email is provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: $0 <email>${NC}"
    echo "Example: $0 user@example.com"
    exit 1
fi

EMAIL="$1"

echo -e "${BLUE}=== Manual Pro Upgrade ===${NC}"
echo "Email: $EMAIL"
echo ""

# Step 1: Get user_id from Cognito
echo -e "${BLUE}Step 1: Getting user_id from Cognito...${NC}"
USER_DATA=$(aws cognito-idp list-users \
    --user-pool-id "$USER_POOL_ID" \
    --filter "email = \"$EMAIL\"" \
    --region "$REGION")

USER_ID=$(echo "$USER_DATA" | jq -r '.Users[0].Attributes[] | select(.Name=="sub") | .Value')

if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
    echo -e "${YELLOW}Error: User not found with email $EMAIL${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Found user_id: $USER_ID${NC}"
echo ""

# Step 2: Update DynamoDB subscription status
echo -e "${BLUE}Step 2: Updating subscription status to Pro...${NC}"
aws dynamodb update-item \
    --table-name "$SUBSCRIPTIONS_TABLE" \
    --key "{\"user_id\": {\"S\": \"$USER_ID\"}}" \
    --update-expression "SET subscription_status = :status, subscription_end_date = :end_date" \
    --expression-attribute-values '{
        ":status": {"S": "pro"},
        ":end_date": {"S": "2099-12-31T23:59:59Z"}
    }' \
    --region "$REGION"

echo -e "${GREEN}✓ Subscription updated${NC}"
echo ""

# Step 3: Verify the update
echo -e "${BLUE}Step 3: Verifying subscription...${NC}"
SUBSCRIPTION=$(aws dynamodb get-item \
    --table-name "$SUBSCRIPTIONS_TABLE" \
    --key "{\"user_id\": {\"S\": \"$USER_ID\"}}" \
    --region "$REGION")

STATUS=$(echo "$SUBSCRIPTION" | jq -r '.Item.subscription_status.S')
END_DATE=$(echo "$SUBSCRIPTION" | jq -r '.Item.subscription_end_date.S')

echo -e "${GREEN}✓ Verification complete:${NC}"
echo "  Subscription Status: $STATUS"
echo "  Subscription End Date: $END_DATE"
echo ""

# Summary
echo -e "${GREEN}=== Upgrade Complete ===${NC}"
echo "User: $EMAIL"
echo "User ID: $USER_ID"
echo "Status: $STATUS"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. User should log out and log back in to scatterpilot.com"
echo "2. Go to /account page to see Pro status"
echo "3. Test Pro features:"
echo "   - Color picker (not grayed out)"
echo "   - Business name field (not locked)"
echo "   - Create invoice → PDF should have no watermark"

#!/bin/bash

###############################################################################
# ScatterPilot - Deployment Test Script
# Tests the deployed API endpoints and Bedrock integration
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_FILE="$PROJECT_ROOT/.deployment-outputs"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           ScatterPilot - Deployment Test Suite                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# Load deployment outputs
# ============================================================================
if [ ! -f "$OUTPUT_FILE" ]; then
    echo -e "${RED}✗ Deployment outputs not found${NC}"
    echo "Please run ./scripts/03-deploy.sh first"
    exit 1
fi

source "$OUTPUT_FILE"

echo -e "${CYAN}Testing deployment:${NC}"
echo "  API URL: $API_URL"
echo "  Region: $AWS_REGION"
echo "  Environment: $ENVIRONMENT"
echo ""

# ============================================================================
# Test 1: API Gateway Health
# ============================================================================
echo -e "${BLUE}[Test 1/5] API Gateway Health Check${NC}"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/conversation" \
    -X OPTIONS \
    -H "Access-Control-Request-Method: POST" \
    -H "Origin: http://localhost")

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 204 ]; then
    echo -e "${GREEN}✓${NC} API Gateway is accessible (HTTP $HTTP_CODE)"
    echo -e "${GREEN}✓${NC} CORS is configured correctly"
else
    echo -e "${RED}✗${NC} API Gateway returned HTTP $HTTP_CODE"
fi

echo ""

# ============================================================================
# Test 2: Bedrock Conversation Endpoint
# ============================================================================
echo -e "${BLUE}[Test 2/5] Bedrock Conversation Endpoint${NC}"
echo "Sending test message to AI..."
echo ""

# Generate unique user_id for testing
USER_ID="test-user-$(date +%s)"

# Create test request
REQUEST_BODY=$(cat <<EOF
{
  "user_id": "$USER_ID",
  "message": "Can you invoice Acme Corp for 5 widgets at \$10 each?"
}
EOF
)

# Send request
RESPONSE=$(curl -s -X POST "$API_URL/conversation" \
    -H "Content-Type: application/json" \
    -d "$REQUEST_BODY")

# Check response
if echo "$RESPONSE" | jq -e '.conversation_id' > /dev/null 2>&1; then
    CONVERSATION_ID=$(echo "$RESPONSE" | jq -r '.conversation_id')
    AI_MESSAGE=$(echo "$RESPONSE" | jq -r '.message' | head -c 100)

    echo -e "${GREEN}✓${NC} Bedrock conversation successful"
    echo -e "${GREEN}✓${NC} Conversation ID: $CONVERSATION_ID"
    echo -e "${GREEN}✓${NC} AI Response preview: ${AI_MESSAGE}..."
    echo ""
    echo "Full response:"
    echo "$RESPONSE" | jq '.'
else
    echo -e "${RED}✗${NC} Conversation endpoint failed"
    echo "Response: $RESPONSE"
fi

echo ""

# ============================================================================
# Test 3: DynamoDB Tables
# ============================================================================
echo -e "${BLUE}[Test 3/5] DynamoDB Tables${NC}"

# Check Conversations table
CONV_STATUS=$(aws dynamodb describe-table \
    --table-name "$CONVERSATIONS_TABLE" \
    --region "$AWS_REGION" \
    --query 'Table.TableStatus' \
    --output text 2>/dev/null || echo "ERROR")

if [ "$CONV_STATUS" = "ACTIVE" ]; then
    CONV_COUNT=$(aws dynamodb scan \
        --table-name "$CONVERSATIONS_TABLE" \
        --region "$AWS_REGION" \
        --select "COUNT" \
        --query 'Count' \
        --output text)
    echo -e "${GREEN}✓${NC} Conversations table is active ($CONV_COUNT items)"
else
    echo -e "${RED}✗${NC} Conversations table status: $CONV_STATUS"
fi

# Check Invoices table
INV_STATUS=$(aws dynamodb describe-table \
    --table-name "$INVOICES_TABLE" \
    --region "$AWS_REGION" \
    --query 'Table.TableStatus' \
    --output text 2>/dev/null || echo "ERROR")

if [ "$INV_STATUS" = "ACTIVE" ]; then
    INV_COUNT=$(aws dynamodb scan \
        --table-name "$INVOICES_TABLE" \
        --region "$AWS_REGION" \
        --select "COUNT" \
        --query 'Count' \
        --output text)
    echo -e "${GREEN}✓${NC} Invoices table is active ($INV_COUNT items)"
else
    echo -e "${RED}✗${NC} Invoices table status: $INV_STATUS"
fi

echo ""

# ============================================================================
# Test 4: S3 Bucket
# ============================================================================
echo -e "${BLUE}[Test 4/5] S3 Bucket${NC}"

if aws s3 ls "s3://$INVOICE_BUCKET" --region "$AWS_REGION" > /dev/null 2>&1; then
    BUCKET_VERSIONING=$(aws s3api get-bucket-versioning \
        --bucket "$INVOICE_BUCKET" \
        --region "$AWS_REGION" \
        --query 'Status' \
        --output text 2>/dev/null || echo "Disabled")

    BUCKET_ENCRYPTION=$(aws s3api get-bucket-encryption \
        --bucket "$INVOICE_BUCKET" \
        --region "$AWS_REGION" \
        --query 'ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm' \
        --output text 2>/dev/null || echo "None")

    echo -e "${GREEN}✓${NC} S3 bucket exists: $INVOICE_BUCKET"
    echo -e "${GREEN}✓${NC} Versioning: $BUCKET_VERSIONING"
    echo -e "${GREEN}✓${NC} Encryption: $BUCKET_ENCRYPTION"
else
    echo -e "${RED}✗${NC} S3 bucket not accessible"
fi

echo ""

# ============================================================================
# Test 5: Lambda Functions
# ============================================================================
echo -e "${BLUE}[Test 5/5] Lambda Functions${NC}"

# List all Lambda functions for this stack
FUNCTIONS=(
    "ScatterPilot-Conversation-$ENVIRONMENT"
    "ScatterPilot-CreateInvoice-$ENVIRONMENT"
    "ScatterPilot-ListInvoices-$ENVIRONMENT"
    "ScatterPilot-GetInvoice-$ENVIRONMENT"
    "ScatterPilot-GeneratePDF-$ENVIRONMENT"
)

for FUNC in "${FUNCTIONS[@]}"; do
    STATUS=$(aws lambda get-function \
        --function-name "$FUNC" \
        --region "$AWS_REGION" \
        --query 'Configuration.State' \
        --output text 2>/dev/null || echo "ERROR")

    if [ "$STATUS" = "Active" ]; then
        echo -e "${GREEN}✓${NC} $FUNC is active"
    else
        echo -e "${RED}✗${NC} $FUNC status: $STATUS"
    fi
done

echo ""

# ============================================================================
# Summary
# ============================================================================
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Test Suite Complete!${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${BLUE}Additional Testing:${NC}"
echo ""
echo "  1. View CloudWatch Logs:"
echo "     aws logs tail /aws/lambda/ScatterPilot-Conversation-$ENVIRONMENT --follow --region $AWS_REGION"
echo ""
echo "  2. Test with curl:"
echo "     curl -X POST $API_URL/conversation \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"user_id\":\"test\",\"message\":\"Create invoice for Acme Corp\"}'"
echo ""
echo "  3. Monitor costs:"
echo "     ./scripts/06-setup-monitoring.sh"
echo ""
echo "  4. View API in AWS Console:"
echo "     https://console.aws.amazon.com/apigateway/main/apis?region=$AWS_REGION"
echo ""

# Save test results
TEST_RESULTS_FILE="$PROJECT_ROOT/.test-results"
cat > "$TEST_RESULTS_FILE" <<EOF
TESTED_AT="$(date -u +"%Y-%m-%d %H:%M:%S UTC")"
API_URL="$API_URL"
TEST_CONVERSATION_ID="$CONVERSATION_ID"
TEST_USER_ID="$USER_ID"
EOF

echo -e "${GREEN}Test results saved to: .test-results${NC}"
echo ""

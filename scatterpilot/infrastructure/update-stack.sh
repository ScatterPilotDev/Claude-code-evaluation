#!/bin/bash

###############################################################################
# ScatterPilot - Direct Stack Update Script
# Updates CloudFormation stack without creating changesets (bypasses hooks)
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
INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure"
DEPLOYMENT_CONFIG="$PROJECT_ROOT/.deployment-config"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        ScatterPilot - Direct Stack Update (No Changeset)      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# Load deployment configuration
# ============================================================================
if [ ! -f "$DEPLOYMENT_CONFIG" ]; then
    echo -e "${RED}✗ Deployment configuration not found${NC}"
    echo -e "Please run ${CYAN}scripts/03-deploy.sh${NC} first to create initial stack"
    exit 1
fi

echo -e "${CYAN}Loading deployment configuration...${NC}"
source "$DEPLOYMENT_CONFIG"

# Validate required configuration
if [ -z "$STACK_NAME" ] || [ -z "$AWS_REGION" ] || [ -z "$S3_BUCKET" ]; then
    echo -e "${RED}✗ Missing required configuration${NC}"
    echo "Required: STACK_NAME, AWS_REGION, S3_BUCKET"
    exit 1
fi

echo -e "${GREEN}✓${NC} Configuration loaded"
echo -e "  Stack Name: ${CYAN}$STACK_NAME${NC}"
echo -e "  Region: ${CYAN}$AWS_REGION${NC}"
echo -e "  Environment: ${CYAN}$ENVIRONMENT${NC}"
echo -e "  S3 Bucket: ${CYAN}$S3_BUCKET${NC}"
echo ""

# ============================================================================
# Check if stack exists
# ============================================================================
echo -e "${BLUE}[Step 1/6] Verifying stack exists...${NC}"
if ! aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --output text &>/dev/null; then
    echo -e "${RED}✗ Stack '$STACK_NAME' not found${NC}"
    echo -e "Please create the stack first using ${CYAN}scripts/03-deploy.sh${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Stack exists"
echo ""

# ============================================================================
# Build SAM application
# ============================================================================
echo -e "${BLUE}[Step 2/6] Building SAM application...${NC}"
cd "$INFRASTRUCTURE_DIR"

sam build \
    --template template.yaml \
    --use-container \
    --region "$AWS_REGION"

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ SAM build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Build completed"
echo ""

# ============================================================================
# Package application to S3
# ============================================================================
echo -e "${BLUE}[Step 3/6] Packaging application to S3...${NC}"

# Ensure S3 bucket exists
if ! aws s3 ls "s3://$S3_BUCKET" --region "$AWS_REGION" &>/dev/null; then
    echo -e "${YELLOW}Creating S3 bucket: $S3_BUCKET${NC}"
    aws s3 mb "s3://$S3_BUCKET" --region "$AWS_REGION"
fi

# Package the application
PACKAGED_TEMPLATE="/tmp/packaged-template-$(date +%s).yaml"

sam package \
    --template-file .aws-sam/build/template.yaml \
    --s3-bucket "$S3_BUCKET" \
    --s3-prefix "scatterpilot-updates" \
    --output-template-file "$PACKAGED_TEMPLATE" \
    --region "$AWS_REGION"

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Package failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Package uploaded to S3"
echo ""

# ============================================================================
# Prepare stack parameters
# ============================================================================
echo -e "${BLUE}[Step 4/6] Preparing stack parameters...${NC}"

# Get existing parameter values from current stack
EXISTING_PARAMS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Parameters' \
    --output json)

# Prompt for Stripe keys (optional - use existing if not provided)
echo ""
echo -e "${CYAN}Stripe Configuration (press Enter to keep existing values):${NC}"
read -p "Stripe Secret Key (sk_...): " STRIPE_SECRET_KEY_INPUT
read -p "Stripe Webhook Secret (whsec_...): " STRIPE_WEBHOOK_SECRET_INPUT
read -p "Stripe Pro Price ID (price_...): " STRIPE_PRO_PRICE_ID_INPUT
read -p "Frontend URL [http://localhost:5173]: " FRONTEND_URL_INPUT

# Build parameters array properly
PARAMS=(
    "ParameterKey=Environment,ParameterValue=$ENVIRONMENT"
)

if [ ! -z "$STRIPE_SECRET_KEY_INPUT" ]; then
    PARAMS+=("ParameterKey=StripeSecretKey,ParameterValue=$STRIPE_SECRET_KEY_INPUT")
else
    PARAMS+=("ParameterKey=StripeSecretKey,UsePreviousValue=true")
fi

if [ ! -z "$STRIPE_WEBHOOK_SECRET_INPUT" ]; then
    PARAMS+=("ParameterKey=StripeWebhookSecret,ParameterValue=$STRIPE_WEBHOOK_SECRET_INPUT")
else
    PARAMS+=("ParameterKey=StripeWebhookSecret,UsePreviousValue=true")
fi

if [ ! -z "$STRIPE_PRO_PRICE_ID_INPUT" ]; then
    PARAMS+=("ParameterKey=StripeProPriceId,ParameterValue=$STRIPE_PRO_PRICE_ID_INPUT")
else
    PARAMS+=("ParameterKey=StripeProPriceId,UsePreviousValue=true")
fi

if [ ! -z "$FRONTEND_URL_INPUT" ]; then
    PARAMS+=("ParameterKey=FrontendUrl,ParameterValue=$FRONTEND_URL_INPUT")
else
    PARAMS+=("ParameterKey=FrontendUrl,UsePreviousValue=true")
fi

# Add remaining required parameters with UsePreviousValue
PARAMS+=("ParameterKey=StripeClientId,UsePreviousValue=true")

echo -e "${GREEN}✓${NC} Parameters prepared"
echo ""

# ============================================================================
# Pre-flight checks
# ============================================================================
echo -e "${BLUE}[Step 5/6] Running pre-flight checks...${NC}"

# Check 1: Validate Stripe keys format if provided
if [ ! -z "$STRIPE_SECRET_KEY_INPUT" ]; then
    if [[ ! "$STRIPE_SECRET_KEY_INPUT" =~ ^sk_(test|live)_[a-zA-Z0-9]{24,}$ ]]; then
        echo -e "${YELLOW}⚠ Warning: Stripe Secret Key format looks invalid (should start with sk_test_ or sk_live_)${NC}"
    else
        echo -e "${GREEN}✓${NC} Stripe Secret Key format valid"
    fi
fi

if [ ! -z "$STRIPE_WEBHOOK_SECRET_INPUT" ]; then
    if [[ ! "$STRIPE_WEBHOOK_SECRET_INPUT" =~ ^whsec_[a-zA-Z0-9]{32,}$ ]]; then
        echo -e "${YELLOW}⚠ Warning: Stripe Webhook Secret format looks invalid (should start with whsec_)${NC}"
    else
        echo -e "${GREEN}✓${NC} Stripe Webhook Secret format valid"
    fi
fi

if [ ! -z "$STRIPE_PRO_PRICE_ID_INPUT" ]; then
    if [[ ! "$STRIPE_PRO_PRICE_ID_INPUT" =~ ^price_[a-zA-Z0-9]{14,}$ ]]; then
        echo -e "${YELLOW}⚠ Warning: Stripe Price ID format looks invalid (should start with price_)${NC}"
    else
        echo -e "${GREEN}✓${NC} Stripe Price ID format valid"
    fi
fi

# Check 2: Test S3 bucket write permissions
echo -n "Testing S3 bucket write permissions... "
TEST_FILE="s3://$S3_BUCKET/scatterpilot-updates/.preflight-test-$(date +%s).txt"
if echo "preflight check" | aws s3 cp - "$TEST_FILE" --region "$AWS_REGION" &>/dev/null; then
    aws s3 rm "$TEST_FILE" --region "$AWS_REGION" &>/dev/null
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo -e "${RED}Failed to write to S3 bucket: $S3_BUCKET${NC}"
    echo -e "${YELLOW}Check IAM permissions for S3 write access${NC}"
    exit 1
fi

# Check 3: Verify Bedrock model access
echo -n "Verifying Bedrock model access (us.anthropic.claude-3-7-sonnet-20250219-v1:0)... "
if aws bedrock list-foundation-models \
    --region us-east-1 \
    --by-provider anthropic \
    --query "modelSummaries[?modelId=='us.anthropic.claude-3-7-sonnet-20250219-v1:0'].modelId" \
    --output text 2>/dev/null | grep -q "claude-3-7-sonnet"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠${NC}"
    echo -e "${YELLOW}Warning: Unable to verify Bedrock model access${NC}"
    echo -e "${YELLOW}Ensure you have requested access to Claude 3.7 Sonnet in the Bedrock console${NC}"
    echo -e "${YELLOW}Region: us-east-1${NC}"
    echo ""
    read -p "Continue anyway? (yes/no): " BEDROCK_CONFIRM
    if [ "$BEDROCK_CONFIRM" != "yes" ]; then
        echo -e "${YELLOW}Update cancelled${NC}"
        exit 0
    fi
fi

echo -e "${GREEN}✓${NC} Pre-flight checks completed"
echo ""

# ============================================================================
# Update stack directly (no changeset)
# ============================================================================
echo -e "${BLUE}[Step 6/6] Updating stack directly (bypassing changesets)...${NC}"
echo -e "${YELLOW}NOTE: This update will NOT create a changeset and will bypass organizational hooks${NC}"
echo ""

read -p "Continue with direct stack update? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo -e "${YELLOW}Update cancelled${NC}"
    rm -f "$PACKAGED_TEMPLATE"
    exit 0
fi

echo -e "${CYAN}Initiating direct stack update...${NC}"

# Use CloudFormation update-stack (not SAM deploy which creates changesets)
aws cloudformation update-stack \
    --stack-name "$STACK_NAME" \
    --template-body "file://$PACKAGED_TEMPLATE" \
    --parameters "${PARAMS[@]}" \
    --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
    --region "$AWS_REGION"

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Stack update initiation failed${NC}"
    echo -e "${YELLOW}If the stack is in UPDATE_ROLLBACK_FAILED state, manual intervention may be required${NC}"
    rm -f "$PACKAGED_TEMPLATE"
    exit 1
fi

echo -e "${GREEN}✓${NC} Stack update initiated"
echo ""

# ============================================================================
# Monitor update progress
# ============================================================================
echo -e "${CYAN}Monitoring stack update progress...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop monitoring (update will continue)${NC}"
echo ""

# Track which event we've already seen
LAST_EVENT_TIME=""
UPDATE_STATUS="IN_PROGRESS"

while [ "$UPDATE_STATUS" = "IN_PROGRESS" ]; do
    # Get current stack status
    STACK_STATUS=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].StackStatus' \
        --output text 2>/dev/null || echo "UNKNOWN")

    # Get latest stack events (most recent 5)
    EVENTS=$(aws cloudformation describe-stack-events \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --max-items 5 \
        --query 'StackEvents[*].[Timestamp,ResourceStatus,ResourceType,LogicalResourceId,ResourceStatusReason]' \
        --output text 2>/dev/null)

    # Display new events
    if [ ! -z "$EVENTS" ]; then
        while IFS=$'\t' read -r timestamp status resource_type logical_id reason; do
            # Skip if we've already seen this event
            if [ ! -z "$LAST_EVENT_TIME" ] && [[ "$timestamp" < "$LAST_EVENT_TIME" || "$timestamp" = "$LAST_EVENT_TIME" ]]; then
                continue
            fi

            # Color code based on status
            if [[ "$status" == *"COMPLETE"* ]]; then
                STATUS_COLOR="$GREEN"
            elif [[ "$status" == *"FAILED"* ]] || [[ "$status" == *"ROLLBACK"* ]]; then
                STATUS_COLOR="$RED"
            elif [[ "$status" == *"IN_PROGRESS"* ]]; then
                STATUS_COLOR="$YELLOW"
            else
                STATUS_COLOR="$CYAN"
            fi

            # Format resource type for display
            SHORT_TYPE=$(echo "$resource_type" | sed 's/AWS:://' | sed 's/::/ /')

            # Display event
            echo -e "${STATUS_COLOR}▸${NC} ${SHORT_TYPE}: ${CYAN}${logical_id}${NC} - ${STATUS_COLOR}${status}${NC}"
            if [ ! -z "$reason" ] && [ "$reason" != "None" ] && [ "$reason" != "-" ]; then
                echo -e "  ${YELLOW}└─${NC} $reason"
            fi

            LAST_EVENT_TIME="$timestamp"
        done <<< "$EVENTS"
    fi

    # Check if update is complete
    if [[ "$STACK_STATUS" == "UPDATE_COMPLETE" ]]; then
        UPDATE_STATUS="SUCCESS"
        break
    elif [[ "$STACK_STATUS" == "UPDATE_ROLLBACK_COMPLETE" ]] || \
         [[ "$STACK_STATUS" == "UPDATE_ROLLBACK_FAILED" ]] || \
         [[ "$STACK_STATUS" == "UPDATE_FAILED" ]]; then
        UPDATE_STATUS="FAILED"
        break
    elif [[ "$STACK_STATUS" != "UPDATE_IN_PROGRESS" ]] && \
         [[ "$STACK_STATUS" != "UPDATE_COMPLETE_CLEANUP_IN_PROGRESS" ]]; then
        # Unexpected status
        echo -e "${RED}Unexpected stack status: $STACK_STATUS${NC}"
        UPDATE_STATUS="FAILED"
        break
    fi

    # Wait before checking again
    sleep 5
done

echo ""

# Set exit status based on result
if [ "$UPDATE_STATUS" = "SUCCESS" ]; then
    UPDATE_STATUS=0
else
    UPDATE_STATUS=1
fi

# Clean up packaged template
rm -f "$PACKAGED_TEMPLATE"

if [ $UPDATE_STATUS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                  Stack Update Successful!                      ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Get stack outputs
    echo -e "${CYAN}Stack Outputs:${NC}"
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
        --output table

    echo ""
    echo -e "${GREEN}Stack updated successfully without changesets!${NC}"
    echo -e "Updated components:"
    echo -e "  ✓ Lambda functions with new Bedrock model"
    echo -e "  ✓ Pro tier subscription gating"
    echo -e "  ✓ Stripe webhook handling"

else
    echo ""
    echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                    Stack Update Failed                         ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}CloudFormation will automatically rollback the failed changes.${NC}"
    echo -e "${YELLOW}Check stack events for details:${NC}"
    echo -e "https://console.aws.amazon.com/cloudformation/home?region=$AWS_REGION#/stacks"
    echo ""
    echo -e "${CYAN}To view recent stack events:${NC}"
    echo -e "aws cloudformation describe-stack-events --stack-name $STACK_NAME --region $AWS_REGION --max-items 20"
    exit 1
fi

#!/bin/bash

###############################################################################
# ScatterPilot - Deployment Script
# Automates SAM build and deployment with guided prompts
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
DEPLOYMENT_CONFIG="$PROJECT_ROOT/.deployment-config"
LOG_SCRIPT="$(cd "$PROJECT_ROOT/.." && pwd)/scripts/log-activity.sh"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              ScatterPilot - AWS Deployment                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# Load previous configuration if exists
# ============================================================================
if [ -f "$DEPLOYMENT_CONFIG" ]; then
    echo -e "${CYAN}Found previous deployment configuration${NC}"
    source "$DEPLOYMENT_CONFIG"
    echo -e "Previous settings:"
    echo -e "  Stack Name: ${STACK_NAME:-Not set}"
    echo -e "  Region: ${AWS_REGION:-Not set}"
    echo -e "  Environment: ${ENVIRONMENT:-Not set}"
    echo ""

    read -p "Use previous configuration? (y/n): " USE_PREVIOUS
    if [[ ! $USE_PREVIOUS =~ ^[Yy]$ ]]; then
        rm -f "$DEPLOYMENT_CONFIG"
        unset STACK_NAME AWS_REGION ENVIRONMENT S3_BUCKET
    fi
fi

# ============================================================================
# Gather deployment parameters
# ============================================================================
echo -e "${BLUE}[Step 1/6] Deployment Configuration${NC}"
echo ""

# Stack name
if [ -z "$STACK_NAME" ]; then
    read -p "Enter stack name [scatterpilot]: " INPUT_STACK_NAME
    STACK_NAME=${INPUT_STACK_NAME:-scatterpilot}
fi
echo -e "${GREEN}✓${NC} Stack name: $STACK_NAME"

# AWS Region
if [ -z "$AWS_REGION" ]; then
    CURRENT_REGION=$(aws configure get region 2>/dev/null || echo "us-east-1")
    echo ""
    echo "Recommended regions for Bedrock Claude 3.5 Sonnet:"
    echo "  1. us-east-1 (US East - N. Virginia) [Recommended]"
    echo "  2. us-west-2 (US West - Oregon)"
    echo "  3. eu-west-1 (Europe - Ireland)"
    echo ""
    read -p "Enter AWS region [$CURRENT_REGION]: " INPUT_REGION
    AWS_REGION=${INPUT_REGION:-$CURRENT_REGION}
fi
echo -e "${GREEN}✓${NC} AWS Region: $AWS_REGION"

# Environment
if [ -z "$ENVIRONMENT" ]; then
    echo ""
    echo "Select environment:"
    echo "  1. dev (Development)"
    echo "  2. staging (Staging)"
    echo "  3. prod (Production)"
    echo ""
    read -p "Choose environment [1]: " ENV_CHOICE
    case ${ENV_CHOICE:-1} in
        1) ENVIRONMENT="dev" ;;
        2) ENVIRONMENT="staging" ;;
        3) ENVIRONMENT="prod" ;;
        *) ENVIRONMENT="dev" ;;
    esac
fi
echo -e "${GREEN}✓${NC} Environment: $ENVIRONMENT"

# S3 Bucket for SAM artifacts
if [ -z "$S3_BUCKET" ]; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    DEFAULT_BUCKET="scatterpilot-sam-artifacts-${ACCOUNT_ID}-${AWS_REGION}"
    echo ""
    read -p "Enter S3 bucket for deployment artifacts [$DEFAULT_BUCKET]: " INPUT_BUCKET
    S3_BUCKET=${INPUT_BUCKET:-$DEFAULT_BUCKET}
fi
echo -e "${GREEN}✓${NC} S3 Bucket: $S3_BUCKET"

# Cognito (optional)
if [ -z "$COGNITO_ARN" ]; then
    echo ""
    read -p "Do you have a Cognito User Pool ARN for authentication? (y/n) [n]: " HAS_COGNITO
    if [[ $HAS_COGNITO =~ ^[Yy]$ ]]; then
        read -p "Enter Cognito User Pool ARN: " COGNITO_ARN
    else
        COGNITO_ARN=""
    fi
fi
if [ -n "$COGNITO_ARN" ]; then
    echo -e "${GREEN}✓${NC} Cognito enabled"
else
    echo -e "${YELLOW}⚠${NC} Cognito disabled (API will be publicly accessible)"
fi

echo ""

# Save configuration
cat > "$DEPLOYMENT_CONFIG" <<EOF
STACK_NAME="$STACK_NAME"
AWS_REGION="$AWS_REGION"
ENVIRONMENT="$ENVIRONMENT"
S3_BUCKET="$S3_BUCKET"
COGNITO_ARN="$COGNITO_ARN"
EOF

echo -e "${GREEN}✓${NC} Configuration saved to .deployment-config"
echo ""

# ============================================================================
# Create S3 bucket if it doesn't exist
# ============================================================================
echo -e "${BLUE}[Step 2/6] Preparing S3 Bucket${NC}"
echo ""

if aws s3 ls "s3://$S3_BUCKET" --region "$AWS_REGION" 2>&1 | grep -q 'NoSuchBucket'; then
    echo "Creating S3 bucket: $S3_BUCKET"

    if [ "$AWS_REGION" = "us-east-1" ]; then
        aws s3 mb "s3://$S3_BUCKET" --region "$AWS_REGION"
    else
        aws s3 mb "s3://$S3_BUCKET" --region "$AWS_REGION" --create-bucket-configuration LocationConstraint="$AWS_REGION"
    fi

    # Enable versioning
    aws s3api put-bucket-versioning \
        --bucket "$S3_BUCKET" \
        --region "$AWS_REGION" \
        --versioning-configuration Status=Enabled

    echo -e "${GREEN}✓${NC} S3 bucket created: $S3_BUCKET"
else
    echo -e "${GREEN}✓${NC} S3 bucket exists: $S3_BUCKET"
fi

echo ""

# ============================================================================
# Build SAM application
# ============================================================================
echo -e "${BLUE}[Step 3/6] Building SAM Application${NC}"
echo ""
echo "This may take a few minutes..."
echo ""

cd "$PROJECT_ROOT/infrastructure"

# Check if Docker is running (for Lambda layers)
if docker ps &> /dev/null; then
    echo "Using Docker to build Lambda layers..."
    sam build --use-container --region "$AWS_REGION"
else
    echo -e "${YELLOW}⚠ Docker not running, building without container${NC}"
    sam build --region "$AWS_REGION"
fi

echo ""
echo -e "${GREEN}✓${NC} Build complete"
echo ""

# ============================================================================
# Validate template
# ============================================================================
echo -e "${BLUE}[Step 4/6] Validating SAM Template${NC}"
echo ""

sam validate --lint --region "$AWS_REGION"

echo ""
echo -e "${GREEN}✓${NC} Template validated"
echo ""

# ============================================================================
# Deploy SAM application
# ============================================================================
echo -e "${BLUE}[Step 5/6] Deploying to AWS${NC}"
echo ""
echo "Stack: $STACK_NAME"
echo "Region: $AWS_REGION"
echo "Environment: $ENVIRONMENT"
echo ""

# Prepare parameter overrides
PARAM_OVERRIDES="Environment=$ENVIRONMENT"
if [ -n "$COGNITO_ARN" ]; then
    PARAM_OVERRIDES="$PARAM_OVERRIDES CognitoUserPoolArn=$COGNITO_ARN"
fi

# Check if this is first deployment
if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" &> /dev/null; then
    echo "Updating existing stack..."
    CAPABILITIES="CAPABILITY_IAM CAPABILITY_NAMED_IAM"
    CONFIRM_CHANGESET="--no-confirm-changeset"
else
    echo "Creating new stack..."
    CAPABILITIES="CAPABILITY_IAM CAPABILITY_NAMED_IAM"
    CONFIRM_CHANGESET=""
fi

# Deploy
sam deploy \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --s3-bucket "$S3_BUCKET" \
    --s3-prefix "$STACK_NAME" \
    --capabilities $CAPABILITIES \
    --parameter-overrides $PARAM_OVERRIDES \
    --tags Environment="$ENVIRONMENT" Application="ScatterPilot" \
    --no-fail-on-empty-changeset \
    $CONFIRM_CHANGESET

echo ""
echo -e "${GREEN}✓${NC} Deployment complete!"
echo ""

# Log deployment
if [ -x "$LOG_SCRIPT" ]; then
    "$LOG_SCRIPT" DEPLOY "Deployed ScatterPilot to AWS region $AWS_REGION: stack $STACK_NAME with Lambda functions, API Gateway, DynamoDB tables, and S3 storage for $ENVIRONMENT environment" 2>/dev/null || true
fi

# ============================================================================
# Get outputs
# ============================================================================
echo -e "${BLUE}[Step 6/6] Deployment Information${NC}"
echo ""

# Retrieve stack outputs
API_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
    --output text)

CONVERSATIONS_TABLE=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`ConversationsTableName`].OutputValue' \
    --output text)

INVOICES_TABLE=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`InvoicesTableName`].OutputValue' \
    --output text)

INVOICE_BUCKET=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query 'Stacks[0].Outputs[?OutputKey==`InvoiceBucketName`].OutputValue' \
    --output text)

# Save outputs to file
OUTPUT_FILE="$PROJECT_ROOT/.deployment-outputs"
cat > "$OUTPUT_FILE" <<EOF
API_URL="$API_URL"
CONVERSATIONS_TABLE="$CONVERSATIONS_TABLE"
INVOICES_TABLE="$INVOICES_TABLE"
INVOICE_BUCKET="$INVOICE_BUCKET"
STACK_NAME="$STACK_NAME"
AWS_REGION="$AWS_REGION"
ENVIRONMENT="$ENVIRONMENT"
DEPLOYED_AT="$(date -u +"%Y-%m-%d %H:%M:%S UTC")"
EOF

# Display outputs
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Deployment Successful!${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}API Gateway URL:${NC}"
echo "  $API_URL"
echo ""
echo -e "${YELLOW}DynamoDB Tables:${NC}"
echo "  Conversations: $CONVERSATIONS_TABLE"
echo "  Invoices:      $INVOICES_TABLE"
echo ""
echo -e "${YELLOW}S3 Bucket:${NC}"
echo "  $INVOICE_BUCKET"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# ============================================================================
# Next steps
# ============================================================================
echo -e "${BLUE}Next Steps:${NC}"
echo ""
echo "  1. Test the API:"
echo "     ./scripts/04-test-deployment.sh"
echo ""
echo "  2. Update frontend to use API:"
echo "     ./scripts/05-configure-frontend.sh"
echo ""
echo "  3. Set up cost monitoring:"
echo "     ./scripts/06-setup-monitoring.sh"
echo ""
echo "  4. View CloudWatch logs:"
echo "     aws logs tail /aws/lambda/ScatterPilot-Conversation-$ENVIRONMENT --follow --region $AWS_REGION"
echo ""
echo -e "${GREEN}Deployment outputs saved to: .deployment-outputs${NC}"
echo ""

# Return to original directory
cd - > /dev/null

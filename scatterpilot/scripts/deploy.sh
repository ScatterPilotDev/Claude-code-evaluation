#!/bin/bash
set -e

echo "=================================================="
echo "ScatterPilot Deployment Script"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
STACK_NAME="ScatterPilot-dev"
REGION="us-east-1"
ENVIRONMENT="dev"

echo -e "${YELLOW}Step 1: Building SAM application...${NC}"
cd /workspaces/Claude-code-evaluation/scatterpilot/infrastructure

# Build with container to ensure Python 3.11 compatibility
sam build --use-container

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}Step 2: Deploying to AWS...${NC}"
echo "Stack Name: $STACK_NAME"
echo "Region: $REGION"
echo "Environment: $ENVIRONMENT"
echo ""

# Deploy
sam deploy \
    --template-file .aws-sam/build/template.yaml \
    --stack-name $STACK_NAME \
    --capabilities CAPABILITY_IAM \
    --region $REGION \
    --parameter-overrides Environment=$ENVIRONMENT \
    --no-fail-on-empty-changeset \
    --no-confirm-changeset

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Deployment successful!${NC}"
    echo ""

    # Get outputs
    echo -e "${YELLOW}Retrieving stack outputs...${NC}"

    API_URL=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
        --output text)

    USER_POOL_ID=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
        --output text)

    USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
        --output text)

    CONVERSATION_FUNCTION=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --region $REGION \
        --query 'Stacks[0].Outputs[?OutputKey==`ConversationFunctionArn`].OutputValue' \
        --output text)

    echo ""
    echo "=================================================="
    echo -e "${GREEN}Deployment Complete!${NC}"
    echo "=================================================="
    echo ""
    echo "API Endpoint:"
    echo "  $API_URL"
    echo ""
    echo "Cognito User Pool:"
    echo "  Pool ID: $USER_POOL_ID"
    echo "  Client ID: $USER_POOL_CLIENT_ID"
    echo ""
    echo "Conversation Function ARN:"
    echo "  $CONVERSATION_FUNCTION"
    echo ""
    echo "=================================================="
    echo "Test the Conversation Endpoint:"
    echo "=================================================="
    echo ""
    echo "curl -X POST $API_URL/conversation \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -d '{"
    echo "    \"message\": \"I need to create an invoice for John Smith for consulting services\""
    echo "  }'"
    echo ""
    echo "=================================================="
    echo "Monitor Logs:"
    echo "=================================================="
    echo ""
    echo "aws logs tail /aws/lambda/ScatterPilot-Conversation-dev --follow"
    echo ""

else
    echo ""
    echo -e "${RED}✗ Deployment failed${NC}"
    exit 1
fi

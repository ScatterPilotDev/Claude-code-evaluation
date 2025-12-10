#!/bin/bash

# ScatterPilot - Create Test User Script
# Creates a Cognito user for testing with confirmed status (no email verification needed)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STACK_NAME="scatterpilot-dev"
REGION="${AWS_REGION:-us-east-1}"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}ScatterPilot - Create Test User${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Get User Pool ID from CloudFormation
echo -e "${YELLOW}[1/5]${NC} Getting Cognito User Pool ID..."
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

if [ -z "$USER_POOL_ID" ]; then
  echo -e "${RED}Error: Could not retrieve User Pool ID. Make sure the stack is deployed.${NC}"
  exit 1
fi

echo -e "${GREEN}✓${NC} User Pool ID: $USER_POOL_ID"
echo ""

# Get user input
if [ -z "$1" ]; then
  read -p "Enter email address for test user: " TEST_EMAIL
else
  TEST_EMAIL="$1"
fi

if [ -z "$2" ]; then
  read -sp "Enter password (min 8 chars, uppercase, lowercase, number, special char): " TEST_PASSWORD
  echo ""
else
  TEST_PASSWORD="$2"
fi

# Validate inputs
if [ -z "$TEST_EMAIL" ] || [ -z "$TEST_PASSWORD" ]; then
  echo -e "${RED}Error: Email and password are required${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}[2/5]${NC} Creating user..."

# Create user
aws cognito-idp admin-create-user \
  --user-pool-id "$USER_POOL_ID" \
  --username "$TEST_EMAIL" \
  --user-attributes Name=email,Value="$TEST_EMAIL" Name=email_verified,Value=true \
  --message-action SUPPRESS \
  --region "$REGION" 2>/dev/null || {
    echo -e "${YELLOW}Note: User may already exist, continuing...${NC}"
  }

echo -e "${GREEN}✓${NC} User created"
echo ""

echo -e "${YELLOW}[3/5]${NC} Setting permanent password..."

# Set permanent password (skip temp password flow)
aws cognito-idp admin-set-user-password \
  --user-pool-id "$USER_POOL_ID" \
  --username "$TEST_EMAIL" \
  --password "$TEST_PASSWORD" \
  --permanent \
  --region "$REGION"

echo -e "${GREEN}✓${NC} Password set"
echo ""

echo -e "${YELLOW}[4/5]${NC} Confirming user account..."

# Confirm user (skip email verification)
aws cognito-idp admin-confirm-sign-up \
  --user-pool-id "$USER_POOL_ID" \
  --username "$TEST_EMAIL" \
  --region "$REGION"

echo -e "${GREEN}✓${NC} User confirmed"
echo ""

# Get User Pool Client ID
echo -e "${YELLOW}[5/5]${NC} Getting User Pool Client ID..."
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text)

echo -e "${GREEN}✓${NC} Client ID: $USER_POOL_CLIENT_ID"
echo ""

# Summary
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}✓ Test User Created Successfully!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${BLUE}Login Credentials:${NC}"
echo -e "  Email:    ${YELLOW}$TEST_EMAIL${NC}"
echo -e "  Password: ${YELLOW}$TEST_PASSWORD${NC}"
echo ""
echo -e "${BLUE}Cognito Configuration:${NC}"
echo -e "  User Pool ID:        ${YELLOW}$USER_POOL_ID${NC}"
echo -e "  User Pool Client ID: ${YELLOW}$USER_POOL_CLIENT_ID${NC}"
echo -e "  Region:              ${YELLOW}$REGION${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo -e "1. Update frontend .env file with:"
echo -e "   ${YELLOW}VITE_COGNITO_USER_POOL_ID=$USER_POOL_ID${NC}"
echo -e "   ${YELLOW}VITE_COGNITO_CLIENT_ID=$USER_POOL_CLIENT_ID${NC}"
echo -e "   ${YELLOW}VITE_AWS_REGION=$REGION${NC}"
echo -e "2. Rebuild and redeploy the frontend"
echo -e "3. Login with the credentials above"
echo ""

#!/bin/bash

###############################################################################
# ScatterPilot - Create Deployment User with Minimal Permissions
# This script creates a new IAM user with ONLY the permissions needed
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     ScatterPilot - Create Least-Privilege Deployment User     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POLICY_FILE="$SCRIPT_DIR/scatterpilot-deploy-policy.json"
USER_NAME="scatterpilot-deploy"

# ============================================================================
# Step 1: Verify we have the policy file
# ============================================================================
echo -e "${BLUE}[Step 1/7] Verifying policy file...${NC}"

if [ ! -f "$POLICY_FILE" ]; then
    echo -e "${RED}✗ Policy file not found: $POLICY_FILE${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Policy file found"
echo ""

# ============================================================================
# Step 2: Check current user permissions
# ============================================================================
echo -e "${BLUE}[Step 2/7] Checking current AWS permissions...${NC}"

CURRENT_USER=$(aws sts get-caller-identity --query Arn --output text 2>/dev/null || echo "")

if [ -z "$CURRENT_USER" ]; then
    echo -e "${RED}✗ Not authenticated to AWS${NC}"
    echo "Please run: aws configure"
    exit 1
fi

echo -e "${GREEN}✓${NC} Current user: $CURRENT_USER"

# Check if using root (bad practice)
if echo "$CURRENT_USER" | grep -q ":root"; then
    echo -e "${YELLOW}⚠ WARNING: You're using the root account!${NC}"
    echo -e "${YELLOW}  This is not recommended for security reasons.${NC}"
    echo ""
    read -p "Continue anyway? (y/n): " CONTINUE
    if [[ ! $CONTINUE =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

# Check if user has AdministratorAccess
echo ""
echo -e "${CYAN}Checking for overly-permissive policies...${NC}"

if echo "$CURRENT_USER" | grep -q ":user/"; then
    CURRENT_USERNAME=$(echo $CURRENT_USER | cut -d'/' -f2)
    ATTACHED_POLICIES=$(aws iam list-attached-user-policies --user-name "$CURRENT_USERNAME" --query 'AttachedPolicies[*].PolicyName' --output text 2>/dev/null || echo "")

    if echo "$ATTACHED_POLICIES" | grep -q "AdministratorAccess"; then
        echo -e "${YELLOW}⚠ WARNING: Current user has AdministratorAccess${NC}"
        echo -e "${YELLOW}  This grants full permissions to all AWS services!${NC}"
        echo -e "${CYAN}  We'll create a new user with minimal permissions instead.${NC}"
    fi
fi

echo ""

# ============================================================================
# Step 3: Check if user already exists
# ============================================================================
echo -e "${BLUE}[Step 3/7] Checking if user already exists...${NC}"

if aws iam get-user --user-name "$USER_NAME" &> /dev/null; then
    echo -e "${YELLOW}⚠ User '$USER_NAME' already exists${NC}"
    echo ""
    read -p "Delete and recreate user? (y/n): " RECREATE

    if [[ $RECREATE =~ ^[Yy]$ ]]; then
        echo ""
        echo -e "${CYAN}Deleting existing user...${NC}"

        # Delete access keys
        ACCESS_KEYS=$(aws iam list-access-keys --user-name "$USER_NAME" --query 'AccessKeyMetadata[*].AccessKeyId' --output text 2>/dev/null || echo "")
        for KEY_ID in $ACCESS_KEYS; do
            echo "  Deleting access key: $KEY_ID"
            aws iam delete-access-key --user-name "$USER_NAME" --access-key-id "$KEY_ID"
        done

        # Detach managed policies
        ATTACHED=$(aws iam list-attached-user-policies --user-name "$USER_NAME" --query 'AttachedPolicies[*].PolicyArn' --output text 2>/dev/null || echo "")
        for POLICY_ARN in $ATTACHED; do
            echo "  Detaching policy: $POLICY_ARN"
            aws iam detach-user-policy --user-name "$USER_NAME" --policy-arn "$POLICY_ARN"
        done

        # Delete inline policies
        INLINE=$(aws iam list-user-policies --user-name "$USER_NAME" --query 'PolicyNames[*]' --output text 2>/dev/null || echo "")
        for POLICY_NAME in $INLINE; do
            echo "  Deleting inline policy: $POLICY_NAME"
            aws iam delete-user-policy --user-name "$USER_NAME" --policy-name "$POLICY_NAME"
        done

        # Delete user
        aws iam delete-user --user-name "$USER_NAME"
        echo -e "${GREEN}✓${NC} Existing user deleted"
    else
        echo "Exiting. Use a different user name or delete manually."
        exit 0
    fi
else
    echo -e "${GREEN}✓${NC} User does not exist (will create new)"
fi

echo ""

# ============================================================================
# Step 4: Create IAM user
# ============================================================================
echo -e "${BLUE}[Step 4/7] Creating IAM user...${NC}"

aws iam create-user \
    --user-name "$USER_NAME" \
    --tags Key=Purpose,Value=ScatterPilotDeployment Key=Principle,Value=LeastPrivilege

echo -e "${GREEN}✓${NC} User created: $USER_NAME"
echo ""

# ============================================================================
# Step 5: Attach least-privilege policy
# ============================================================================
echo -e "${BLUE}[Step 5/7] Attaching minimal permissions policy...${NC}"

aws iam put-user-policy \
    --user-name "$USER_NAME" \
    --policy-name "ScatterPilotDeployPolicy" \
    --policy-document file://"$POLICY_FILE"

echo -e "${GREEN}✓${NC} Policy attached with minimal permissions"
echo ""

# Display policy summary
echo -e "${CYAN}Policy Summary:${NC}"
echo "  ✓ CloudFormation: Create/update stacks (scatterpilot* only)"
echo "  ✓ Lambda: Manage functions (ScatterPilot-* only)"
echo "  ✓ DynamoDB: Create tables (ScatterPilot-* only)"
echo "  ✓ S3: Manage buckets (scatterpilot-* only)"
echo "  ✓ API Gateway: Create/manage REST APIs"
echo "  ✓ IAM: Create roles (Lambda service only)"
echo "  ✓ Bedrock: Invoke Claude Sonnet 4.5 only"
echo "  ✓ CloudWatch: Logs, metrics, alarms"
echo "  ✓ SNS: Create topics (ScatterPilot-* only)"
echo "  ✓ X-Ray: Put trace segments"
echo ""
echo -e "${GREEN}✗ NO AdministratorAccess${NC}"
echo -e "${GREEN}✗ NO access to other AWS resources${NC}"
echo -e "${GREEN}✗ NO IAM user/group management${NC}"
echo -e "${GREEN}✗ NO billing/cost management${NC}"
echo ""

# ============================================================================
# Step 6: Create access keys
# ============================================================================
echo -e "${BLUE}[Step 6/7] Creating access keys...${NC}"
echo ""
echo -e "${YELLOW}⚠ IMPORTANT: Save these credentials securely!${NC}"
echo -e "${YELLOW}  They will only be shown once.${NC}"
echo ""

read -p "Create access keys now? (y/n): " CREATE_KEYS

if [[ ! $CREATE_KEYS =~ ^[Yy]$ ]]; then
    echo ""
    echo "Skipping key creation. Create manually with:"
    echo "  aws iam create-access-key --user-name $USER_NAME"
    echo ""
    exit 0
fi

echo ""

# Create keys
KEYS_OUTPUT=$(aws iam create-access-key --user-name "$USER_NAME" --output json)

ACCESS_KEY_ID=$(echo "$KEYS_OUTPUT" | grep -o '"AccessKeyId": "[^"]*' | cut -d'"' -f4)
SECRET_ACCESS_KEY=$(echo "$KEYS_OUTPUT" | grep -o '"SecretAccessKey": "[^"]*' | cut -d'"' -f4)

echo -e "${GREEN}✓${NC} Access keys created"
echo ""

# ============================================================================
# Step 7: Display credentials and next steps
# ============================================================================
echo -e "${BLUE}[Step 7/7] New Credentials${NC}"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}SAVE THESE CREDENTIALS NOW - THEY WON'T BE SHOWN AGAIN${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}AWS Access Key ID:${NC}"
echo "  $ACCESS_KEY_ID"
echo ""
echo -e "${YELLOW}AWS Secret Access Key:${NC}"
echo "  $SECRET_ACCESS_KEY"
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Save to temporary file
TEMP_FILE="/tmp/scatterpilot-credentials-$(date +%s).txt"
cat > "$TEMP_FILE" <<EOF
ScatterPilot Deployment Credentials
===================================
Created: $(date)
User: $USER_NAME

AWS Access Key ID: $ACCESS_KEY_ID
AWS Secret Access Key: $SECRET_ACCESS_KEY

SECURITY REMINDER:
- Store these in a password manager (1Password, LastPass, etc.)
- For Codespaces: Add to GitHub Secrets
- For local development: Run 'aws configure' with these credentials
- Delete this file after saving credentials securely
- Rotate these credentials every 90 days

To delete this file:
  rm $TEMP_FILE
EOF

echo -e "${GREEN}✓ Credentials saved to: $TEMP_FILE${NC}"
echo -e "${YELLOW}  Delete this file after saving credentials securely!${NC}"
echo ""

# ============================================================================
# Next Steps
# ============================================================================
echo -e "${BLUE}Next Steps:${NC}"
echo ""
echo "1. Save credentials securely:"
echo "   • Password manager (1Password, LastPass, etc.)"
echo "   • GitHub Codespaces Secrets (see CODESPACES_SETUP.md)"
echo ""
echo "2. Replace your current credentials:"
echo ""
echo "   ${CYAN}For GitHub Codespaces:${NC}"
echo "   • Go to: Repository → Settings → Codespaces → Secrets"
echo "   • Update: AWS_ACCESS_KEY_ID with $ACCESS_KEY_ID"
echo "   • Update: AWS_SECRET_ACCESS_KEY with <secret>"
echo "   • Rebuild Codespace"
echo ""
echo "   ${CYAN}For local development:${NC}"
echo "   aws configure"
echo "   AWS Access Key ID: $ACCESS_KEY_ID"
echo "   AWS Secret Access Key: <paste secret>"
echo "   Default region: us-east-1"
echo "   Default output format: json"
echo ""
echo "3. Test new credentials:"
echo "   aws sts get-caller-identity"
echo ""
echo "4. Delete old credentials (if using AdministratorAccess):"
echo "   aws iam delete-access-key --user-name YOUR_OLD_USER --access-key-id OLD_KEY_ID"
echo ""
echo "5. Run security check:"
echo "   ./scripts/security-check.sh"
echo ""
echo "6. Deploy ScatterPilot:"
echo "   ./scripts/00-deploy-all.sh"
echo ""

# ============================================================================
# Cleanup reminder
# ============================================================================
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}SECURITY REMINDERS:${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "• Never commit credentials to Git"
echo "• Enable MFA on your AWS account"
echo "• Rotate credentials every 90 days"
echo "• Delete the temporary credentials file:"
echo "  rm $TEMP_FILE"
echo ""
echo -e "${GREEN}✓ Deployment user created with least-privilege permissions!${NC}"
echo ""

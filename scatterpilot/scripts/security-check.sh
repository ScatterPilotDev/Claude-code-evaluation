#!/bin/bash

###############################################################################
# ScatterPilot - Security Check Script
# Verifies secure credential practices before deployment
###############################################################################

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

SECURITY_ISSUES=0
SECURITY_WARNINGS=0

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║            ScatterPilot - Security Check                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# Check 1: Verify we're not using root credentials
# ============================================================================
echo -e "${BLUE}[1/7] Checking AWS account type...${NC}"

if aws sts get-caller-identity &> /dev/null; then
    USER_ARN=$(aws sts get-caller-identity --query Arn --output text 2>/dev/null)

    if echo "$USER_ARN" | grep -q ":root"; then
        echo -e "${RED}✗ SECURITY RISK: Using root account credentials!${NC}"
        echo -e "   ${YELLOW}Create an IAM user instead. See SECURITY.md${NC}"
        ((SECURITY_ISSUES++))
    else
        echo -e "${GREEN}✓${NC} Not using root account"

        # Check if it's an IAM user (not assumed role)
        if echo "$USER_ARN" | grep -q ":user/"; then
            echo -e "${GREEN}✓${NC} Using IAM user: $(echo $USER_ARN | cut -d'/' -f2)"
        else
            echo -e "${YELLOW}⚠${NC} Using assumed role (acceptable for EC2/Lambda)"
            ((SECURITY_WARNINGS++))
        fi
    fi
else
    echo -e "${YELLOW}⚠${NC} Cannot check (AWS credentials not configured)"
    ((SECURITY_WARNINGS++))
fi

echo ""

# ============================================================================
# Check 2: Verify credentials are not in Git
# ============================================================================
echo -e "${BLUE}[2/7] Checking for credentials in Git...${NC}"

# Check if in a git repository
if git rev-parse --git-dir > /dev/null 2>&1; then
    # Search for AWS keys in git history
    if git log --all --oneline | head -1 > /dev/null 2>&1; then
        FOUND_KEYS=$(git log -p --all | grep -i "AKIA" 2>/dev/null | wc -l)
        FOUND_SECRETS=$(git log -p --all | grep -i "aws_secret_access_key" 2>/dev/null | wc -l)

        if [ "$FOUND_KEYS" -gt 0 ] || [ "$FOUND_SECRETS" -gt 0 ]; then
            echo -e "${RED}✗ CRITICAL: AWS credentials found in Git history!${NC}"
            echo -e "   ${YELLOW}Found $FOUND_KEYS potential access keys${NC}"
            echo -e "   ${YELLOW}Found $FOUND_SECRETS potential secret keys${NC}"
            echo -e "   ${RED}IMMEDIATE ACTION REQUIRED:${NC}"
            echo -e "   ${YELLOW}1. Rotate credentials in AWS Console NOW${NC}"
            echo -e "   ${YELLOW}2. See SECURITY.md for cleanup instructions${NC}"
            ((SECURITY_ISSUES++))
        else
            echo -e "${GREEN}✓${NC} No credentials found in Git history"
        fi
    else
        echo -e "${YELLOW}⚠${NC} No git history to check (new repository)"
        ((SECURITY_WARNINGS++))
    fi

    # Check unstaged files
    UNSTAGED_CREDS=$(git diff | grep -i "AKIA\|aws_secret_access_key" 2>/dev/null | wc -l)
    if [ "$UNSTAGED_CREDS" -gt 0 ]; then
        echo -e "${RED}✗ WARNING: Credentials in unstaged changes${NC}"
        echo -e "   ${YELLOW}Don't commit these files!${NC}"
        ((SECURITY_ISSUES++))
    fi
else
    echo -e "${YELLOW}⚠${NC} Not a git repository"
    ((SECURITY_WARNINGS++))
fi

echo ""

# ============================================================================
# Check 3: Verify .gitignore is protecting credentials
# ============================================================================
echo -e "${BLUE}[3/7] Checking .gitignore protection...${NC}"

if [ -f ".gitignore" ]; then
    GITIGNORE_OK=true

    # Check for AWS credential patterns
    if ! grep -q ".aws" .gitignore; then
        echo -e "${YELLOW}⚠${NC} .gitignore missing .aws/ pattern"
        GITIGNORE_OK=false
    fi

    if ! grep -q "credentials" .gitignore; then
        echo -e "${YELLOW}⚠${NC} .gitignore missing *credentials* pattern"
        GITIGNORE_OK=false
    fi

    if ! grep -q ".env" .gitignore; then
        echo -e "${YELLOW}⚠${NC} .gitignore missing .env pattern"
        GITIGNORE_OK=false
    fi

    if [ "$GITIGNORE_OK" = true ]; then
        echo -e "${GREEN}✓${NC} .gitignore properly configured"
    else
        echo -e "${YELLOW}⚠${NC} .gitignore needs updates (see .gitignore in repo)"
        ((SECURITY_WARNINGS++))
    fi
else
    echo -e "${RED}✗${NC} No .gitignore file found!"
    echo -e "   ${YELLOW}Create one to protect credentials${NC}"
    ((SECURITY_ISSUES++))
fi

echo ""

# ============================================================================
# Check 4: Look for credential files in working directory
# ============================================================================
echo -e "${BLUE}[4/7] Scanning for credential files...${NC}"

FOUND_FILES=0

# Check for AWS credentials file
if [ -f "$HOME/.aws/credentials" ]; then
    if [ -z "$CODESPACES" ]; then
        echo -e "${YELLOW}⚠${NC} Found ~/.aws/credentials (OK for local development)"
        echo -e "   ${CYAN}Using Codespaces? Consider using secrets instead${NC}"
        ((SECURITY_WARNINGS++))
    else
        echo -e "${RED}✗${NC} Found ~/.aws/credentials in Codespace"
        echo -e "   ${YELLOW}Use GitHub Codespaces Secrets instead!${NC}"
        echo -e "   ${YELLOW}See CODESPACES_SETUP.md for instructions${NC}"
        ((SECURITY_ISSUES++))
        FOUND_FILES=1
    fi
fi

# Check for deployment config files
if [ -f ".deployment-config" ]; then
    if grep -q "AWS\|SECRET\|KEY" .deployment-config 2>/dev/null; then
        echo -e "${RED}✗${NC} .deployment-config may contain credentials"
        ((SECURITY_ISSUES++))
        FOUND_FILES=1
    fi
fi

# Check for environment files
for envfile in .env .env.local .env.production; do
    if [ -f "$envfile" ]; then
        if grep -q "AWS\|SECRET\|KEY" "$envfile" 2>/dev/null; then
            echo -e "${YELLOW}⚠${NC} Found $envfile with potential credentials"
            ((SECURITY_WARNINGS++))
            FOUND_FILES=1
        fi
    fi
done

if [ $FOUND_FILES -eq 0 ]; then
    echo -e "${GREEN}✓${NC} No credential files found in working directory"
fi

echo ""

# ============================================================================
# Check 5: Verify MFA is enabled (if possible)
# ============================================================================
echo -e "${BLUE}[5/7] Checking MFA status...${NC}"

if aws sts get-caller-identity &> /dev/null; then
    USER_ARN=$(aws sts get-caller-identity --query Arn --output text 2>/dev/null)

    if echo "$USER_ARN" | grep -q ":user/"; then
        USERNAME=$(echo $USER_ARN | cut -d'/' -f2)
        MFA_DEVICES=$(aws iam list-mfa-devices --user-name "$USERNAME" --query 'MFADevices' --output text 2>/dev/null)

        if [ -n "$MFA_DEVICES" ]; then
            echo -e "${GREEN}✓${NC} MFA enabled on account"
        else
            echo -e "${YELLOW}⚠${NC} MFA not enabled"
            echo -e "   ${CYAN}Recommendation: Enable MFA for additional security${NC}"
            ((SECURITY_WARNINGS++))
        fi
    else
        echo -e "${YELLOW}⚠${NC} Cannot check MFA (using assumed role)"
        ((SECURITY_WARNINGS++))
    fi
else
    echo -e "${YELLOW}⚠${NC} Cannot check (AWS credentials not configured)"
    ((SECURITY_WARNINGS++))
fi

echo ""

# ============================================================================
# Check 6: Check for environment variable credentials
# ============================================================================
echo -e "${BLUE}[6/7] Checking credential sources...${NC}"

if [ -n "$AWS_ACCESS_KEY_ID" ] && [ -n "$AWS_SECRET_ACCESS_KEY" ]; then
    if [ -n "$CODESPACES" ]; then
        echo -e "${GREEN}✓${NC} Using environment variables (Codespaces Secrets)"
    else
        echo -e "${YELLOW}⚠${NC} Using environment variables"
        echo -e "   ${CYAN}Ensure these are not in shell history or scripts${NC}"
        ((SECURITY_WARNINGS++))
    fi
elif [ -f "$HOME/.aws/credentials" ]; then
    echo -e "${YELLOW}⚠${NC} Using ~/.aws/credentials file"
    if [ -n "$CODESPACES" ]; then
        echo -e "   ${CYAN}Consider using Codespaces Secrets instead${NC}"
        ((SECURITY_WARNINGS++))
    fi
else
    echo -e "${YELLOW}⚠${NC} No AWS credentials detected"
fi

echo ""

# ============================================================================
# Check 7: Check IAM policy permissions (basic check)
# ============================================================================
echo -e "${BLUE}[7/7] Checking IAM permissions...${NC}"

if aws sts get-caller-identity &> /dev/null; then
    # Test a few key permissions
    HAS_LAMBDA=false
    HAS_DYNAMODB=false
    HAS_S3=false

    if aws lambda list-functions --max-items 1 &> /dev/null; then
        HAS_LAMBDA=true
    fi

    if aws dynamodb list-tables --max-items 1 &> /dev/null; then
        HAS_DYNAMODB=true
    fi

    if aws s3 ls &> /dev/null; then
        HAS_S3=true
    fi

    if [ "$HAS_LAMBDA" = true ] && [ "$HAS_DYNAMODB" = true ] && [ "$HAS_S3" = true ]; then
        echo -e "${GREEN}✓${NC} Basic deployment permissions verified"
        echo -e "   ${CYAN}Recommend reviewing IAM policy for least privilege${NC}"
        echo -e "   ${CYAN}See scripts/iam-deployment-policy.json${NC}"
    else
        echo -e "${YELLOW}⚠${NC} Some permissions may be missing"
        echo -e "   Lambda: $([ "$HAS_LAMBDA" = true ] && echo "✓" || echo "✗")"
        echo -e "   DynamoDB: $([ "$HAS_DYNAMODB" = true ] && echo "✓" || echo "✗")"
        echo -e "   S3: $([ "$HAS_S3" = true ] && echo "✓" || echo "✗")"
        ((SECURITY_WARNINGS++))
    fi
else
    echo -e "${YELLOW}⚠${NC} Cannot check (AWS credentials not configured)"
    ((SECURITY_WARNINGS++))
fi

echo ""

# ============================================================================
# Summary and Recommendations
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Security Check Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

if [ $SECURITY_ISSUES -eq 0 ] && [ $SECURITY_WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All security checks passed!${NC}"
    echo ""
    echo -e "${GREEN}Your credential setup appears secure.${NC}"
    echo ""
elif [ $SECURITY_ISSUES -eq 0 ]; then
    echo -e "${YELLOW}⚠ $SECURITY_WARNINGS warning(s) found${NC}"
    echo ""
    echo -e "${YELLOW}Review warnings above and consider improvements.${NC}"
    echo ""
else
    echo -e "${RED}✗ $SECURITY_ISSUES critical issue(s) found${NC}"
    echo -e "${YELLOW}⚠ $SECURITY_WARNINGS warning(s) found${NC}"
    echo ""
    echo -e "${RED}CRITICAL ISSUES MUST BE ADDRESSED BEFORE DEPLOYMENT${NC}"
    echo ""
fi

# ============================================================================
# Recommendations
# ============================================================================
echo -e "${CYAN}Security Recommendations:${NC}"
echo ""

if [ -n "$CODESPACES" ]; then
    echo -e "  ${CYAN}You're using GitHub Codespaces:${NC}"
    echo -e "  1. Use Codespaces Secrets for credentials"
    echo -e "     See: CODESPACES_SETUP.md"
    echo -e "  2. Avoid running 'aws configure'"
    echo -e "  3. Never commit credentials files"
    echo ""
fi

echo -e "  ${CYAN}General Best Practices:${NC}"
echo -e "  1. Use dedicated IAM user (not root)"
echo -e "  2. Apply least-privilege IAM policy"
echo -e "     See: scripts/iam-deployment-policy.json"
echo -e "  3. Enable MFA on AWS account"
echo -e "  4. Rotate credentials every 90 days"
echo -e "  5. Enable GitHub secret scanning"
echo ""

echo -e "${CYAN}📚 Security Resources:${NC}"
echo -e "  • SECURITY.md - Comprehensive security guide"
echo -e "  • CODESPACES_SETUP.md - Codespaces secrets setup"
echo -e "  • scripts/iam-deployment-policy.json - Least-privilege policy"
echo ""

if [ $SECURITY_ISSUES -gt 0 ]; then
    exit 1
else
    exit 0
fi

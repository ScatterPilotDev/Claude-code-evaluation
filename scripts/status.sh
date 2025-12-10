#!/bin/bash
# Project Status Script
# Shows recent activity, deployment status, and next steps

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$PROJECT_ROOT/PROJECT_LOG.md"
DEPLOYMENT_OUTPUTS="$PROJECT_ROOT/scatterpilot/.deployment-outputs"
DEPLOYMENT_CONFIG="$PROJECT_ROOT/scatterpilot/.deployment-config"

# Print header
echo -e "${MAGENTA}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║              ScatterPilot - Project Status                     ║${NC}"
echo -e "${MAGENTA}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# Recent Activity
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Recent Activity (Last 10 entries)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ -f "$LOG_FILE" ]; then
    # Extract log entries (skip header lines)
    # Format: [YYYY-MM-DD HH:MM] **[CATEGORY]** - Summary
    grep -E '^\[20[0-9]{2}-' "$LOG_FILE" | head -n 10 | while IFS= read -r line; do
        # Extract parts using more robust parsing
        timestamp=$(echo "$line" | sed 's/^\[\([^]]*\)\].*/\1/')
        category=$(echo "$line" | sed 's/.*\*\*\[\([^]]*\)\]\*\*.*/\1/')
        summary=$(echo "$line" | sed 's/.*\*\* - //')

        # Color code by category
        case $category in
            SETUP)    color="${CYAN}" ;;
            DEPLOY)   color="${GREEN}" ;;
            FIX)      color="${YELLOW}" ;;
            FEATURE)  color="${BLUE}" ;;
            SECURITY) color="${RED}" ;;
            TEST)     color="${MAGENTA}" ;;
            DOCS)     color="${NC}" ;;
            *)        color="${NC}" ;;
        esac

        echo -e "${color}[$category]${NC} ${timestamp}"
        echo "  $summary"
        echo ""
    done
else
    echo -e "${YELLOW}No activity log found yet${NC}"
    echo "Start logging with: ./scripts/log.sh \"Your activity summary\""
    echo ""
fi

# ============================================================================
# Deployment Status
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Deployment Status${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ -f "$DEPLOYMENT_OUTPUTS" ]; then
    source "$DEPLOYMENT_OUTPUTS"

    echo -e "${GREEN}✓ Deployed${NC}"
    echo ""
    echo -e "${CYAN}Stack Information:${NC}"
    echo "  Stack Name:   ${STACK_NAME:-Unknown}"
    echo "  Region:       ${AWS_REGION:-Unknown}"
    echo "  Environment:  ${ENVIRONMENT:-Unknown}"
    echo "  Deployed:     ${DEPLOYED_AT:-Unknown}"
    echo ""

    if [ -n "$API_URL" ]; then
        echo -e "${CYAN}API Endpoint:${NC}"
        echo "  $API_URL"
        echo ""
    fi

    if [ -n "$CONVERSATIONS_TABLE" ]; then
        echo -e "${CYAN}Resources:${NC}"
        echo "  Conversations Table: $CONVERSATIONS_TABLE"
        [ -n "$INVOICES_TABLE" ] && echo "  Invoices Table:      $INVOICES_TABLE"
        [ -n "$INVOICE_BUCKET" ] && echo "  S3 Bucket:           $INVOICE_BUCKET"
        echo ""
    fi

    # Check if deployment is still active
    if command -v aws &> /dev/null && [ -n "$STACK_NAME" ] && [ -n "$AWS_REGION" ]; then
        STACK_STATUS=$(aws cloudformation describe-stacks \
            --stack-name "$STACK_NAME" \
            --region "$AWS_REGION" \
            --query 'Stacks[0].StackStatus' \
            --output text 2>/dev/null || echo "UNKNOWN")

        case $STACK_STATUS in
            CREATE_COMPLETE|UPDATE_COMPLETE)
                echo -e "${GREEN}Stack Status: $STACK_STATUS${NC}"
                ;;
            *IN_PROGRESS)
                echo -e "${YELLOW}Stack Status: $STACK_STATUS${NC}"
                ;;
            *FAILED|*ROLLBACK*)
                echo -e "${RED}Stack Status: $STACK_STATUS${NC}"
                ;;
            *)
                echo -e "${YELLOW}Stack Status: $STACK_STATUS${NC}"
                ;;
        esac
        echo ""
    fi

elif [ -f "$DEPLOYMENT_CONFIG" ]; then
    echo -e "${YELLOW}⚠ Deployment configuration exists but no active deployment found${NC}"
    echo ""
    echo "Run deployment with:"
    echo "  cd scatterpilot && ./scripts/03-deploy.sh"
    echo ""
else
    echo -e "${YELLOW}✗ Not deployed yet${NC}"
    echo ""
    echo "To deploy ScatterPilot:"
    echo "  cd scatterpilot && ./scripts/00-deploy-all.sh"
    echo ""
fi

# ============================================================================
# What's Next
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}What's Next${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Determine next steps based on current state
NEXT_STEPS=()

if [ ! -f "$DEPLOYMENT_OUTPUTS" ]; then
    NEXT_STEPS+=("${YELLOW}1.${NC} Deploy ScatterPilot to AWS")
    NEXT_STEPS+=("   cd scatterpilot && ./scripts/00-deploy-all.sh")
    NEXT_STEPS+=("")
else
    # Already deployed, suggest next actions
    NEXT_STEPS+=("${GREEN}✓${NC} Deployment complete!")
    NEXT_STEPS+=("")
    NEXT_STEPS+=("${YELLOW}Suggested actions:${NC}")
    NEXT_STEPS+=("")
    NEXT_STEPS+=("${YELLOW}1.${NC} Test the API")
    NEXT_STEPS+=("   cd scatterpilot && ./scripts/04-test-deployment.sh")
    NEXT_STEPS+=("")
    NEXT_STEPS+=("${YELLOW}2.${NC} Try the demo frontend")
    NEXT_STEPS+=("   cd scatterpilot/demo && python3 -m http.server 8000")
    NEXT_STEPS+=("   Open: http://localhost:8000")
    NEXT_STEPS+=("")
    NEXT_STEPS+=("${YELLOW}3.${NC} Monitor CloudWatch logs")
    if [ -n "$AWS_REGION" ] && [ -n "$ENVIRONMENT" ]; then
        NEXT_STEPS+=("   aws logs tail /aws/lambda/ScatterPilot-Conversation-$ENVIRONMENT --follow")
    else
        NEXT_STEPS+=("   aws logs tail /aws/lambda/ScatterPilot-Conversation-dev --follow")
    fi
    NEXT_STEPS+=("")
    NEXT_STEPS+=("${YELLOW}4.${NC} View CloudWatch dashboard")
    if [ -n "$AWS_REGION" ] && [ -n "$ENVIRONMENT" ]; then
        NEXT_STEPS+=("   https://console.aws.amazon.com/cloudwatch/home?region=$AWS_REGION#dashboards:name=ScatterPilot-$ENVIRONMENT")
    fi
    NEXT_STEPS+=("")
fi

NEXT_STEPS+=("${CYAN}Useful Commands:${NC}")
NEXT_STEPS+=("")
NEXT_STEPS+=("  ./scripts/log.sh \"Activity summary\"  - Log project activity")
NEXT_STEPS+=("  ./scripts/status.sh                   - Show this status screen")
NEXT_STEPS+=("  ./scripts/log.sh --help               - View logging help")
NEXT_STEPS+=("")

# Print all next steps
for step in "${NEXT_STEPS[@]}"; do
    echo -e "$step"
done

# ============================================================================
# Quick Stats
# ============================================================================
if [ -f "$LOG_FILE" ]; then
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Activity Stats${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""

    TOTAL_ENTRIES=$(grep -cE '^\[20[0-9]{2}-' "$LOG_FILE" 2>/dev/null || echo "0")
    SETUP_COUNT=$(grep -cE '\[SETUP\]' "$LOG_FILE" 2>/dev/null || echo "0")
    DEPLOY_COUNT=$(grep -cE '\[DEPLOY\]' "$LOG_FILE" 2>/dev/null || echo "0")
    FIX_COUNT=$(grep -cE '\[FIX\]' "$LOG_FILE" 2>/dev/null || echo "0")
    FEATURE_COUNT=$(grep -cE '\[FEATURE\]' "$LOG_FILE" 2>/dev/null || echo "0")
    SECURITY_COUNT=$(grep -cE '\[SECURITY\]' "$LOG_FILE" 2>/dev/null || echo "0")
    TEST_COUNT=$(grep -cE '\[TEST\]' "$LOG_FILE" 2>/dev/null || echo "0")
    DOCS_COUNT=$(grep -cE '\[DOCS\]' "$LOG_FILE" 2>/dev/null || echo "0")

    echo "  Total Activities: $TOTAL_ENTRIES"
    echo ""
    echo "  By Category:"
    [ "${SETUP_COUNT:-0}" -gt 0 ] 2>/dev/null && echo "    Setup:    $SETUP_COUNT"
    [ "${DEPLOY_COUNT:-0}" -gt 0 ] 2>/dev/null && echo "    Deploy:   $DEPLOY_COUNT"
    [ "${FIX_COUNT:-0}" -gt 0 ] 2>/dev/null && echo "    Fix:      $FIX_COUNT"
    [ "${FEATURE_COUNT:-0}" -gt 0 ] 2>/dev/null && echo "    Feature:  $FEATURE_COUNT"
    [ "${SECURITY_COUNT:-0}" -gt 0 ] 2>/dev/null && echo "    Security: $SECURITY_COUNT"
    [ "${TEST_COUNT:-0}" -gt 0 ] 2>/dev/null && echo "    Test:     $TEST_COUNT"
    [ "${DOCS_COUNT:-0}" -gt 0 ] 2>/dev/null && echo "    Docs:     $DOCS_COUNT"
    echo ""
fi

echo -e "${MAGENTA}═══════════════════════════════════════════════════════════════${NC}"
echo ""

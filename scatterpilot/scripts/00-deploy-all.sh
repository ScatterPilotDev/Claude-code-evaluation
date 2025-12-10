#!/bin/bash

###############################################################################
# ScatterPilot - Complete Deployment Automation
# Runs all deployment steps in sequence
#
# Usage:
#   ./00-deploy-all.sh                    # Normal deployment with all checks
#   ./00-deploy-all.sh --skip-security-check  # Skip security check with warning
#   ./00-deploy-all.sh --force            # Skip all interactive prompts
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_SCRIPT="$(cd "$SCRIPT_DIR/../.." && pwd)/scripts/log-activity.sh"

# Parse command-line arguments
SKIP_SECURITY_CHECK=false
FORCE_MODE=false

for arg in "$@"; do
    case $arg in
        --skip-security-check)
            SKIP_SECURITY_CHECK=true
            shift
            ;;
        --force)
            FORCE_MODE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --skip-security-check    Skip security check with warning (for dev/eval)"
            echo "  --force                  Skip all interactive prompts (use with caution)"
            echo "  --help, -h               Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                              # Normal deployment"
            echo "  $0 --skip-security-check        # Skip security check (Codespaces/dev)"
            echo "  $0 --force                      # Fully automated deployment"
            echo ""
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $arg${NC}"
            echo "Run '$0 --help' for usage information"
            exit 1
            ;;
    esac
done

# Display warning if using skip/force flags
if [ "$SKIP_SECURITY_CHECK" = true ] || [ "$FORCE_MODE" = true ]; then
    echo ""
    echo -e "${RED}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                      ⚠ WARNING ⚠                             ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    if [ "$SKIP_SECURITY_CHECK" = true ]; then
        echo -e "${YELLOW}Security checks will be SKIPPED during this deployment.${NC}"
        echo ""
        echo -e "${YELLOW}This flag is intended for:${NC}"
        echo "  • Development environments (GitHub Codespaces, local dev)"
        echo "  • Evaluation and testing purposes"
        echo "  • Environments where credential scanning causes false positives"
        echo ""
        echo -e "${RED}DO NOT use this flag for production deployments!${NC}"
        echo ""
    fi

    if [ "$FORCE_MODE" = true ]; then
        echo -e "${YELLOW}Force mode enabled - all prompts will be skipped.${NC}"
        echo ""
        echo -e "${YELLOW}This flag is intended for:${NC}"
        echo "  • Automated CI/CD pipelines"
        echo "  • Scripted deployments"
        echo "  • Non-interactive environments"
        echo ""
        echo -e "${RED}Ensure you have reviewed all settings before using --force!${NC}"
        echo ""
    fi

    if [ "$FORCE_MODE" = false ]; then
        read -p "Press Enter to acknowledge and continue... " ACKNOWLEDGE
    fi
    echo ""
fi

echo -e "${MAGENTA}"
cat <<'EOF'
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ███████╗ ██████╗ █████╗ ████████╗████████╗███████╗██████╗  ║
║   ██╔════╝██╔════╝██╔══██╗╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗ ║
║   ███████╗██║     ███████║   ██║      ██║   █████╗  ██████╔╝ ║
║   ╚════██║██║     ██╔══██║   ██║      ██║   ██╔══╝  ██╔══██╗ ║
║   ███████║╚██████╗██║  ██║   ██║      ██║   ███████╗██║  ██║ ║
║   ╚══════╝ ╚═════╝╚═╝  ╚═╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝ ║
║                                                               ║
║              PILOT - Complete Deployment Suite               ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${CYAN}This script will guide you through:${NC}"
echo "  1. Prerequisites check"
echo "  2. AWS deployment"
echo "  3. Deployment testing"
echo "  4. Frontend configuration"
echo "  5. Cost monitoring setup"
echo ""
echo -e "${YELLOW}Estimated time: 10-15 minutes${NC}"
echo ""

if [ "$FORCE_MODE" = false ]; then
    read -p "Ready to begin? (y/n): " CONFIRM
    if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 0
    fi
else
    echo -e "${YELLOW}[FORCE MODE] Proceeding automatically...${NC}"
fi

# Log deployment start
if [ -x "$LOG_SCRIPT" ]; then
    LOG_MSG="Started full deployment process for ScatterPilot"
    [ "$SKIP_SECURITY_CHECK" = true ] && LOG_MSG="$LOG_MSG (security check skipped)"
    [ "$FORCE_MODE" = true ] && LOG_MSG="$LOG_MSG (force mode)"
    "$LOG_SCRIPT" DEPLOY "$LOG_MSG including prerequisites check, AWS deployment, testing, and monitoring setup" 2>/dev/null || true
fi

echo ""

# ============================================================================
# Step 1: Prerequisites Check
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 1: Prerequisites Check${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ -f "$SCRIPT_DIR/01-check-prerequisites.sh" ]; then
    "$SCRIPT_DIR/01-check-prerequisites.sh"
    PREREQ_EXIT_CODE=$?
else
    echo -e "${RED}✗ Prerequisites check script not found${NC}"
    exit 1
fi

# If prerequisites failed, handle installation flow
if [ $PREREQ_EXIT_CODE -ne 0 ]; then
    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}Prerequisites check found some issues.${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Options:"
    echo "  1. If packages were installed, run this script again"
    echo "  2. If AWS credentials were configured, run this script again"
    echo "  3. Check QUICKSTART.md for installation help"
    echo ""
    read -p "Would you like to retry the prerequisites check? (y/n): " RETRY

    if [[ $RETRY =~ ^[Yy]$ ]]; then
        echo ""
        echo -e "${BLUE}Re-running prerequisites check...${NC}"
        echo ""
        "$SCRIPT_DIR/01-check-prerequisites.sh"
        PREREQ_EXIT_CODE=$?

        if [ $PREREQ_EXIT_CODE -ne 0 ]; then
            echo ""
            echo -e "${RED}Prerequisites still not satisfied.${NC}"
            echo "Please install missing packages and run again:"
            echo "  ./scripts/00-deploy-all.sh"
            echo ""
            exit 1
        fi
    else
        echo ""
        echo "Please install missing prerequisites and run again:"
        echo "  ./scripts/00-deploy-all.sh"
        echo ""
        echo "See QUICKSTART.md for installation help."
        exit 0
    fi
fi

echo ""
if [ "$FORCE_MODE" = false ]; then
    read -p "Prerequisites check complete. Continue to deployment? (y/n): " CONTINUE
    if [[ ! $CONTINUE =~ ^[Yy]$ ]]; then
        echo "Deployment paused. Run individual scripts to continue."
        exit 0
    fi
else
    echo -e "${YELLOW}[FORCE MODE] Proceeding to deployment...${NC}"
fi

echo ""

# ============================================================================
# Security Check
# ============================================================================
if [ "$SKIP_SECURITY_CHECK" = true ]; then
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}Security Check - SKIPPED${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}⚠ Security checks are being skipped (--skip-security-check flag)${NC}"
    echo ""
    echo -e "${CYAN}Rationale:${NC}"
    echo "  This is a development/evaluation environment where credential"
    echo "  scanning may produce false positives or block legitimate work."
    echo ""
    echo -e "${RED}⚠ REMINDER: Never skip security checks in production!${NC}"
    echo ""
elif [ "$FORCE_MODE" = true ]; then
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Security Check${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""

    if [ -f "$SCRIPT_DIR/security-check.sh" ]; then
        "$SCRIPT_DIR/security-check.sh"
        SECURITY_EXIT_CODE=$?

        if [ $SECURITY_EXIT_CODE -ne 0 ]; then
            echo ""
            echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
            echo -e "${RED}SECURITY ISSUES DETECTED${NC}"
            echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
            echo ""
            echo -e "${YELLOW}[FORCE MODE] Continuing despite security issues...${NC}"
            echo -e "${RED}⚠ WARNING: This deployment has security concerns!${NC}"
            echo ""
        fi
    else
        echo -e "${YELLOW}⚠ Security check script not found, skipping...${NC}"
    fi

    echo ""
else
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Security Check${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""

    if [ -f "$SCRIPT_DIR/security-check.sh" ]; then
        "$SCRIPT_DIR/security-check.sh"
        SECURITY_EXIT_CODE=$?

        if [ $SECURITY_EXIT_CODE -ne 0 ]; then
            echo ""
            echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
            echo -e "${RED}SECURITY ISSUES DETECTED${NC}"
            echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
            echo ""
            echo -e "${YELLOW}Critical security issues must be resolved before deploying.${NC}"
            echo ""
            echo -e "${CYAN}Options:${NC}"
            echo "  • Fix the security issues and run again"
            echo "  • Use --skip-security-check flag for dev/eval environments"
            echo "  • Continue anyway (NOT RECOMMENDED for production)"
            echo ""
            read -p "Do you want to continue anyway? (NOT RECOMMENDED) (y/n): " FORCE_CONTINUE

            if [[ ! $FORCE_CONTINUE =~ ^[Yy]$ ]]; then
                echo ""
                echo "Deployment cancelled for security reasons."
                echo ""
                echo "Please review and fix the security issues, then run again:"
                echo "  ./scripts/00-deploy-all.sh"
                echo ""
                echo "Or use --skip-security-check for development environments:"
                echo "  ./scripts/00-deploy-all.sh --skip-security-check"
                echo ""
                echo "See SECURITY.md for detailed guidance."
                exit 1
            fi

            echo ""
            echo -e "${RED}⚠ WARNING: Continuing deployment despite security issues${NC}"
            echo ""
        fi
    else
        echo -e "${YELLOW}⚠ Security check script not found, skipping...${NC}"
    fi

    echo ""
fi

# ============================================================================
# Bedrock Access Reminder
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Bedrock Model Access${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}⚠ Important: Before continuing, ensure you have:${NC}"
echo ""
echo "  1. Enabled Amazon Bedrock model access in AWS Console"
echo "  2. Enabled Claude 3.5 Sonnet v2 specifically"
echo "  3. Verified access is granted (green checkmark)"
echo ""
echo "Model ID: anthropic.claude-3-5-sonnet-20241022-v2:0"
echo ""
echo "If you haven't done this yet:"
echo "  - Open: https://console.aws.amazon.com/bedrock/"
echo "  - Click: Model access (left sidebar)"
echo "  - Enable: Claude 3.5 Sonnet v2"
echo ""
echo "For detailed instructions:"
echo "  cat scripts/02-enable-bedrock-access.md"
echo ""

if [ "$FORCE_MODE" = false ]; then
    read -p "Have you enabled Bedrock model access? (y/n): " BEDROCK_READY
    if [[ ! $BEDROCK_READY =~ ^[Yy]$ ]]; then
        echo ""
        echo -e "${YELLOW}Please enable Bedrock access first, then run:${NC}"
        echo "  ./scripts/00-deploy-all.sh"
        echo ""
        exit 0
    fi
else
    echo -e "${YELLOW}[FORCE MODE] Assuming Bedrock access is configured...${NC}"
fi

echo ""

# ============================================================================
# Step 2: Deploy to AWS
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 2: AWS Deployment${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ -f "$SCRIPT_DIR/03-deploy.sh" ]; then
    "$SCRIPT_DIR/03-deploy.sh"
else
    echo -e "${RED}✗ Deployment script not found${NC}"
    exit 1
fi

echo ""
if [ "$FORCE_MODE" = false ]; then
    read -p "Deployment complete. Continue to testing? (y/n): " CONTINUE
    if [[ ! $CONTINUE =~ ^[Yy]$ ]]; then
        echo "Deployment complete. Run remaining scripts manually if needed."
        exit 0
    fi
else
    echo -e "${YELLOW}[FORCE MODE] Proceeding to testing...${NC}"
fi

echo ""

# ============================================================================
# Step 3: Test Deployment
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 3: Testing Deployment${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ -f "$SCRIPT_DIR/04-test-deployment.sh" ]; then
    "$SCRIPT_DIR/04-test-deployment.sh"
else
    echo -e "${YELLOW}⚠ Test script not found, skipping...${NC}"
fi

echo ""
if [ "$FORCE_MODE" = false ]; then
    read -p "Testing complete. Continue to frontend setup? (y/n): " CONTINUE
    if [[ ! $CONTINUE =~ ^[Yy]$ ]]; then
        echo "You can run frontend setup later with:"
        echo "  ./scripts/05-configure-frontend.sh"
        exit 0
    fi
else
    echo -e "${YELLOW}[FORCE MODE] Proceeding to frontend setup...${NC}"
fi

echo ""

# ============================================================================
# Step 4: Configure Frontend
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 4: Frontend Configuration${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ -f "$SCRIPT_DIR/05-configure-frontend.sh" ]; then
    "$SCRIPT_DIR/05-configure-frontend.sh"
else
    echo -e "${YELLOW}⚠ Frontend configuration script not found, skipping...${NC}"
fi

echo ""
if [ "$FORCE_MODE" = false ]; then
    read -p "Frontend configured. Set up cost monitoring? (y/n): " CONTINUE
    if [[ ! $CONTINUE =~ ^[Yy]$ ]]; then
        echo "You can set up monitoring later with:"
        echo "  ./scripts/06-setup-monitoring.sh"
        exit 0
    fi
else
    echo -e "${YELLOW}[FORCE MODE] Proceeding to monitoring setup...${NC}"
fi

echo ""

# ============================================================================
# Step 5: Set Up Monitoring
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Step 5: Cost Monitoring Setup${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ -f "$SCRIPT_DIR/06-setup-monitoring.sh" ]; then
    "$SCRIPT_DIR/06-setup-monitoring.sh"
else
    echo -e "${YELLOW}⚠ Monitoring setup script not found, skipping...${NC}"
fi

echo ""

# ============================================================================
# Final Summary
# ============================================================================
echo -e "${MAGENTA}"
cat <<'EOF'
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║              🎉 DEPLOYMENT COMPLETE! 🎉                       ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${GREEN}All deployment steps completed successfully!${NC}"
echo ""

# Log deployment completion
if [ -x "$LOG_SCRIPT" ]; then
    "$LOG_SCRIPT" DEPLOY "Completed full deployment of ScatterPilot including all infrastructure, testing, frontend configuration, and monitoring setup successfully" 2>/dev/null || true
fi

# Load deployment outputs
if [ -f "$SCRIPT_DIR/../.deployment-outputs" ]; then
    source "$SCRIPT_DIR/../.deployment-outputs"

    echo -e "${CYAN}Your ScatterPilot deployment:${NC}"
    echo ""
    echo -e "${YELLOW}API Endpoint:${NC}"
    echo "  $API_URL"
    echo ""
    echo -e "${YELLOW}Resources:${NC}"
    echo "  Stack:        $STACK_NAME"
    echo "  Region:       $AWS_REGION"
    echo "  Environment:  $ENVIRONMENT"
    echo ""
fi

echo -e "${CYAN}Next Steps:${NC}"
echo ""
echo "  1. Test the frontend:"
echo "     cd demo && python3 -m http.server 8000"
echo "     Open: http://localhost:8000"
echo ""
echo "  2. Confirm email subscription for billing alerts"
echo "     (Check your email inbox)"
echo ""
echo "  3. View CloudWatch dashboard:"
if [ -n "$AWS_REGION" ] && [ -n "$ENVIRONMENT" ]; then
    echo "     https://console.aws.amazon.com/cloudwatch/home?region=$AWS_REGION#dashboards:name=ScatterPilot-$ENVIRONMENT"
fi
echo ""
echo "  4. Review deployment guide:"
echo "     cat DEPLOYMENT_GUIDE.md"
echo ""

echo -e "${GREEN}Happy invoicing! 📄✨${NC}"
echo ""

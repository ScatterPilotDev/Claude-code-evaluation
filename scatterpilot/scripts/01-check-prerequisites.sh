#!/bin/bash

###############################################################################
# ScatterPilot - Prerequisites Check Script
# This script verifies all prerequisites are installed before deployment
###############################################################################

# Note: We don't use 'set -e' here because we want to continue checking
# all prerequisites even if some checks fail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_SCRIPT="$(cd "$SCRIPT_DIR/../.." && pwd)/scripts/log-activity.sh"

# Tracking variables
CHECKS_PASSED=0
CHECKS_FAILED=0
WARNINGS=0

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         ScatterPilot - Prerequisites Check                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to print check result
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((CHECKS_PASSED++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((CHECKS_FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

# ============================================================================
# 1. Check AWS CLI
# ============================================================================
echo -e "${BLUE}[1/8] Checking AWS CLI...${NC}"

if command -v aws &> /dev/null; then
    AWS_VERSION=$(aws --version 2>&1 | cut -d' ' -f1 | cut -d'/' -f2 || echo "unknown")
    check_pass "AWS CLI installed (version $AWS_VERSION)"

    # Check if credentials are configured
    if aws sts get-caller-identity &> /dev/null; then
        ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "unknown")
        AWS_REGION=$(aws configure get region 2>/dev/null || echo "")
        check_pass "AWS credentials configured (Account: $ACCOUNT_ID)"

        if [ -n "$AWS_REGION" ]; then
            check_pass "Default region set: $AWS_REGION"
        else
            check_warn "No default region set. You'll be prompted during deployment."
        fi
    else
        check_fail "AWS credentials not configured"
        echo -e "   ${YELLOW}Run: aws configure${NC}"
    fi
else
    check_fail "AWS CLI not installed"
    echo -e "   ${YELLOW}Install: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html${NC}"
fi

echo ""

# ============================================================================
# 2. Check AWS SAM CLI
# ============================================================================
echo -e "${BLUE}[2/8] Checking AWS SAM CLI...${NC}"

if command -v sam &> /dev/null; then
    SAM_VERSION=$(sam --version 2>&1 | cut -d' ' -f4 || echo "unknown")
    check_pass "SAM CLI installed (version $SAM_VERSION)"

    # Check if Docker is available (required for sam build)
    if command -v docker &> /dev/null; then
        if docker ps &> /dev/null 2>&1; then
            check_pass "Docker is running"
        else
            check_warn "Docker is installed but not running"
            echo -e "   ${YELLOW}Start Docker to build Lambda layers${NC}"
        fi
    else
        check_warn "Docker not installed"
        echo -e "   ${YELLOW}Docker is recommended for building Lambda layers${NC}"
        echo -e "   ${YELLOW}Install: https://docs.docker.com/get-docker/${NC}"
    fi
else
    check_fail "SAM CLI not installed"
    echo -e "   ${YELLOW}Install: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html${NC}"
    echo ""
    echo -e "   Quick install (macOS):   brew install aws-sam-cli"
    echo -e "   Quick install (Linux):   pip install aws-sam-cli"
fi

echo ""

# ============================================================================
# 3. Check Python
# ============================================================================
echo -e "${BLUE}[3/8] Checking Python...${NC}"

if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2 || echo "unknown")
    PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d'.' -f1 2>/dev/null || echo "0")
    PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d'.' -f2 2>/dev/null || echo "0")

    if [ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -ge 11 ]; then
        check_pass "Python $PYTHON_VERSION installed (3.11+ required)"
    else
        check_warn "Python $PYTHON_VERSION installed (3.11+ recommended)"
    fi

    # Check pip
    if command -v pip3 &> /dev/null; then
        check_pass "pip3 installed"
    else
        check_warn "pip3 not found"
    fi
else
    check_fail "Python 3 not installed"
    echo -e "   ${YELLOW}Install Python 3.11+${NC}"
fi

echo ""

# ============================================================================
# 4. Check Project Structure
# ============================================================================
echo -e "${BLUE}[4/8] Checking project structure...${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -f "$PROJECT_ROOT/infrastructure/template.yaml" ]; then
    check_pass "SAM template found"
else
    check_fail "SAM template not found at infrastructure/template.yaml"
fi

if [ -d "$PROJECT_ROOT/functions" ]; then
    check_pass "Lambda functions directory found"
else
    check_fail "Lambda functions directory not found"
fi

if [ -d "$PROJECT_ROOT/layers/common" ]; then
    check_pass "Lambda layer directory found"
else
    check_fail "Lambda layer directory not found"
fi

echo ""

# ============================================================================
# 5. Check Python Dependencies
# ============================================================================
echo -e "${BLUE}[5/8] Checking Python dependencies...${NC}"

# Check if requirements files exist
if [ -f "$PROJECT_ROOT/layers/common/requirements.txt" ]; then
    check_pass "Layer requirements.txt found"
else
    check_warn "Layer requirements.txt not found"
fi

# Check for function-specific requirements
FUNCTION_COUNT=$(find "$PROJECT_ROOT/functions" -name "requirements.txt" 2>/dev/null | wc -l)
if [ $FUNCTION_COUNT -gt 0 ]; then
    check_pass "Function requirements files found ($FUNCTION_COUNT)"
else
    check_warn "No function requirements.txt files found"
fi

echo ""

# ============================================================================
# 6. Validate SAM Template
# ============================================================================
echo -e "${BLUE}[6/8] Validating SAM template...${NC}"

if command -v sam &> /dev/null; then
    cd "$PROJECT_ROOT/infrastructure" 2>/dev/null || cd "$PROJECT_ROOT"

    if sam validate --lint &> /dev/null 2>&1; then
        check_pass "SAM template is valid"
    else
        check_warn "SAM template validation had warnings (may still deploy)"
        echo -e "   ${YELLOW}Run 'sam validate' for details${NC}"
    fi

    cd - > /dev/null 2>&1 || true
else
    check_warn "Skipping template validation (SAM CLI not installed)"
fi

echo ""

# ============================================================================
# 7. Check Bedrock Model Access (requires AWS credentials)
# ============================================================================
echo -e "${BLUE}[7/8] Checking Bedrock model access...${NC}"

if command -v aws &> /dev/null && aws sts get-caller-identity &> /dev/null 2>&1; then
    REGION=${AWS_REGION:-us-east-1}

    # Try to list Bedrock foundation models
    if aws bedrock list-foundation-models --region $REGION &> /dev/null 2>&1; then
        check_pass "Bedrock service is accessible"

        # Check if Claude 3.5 Sonnet is available
        MODEL_ID="anthropic.claude-3-5-sonnet-20241022-v2:0"
        if aws bedrock list-foundation-models --region $REGION --query "modelSummaries[?modelId=='$MODEL_ID']" --output json 2>/dev/null | grep -q "$MODEL_ID"; then
            check_pass "Claude 3.5 Sonnet v2 model is available in $REGION"
        else
            check_warn "Claude 3.5 Sonnet v2 may not be available in $REGION"
            echo -e "   ${YELLOW}Model access must be enabled in AWS Console${NC}"
            echo -e "   ${YELLOW}Supported regions: us-east-1, us-west-2${NC}"
        fi
    else
        check_warn "Cannot access Bedrock (check region or permissions)"
        echo -e "   ${YELLOW}Bedrock may not be available in $REGION${NC}"
        echo -e "   ${YELLOW}Supported regions: us-east-1, us-west-2, eu-west-1, etc.${NC}"
    fi
else
    check_warn "Skipping Bedrock check (AWS credentials not configured)"
fi

echo ""

# ============================================================================
# 8. Check Disk Space
# ============================================================================
echo -e "${BLUE}[8/8] Checking disk space...${NC}"

if command -v df &> /dev/null; then
    AVAILABLE_GB=$(df -BG . 2>/dev/null | awk 'NR==2 {print $4}' | sed 's/G//' 2>/dev/null || echo "0")

    if [ "$AVAILABLE_GB" -gt 5 ] 2>/dev/null; then
        check_pass "Sufficient disk space available (${AVAILABLE_GB}GB)"
    elif [ "$AVAILABLE_GB" -gt 0 ] 2>/dev/null; then
        check_warn "Low disk space (${AVAILABLE_GB}GB available, 5GB+ recommended)"
    else
        check_warn "Could not determine disk space"
    fi
else
    check_warn "Could not check disk space"
fi

echo ""

# ============================================================================
# Summary and Auto-Fix Offers
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Summary:${NC}"
echo -e "${GREEN}  Passed:   $CHECKS_PASSED${NC}"
echo -e "${RED}  Failed:   $CHECKS_FAILED${NC}"
echo -e "${YELLOW}  Warnings: $WARNINGS${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"

if [ $CHECKS_FAILED -eq 0 ]; then
    echo -e "${GREEN}"
    echo "✓ All critical checks passed!"
    echo "✓ You're ready to deploy ScatterPilot to AWS"
    echo -e "${NC}"

    # Log successful prerequisites check
    if [ -x "$LOG_SCRIPT" ]; then
        "$LOG_SCRIPT" SETUP "Prerequisites check passed: $CHECKS_PASSED checks successful with $WARNINGS warnings - AWS CLI, SAM CLI, Python, Docker verified and ready for deployment" 2>/dev/null || true
    fi

    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠ There are $WARNINGS warning(s) that you may want to address${NC}"
        echo ""
    fi

    echo -e "${BLUE}Next steps:${NC}"
    echo "  1. Enable Bedrock model access (see scripts/02-enable-bedrock-access.md)"
    echo "  2. Run deployment: ./scripts/03-deploy.sh"
    echo ""
    exit 0
else
    echo -e "${RED}"
    echo "✗ $CHECKS_FAILED critical check(s) failed"
    echo -e "${NC}"
    echo ""

    # Log failed prerequisites check
    if [ -x "$LOG_SCRIPT" ]; then
        "$LOG_SCRIPT" SETUP "Prerequisites check failed: $CHECKS_FAILED critical failures detected - missing tools or configuration issues preventing deployment readiness" 2>/dev/null || true
    fi

    # ========================================================================
    # Offer to install missing packages
    # ========================================================================
    echo -e "${CYAN}Would you like help installing the missing packages?${NC}"
    echo ""

    # Detect OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        OS="windows"
    else
        OS="unknown"
    fi

    INSTALL_COMMANDS=()

    # Check what's missing and build installation commands
    if ! command -v aws &> /dev/null; then
        echo -e "${YELLOW}📦 AWS CLI is missing${NC}"
        case $OS in
            macos)
                echo "   macOS: brew install awscli"
                INSTALL_COMMANDS+=("brew install awscli")
                ;;
            linux)
                echo "   Linux: curl 'https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip' -o 'awscliv2.zip' && unzip awscliv2.zip && sudo ./aws/install"
                echo "   Or download from: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
                ;;
            *)
                echo "   Download from: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
                ;;
        esac
        echo ""
    fi

    if ! command -v sam &> /dev/null; then
        echo -e "${YELLOW}📦 SAM CLI is missing${NC}"
        case $OS in
            macos)
                echo "   macOS: brew install aws-sam-cli"
                INSTALL_COMMANDS+=("brew install aws-sam-cli")
                ;;
            linux)
                echo "   Linux: pip install aws-sam-cli"
                INSTALL_COMMANDS+=("pip3 install aws-sam-cli")
                ;;
            *)
                echo "   Download from: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
                ;;
        esac
        echo ""
    fi

    if ! command -v python3 &> /dev/null; then
        echo -e "${YELLOW}📦 Python 3 is missing${NC}"
        case $OS in
            macos)
                echo "   macOS: brew install python@3.11"
                INSTALL_COMMANDS+=("brew install python@3.11")
                ;;
            linux)
                echo "   Linux (Ubuntu/Debian): sudo apt-get update && sudo apt-get install python3.11"
                echo "   Linux (RHEL/Amazon Linux): sudo yum install python3.11"
                ;;
            *)
                echo "   Download from: https://www.python.org/downloads/"
                ;;
        esac
        echo ""
    fi

    if ! command -v docker &> /dev/null; then
        echo -e "${YELLOW}📦 Docker is missing (optional but recommended)${NC}"
        case $OS in
            macos)
                echo "   macOS: Download Docker Desktop from https://www.docker.com/products/docker-desktop"
                ;;
            linux)
                echo "   Linux: curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh"
                ;;
            *)
                echo "   Download from: https://docs.docker.com/get-docker/"
                ;;
        esac
        echo ""
    fi

    # Offer automatic installation for Homebrew-based systems
    if [ $OS = "macos" ] && command -v brew &> /dev/null && [ ${#INSTALL_COMMANDS[@]} -gt 0 ]; then
        echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
        echo -e "${CYAN}Automatic Installation Available${NC}"
        echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
        echo ""
        echo "I can automatically install the missing packages using Homebrew:"
        echo ""
        for cmd in "${INSTALL_COMMANDS[@]}"; do
            echo "  • $cmd"
        done
        echo ""
        read -p "Install missing packages automatically? (y/n): " AUTO_INSTALL

        if [[ $AUTO_INSTALL =~ ^[Yy]$ ]]; then
            echo ""
            echo -e "${BLUE}Installing packages...${NC}"
            echo ""

            for cmd in "${INSTALL_COMMANDS[@]}"; do
                echo -e "${CYAN}Running: $cmd${NC}"
                eval $cmd
                if [ $? -eq 0 ]; then
                    echo -e "${GREEN}✓ Installed successfully${NC}"
                else
                    echo -e "${RED}✗ Installation failed${NC}"
                fi
                echo ""
            done

            echo -e "${GREEN}Installation complete!${NC}"
            echo ""
            echo "Please run this script again to verify:"
            echo "  ./scripts/01-check-prerequisites.sh"
            echo ""
            exit 0
        fi
    elif [ $OS = "linux" ] && [ ${#INSTALL_COMMANDS[@]} -gt 0 ]; then
        echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
        echo -e "${CYAN}Installation Commands${NC}"
        echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
        echo ""
        echo "Run these commands to install missing packages:"
        echo ""
        for cmd in "${INSTALL_COMMANDS[@]}"; do
            echo "  $cmd"
        done
        echo ""
        read -p "Would you like to install pip-based packages now? (y/n): " INSTALL_PIP

        if [[ $INSTALL_PIP =~ ^[Yy]$ ]]; then
            echo ""
            echo -e "${BLUE}Installing pip packages...${NC}"
            echo ""

            for cmd in "${INSTALL_COMMANDS[@]}"; do
                if [[ $cmd == pip* ]]; then
                    echo -e "${CYAN}Running: $cmd${NC}"
                    eval $cmd
                    if [ $? -eq 0 ]; then
                        echo -e "${GREEN}✓ Installed successfully${NC}"
                    else
                        echo -e "${RED}✗ Installation failed${NC}"
                    fi
                    echo ""
                fi
            done

            echo -e "${GREEN}Installation complete!${NC}"
            echo ""
            echo "Please run this script again to verify:"
            echo "  ./scripts/01-check-prerequisites.sh"
            echo ""
            exit 0
        fi
    fi

    echo ""
    echo -e "${BLUE}Manual Installation:${NC}"
    echo "  1. Install the missing packages using the commands above"
    echo "  2. Run this script again to verify: ./scripts/01-check-prerequisites.sh"
    echo ""

    # Special handling for AWS credentials
    if command -v aws &> /dev/null && ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
        echo -e "${CYAN}AWS Credentials Setup${NC}"
        echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
        echo ""
        echo "AWS CLI is installed but credentials are not configured."
        echo ""
        read -p "Would you like to configure AWS credentials now? (y/n): " CONFIG_AWS

        if [[ $CONFIG_AWS =~ ^[Yy]$ ]]; then
            echo ""
            echo -e "${BLUE}Running: aws configure${NC}"
            echo ""
            aws configure
            echo ""
            echo -e "${GREEN}✓ AWS credentials configured${NC}"
            echo ""
            echo "Please run this script again to verify:"
            echo "  ./scripts/01-check-prerequisites.sh"
            echo ""
            exit 0
        fi
    fi

    echo ""
    exit 1
fi

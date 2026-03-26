#!/bin/bash
#
# Cleanup script for abandoned AWS resources
# Default: dry-run mode (lists resources without deleting)
# Use --execute flag to actually delete resources
#

set -euo pipefail

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
AMPLIFY_APP_NAME="ai-invoice-generator"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
EXECUTE_MODE=false
for arg in "$@"; do
    case $arg in
        --execute)
            EXECUTE_MODE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--execute]"
            echo ""
            echo "Options:"
            echo "  --execute    Actually delete resources (default is dry-run)"
            echo "  --help, -h   Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $arg"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Print mode banner
echo ""
if [ "$EXECUTE_MODE" = true ]; then
    echo -e "${RED}================================================${NC}"
    echo -e "${RED}  EXECUTE MODE - Resources WILL be deleted!${NC}"
    echo -e "${RED}================================================${NC}"
else
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}  DRY-RUN MODE - No resources will be deleted${NC}"
    echo -e "${BLUE}  Use --execute flag to delete resources${NC}"
    echo -e "${BLUE}================================================${NC}"
fi
echo ""

# Track if any resources were found
RESOURCES_FOUND=false

#
# 1. AWS Amplify App: ai-invoice-generator
#
echo -e "${YELLOW}Checking for Amplify app: ${AMPLIFY_APP_NAME}${NC}"
echo "Region: ${AWS_REGION}"
echo ""

# List Amplify apps and find the target
AMPLIFY_APP_ID=$(aws amplify list-apps \
    --region "${AWS_REGION}" \
    --query "apps[?name=='${AMPLIFY_APP_NAME}'].appId" \
    --output text 2>/dev/null || echo "")

if [ -z "$AMPLIFY_APP_ID" ] || [ "$AMPLIFY_APP_ID" = "None" ]; then
    echo -e "${GREEN}No Amplify app found with name '${AMPLIFY_APP_NAME}'${NC}"
    echo ""
else
    RESOURCES_FOUND=true

    # Get app details
    echo -e "${YELLOW}Found Amplify app:${NC}"
    echo "  App ID:   ${AMPLIFY_APP_ID}"

    APP_DETAILS=$(aws amplify get-app \
        --app-id "${AMPLIFY_APP_ID}" \
        --region "${AWS_REGION}" \
        --query "app.{Name:name,CreateTime:createTime,DefaultDomain:defaultDomain}" \
        --output json 2>/dev/null || echo "{}")

    APP_CREATE_TIME=$(echo "$APP_DETAILS" | jq -r '.CreateTime // "unknown"')
    APP_DOMAIN=$(echo "$APP_DETAILS" | jq -r '.DefaultDomain // "none"')

    echo "  Name:     ${AMPLIFY_APP_NAME}"
    echo "  Created:  ${APP_CREATE_TIME}"
    echo "  Domain:   ${APP_DOMAIN}"
    echo ""

    # List branches
    echo "  Branches:"
    BRANCHES=$(aws amplify list-branches \
        --app-id "${AMPLIFY_APP_ID}" \
        --region "${AWS_REGION}" \
        --query "branches[].branchName" \
        --output text 2>/dev/null || echo "")

    if [ -z "$BRANCHES" ]; then
        echo "    (none)"
    else
        for branch in $BRANCHES; do
            echo "    - ${branch}"
        done
    fi
    echo ""

    if [ "$EXECUTE_MODE" = true ]; then
        echo -e "${RED}Deleting Amplify app: ${AMPLIFY_APP_ID}${NC}"

        # Confirm deletion
        read -p "Are you sure you want to delete this app? (yes/no): " CONFIRM
        if [ "$CONFIRM" != "yes" ]; then
            echo "Deletion cancelled."
            exit 0
        fi

        aws amplify delete-app \
            --app-id "${AMPLIFY_APP_ID}" \
            --region "${AWS_REGION}"

        echo -e "${GREEN}Amplify app deleted successfully${NC}"
    else
        echo -e "${BLUE}[DRY-RUN] Would delete Amplify app: ${AMPLIFY_APP_ID}${NC}"
    fi
    echo ""
fi

#
# Summary
#
echo "================================================"
if [ "$RESOURCES_FOUND" = false ]; then
    echo -e "${GREEN}No abandoned resources found.${NC}"
elif [ "$EXECUTE_MODE" = true ]; then
    echo -e "${GREEN}Cleanup complete.${NC}"
else
    echo -e "${YELLOW}Dry-run complete. Run with --execute to delete.${NC}"
fi
echo "================================================"

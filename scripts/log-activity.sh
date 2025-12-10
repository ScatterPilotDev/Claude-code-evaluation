#!/bin/bash
# Project Activity Logging Script
# Appends timestamped entries to PROJECT_LOG.md

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
LOG_FILE="PROJECT_LOG.md"
MIN_LENGTH=140
MAX_LENGTH=280

# Valid categories
VALID_CATEGORIES=("SETUP" "DEPLOY" "FIX" "FEATURE" "SECURITY" "TEST" "DOCS")

# Function to display usage
usage() {
    echo "Usage: $0 [CATEGORY] \"Summary text\""
    echo ""
    echo "Categories:"
    echo "  SETUP     - Environment setup, installations, configurations"
    echo "  DEPLOY    - Deployments and infrastructure changes"
    echo "  FIX       - Bug fixes and corrections"
    echo "  FEATURE   - New features and enhancements"
    echo "  SECURITY  - Security-related changes"
    echo "  TEST      - Testing activities"
    echo "  DOCS      - Documentation updates"
    echo ""
    echo "Summary requirements:"
    echo "  - Must be between ${MIN_LENGTH}-${MAX_LENGTH} characters"
    echo "  - Should be action-focused and human-readable"
    echo "  - Include relevant context (files, services, regions, etc.)"
    echo ""
    echo "Examples:"
    echo "  $0 SETUP \"Installed AWS CLI and SAM CLI in Codespaces environment\""
    echo "  $0 DEPLOY \"Deployed ScatterPilot to AWS us-east-1 with Lambda and API Gateway\""
    echo "  $0 FIX \"Resolved CORS configuration issue in API Gateway causing browser errors\""
    exit 1
}

# Function to validate category
validate_category() {
    local category=$1
    for valid in "${VALID_CATEGORIES[@]}"; do
        if [[ "$category" == "$valid" ]]; then
            return 0
        fi
    done
    return 1
}

# Function to validate summary length
validate_length() {
    local text=$1
    local length=${#text}

    if [[ $length -lt $MIN_LENGTH ]]; then
        echo -e "${RED}Error: Summary too short (${length} chars). Minimum: ${MIN_LENGTH} characters${NC}" >&2
        return 1
    fi

    if [[ $length -gt $MAX_LENGTH ]]; then
        echo -e "${RED}Error: Summary too long (${length} chars). Maximum: ${MAX_LENGTH} characters${NC}" >&2
        return 1
    fi

    return 0
}

# Function to add log entry
add_log_entry() {
    local category=$1
    local summary=$2

    # Get current timestamp
    local timestamp=$(date '+%Y-%m-%d %H:%M')
    local date_only=$(date '+%Y-%m-%d')

    # Create log file if it doesn't exist
    if [[ ! -f "$LOG_FILE" ]]; then
        cat > "$LOG_FILE" << 'EOF'
# Project Activity Log

This log tracks all significant activities in the project. Each entry includes:
- **Timestamp**: When the activity occurred
- **Category**: Type of activity (SETUP, DEPLOY, FIX, FEATURE, SECURITY, TEST, DOCS)
- **Summary**: Brief description of what was done (140-280 characters)

Entries are organized by date, with most recent at the top.

---

EOF
    fi

    # Check if there's already a section for today
    if ! grep -q "^## $date_only" "$LOG_FILE"; then
        # Add new date section after the header (after the ---)
        # Create temp file with new date section
        awk -v date="$date_only" '
            /^---$/ {
                print
                print ""
                print "## " date
                print ""
                next
            }
            { print }
        ' "$LOG_FILE" > "${LOG_FILE}.tmp"
        mv "${LOG_FILE}.tmp" "$LOG_FILE"
    fi

    # Add the entry under the appropriate date section
    local entry="[$timestamp] **[$category]** - $summary"

    # Insert entry after the date header
    awk -v date="$date_only" -v entry="$entry" '
        /^## / && $2 == date {
            print
            print ""
            print entry
            next
        }
        { print }
    ' "$LOG_FILE" > "${LOG_FILE}.tmp"
    mv "${LOG_FILE}.tmp" "$LOG_FILE"

    echo -e "${GREEN}✓${NC} Logged: [$category] $summary"
}

# Main script
main() {
    # Check for help flag
    if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
        usage
    fi

    # Check arguments
    if [[ $# -lt 2 ]]; then
        echo -e "${RED}Error: Missing arguments${NC}" >&2
        echo ""
        usage
    fi

    local category=$1
    local summary=$2

    # Validate category
    if ! validate_category "$category"; then
        echo -e "${RED}Error: Invalid category '$category'${NC}" >&2
        echo "Valid categories: ${VALID_CATEGORIES[*]}" >&2
        exit 1
    fi

    # Validate summary length
    if ! validate_length "$summary"; then
        echo -e "${YELLOW}Tip: Current length is ${#summary} characters${NC}" >&2
        exit 1
    fi

    # Add the log entry
    add_log_entry "$category" "$summary"
}

# Run main function
main "$@"

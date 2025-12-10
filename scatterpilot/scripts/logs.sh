#!/bin/bash
# ScatterPilot Lambda Log Tailer
# Tails CloudWatch logs for Lambda functions

set -e

# Default values
FUNCTION="Conversation"
TIME_RANGE="5m"
FILTER_ERRORS=true
ENVIRONMENT="${ENVIRONMENT:-dev}"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --full)
            FILTER_ERRORS=false
            shift
            ;;
        --since)
            TIME_RANGE="$2"
            shift 2
            ;;
        Conversation|CreateInvoice|ListInvoices|GetInvoice|GeneratePDF)
            FUNCTION="$1"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [FUNCTION] [--full] [--since TIME]"
            echo ""
            echo "Functions:"
            echo "  Conversation    (default)"
            echo "  CreateInvoice"
            echo "  ListInvoices"
            echo "  GetInvoice"
            echo "  GeneratePDF"
            echo ""
            echo "Options:"
            echo "  --full          Show all logs (default: ERROR only)"
            echo "  --since TIME    Time range (default: 5m)"
            echo ""
            echo "Examples:"
            echo "  $0                      # Tail Conversation errors from last 5m"
            echo "  $0 --full               # Tail Conversation all logs"
            echo "  $0 --since 1h           # Tail Conversation errors from last hour"
            echo "  $0 CreateInvoice        # Tail CreateInvoice errors"
            echo "  $0 CreateInvoice --full --since 30m"
            exit 0
            ;;
        *)
            echo "Error: Unknown argument: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Build log group name
LOG_GROUP="/aws/lambda/ScatterPilot-${FUNCTION}-${ENVIRONMENT}"

echo "📋 Tailing logs for: $LOG_GROUP"
echo "⏰ Time range: $TIME_RANGE"

if [ "$FILTER_ERRORS" = true ]; then
    echo "🔍 Filtering: ERROR lines only (use --full for all logs)"
    echo ""
    aws logs tail "$LOG_GROUP" --since "$TIME_RANGE" --follow --filter-pattern "ERROR"
else
    echo "🔍 Showing: All logs"
    echo ""
    aws logs tail "$LOG_GROUP" --since "$TIME_RANGE" --follow
fi

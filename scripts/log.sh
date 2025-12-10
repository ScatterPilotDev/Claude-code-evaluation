#!/bin/bash
# Simple wrapper for log-activity.sh
# Usage: ./scripts/log.sh "Your summary here"
# Or: ./scripts/log.sh CATEGORY "Your summary here"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check for help flag
if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
    exec "$SCRIPT_DIR/log-activity.sh" --help
fi

# If only one argument provided, assume it's FEATURE category
if [[ $# -eq 1 ]]; then
    exec "$SCRIPT_DIR/log-activity.sh" FEATURE "$1"
else
    exec "$SCRIPT_DIR/log-activity.sh" "$@"
fi

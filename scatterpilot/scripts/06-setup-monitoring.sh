#!/bin/bash

###############################################################################
# ScatterPilot - Cost Monitoring and CloudWatch Alarms Setup
# Sets up billing alarms and CloudWatch dashboards
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_FILE="$PROJECT_ROOT/.deployment-outputs"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         ScatterPilot - Cost Monitoring Setup                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# Load deployment outputs
# ============================================================================
if [ ! -f "$OUTPUT_FILE" ]; then
    echo -e "${RED}✗ Deployment outputs not found${NC}"
    echo "Please run ./scripts/03-deploy.sh first"
    exit 1
fi

source "$OUTPUT_FILE"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo -e "${CYAN}Setup for:${NC}"
echo "  AWS Account: $ACCOUNT_ID"
echo "  Stack: $STACK_NAME"
echo "  Environment: $ENVIRONMENT"
echo "  Region: $AWS_REGION"
echo ""

# ============================================================================
# Configure Billing Alert Email
# ============================================================================
echo -e "${BLUE}[Step 1/5] Email Configuration${NC}"
echo ""

read -p "Enter email address for billing alerts: " EMAIL_ADDRESS

if [ -z "$EMAIL_ADDRESS" ]; then
    echo -e "${RED}✗ Email address is required${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Email: $EMAIL_ADDRESS"
echo ""

# ============================================================================
# Create SNS Topic for Billing Alerts
# ============================================================================
echo -e "${BLUE}[Step 2/5] Creating SNS Topic${NC}"
echo ""

SNS_TOPIC_NAME="ScatterPilot-Billing-Alerts-${ENVIRONMENT}"

# Check if topic already exists
EXISTING_TOPIC=$(aws sns list-topics --region us-east-1 --query "Topics[?contains(TopicArn, '$SNS_TOPIC_NAME')].TopicArn" --output text)

if [ -n "$EXISTING_TOPIC" ]; then
    echo -e "${YELLOW}⚠${NC} SNS topic already exists: $SNS_TOPIC_NAME"
    TOPIC_ARN="$EXISTING_TOPIC"
else
    # Create SNS topic (must be in us-east-1 for billing alarms)
    TOPIC_ARN=$(aws sns create-topic \
        --name "$SNS_TOPIC_NAME" \
        --region us-east-1 \
        --tags "Key=Environment,Value=$ENVIRONMENT" "Key=Application,Value=ScatterPilot" \
        --query 'TopicArn' \
        --output text)

    echo -e "${GREEN}✓${NC} Created SNS topic: $SNS_TOPIC_NAME"
fi

echo "  ARN: $TOPIC_ARN"
echo ""

# Subscribe email to topic
SUBSCRIPTION_ARN=$(aws sns subscribe \
    --topic-arn "$TOPIC_ARN" \
    --protocol email \
    --notification-endpoint "$EMAIL_ADDRESS" \
    --region us-east-1 \
    --query 'SubscriptionArn' \
    --output text)

echo -e "${GREEN}✓${NC} Email subscription created"
echo -e "${YELLOW}⚠${NC} Check your email and confirm the subscription!"
echo ""

# ============================================================================
# Create Billing Alarms
# ============================================================================
echo -e "${BLUE}[Step 3/5] Creating Billing Alarms${NC}"
echo ""

# Determine billing thresholds based on environment
case $ENVIRONMENT in
    "dev")
        THRESHOLD_WARNING=10
        THRESHOLD_CRITICAL=50
        ;;
    "staging")
        THRESHOLD_WARNING=50
        THRESHOLD_CRITICAL=200
        ;;
    "prod")
        THRESHOLD_WARNING=100
        THRESHOLD_CRITICAL=500
        ;;
    *)
        THRESHOLD_WARNING=10
        THRESHOLD_CRITICAL=50
        ;;
esac

echo "Default thresholds for $ENVIRONMENT:"
echo "  Warning:  \$${THRESHOLD_WARNING}"
echo "  Critical: \$${THRESHOLD_CRITICAL}"
echo ""

read -p "Use default thresholds? (y/n) [y]: " USE_DEFAULT
if [[ ! $USE_DEFAULT =~ ^[Yy]*$ ]] && [ -n "$USE_DEFAULT" ]; then
    read -p "Enter warning threshold (USD): " THRESHOLD_WARNING
    read -p "Enter critical threshold (USD): " THRESHOLD_CRITICAL
fi

echo ""

# Create warning alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "ScatterPilot-${ENVIRONMENT}-Billing-Warning" \
    --alarm-description "ScatterPilot $ENVIRONMENT billing warning at \$${THRESHOLD_WARNING}" \
    --metric-name EstimatedCharges \
    --namespace AWS/Billing \
    --statistic Maximum \
    --period 21600 \
    --evaluation-periods 1 \
    --threshold $THRESHOLD_WARNING \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=Currency,Value=USD \
    --alarm-actions "$TOPIC_ARN" \
    --region us-east-1

echo -e "${GREEN}✓${NC} Warning alarm set at \$$THRESHOLD_WARNING"

# Create critical alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "ScatterPilot-${ENVIRONMENT}-Billing-Critical" \
    --alarm-description "ScatterPilot $ENVIRONMENT billing CRITICAL at \$${THRESHOLD_CRITICAL}" \
    --metric-name EstimatedCharges \
    --namespace AWS/Billing \
    --statistic Maximum \
    --period 21600 \
    --evaluation-periods 1 \
    --threshold $THRESHOLD_CRITICAL \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=Currency,Value=USD \
    --alarm-actions "$TOPIC_ARN" \
    --region us-east-1

echo -e "${GREEN}✓${NC} Critical alarm set at \$$THRESHOLD_CRITICAL"
echo ""

# ============================================================================
# Create Lambda Error Alarms
# ============================================================================
echo -e "${BLUE}[Step 4/5] Creating Lambda Error Alarms${NC}"
echo ""

# Create alarm for conversation function errors
aws cloudwatch put-metric-alarm \
    --alarm-name "ScatterPilot-${ENVIRONMENT}-Conversation-Errors" \
    --alarm-description "Errors in Conversation Lambda function" \
    --metric-name Errors \
    --namespace AWS/Lambda \
    --statistic Sum \
    --period 300 \
    --evaluation-periods 1 \
    --threshold 5 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=FunctionName,Value="ScatterPilot-Conversation-${ENVIRONMENT}" \
    --alarm-actions "$TOPIC_ARN" \
    --region "$AWS_REGION"

echo -e "${GREEN}✓${NC} Conversation function error alarm created"

# Create alarm for high duration (timeout warning)
aws cloudwatch put-metric-alarm \
    --alarm-name "ScatterPilot-${ENVIRONMENT}-Conversation-Duration" \
    --alarm-description "High duration in Conversation Lambda function" \
    --metric-name Duration \
    --namespace AWS/Lambda \
    --statistic Average \
    --period 300 \
    --evaluation-periods 2 \
    --threshold 50000 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=FunctionName,Value="ScatterPilot-Conversation-${ENVIRONMENT}" \
    --alarm-actions "$TOPIC_ARN" \
    --region "$AWS_REGION"

echo -e "${GREEN}✓${NC} Conversation function duration alarm created"
echo ""

# ============================================================================
# Create CloudWatch Dashboard
# ============================================================================
echo -e "${BLUE}[Step 5/5] Creating CloudWatch Dashboard${NC}"
echo ""

DASHBOARD_NAME="ScatterPilot-${ENVIRONMENT}"

# Create dashboard JSON
cat > /tmp/dashboard.json <<EOF
{
    "widgets": [
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    [ "AWS/Lambda", "Invocations", { "stat": "Sum", "label": "Invocations" } ],
                    [ ".", "Errors", { "stat": "Sum", "label": "Errors", "yAxis": "right" } ],
                    [ ".", "Duration", { "stat": "Average", "label": "Avg Duration (ms)" } ]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "$AWS_REGION",
                "title": "Lambda Metrics - Conversation",
                "period": 300,
                "yAxis": {
                    "left": {
                        "label": "Count"
                    },
                    "right": {
                        "label": "Errors"
                    }
                }
            }
        },
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    [ "AWS/DynamoDB", "ConsumedReadCapacityUnits", { "stat": "Sum" } ],
                    [ ".", "ConsumedWriteCapacityUnits", { "stat": "Sum" } ]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "$AWS_REGION",
                "title": "DynamoDB Capacity",
                "period": 300
            }
        },
        {
            "type": "metric",
            "properties": {
                "metrics": [
                    [ "AWS/ApiGateway", "Count", { "stat": "Sum", "label": "Requests" } ],
                    [ ".", "4XXError", { "stat": "Sum", "label": "4XX Errors", "yAxis": "right" } ],
                    [ ".", "5XXError", { "stat": "Sum", "label": "5XX Errors", "yAxis": "right" } ]
                ],
                "view": "timeSeries",
                "stacked": false,
                "region": "$AWS_REGION",
                "title": "API Gateway Metrics",
                "period": 300
            }
        },
        {
            "type": "log",
            "properties": {
                "query": "SOURCE '/aws/lambda/ScatterPilot-Conversation-$ENVIRONMENT'\n| fields @timestamp, @message\n| filter @message like /ERROR/\n| sort @timestamp desc\n| limit 20",
                "region": "$AWS_REGION",
                "title": "Recent Errors",
                "stacked": false
            }
        }
    ]
}
EOF

# Create the dashboard
aws cloudwatch put-dashboard \
    --dashboard-name "$DASHBOARD_NAME" \
    --dashboard-body file:///tmp/dashboard.json \
    --region "$AWS_REGION"

echo -e "${GREEN}✓${NC} CloudWatch dashboard created: $DASHBOARD_NAME"
echo ""

rm -f /tmp/dashboard.json

# ============================================================================
# Cost Estimation
# ============================================================================
echo -e "${BLUE}[Bonus] Monthly Cost Estimation${NC}"
echo ""

cat <<EOF
Estimated monthly costs for $ENVIRONMENT environment:

┌─────────────────────────────────────────────────────────────┐
│ AWS Bedrock (Claude Sonnet 4.5)                             │
├─────────────────────────────────────────────────────────────┤
│ Input tokens:  \$0.003 per 1K tokens                        │
│ Output tokens: \$0.015 per 1K tokens                        │
│                                                             │
│ Example usage:                                              │
│ • 100 invoices/month × 5K tokens = 500K tokens             │
│ • Estimated cost: ~\$5-10/month                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ DynamoDB (On-Demand)                                        │
├─────────────────────────────────────────────────────────────┤
│ Write requests: \$1.25 per million                          │
│ Read requests:  \$0.25 per million                          │
│ Storage:        \$0.25 per GB/month                         │
│                                                             │
│ Example usage:                                              │
│ • 1,000 writes/month: \$0.0013                              │
│ • 5,000 reads/month: \$0.0013                               │
│ • 1 GB storage: \$0.25                                      │
│ • Estimated cost: ~\$0.50/month                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Lambda                                                      │
├─────────────────────────────────────────────────────────────┤
│ Requests:  \$0.20 per 1M requests                           │
│ Duration:  \$0.0000166667 per GB-second                     │
│                                                             │
│ Example usage:                                              │
│ • 1,000 invocations × 2s × 1GB: \$0.03                      │
│ • Free tier: 1M requests, 400K GB-seconds                   │
│ • Estimated cost: FREE (within free tier)                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ API Gateway                                                 │
├─────────────────────────────────────────────────────────────┤
│ REST API requests: \$3.50 per million                       │
│                                                             │
│ Example usage:                                              │
│ • 5,000 requests/month: \$0.02                              │
│ • Free tier: 1M requests (12 months)                        │
│ • Estimated cost: FREE (within free tier)                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ S3                                                          │
├─────────────────────────────────────────────────────────────┤
│ Storage: \$0.023 per GB/month                               │
│ Requests: Minimal cost                                      │
│                                                             │
│ Example usage:                                              │
│ • 100 PDFs × 100KB = 10MB: \$0.0002                         │
│ • Estimated cost: <\$0.01/month                             │
└─────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════
TOTAL ESTIMATED MONTHLY COST (Development/Light Use):
  \$5 - \$15/month

Primary cost driver: Bedrock API calls
Cost scales with usage - monitor regularly!
═══════════════════════════════════════════════════════════════

Note: Costs shown are estimates. Actual costs may vary based on
usage patterns, region, and AWS pricing changes.
EOF

echo ""

# ============================================================================
# Summary
# ============================================================================
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Monitoring Setup Complete!${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${BLUE}Created Resources:${NC}"
echo "  ✓ SNS Topic: $SNS_TOPIC_NAME"
echo "  ✓ Email subscription to: $EMAIL_ADDRESS"
echo "  ✓ Billing alarms: Warning (\$$THRESHOLD_WARNING), Critical (\$$THRESHOLD_CRITICAL)"
echo "  ✓ Lambda error alarms"
echo "  ✓ CloudWatch dashboard: $DASHBOARD_NAME"
echo ""

echo -e "${YELLOW}⚠ Important:${NC}"
echo "  1. Check your email and CONFIRM the SNS subscription"
echo "  2. You won't receive alerts until confirmed"
echo ""

echo -e "${BLUE}View Monitoring:${NC}"
echo ""
echo "  CloudWatch Dashboard:"
echo "    https://console.aws.amazon.com/cloudwatch/home?region=$AWS_REGION#dashboards:name=$DASHBOARD_NAME"
echo ""
echo "  CloudWatch Alarms:"
echo "    https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#alarmsV2:"
echo ""
echo "  Cost Explorer:"
echo "    https://console.aws.amazon.com/cost-management/home#/cost-explorer"
echo ""
echo "  Billing Dashboard:"
echo "    https://console.aws.amazon.com/billing/home"
echo ""

echo -e "${BLUE}CLI Commands:${NC}"
echo ""
echo "  View current costs:"
echo "    aws ce get-cost-and-usage --time-period Start=2025-10-01,End=2025-10-31 --granularity MONTHLY --metrics BlendedCost"
echo ""
echo "  Check alarm status:"
echo "    aws cloudwatch describe-alarms --region us-east-1 --alarm-names ScatterPilot-${ENVIRONMENT}-Billing-Warning"
echo ""
echo "  View Lambda logs:"
echo "    aws logs tail /aws/lambda/ScatterPilot-Conversation-${ENVIRONMENT} --follow --region $AWS_REGION"
echo ""

# Save monitoring configuration
MONITORING_CONFIG="$PROJECT_ROOT/.monitoring-config"
cat > "$MONITORING_CONFIG" <<EOF
SNS_TOPIC_ARN="$TOPIC_ARN"
EMAIL_ADDRESS="$EMAIL_ADDRESS"
THRESHOLD_WARNING="$THRESHOLD_WARNING"
THRESHOLD_CRITICAL="$THRESHOLD_CRITICAL"
DASHBOARD_NAME="$DASHBOARD_NAME"
CONFIGURED_AT="$(date -u +"%Y-%m-%d %H:%M:%S UTC")"
EOF

echo -e "${GREEN}Monitoring configuration saved to: .monitoring-config${NC}"
echo ""

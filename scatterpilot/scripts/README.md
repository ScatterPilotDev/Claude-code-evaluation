# ScatterPilot Deployment Scripts

Automated deployment scripts for ScatterPilot AWS infrastructure.

## 📋 Scripts Overview

| Script | Purpose | Time | Interactive |
|--------|---------|------|-------------|
| `00-deploy-all.sh` | **Complete automated deployment** | 10-15 min | ✅ Yes |
| `01-check-prerequisites.sh` | Verify prerequisites | 1 min | ❌ No |
| `02-enable-bedrock-access.md` | Bedrock setup guide | 2 min | 📖 Guide |
| `03-deploy.sh` | Deploy infrastructure | 5-10 min | ✅ Yes |
| `04-test-deployment.sh` | Test deployment | 1-2 min | ❌ No |
| `05-configure-frontend.sh` | Configure demo frontend | 1 min | ✅ Yes |
| `06-setup-monitoring.sh` | Set up cost monitoring | 2-3 min | ✅ Yes |

---

## 🚀 Quick Start

### One-Command Deployment

```bash
./scripts/00-deploy-all.sh
```

This runs all scripts in sequence with interactive prompts.

---

## 📝 Individual Scripts

### 1️⃣ Prerequisites Check

```bash
./scripts/01-check-prerequisites.sh
```

**Checks:**
- ✅ AWS CLI installed and configured
- ✅ SAM CLI installed
- ✅ Python 3.11+ available
- ✅ Docker running (optional)
- ✅ Project structure valid
- ✅ SAM template valid
- ✅ Bedrock service accessible

**Exit Codes:**
- `0`: All checks passed
- `1`: Critical checks failed

**Example Output:**
```
[1/8] Checking AWS CLI...
✓ AWS CLI installed (version 2.13.0)
✓ AWS credentials configured (Account: 123456789012)
✓ Default region set: us-east-1

...

═══════════════════════════════════════════════════════════════
Summary:
  Passed:   15
  Failed:   0
  Warnings: 2
═══════════════════════════════════════════════════════════════
```

---

### 2️⃣ Bedrock Access Setup

```bash
cat scripts/02-enable-bedrock-access.md
```

**Documentation includes:**
- Step-by-step console instructions
- Supported AWS regions
- CLI commands for verification
- Troubleshooting guide
- Pricing information
- IAM permissions required

**Supported Regions:**
- ⭐ `us-east-1` (Primary)
- ⭐ `us-west-2` (Primary)
- ✓ `eu-west-1`, `eu-west-3`
- ✓ `ap-northeast-1`, `ap-southeast-1`, `ap-southeast-2`

---

### 3️⃣ Infrastructure Deployment

```bash
./scripts/03-deploy.sh
```

**Configuration Prompts:**
1. **Stack Name**: Default `scatterpilot`
2. **AWS Region**: Default from AWS config
3. **Environment**: `dev`, `staging`, or `prod`
4. **S3 Bucket**: Auto-generated or custom
5. **Cognito ARN**: Optional for authentication

**Resources Created:**
- 5 Lambda functions
- 1 Lambda layer (shared dependencies)
- 3 DynamoDB tables
- 1 S3 bucket (encrypted)
- 1 API Gateway REST API
- CloudWatch log groups
- IAM roles and policies

**Outputs:**
- API Gateway URL
- DynamoDB table names
- S3 bucket name
- Lambda function ARNs

**Configuration Saved:**
- `.deployment-config` - Deployment parameters
- `.deployment-outputs` - Stack outputs

**Example:**
```bash
./scripts/03-deploy.sh

# Prompts:
Enter stack name [scatterpilot]: scatterpilot
Enter AWS region [us-east-1]: us-east-1
Choose environment [1]: 1

# Output:
═══════════════════════════════════════════════════════════════
Deployment Successful!
═══════════════════════════════════════════════════════════════

API Gateway URL:
  https://abc123xyz.execute-api.us-east-1.amazonaws.com/dev
```

---

### 4️⃣ Deployment Testing

```bash
./scripts/04-test-deployment.sh
```

**Tests Performed:**
1. API Gateway health check (CORS, HTTP status)
2. Bedrock conversation endpoint (full conversation test)
3. DynamoDB tables (status, item counts)
4. S3 bucket (versioning, encryption)
5. Lambda functions (status check)

**Prerequisites:**
- Deployment must be complete
- `.deployment-outputs` file must exist

**Example Output:**
```
[Test 1/5] API Gateway Health Check
✓ API Gateway is accessible (HTTP 200)
✓ CORS is configured correctly

[Test 2/5] Bedrock Conversation Endpoint
Sending test message to AI...

✓ Bedrock conversation successful
✓ Conversation ID: 550e8400-e29b-41d4-a716-446655440000
✓ AI Response preview: Great! I've extracted...

[Test 3/5] DynamoDB Tables
✓ Conversations table is active (1 items)
✓ Invoices table is active (0 items)
```

**Results Saved:** `.test-results`

---

### 5️⃣ Frontend Configuration

```bash
./scripts/05-configure-frontend.sh
```

**Creates:**
- `demo/js/config.js` - Frontend configuration
- `demo/js/api-client.js` - API client helper
- Backups of original files

**Configuration:**
- API URL from deployment outputs
- Environment settings
- Feature flags
- AWS region/account info

**Example:**
```javascript
// Generated config.js
const ScatterPilotConfig = {
    apiUrl: 'https://abc123.execute-api.us-east-1.amazonaws.com/dev',
    environment: 'dev',
    features: {
        demoMode: true,
        liveMode: true,
        defaultMode: 'demo'
    }
    // ...
};
```

**Testing:**
```bash
cd demo
python3 -m http.server 8000
# Open http://localhost:8000
# Toggle to "Live API" mode
```

---

### 6️⃣ Cost Monitoring Setup

```bash
./scripts/06-setup-monitoring.sh
```

**Creates:**
1. **SNS Topic** for billing alerts
2. **Email Subscription** (requires confirmation)
3. **Billing Alarms**:
   - Warning threshold (default: $10 dev, $50 staging, $100 prod)
   - Critical threshold (default: $50 dev, $200 staging, $500 prod)
4. **Lambda Error Alarms**:
   - Error count threshold
   - Duration warning (near timeout)
5. **CloudWatch Dashboard** with metrics for:
   - Lambda invocations, errors, duration
   - DynamoDB capacity
   - API Gateway requests/errors
   - Recent error logs

**Configuration Prompts:**
1. Email address for alerts
2. Custom billing thresholds (optional)

**Outputs:**
- CloudWatch dashboard URL
- Cost estimation breakdown
- CLI commands for monitoring

**Cost Estimate (Development):**
```
┌─────────────────────────────────────────────┐
│ AWS Bedrock (Claude Sonnet 4.5)            │
│ Example: 100 invoices × 5K tokens = $5-10  │
├─────────────────────────────────────────────┤
│ DynamoDB (On-Demand)                       │
│ Example: 1K writes + 5K reads = ~$0.50    │
├─────────────────────────────────────────────┤
│ Lambda - FREE (within free tier)           │
│ API Gateway - FREE (within free tier)      │
│ S3 - <$0.01/month                          │
└─────────────────────────────────────────────┘

TOTAL: $5-15/month
```

**Configuration Saved:** `.monitoring-config`

---

## 🔍 Configuration Files

Generated during deployment:

| File | Purpose |
|------|---------|
| `.deployment-config` | Stack name, region, environment, S3 bucket |
| `.deployment-outputs` | API URL, table names, bucket names |
| `.test-results` | Test execution results |
| `.monitoring-config` | SNS topic, thresholds, dashboard |

**Example `.deployment-outputs`:**
```bash
API_URL="https://abc123.execute-api.us-east-1.amazonaws.com/dev"
CONVERSATIONS_TABLE="ScatterPilot-Conversations-dev"
INVOICES_TABLE="ScatterPilot-Invoices-dev"
INVOICE_BUCKET="scatterpilot-invoices-dev-123456789012"
STACK_NAME="scatterpilot"
AWS_REGION="us-east-1"
ENVIRONMENT="dev"
DEPLOYED_AT="2025-10-30 20:30:00 UTC"
```

---

## 🛠️ Common Tasks

### Re-deploy After Code Changes

```bash
./scripts/03-deploy.sh
# Uses saved configuration from .deployment-config
```

### Update Frontend Configuration

```bash
./scripts/05-configure-frontend.sh
```

### View Deployment Status

```bash
source .deployment-outputs
aws cloudformation describe-stacks --stack-name $STACK_NAME --region $AWS_REGION
```

### View Lambda Logs

```bash
source .deployment-outputs
aws logs tail /aws/lambda/ScatterPilot-Conversation-$ENVIRONMENT --follow --region $AWS_REGION
```

### Check Current Costs

```bash
aws ce get-cost-and-usage \
  --time-period Start=2025-10-01,End=2025-10-31 \
  --granularity MONTHLY \
  --metrics BlendedCost
```

### Delete Deployment

```bash
source .deployment-outputs

# Delete stack
aws cloudformation delete-stack --stack-name $STACK_NAME --region $AWS_REGION

# Empty and delete S3 buckets
aws s3 rm s3://$INVOICE_BUCKET --recursive
aws s3 rb s3://$INVOICE_BUCKET
```

---

## 🐛 Troubleshooting

### Script Permission Denied

```bash
chmod +x scripts/*.sh
```

### AWS CLI Not Configured

```bash
aws configure
# Enter your credentials
```

### Docker Not Running

```bash
# macOS
open -a Docker

# Linux
sudo systemctl start docker
```

### Bedrock Access Denied

1. Open AWS Console → Amazon Bedrock
2. Navigate to "Model access"
3. Enable "Claude Sonnet 4.5 v2"
4. Wait for "Access granted" status

### Stack Deployment Failed

```bash
# View CloudFormation events
aws cloudformation describe-stack-events \
  --stack-name scatterpilot \
  --max-items 20
```

### Clean Start

```bash
# Remove configuration files
rm -f .deployment-config .deployment-outputs .test-results .monitoring-config

# Delete stack
aws cloudformation delete-stack --stack-name scatterpilot

# Start over
./scripts/00-deploy-all.sh
```

---

## 📚 Additional Resources

- [Complete Deployment Guide](../DEPLOYMENT_GUIDE.md)
- [Main README](../README.md)
- [SAM Template](../infrastructure/template.yaml)
- [Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)

---

## 💡 Tips

1. **Save Configuration**: Scripts save settings to avoid re-entering information
2. **Reuse Buckets**: S3 buckets are auto-generated with account ID to avoid conflicts
3. **Email Confirmation**: Don't forget to confirm SNS email subscription!
4. **Region Selection**: Use `us-east-1` or `us-west-2` for best Bedrock availability
5. **Cost Monitoring**: Set up billing alarms before testing extensively

---

**Need Help?** See [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) for detailed documentation.

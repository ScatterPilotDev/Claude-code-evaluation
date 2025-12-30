# ScatterPilot - Complete Deployment Guide

## 🚨 SECURITY WARNING

**STOP! Read this before deploying:**

### ⚠️ Never Commit AWS Credentials to Git!

If you're deploying from:
- **Public Repository / Codespaces**: Use [GitHub Codespaces Secrets](CODESPACES_SETUP.md)
- **Local Machine**: Use `aws configure` (credentials stored in `~/.aws/`)
- **EC2 / Cloud**: Use IAM roles (no credentials needed)

### 🔒 Required Reading

1. **[SECURITY.md](SECURITY.md)** - Comprehensive security guide
2. **[CODESPACES_SETUP.md](CODESPACES_SETUP.md)** - Secure Codespaces setup
3. **[scripts/iam-deployment-policy.json](scripts/iam-deployment-policy.json)** - Least-privilege IAM policy

### ✅ Security Checklist

- [ ] Read SECURITY.md
- [ ] Using GitHub Codespaces Secrets or IAM role (not credential files)
- [ ] Created dedicated IAM user (not root account)
- [ ] Applied least-privilege IAM policy
- [ ] Enabled MFA on AWS account
- [ ] `.gitignore` includes `.aws/` and credential files
- [ ] GitHub secret scanning enabled

**Once you've completed the checklist above, proceed with deployment.**

---

This guide walks you through deploying ScatterPilot to AWS with real Bedrock integration.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Bedrock Access Setup](#bedrock-access-setup)
4. [Deployment Steps](#deployment-steps)
5. [Post-Deployment](#post-deployment)
6. [Cost Monitoring](#cost-monitoring)
7. [Troubleshooting](#troubleshooting)
8. [Next Steps](#next-steps)

---

## Prerequisites

### Required Tools

- **AWS CLI** (v2.0+)
- **AWS SAM CLI** (v1.50+)
- **Python** (3.11+)
- **Docker** (recommended for building Lambda layers)
- **Git**
- **curl** and **jq** (for testing)

### Required AWS Access

- AWS Account with administrative permissions
- Programmatic access credentials configured
- Permissions to:
  - Create CloudFormation stacks
  - Manage Lambda functions
  - Create DynamoDB tables
  - Create S3 buckets
  - Access Amazon Bedrock
  - Create IAM roles

---

## Pre-Deployment Checklist

### Step 1: Run Prerequisites Check

```bash
cd scatterpilot
chmod +x scripts/*.sh
./scripts/01-check-prerequisites.sh
```

This script verifies:
- ✅ AWS CLI installed and configured
- ✅ SAM CLI installed
- ✅ Python 3.11+ available
- ✅ Docker running (optional but recommended)
- ✅ Project structure is correct
- ✅ SAM template is valid
- ✅ Bedrock service accessibility

**Expected Output:**
```
═══════════════════════════════════════════════════════════════
Summary:
  Passed:   15
  Failed:   0
  Warnings: 2
═══════════════════════════════════════════════════════════════

✓ All critical checks passed!
✓ You're ready to deploy ScatterPilot to AWS
```

### Step 2: Fix Any Issues

If the check fails, follow the recommendations in the output:

**AWS CLI not configured?**
```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter default region (recommend: us-east-1)
# Enter output format (recommend: json)
```

**SAM CLI not installed?**
```bash
# macOS
brew install aws-sam-cli

# Linux
pip install aws-sam-cli

# Windows
choco install aws-sam-cli
```

**Docker not running?**
```bash
# Start Docker Desktop or run:
sudo systemctl start docker  # Linux
open -a Docker              # macOS
```

---

## Bedrock Access Setup

### Step 1: Review Bedrock Setup Guide

```bash
cat scripts/02-enable-bedrock-access.md
```

Or view online: [02-enable-bedrock-access.md](scripts/02-enable-bedrock-access.md)

### Step 2: Enable Model Access in AWS Console

1. **Sign in to AWS Console**
   - Go to https://console.aws.amazon.com/

2. **Navigate to Amazon Bedrock**
   - Search for "Bedrock" in the services search bar
   - Select your deployment region (recommended: **us-east-1** or **us-west-2**)

3. **Enable Model Access**
   - Click **"Model access"** in the left sidebar
   - Click **"Enable specific models"**
   - Find **Anthropic → Claude Sonnet 4.5 v2**
   - Model ID: `anthropic.claude-sonnet-4-5-20250929-v1:0`
   - Check the box and click **"Request model access"**

4. **Wait for Approval**
   - Access is typically granted **immediately**
   - Status will change to "Access granted" ✅

### Step 3: Verify Access

```bash
# Test Bedrock access
aws bedrock list-foundation-models \
  --region us-east-1 \
  --query 'modelSummaries[?modelId==`anthropic.claude-sonnet-4-5-20250929-v1:0`]'
```

**Expected output:** JSON with model details

### Supported Regions

| Region | Code | Latency | Recommended |
|--------|------|---------|-------------|
| US East (N. Virginia) | us-east-1 | Lowest | ⭐ Primary |
| US West (Oregon) | us-west-2 | Low | ⭐ Primary |
| Europe (Ireland) | eu-west-1 | Medium | ✓ |
| Asia Pacific (Tokyo) | ap-northeast-1 | Medium | ✓ |

---

## Deployment Steps

### Step 1: Run Automated Deployment

```bash
./scripts/03-deploy.sh
```

### Step 2: Answer Configuration Prompts

The script will guide you through:

#### Stack Name
```
Enter stack name [scatterpilot]: scatterpilot
```
- Use default or enter custom name
- Must be unique in your AWS account

#### AWS Region
```
Enter AWS region [us-east-1]: us-east-1
```
- Choose from supported Bedrock regions
- Recommended: `us-east-1` or `us-west-2`

#### Environment
```
Select environment:
  1. dev (Development)
  2. staging (Staging)
  3. prod (Production)

Choose environment [1]: 1
```
- **dev**: For development and testing
- **staging**: For pre-production testing
- **prod**: For production use

#### S3 Bucket
```
Enter S3 bucket for deployment artifacts [scatterpilot-sam-artifacts-123456789012-us-east-1]:
```
- Press Enter to use auto-generated name
- Or provide your own bucket name
- Bucket will be created if it doesn't exist

#### Cognito (Optional)
```
Do you have a Cognito User Pool ARN for authentication? (y/n) [n]: n
```
- **n**: API will be publicly accessible (good for demo)
- **y**: Requires Cognito authentication (recommended for production)

### Step 3: Wait for Deployment

The script will:
1. ✅ Create/verify S3 bucket for artifacts
2. ✅ Build Lambda functions and layers
3. ✅ Validate SAM template
4. ✅ Deploy CloudFormation stack
5. ✅ Retrieve and display outputs

**Deployment time:** 3-5 minutes

### Step 4: Save Deployment Info

Upon success, you'll see:

```
═══════════════════════════════════════════════════════════════
Deployment Successful!
═══════════════════════════════════════════════════════════════

API Gateway URL:
  https://abc123xyz.execute-api.us-east-1.amazonaws.com/dev

DynamoDB Tables:
  Conversations: ScatterPilot-Conversations-dev
  Invoices:      ScatterPilot-Invoices-dev

S3 Bucket:
  scatterpilot-invoices-dev-123456789012
═══════════════════════════════════════════════════════════════
```

**Important:** This information is saved to `.deployment-outputs`

---

## Post-Deployment

### Step 1: Test the Deployment

```bash
./scripts/04-test-deployment.sh
```

This script tests:
- ✅ API Gateway accessibility
- ✅ Bedrock conversation endpoint
- ✅ DynamoDB tables
- ✅ S3 bucket
- ✅ Lambda functions

**Expected output:**
```
[Test 1/5] API Gateway Health Check
✓ API Gateway is accessible (HTTP 200)
✓ CORS is configured correctly

[Test 2/5] Bedrock Conversation Endpoint
Sending test message to AI...

✓ Bedrock conversation successful
✓ Conversation ID: 550e8400-e29b-41d4-a716-446655440000
✓ AI Response preview: Great! I've extracted the following information...
```

### Step 2: Configure Frontend

```bash
./scripts/05-configure-frontend.sh
```

This script:
- Creates `demo/js/config.js` with API URL
- Creates `demo/js/api-client.js` helper
- Updates `demo/index.html` to include config
- Backs up original files

### Step 3: Test Frontend

```bash
# Start local server
cd demo
python3 -m http.server 8000

# Open browser to http://localhost:8000
# Toggle to "Live API" mode
# Test creating an invoice
```

**Verify:**
1. Switch mode toggle to "Live API"
2. Click "Start Creating an Invoice"
3. Send message: "Invoice Acme Corp for 5 widgets at $10 each"
4. Confirm AI responds with real Bedrock output
5. Complete invoice and download PDF

---

## Cost Monitoring

### Step 1: Set Up CloudWatch Alarms

```bash
./scripts/06-setup-monitoring.sh
```

### Step 2: Configure Email Alerts

```
Enter email address for billing alerts: your@email.com
```

The script will:
- Create SNS topic for alerts
- Subscribe your email
- Create billing alarms (warning & critical)
- Create Lambda error alarms
- Create CloudWatch dashboard

### Step 3: Confirm Email Subscription

**Important:** Check your email and click the confirmation link!

You won't receive alerts until you confirm.

### Step 4: Review Cost Estimates

The script displays estimated monthly costs:

```
TOTAL ESTIMATED MONTHLY COST (Development/Light Use):
  $5 - $15/month

Primary cost driver: Bedrock API calls
Cost scales with usage - monitor regularly!
```

**Cost Breakdown:**
- **Bedrock**: ~$5-10/month (100 invoices)
- **DynamoDB**: ~$0.50/month (on-demand)
- **Lambda**: FREE (within free tier)
- **API Gateway**: FREE (within free tier for 12 months)
- **S3**: <$0.01/month

### Monitoring Dashboard

View your CloudWatch dashboard:
```
https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=ScatterPilot-dev
```

### View Current Costs

```bash
# Current month costs
aws ce get-cost-and-usage \
  --time-period Start=2025-10-01,End=2025-10-31 \
  --granularity MONTHLY \
  --metrics BlendedCost

# By service
aws ce get-cost-and-usage \
  --time-period Start=2025-10-01,End=2025-10-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

---

## Troubleshooting

### Issue: "Model not found" during deployment

**Cause:** Bedrock model not available in selected region

**Solution:**
```bash
# Switch to a supported region
aws configure set region us-east-1

# Re-run deployment
./scripts/03-deploy.sh
```

### Issue: "Access denied" when calling Bedrock

**Cause:** Model access not enabled

**Solution:**
1. Go to AWS Console → Bedrock → Model access
2. Enable Claude Sonnet 4.5 v2
3. Wait for "Access granted" status
4. Re-run deployment

### Issue: SAM build fails

**Cause:** Docker not running or permissions issue

**Solution:**
```bash
# Start Docker
# macOS: Open Docker Desktop
# Linux:
sudo systemctl start docker

# Or build without Docker
cd infrastructure
sam build --use-container false
```

### Issue: Stack deployment fails

**Cause:** Insufficient permissions

**Solution:**
```bash
# Verify IAM permissions
aws iam get-user
aws iam list-attached-user-policies --user-name YOUR_USERNAME

# Required permissions:
# - CloudFormationFullAccess
# - AWSLambda_FullAccess
# - AmazonDynamoDBFullAccess
# - AmazonS3FullAccess
# - IAMFullAccess
```

### Issue: API returns 403 Forbidden

**Cause:** Cognito authorization enabled but no token provided

**Solution:**
```bash
# Disable Cognito for testing
sam deploy \
  --parameter-overrides CognitoUserPoolArn=""
```

### Issue: Frontend can't connect to API

**Cause:** CORS or incorrect API URL

**Solution:**
```bash
# Verify API URL
cat .deployment-outputs

# Test API directly
curl -X POST https://YOUR_API_URL/conversation \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"test","message":"hello"}'

# Update frontend config
./scripts/05-configure-frontend.sh
```

### View Logs

```bash
# Source deployment config
source .deployment-outputs

# View Lambda logs
aws logs tail /aws/lambda/ScatterPilot-Conversation-$ENVIRONMENT --follow

# View last 10 minutes of errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/ScatterPilot-Conversation-$ENVIRONMENT \
  --filter-pattern "ERROR" \
  --start-time $(date -u -d '10 minutes ago' +%s)000
```

### Clean Up / Delete Stack

```bash
# Delete stack
source .deployment-outputs
aws cloudformation delete-stack --stack-name $STACK_NAME --region $AWS_REGION

# Empty and delete S3 bucket (required before stack deletion)
aws s3 rm s3://$INVOICE_BUCKET --recursive
aws s3 rb s3://$INVOICE_BUCKET

# Delete SAM artifacts bucket
aws s3 rm s3://$S3_BUCKET --recursive
aws s3 rb s3://$S3_BUCKET
```

---

## Next Steps

### 1. Deploy Frontend to Production

**Option A: S3 + CloudFront**
```bash
# Create S3 bucket for static hosting
aws s3 mb s3://scatterpilot-frontend
aws s3 website s3://scatterpilot-frontend --index-document index.html

# Upload frontend
cd demo
aws s3 sync . s3://scatterpilot-frontend --acl public-read

# Set up CloudFront distribution
aws cloudfront create-distribution --origin-domain-name scatterpilot-frontend.s3-website-us-east-1.amazonaws.com
```

**Option B: Netlify**
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
cd demo
netlify deploy --prod
```

### 2. Add Authentication

```bash
# Create Cognito User Pool
aws cognito-idp create-user-pool --pool-name ScatterPilot-Users

# Get User Pool ARN
COGNITO_ARN=$(aws cognito-idp describe-user-pool --user-pool-id YOUR_POOL_ID --query 'UserPool.Arn' --output text)

# Re-deploy with Cognito
sam deploy --parameter-overrides CognitoUserPoolArn=$COGNITO_ARN
```

### 3. Set Up CI/CD

```bash
# Create GitHub Actions workflow
mkdir -p .github/workflows
cat > .github/workflows/deploy.yml <<'EOF'
name: Deploy ScatterPilot
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: aws-actions/setup-sam@v2
      - run: sam build
      - run: sam deploy --no-confirm-changeset
EOF
```

### 4. Enable Custom Domain

```bash
# Create ACM certificate
aws acm request-certificate --domain-name api.yourdomain.com

# Create custom domain in API Gateway
aws apigatewayv2 create-domain-name \
  --domain-name api.yourdomain.com \
  --domain-name-configurations CertificateArn=YOUR_CERT_ARN
```

### 5. Add More Features

- Implement invoice templates
- Add email delivery (SES)
- Support multiple currencies
- Add invoice payment tracking
- Implement webhooks for invoice events

---

## Resources

- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [Amazon Bedrock User Guide](https://docs.aws.amazon.com/bedrock/)
- [Claude API Documentation](https://docs.anthropic.com/claude/reference/bedrock)
- [AWS Cost Management](https://aws.amazon.com/aws-cost-management/)

---

## Support

**Issues?** Open an issue on GitHub or check the troubleshooting section.

**Questions?** Review the [README.md](README.md) for architecture details.

---

**🎉 Congratulations!** You've successfully deployed ScatterPilot to AWS!

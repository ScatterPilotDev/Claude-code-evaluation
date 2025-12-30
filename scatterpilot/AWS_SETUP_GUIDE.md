# AWS Setup Guide for ScatterPilot

Complete guide to configure AWS services and test Bedrock locally

## Prerequisites

- AWS Account with billing enabled
- AWS CLI installed
- Python 3.11+ installed
- Basic understanding of AWS services

## Step 1: Install AWS CLI

### macOS
```bash
brew install awscli
```

### Linux
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

### Windows
Download and run the installer from: https://aws.amazon.com/cli/

### Verify Installation
```bash
aws --version
# Should show: aws-cli/2.x.x or higher
```

## Step 2: Configure AWS Credentials

### Create IAM User

1. Go to AWS Console → IAM
2. Click "Users" → "Add users"
3. User name: `scatterpilot-dev`
4. Select "Access key - Programmatic access"
5. Click "Next: Permissions"

### Attach Policies

Attach these managed policies:
- `AmazonBedrockFullAccess`
- `AmazonDynamoDBFullAccess`
- `AmazonS3FullAccess`
- `AWSLambda_FullAccess`
- `CloudWatchLogsFullAccess`

Or create a custom policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "bedrock:*",
                "dynamodb:*",
                "s3:*",
                "lambda:*",
                "logs:*",
                "apigateway:*",
                "cloudformation:*",
                "iam:GetRole",
                "iam:PassRole"
            ],
            "Resource": "*"
        }
    ]
}
```

### Configure CLI

```bash
aws configure

# Enter when prompted:
AWS Access Key ID: YOUR_ACCESS_KEY
AWS Secret Access Key: YOUR_SECRET_KEY
Default region name: us-east-1
Default output format: json
```

### Verify Configuration

```bash
# Test credentials
aws sts get-caller-identity

# Should output:
{
    "UserId": "AIDAXXXXXXXXXXXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/scatterpilot-dev"
}
```

## Step 3: Enable Amazon Bedrock

### Request Model Access

1. Go to AWS Console → Amazon Bedrock
2. Click "Model access" in the left sidebar
3. Click "Request model access"
4. Select: **Anthropic → Claude Sonnet 4.5 v2**
   - Model ID: `anthropic.claude-sonnet-4-5-20250929-v1:0`
5. Click "Request model access"
6. Wait for approval (usually instant)

### Verify Bedrock Access

```bash
# List available models
aws bedrock list-foundation-models \
    --region us-east-1 \
    --query 'modelSummaries[?contains(modelId, `claude-sonnet-4-5`)].{ID:modelId,Name:modelName}' \
    --output table

# Should show:
------------------------------------------------------------------------------------------
|                                  ListFoundationModels                                  |
+--------------------------------------------------------------+-------------------------+
|                              ID                              |          Name           |
+--------------------------------------------------------------+-------------------------+
|  anthropic.claude-sonnet-4-5-20250929-v1:0                  |  Claude Sonnet 4.5   |
+--------------------------------------------------------------+-------------------------+
```

### Supported Regions for Bedrock

Claude Sonnet 4.5 is available in:
- `us-east-1` (N. Virginia) ✅ **Recommended**
- `us-west-2` (Oregon)
- `eu-central-1` (Frankfurt)
- `ap-northeast-1` (Tokyo)

**Note:** If you get "Access Denied", ensure:
1. Model access is approved
2. You're using a supported region
3. Your IAM user has Bedrock permissions

## Step 4: Test Bedrock Locally

### Install Dependencies

```bash
cd scatterpilot
pip install -r requirements.txt
```

### Run Local Test Script

```bash
# Interactive conversation test
python scripts/local-test.py

# Or just test validation (no AWS needed)
python scripts/local-test.py validate
```

### Expected Output

```
================================================================================
                    ScatterPilot Local Test Suite
================================================================================

Mode: Interactive Conversation

Prerequisites:
  - AWS credentials configured (aws configure)
  - Bedrock model access enabled
  - Internet connection

Starting conversation...
Type 'quit' to exit, 'reset' to start over

================================================================================

USER: Hello! I'd like to create an invoice.

ASSISTANT: Hello! I'd be happy to help you create an invoice. Let me gather
some information...
```

### Example Conversation

```
YOU: I need an invoice for Acme Corp

ASSISTANT: Perfect! Who is the customer for this invoice?

YOU: The customer is Acme Corporation

ASSISTANT: Great! What date would you like on the invoice?

YOU: Today's date

ASSISTANT: And when should this invoice be due?

YOU: 30 days from now

ASSISTANT: Excellent. Now, let's add the items. What would you like to invoice for?

YOU: 40 hours of consulting services at $150 per hour

ASSISTANT: Got it! Would you like to add more items?

YOU: No, that's it

ASSISTANT: What tax rate should I apply?

YOU: 8 percent

ASSISTANT: Would you like to add a discount?

YOU: No discount

ASSISTANT: Any notes or payment terms?

YOU: Payment due within 30 days

ASSISTANT: Perfect! I've created your invoice...
[Shows invoice summary with extracted data]
```

## Step 5: Deploy to AWS

### Install SAM CLI

```bash
# macOS
brew install aws-sam-cli

# Or via pip
pip install aws-sam-cli

# Verify
sam --version
```

### Build and Deploy

```bash
# Build the application
make build

# Deploy with guided setup
make deploy-guided

# Follow prompts:
# - Stack Name: scatterpilot-dev
# - AWS Region: us-east-1
# - Confirm changes: Y
# - Allow SAM CLI IAM role creation: Y
# - Save arguments to configuration: Y
```

### Get API URL

```bash
make get-api-url

# Output example:
https://abc123xyz.execute-api.us-east-1.amazonaws.com/dev
```

### Test Deployed API

```bash
# Test conversation endpoint
curl -X POST https://YOUR-API-URL/conversation \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I need to create an invoice for Acme Corp"
  }'
```

## Step 6: Use Demo with Live API

1. Open `demo/index.html`
2. Toggle "Demo Mode" to "Live API"
3. Enter your API Gateway URL
4. Start creating invoices with real Bedrock!

## Troubleshooting

### "No credentials found"

```bash
# Check credentials
aws configure list

# If empty, reconfigure
aws configure
```

### "Access Denied" for Bedrock

```bash
# Check model access
aws bedrock get-foundation-model \
    --model-identifier anthropic.claude-sonnet-4-5-20250929-v1:0 \
    --region us-east-1

# If error, request access in console
```

### "ThrottlingException"

This means you're hitting rate limits. Wait a moment and try again, or:

```bash
# Check service quotas
aws service-quotas get-service-quota \
    --service-code bedrock \
    --quota-code L-xxxxx \
    --region us-east-1
```

### "Module not found" in local test

```bash
# Ensure you're in project directory
cd scatterpilot

# Reinstall dependencies
pip install -r requirements.txt

# Try again
python scripts/local-test.py
```

### SAM Deploy Fails

```bash
# Check SAM version
sam --version  # Should be 1.100.0+

# Validate template
make validate

# Check for syntax errors
cat infrastructure/template.yaml
```

## Cost Estimation

### Bedrock Costs
- **Claude Sonnet 4.5:**
  - Input: $0.003 per 1K tokens
  - Output: $0.015 per 1K tokens
  - Average conversation: ~$0.05

### Development Testing
- 100 test conversations: ~$5
- 1,000 test conversations: ~$50

### Free Tier (if applicable)
- Lambda: 1M requests/month free
- DynamoDB: 25GB storage free
- S3: 5GB storage free

**Recommendation:** Set up billing alerts:
```bash
aws budgets create-budget \
    --account-id YOUR-ACCOUNT-ID \
    --budget file://budget.json
```

## Security Best Practices

### 1. Use Environment-Specific IAM Roles

Don't use your root account or admin user for development.

### 2. Rotate Access Keys

```bash
# Create new key
aws iam create-access-key --user-name scatterpilot-dev

# Configure new key
aws configure

# Delete old key
aws iam delete-access-key --access-key-id OLD_KEY --user-name scatterpilot-dev
```

### 3. Enable MFA

Add multi-factor authentication to your AWS account.

### 4. Use AWS Secrets Manager

For production, store API keys in Secrets Manager:

```bash
aws secretsmanager create-secret \
    --name scatterpilot/api-keys \
    --secret-string '{"key":"value"}'
```

## Next Steps

### After Setup is Complete

1. ✅ Test local Bedrock integration
2. ✅ Deploy to AWS
3. ✅ Test API endpoints
4. ✅ Connect demo to live API
5. ✅ Set up monitoring

### Optional Enhancements

- Set up CloudWatch dashboards
- Configure CloudFront CDN
- Add custom domain
- Implement Cognito authentication
- Set up CI/CD pipeline

## Resources

- [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [Claude API Reference](https://docs.anthropic.com/claude/reference/)
- [ScatterPilot README](README.md)

## Support

If you encounter issues:

1. Check CloudWatch Logs:
   ```bash
   make logs FUNCTION=ScatterPilot-Conversation-dev
   ```

2. Verify IAM permissions:
   ```bash
   aws iam get-user-policy --user-name scatterpilot-dev --policy-name YOUR_POLICY
   ```

3. Test Bedrock directly:
   ```bash
   python scripts/local-test.py validate
   ```

---

**Ready to build amazing AI-powered applications!** 🚀

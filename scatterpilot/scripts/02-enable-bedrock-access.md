# Enabling Amazon Bedrock Model Access

Before deploying ScatterPilot, you must enable access to the Claude Sonnet 4.5 model in Amazon Bedrock.

## Model Information

- **Model ID**: `anthropic.claude-sonnet-4-5-20250929-v1:0`
- **Model Name**: Claude Sonnet 4.5 v2
- **Provider**: Anthropic
- **Release Date**: October 22, 2024

## Supported Regions

Claude Sonnet 4.5 v2 is available in the following AWS regions:

| Region Code | Region Name | Recommended |
|------------|-------------|-------------|
| us-east-1 | US East (N. Virginia) | ✓ Primary |
| us-west-2 | US West (Oregon) | ✓ Primary |
| eu-west-1 | Europe (Ireland) | ✓ |
| eu-west-3 | Europe (Paris) | ✓ |
| ap-northeast-1 | Asia Pacific (Tokyo) | ✓ |
| ap-southeast-1 | Asia Pacific (Singapore) | ✓ |
| ap-southeast-2 | Asia Pacific (Sydney) | ✓ |

**Recommendation**: Use `us-east-1` or `us-west-2` for the lowest latency and best availability.

## Step-by-Step Setup

### Option 1: AWS Console (Recommended)

1. **Sign in to AWS Console**
   - Navigate to https://console.aws.amazon.com/

2. **Open Amazon Bedrock**
   - Search for "Bedrock" in the search bar
   - Click on "Amazon Bedrock"

3. **Select Your Region**
   - In the top-right corner, select one of the supported regions
   - **Recommended**: Choose `us-east-1` or `us-west-2`

4. **Enable Model Access**
   - In the left sidebar, click **"Model access"**
   - Click **"Enable specific models"** or **"Modify model access"**

5. **Request Claude Sonnet 4.5 Access**
   - Find **"Anthropic"** in the list of providers
   - Locate **"Claude Sonnet 4.5 v2"**
   - Check the box next to this model
   - Review the EULA and accept terms
   - Click **"Request model access"** or **"Save changes"**

6. **Wait for Approval**
   - Model access is usually granted **immediately**
   - Status will change from "In progress" to "Access granted"
   - This typically takes less than 1 minute

7. **Verify Access**
   - Refresh the page
   - Confirm status shows "Access granted" with a green checkmark

### Option 2: AWS CLI

Run these commands to check and request model access:

```bash
# Set your preferred region
export AWS_REGION=us-east-1

# List available models
aws bedrock list-foundation-models \
  --region $AWS_REGION \
  --query 'modelSummaries[?contains(modelId, `claude-sonnet-4-5`)]' \
  --output table

# Note: Currently, you must enable model access through the AWS Console
# The CLI doesn't support requesting model access programmatically
```

## Verification

After enabling access, verify it works:

```bash
# Test Bedrock access
aws bedrock list-foundation-models \
  --region us-east-1 \
  --query 'modelSummaries[?modelId==`anthropic.claude-sonnet-4-5-20250929-v1:0`]' \
  --output json
```

Expected output:
```json
[
  {
    "modelArn": "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0",
    "modelId": "anthropic.claude-sonnet-4-5-20250929-v1:0",
    "modelName": "Claude Sonnet 4.5 v2",
    "providerName": "Anthropic",
    ...
  }
]
```

## Test Model Invocation

You can test the model with this command (requires access to be granted):

```bash
aws bedrock-runtime invoke-model \
  --region us-east-1 \
  --model-id anthropic.claude-sonnet-4-5-20250929-v1:0 \
  --body '{
    "anthropic_version": "bedrock-2023-05-31",
    "max_tokens": 100,
    "messages": [
      {
        "role": "user",
        "content": "Hello! Please confirm you are working."
      }
    ]
  }' \
  --cli-binary-format raw-in-base64-out \
  /dev/stdout
```

## Troubleshooting

### Issue: "Model not found" error

**Solution**:
- Verify you're using a supported region
- Check model ID is exactly: `anthropic.claude-sonnet-4-5-20250929-v1:0`
- Try a different region (us-east-1 or us-west-2)

### Issue: "Access denied" error

**Solution**:
- Ensure model access has been granted (green checkmark in console)
- Verify your IAM user/role has `bedrock:InvokeModel` permission
- Wait a few minutes after enabling access

### Issue: Model access request pending

**Solution**:
- Most requests are approved instantly
- If pending > 5 minutes, try:
  1. Refresh the page
  2. Sign out and sign back in
  3. Contact AWS Support

### Issue: "Bedrock not available in this region"

**Solution**:
- Switch to a supported region (see table above)
- Update your AWS CLI default region:
  ```bash
  aws configure set region us-east-1
  ```

## Pricing Information

**On-Demand Pricing** (as of October 2024):

| Token Type | Price per 1K tokens |
|-----------|-------------------|
| Input tokens | $0.003 |
| Output tokens | $0.015 |

**Example costs** for ScatterPilot:
- Average invoice conversation: ~5,000 tokens total
- Estimated cost per invoice: **$0.05 - $0.10**
- 100 invoices/month: **$5 - $10/month**

*Prices may vary by region. Check current pricing: https://aws.amazon.com/bedrock/pricing/*

## IAM Permissions Required

Your AWS user/role needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0"
    },
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:ListFoundationModels",
        "bedrock:GetFoundationModel"
      ],
      "Resource": "*"
    }
  ]
}
```

The SAM template automatically grants these permissions to Lambda functions.

## Next Steps

Once model access is enabled:

1. ✓ Model access granted
2. ➤ Run deployment script: `./scripts/03-deploy.sh`
3. Test your deployment

## Additional Resources

- [Amazon Bedrock User Guide](https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html)
- [Anthropic Claude Documentation](https://docs.anthropic.com/claude/reference/bedrock)
- [Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/)
- [Supported Regions](https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-regions.html)

---

**Need Help?** Check the troubleshooting section or open an issue on GitHub.

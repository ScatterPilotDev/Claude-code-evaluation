# ScatterPilot Deployment - Status & Reference

**Last Updated:** 2025-11-13
**Status:** ✅ PRODUCTION DEPLOYMENT SUCCESSFUL
**Environment:** Production (dev stack)

---

## 🎉 CURRENT STATUS - PRODUCTION DEPLOYED

### ✅ COMPLETED - ALL PHASES DONE
- [x] Added Cognito User Pool + Client to template.yaml
- [x] Removed all conditional logic (no null errors)
- [x] Upgraded to Claude Sonnet 4.5 model
- [x] Updated IAM policy file with Cognito permissions
- [x] Fixed CloudFormation changeset permissions
- [x] Fixed IAM role deletion permissions (ListRolePolicies, ListAttachedRolePolicies, UpdateAssumeRolePolicy)
- [x] Verified DynamoDB UpdateTimeToLive permission present
- [x] Applied updated IAM policy to deployment user
- [x] Enabled Bedrock Claude Sonnet 4.5 model access
- [x] Built SAM application successfully
- [x] Deployed to AWS production stack
- [x] Verified all resources created successfully

### 📦 DEPLOYED RESOURCES
The following resources are now live in AWS:
- **API Gateway**: ScatterPilot-API-dev (REST API with Cognito auth)
- **Lambda Functions**: 5 functions (Conversation, CreateInvoice, ListInvoices, GetInvoice, GeneratePDF)
- **DynamoDB Tables**: 3 tables (Conversations, Invoices, RateLimits with TTL)
- **S3 Bucket**: Invoice PDF storage with encryption and versioning
- **Cognito User Pool**: User authentication with email verification
- **CloudWatch**: Log groups and X-Ray tracing enabled

---

## 🔐 CRITICAL FIXES APPLIED (2025-11-13)

### Issue 1: DynamoDB Permission Error
**Error:** `dynamodb:UpdateTimeToLive not authorized`
**Resolution:** Permission was actually present in policy; error was from previous deployment with stale IAM cache. Applied fresh policy and waited for propagation.

### Issue 2: IAM Role Deletion Failures During Rollback
**Error:** CloudFormation couldn't delete IAM roles during failed deployment rollback
**Resolution:** Added three missing IAM permissions to `scripts/iam-deployment-policy.json`:
- `iam:ListRolePolicies` (line 103)
- `iam:ListAttachedRolePolicies` (line 104)
- `iam:UpdateAssumeRolePolicy` (line 105)

### Issue 3: CloudFormation Changeset Permissions Missing
**Error:** SAM CLI uses changesets but deployment user lacked permissions
**Resolution:** Added CloudFormation changeset operations to `scripts/iam-deployment-policy.json`:
- `cloudformation:CreateChangeSet` (line 19)
- `cloudformation:DescribeChangeSet` (line 20)
- `cloudformation:ExecuteChangeSet` (line 21)
- `cloudformation:DeleteChangeSet` (line 22)
- `cloudformation:ListChangeSets` (line 23)
- `cloudformation:GetTemplate` (line 15)
- `cloudformation:ListStackResources` (line 17)

---

## 📋 DEPLOYMENT PREREQUISITES (For Future Reference)

If deploying to a new environment or AWS account, complete these actions:

---

## 🔴 ACTION 1: Add Cognito Permissions to IAM User (CRITICAL)

**Time Required:** 3-5 minutes

### Steps:

1. **Open AWS Console** → Sign in to https://console.aws.amazon.com/

2. **Navigate to IAM**
   - Search for "IAM" in the top search bar
   - Click on "IAM" service

3. **Find Your User**
   - Click "Users" in left sidebar
   - Click on user: `scatterpilot-deploy`

4. **Add Permissions**
   - Click "Add permissions" button
   - Choose "Attach policies directly" OR "Add inline policy"

5. **Option A: Use Managed Policy (Easiest)**
   - Search for: `AmazonCognitoPowerUser`
   - Check the box
   - Click "Next" → "Add permissions"

   **OR**

6. **Option B: Add Inline Policy (More Secure)**
   - Click "Add inline policy"
   - Click "JSON" tab
   - Paste the following:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CognitoUserPools",
      "Effect": "Allow",
      "Action": [
        "cognito-idp:CreateUserPool",
        "cognito-idp:DeleteUserPool",
        "cognito-idp:DescribeUserPool",
        "cognito-idp:UpdateUserPool",
        "cognito-idp:CreateUserPoolClient",
        "cognito-idp:DeleteUserPoolClient",
        "cognito-idp:DescribeUserPoolClient",
        "cognito-idp:UpdateUserPoolClient",
        "cognito-idp:ListUserPools",
        "cognito-idp:ListUserPoolClients",
        "cognito-idp:TagResource",
        "cognito-idp:UntagResource"
      ],
      "Resource": "arn:aws:cognito-idp:*:*:userpool/*"
    }
  ]
}
```

   - Click "Review policy"
   - Policy name: `ScatterPilotCognitoAccess`
   - Click "Create policy"

7. **Verify**
   - Confirm new policy appears in user's permissions list

---

## 🔴 ACTION 2: Enable Bedrock Claude Sonnet 4.5 Access (CRITICAL)

**Time Required:** 2-3 minutes (approval is instant)

### Steps:

1. **Open AWS Console** → https://console.aws.amazon.com/

2. **Verify Region**
   - Look at top-right corner
   - Must be: **US East (N. Virginia) us-east-1**
   - If not, click region dropdown and select "US East (N. Virginia)"

3. **Navigate to Bedrock**
   - Search for "Bedrock" in top search bar
   - Click "Amazon Bedrock" service

4. **Access Model Access Page**
   - Click "Model access" in the left sidebar
   - OR click "Get started" if first time

5. **Request Model Access**
   - Click "Manage model access" or "Request model access" button
   - Scroll to find: **Anthropic**
   - Look for: **Claude Sonnet 4.5**
     - Model ID: `anthropic.claude-sonnet-4-5-20250929-v1:0`
   - Check the box next to it
   - Click "Request model access" button at bottom

6. **Wait for Approval**
   - Status will change from "In Progress" to "Access granted" ✅
   - This is usually **instant** (10-30 seconds)
   - Refresh page if needed

7. **Verify Access**
   - Confirm status shows: **"Access granted"** with green checkmark
   - Model should appear in "Models with access granted" section

### Alternative Verification (Optional):
Run this command in terminal:
```bash
aws bedrock list-foundation-models --region us-east-1 \
  --query 'modelSummaries[?modelId==`anthropic.claude-sonnet-4-5-20250929-v1:0`]'
```
Should return model details if access granted.

---

## ✅ VERIFICATION CHECKLIST

Before proceeding to deployment, confirm:

- [ ] ACTION 1: Cognito permissions added to IAM user `scatterpilot-deploy`
- [ ] ACTION 2: Bedrock Claude Sonnet 4.5 access granted (status: "Access granted")
- [ ] AWS region is set to `us-east-1`
- [ ] AWS credentials working: `aws sts get-caller-identity` returns user info

---

## 🚀 NEXT STEPS (After Completing Actions)

Once both actions are complete, return to Claude Code and say:

**"Actions completed, ready to deploy"**

Then we'll proceed to **PHASE 5 - EXECUTE**:

1. Run `sam build --use-container`
2. Run `sam deploy --guided`
3. Configure deployment parameters
4. Deploy stack (~5-7 minutes)
5. Get API Gateway endpoint
6. Test with real Bedrock
7. (Optional) Configure ScatterPilot.com domain

---

## 📁 REFERENCE FILES

Updated files ready for deployment:

- ✅ `scatterpilot/infrastructure/template.yaml` - Main SAM template with Cognito
- ✅ `scatterpilot/scripts/iam-deployment-policy.json` - Complete IAM policy
- ✅ `.aws-sam/build/` - Pre-built artifacts ready

---

## 🆘 TROUBLESHOOTING

### "Access Denied" when adding IAM permissions
- You need administrative access to the AWS account
- Contact AWS account administrator
- Or use AWS root account (not recommended for production)

### Can't find "Model access" in Bedrock console
- Verify you're in `us-east-1` region (top-right corner)
- Make sure you're viewing Amazon Bedrock (not Amazon Bedrock Studio)
- Try direct link: https://console.aws.amazon.com/bedrock/home?region=us-east-1#/modelaccess

### Model already shows "Access granted"
- Great! You're already set for ACTION 2
- Just verify Claude Sonnet 4.5 (not 3.5) is enabled

---

## 📊 DEPLOYMENT TIMELINE

- **AWS Actions**: 5-8 minutes (you are here)
- **SAM Build**: 2-3 minutes
- **SAM Deploy**: 5-7 minutes
- **Testing**: 2-3 minutes
- **Total**: ~15-20 minutes to fully deployed API

---

## ⏸️ PAUSED AT: PHASE 4 - DEPLOYMENT PREP

**Resume at:** PHASE 5 - EXECUTE (after completing AWS actions)

---

## 🚀 NEXT STEPS / RESUMING WORK

When you return to this project, here's how to check status and continue:

### Quick Status Check
```bash
# Verify stack is deployed
aws cloudformation describe-stacks \
  --stack-name scatterpilot-dev \
  --query 'Stacks[0].StackStatus'

# Get all stack outputs (API URL, User Pool IDs, etc.)
aws cloudformation describe-stacks \
  --stack-name scatterpilot-dev \
  --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' \
  --output table
```

### Get API Endpoint
```bash
# Get the API Gateway URL
aws cloudformation describe-stacks \
  --stack-name scatterpilot-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text
```

### Common Operations

**Update Deployment (After Code Changes):**
```bash
cd /workspaces/Claude-code-evaluation/scatterpilot/infrastructure
sam build --use-container
sam deploy  # Uses saved config from samconfig.toml
```

**View Lambda Logs:**
```bash
# View recent logs for a function
sam logs --stack-name scatterpilot-dev --name ScatterPilot-Conversation-dev --tail

# Or use AWS CLI
aws logs tail /aws/lambda/ScatterPilot-Conversation-dev --follow
```

**Create Test User in Cognito:**
```bash
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name scatterpilot-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username testuser@example.com \
  --user-attributes Name=email,Value=testuser@example.com Name=email_verified,Value=true \
  --temporary-password 'TempPass123!' \
  --message-action SUPPRESS
```

**Delete Stack (Clean Up):**
```bash
sam delete --stack-name scatterpilot-dev
```

### Potential Future Enhancements
- [ ] Add automated testing pipeline (API integration tests)
- [ ] Implement user registration frontend
- [ ] Add custom domain (scatterpilot.com) with API Gateway
- [ ] Set up staging environment (separate stack)
- [ ] Configure CloudWatch dashboards for monitoring
- [ ] Add rate limiting per user tier
- [ ] Implement invoice templates customization
- [ ] Add email delivery for generated invoices

### Key Files Reference
- **Infrastructure:** `/workspaces/Claude-code-evaluation/scatterpilot/infrastructure/template.yaml`
- **IAM Policy:** `/workspaces/Claude-code-evaluation/scatterpilot/scripts/iam-deployment-policy.json`
- **Lambda Functions:** `/workspaces/Claude-code-evaluation/scatterpilot/functions/`
- **Deployment Logs:** `/workspaces/Claude-code-evaluation/PROJECT_LOG.md`

---

## 📊 RESOURCE COSTS (Estimate)

Current configuration (dev environment):
- **DynamoDB**: Pay-per-request (negligible for dev/testing)
- **Lambda**: ~$0.20/million requests + compute time
- **API Gateway**: ~$3.50/million requests
- **S3**: ~$0.023/GB storage + requests
- **Cognito**: Free tier: 50,000 MAUs
- **Bedrock Claude**: ~$3/million input tokens, ~$15/million output tokens

**Estimated monthly cost for light testing:** <$5/month
**Estimated monthly cost for production (1000 users):** $50-200/month depending on usage

---

**Status:** ✅ Production Deployed & Documented
**Last Updated:** 2025-11-13 20:45 UTC

# Security Guide for ScatterPilot

## 🚨 CRITICAL: AWS Credentials Management

### ⚠️ Important Security Warning

**NEVER commit AWS credentials to Git repositories, especially public ones!**

If you've accidentally committed credentials:
1. **IMMEDIATELY** rotate/delete them in AWS IAM Console
2. See [Credential Cleanup](#credential-cleanup) section below
3. Create new credentials with minimal permissions

---

## 🔐 Secure Credential Management

### Option 1: GitHub Codespaces Secrets (Recommended for Codespaces)

If you're using GitHub Codespaces:

1. **Navigate to Repository Settings**
   - Go to your repository on GitHub
   - Click **Settings** → **Secrets and variables** → **Codespaces**

2. **Add Secrets**
   - Click **New repository secret**
   - Add these secrets:
     ```
     AWS_ACCESS_KEY_ID=your-access-key-id
     AWS_SECRET_ACCESS_KEY=your-secret-access-key
     AWS_DEFAULT_REGION=us-east-1
     ```

3. **Access in Scripts**
   The secrets are automatically available as environment variables:
   ```bash
   echo $AWS_ACCESS_KEY_ID  # Automatically set
   aws sts get-caller-identity  # Works without manual configuration
   ```

4. **Benefits**
   - ✅ Credentials never touch the filesystem
   - ✅ Not stored in Git history
   - ✅ Scoped to your repository
   - ✅ Encrypted by GitHub

### Option 2: Environment Variables

Set credentials as environment variables:

```bash
export AWS_ACCESS_KEY_ID="your-access-key-id"
export AWS_SECRET_ACCESS_KEY="your-secret-access-key"
export AWS_DEFAULT_REGION="us-east-1"
```

**Important:** Add to `~/.bashrc` or `~/.zshrc` but **NEVER** commit these files.

### Option 3: AWS CLI Configuration (Local Only)

If working locally (not in public Codespace):

```bash
aws configure
```

Credentials stored in `~/.aws/credentials` (already in `.gitignore`).

### Option 4: IAM Roles (Production Best Practice)

For EC2, Lambda, or ECS deployments:
- Attach IAM roles to resources
- No long-term credentials needed
- Automatically rotated by AWS

---

## 🎯 Least-Privilege IAM Policy

### Creating a Deployment User

1. **Create IAM User**
   ```bash
   aws iam create-user --user-name scatterpilot-deployer
   ```

2. **Attach Policy** (see below)
   ```bash
   aws iam put-user-policy \
     --user-name scatterpilot-deployer \
     --policy-name ScatterPilotDeployPolicy \
     --policy-document file://scripts/iam-deployment-policy.json
   ```

3. **Create Access Keys**
   ```bash
   aws iam create-access-key --user-name scatterpilot-deployer
   ```
   **Save these immediately** - you won't see the secret key again!

### Minimum Required Permissions

Create a file `scripts/iam-deployment-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudFormationAccess",
      "Effect": "Allow",
      "Action": [
        "cloudformation:CreateStack",
        "cloudformation:UpdateStack",
        "cloudformation:DeleteStack",
        "cloudformation:DescribeStacks",
        "cloudformation:DescribeStackEvents",
        "cloudformation:DescribeStackResources",
        "cloudformation:GetTemplateSummary",
        "cloudformation:ListStacks",
        "cloudformation:ValidateTemplate"
      ],
      "Resource": [
        "arn:aws:cloudformation:*:*:stack/scatterpilot*",
        "arn:aws:cloudformation:*:*:stack/aws-sam-cli-managed-default/*"
      ]
    },
    {
      "Sid": "S3DeploymentBucket",
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:DeleteBucket",
        "s3:GetBucketLocation",
        "s3:GetBucketPolicy",
        "s3:GetBucketVersioning",
        "s3:GetEncryptionConfiguration",
        "s3:ListBucket",
        "s3:PutBucketPolicy",
        "s3:PutBucketVersioning",
        "s3:PutEncryptionConfiguration",
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::scatterpilot-*",
        "arn:aws:s3:::scatterpilot-*/*",
        "arn:aws:s3:::aws-sam-cli-managed-default-*",
        "arn:aws:s3:::aws-sam-cli-managed-default-*/*"
      ]
    },
    {
      "Sid": "LambdaFunctions",
      "Effect": "Allow",
      "Action": [
        "lambda:CreateFunction",
        "lambda:DeleteFunction",
        "lambda:GetFunction",
        "lambda:GetFunctionConfiguration",
        "lambda:ListFunctions",
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration",
        "lambda:PublishVersion",
        "lambda:CreateAlias",
        "lambda:DeleteAlias",
        "lambda:GetAlias",
        "lambda:UpdateAlias",
        "lambda:AddPermission",
        "lambda:RemovePermission",
        "lambda:GetPolicy",
        "lambda:TagResource",
        "lambda:UntagResource"
      ],
      "Resource": "arn:aws:lambda:*:*:function:ScatterPilot-*"
    },
    {
      "Sid": "LambdaLayers",
      "Effect": "Allow",
      "Action": [
        "lambda:PublishLayerVersion",
        "lambda:DeleteLayerVersion",
        "lambda:GetLayerVersion"
      ],
      "Resource": "arn:aws:lambda:*:*:layer:scatterpilot-*"
    },
    {
      "Sid": "IAMRoleManagement",
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:PassRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRolePolicy",
        "iam:TagRole",
        "iam:UntagRole"
      ],
      "Resource": [
        "arn:aws:iam::*:role/scatterpilot-*",
        "arn:aws:iam::*:role/ScatterPilot-*"
      ]
    },
    {
      "Sid": "DynamoDBTables",
      "Effect": "Allow",
      "Action": [
        "dynamodb:CreateTable",
        "dynamodb:DeleteTable",
        "dynamodb:DescribeTable",
        "dynamodb:DescribeTimeToLive",
        "dynamodb:UpdateTable",
        "dynamodb:UpdateTimeToLive",
        "dynamodb:ListTables",
        "dynamodb:TagResource",
        "dynamodb:UntagResource",
        "dynamodb:DescribeContinuousBackups",
        "dynamodb:UpdateContinuousBackups"
      ],
      "Resource": "arn:aws:dynamodb:*:*:table/ScatterPilot-*"
    },
    {
      "Sid": "APIGateway",
      "Effect": "Allow",
      "Action": [
        "apigateway:GET",
        "apigateway:POST",
        "apigateway:PUT",
        "apigateway:DELETE",
        "apigateway:PATCH"
      ],
      "Resource": "arn:aws:apigateway:*::/restapis*"
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:DeleteLogGroup",
        "logs:DescribeLogGroups",
        "logs:PutRetentionPolicy",
        "logs:TagLogGroup"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/lambda/ScatterPilot-*"
    },
    {
      "Sid": "CloudWatchMonitoring",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricAlarm",
        "cloudwatch:DeleteAlarms",
        "cloudwatch:DescribeAlarms",
        "cloudwatch:PutDashboard",
        "cloudwatch:DeleteDashboards"
      ],
      "Resource": "*"
    },
    {
      "Sid": "SNSForAlerts",
      "Effect": "Allow",
      "Action": [
        "sns:CreateTopic",
        "sns:DeleteTopic",
        "sns:Subscribe",
        "sns:Unsubscribe",
        "sns:GetTopicAttributes",
        "sns:SetTopicAttributes",
        "sns:TagResource"
      ],
      "Resource": "arn:aws:sns:*:*:ScatterPilot-*"
    },
    {
      "Sid": "XRayTracing",
      "Effect": "Allow",
      "Action": [
        "xray:PutTraceSegments",
        "xray:PutTelemetryRecords"
      ],
      "Resource": "*"
    },
    {
      "Sid": "BedrockModelAccess",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:ListFoundationModels",
        "bedrock:GetFoundationModel"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-5-20250929-v1:0"
      ]
    },
    {
      "Sid": "GetCallerIdentity",
      "Effect": "Allow",
      "Action": "sts:GetCallerIdentity",
      "Resource": "*"
    }
  ]
}
```

### Additional Monitoring Policy (Optional)

For cost monitoring and CloudWatch dashboards:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CostExplorerReadOnly",
      "Effect": "Allow",
      "Action": [
        "ce:GetCostAndUsage",
        "ce:GetCostForecast"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudWatchReadMetrics",
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics"
      ],
      "Resource": "*"
    },
    {
      "Sid": "LogsReadOnly",
      "Effect": "Allow",
      "Action": [
        "logs:FilterLogEvents",
        "logs:GetLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/lambda/ScatterPilot-*:*"
    }
  ]
}
```

---

## 🔄 Credential Rotation

### When to Rotate Credentials

Rotate immediately if:
- ❌ Credentials committed to Git (public or private)
- ❌ Credentials shared via insecure channel (email, Slack, etc.)
- ❌ Suspicious AWS activity detected
- ❌ Team member with access leaves
- 📅 Every 90 days (best practice)

### How to Rotate

1. **Create New Credentials**
   ```bash
   aws iam create-access-key --user-name scatterpilot-deployer
   ```

2. **Update Your Configuration**
   ```bash
   aws configure
   # Enter new credentials
   ```

3. **Test New Credentials**
   ```bash
   aws sts get-caller-identity
   ```

4. **Delete Old Credentials**
   ```bash
   aws iam delete-access-key \
     --user-name scatterpilot-deployer \
     --access-key-id OLD_ACCESS_KEY_ID
   ```

---

## 🧹 Credential Cleanup

### If Credentials Were Committed to Git

**CRITICAL: Do this IMMEDIATELY**

1. **Deactivate/Delete Credentials in AWS**
   ```bash
   # List all access keys
   aws iam list-access-keys --user-name scatterpilot-deployer

   # Delete the compromised key
   aws iam delete-access-key \
     --user-name scatterpilot-deployer \
     --access-key-id COMPROMISED_KEY_ID
   ```

2. **Remove from Git History**
   ```bash
   # Find the file path
   git log --all --full-history -- "*credentials*"

   # Remove from history (DESTRUCTIVE - use with caution)
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .aws/credentials" \
     --prune-empty --tag-name-filter cat -- --all

   # Force push
   git push origin --force --all
   git push origin --force --tags
   ```

3. **Clean Local Repository**
   ```bash
   # Remove from reflog
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   ```

4. **Contact GitHub Support**
   - If repository is public, contact GitHub to purge cached credentials
   - They can clear the cache that might still contain secrets

5. **Enable Secret Scanning**
   - Go to GitHub repository **Settings** → **Security**
   - Enable **Secret scanning**
   - Enable **Push protection**

### Using BFG Repo-Cleaner (Easier Alternative)

```bash
# Install BFG
brew install bfg  # macOS
# or download from https://rtyley.github.io/bfg-repo-cleaner/

# Clone a fresh copy
git clone --mirror https://github.com/user/repo.git

# Remove credentials
bfg --delete-files credentials repo.git
bfg --replace-text passwords.txt repo.git

# Push cleaned history
cd repo.git
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push
```

---

## 🛡️ Security Best Practices

### DO ✅

- ✅ Use IAM roles for AWS resources (EC2, Lambda, ECS)
- ✅ Use GitHub Codespaces Secrets for temporary credentials
- ✅ Enable MFA on AWS accounts
- ✅ Rotate credentials every 90 days
- ✅ Use least-privilege IAM policies
- ✅ Enable CloudTrail for audit logging
- ✅ Enable AWS GuardDuty for threat detection
- ✅ Use AWS Secrets Manager for application secrets
- ✅ Enable secret scanning on GitHub
- ✅ Review IAM Access Analyzer findings regularly

### DON'T ❌

- ❌ Commit credentials to Git (even private repos)
- ❌ Share credentials via email, Slack, or messaging
- ❌ Use root account credentials
- ❌ Give `AdministratorAccess` to deployment users
- ❌ Hard-code secrets in application code
- ❌ Store credentials in application logs
- ❌ Use the same credentials across environments
- ❌ Leave unused IAM users/keys active

---

## 🔍 Detecting Exposed Credentials

### Tools

1. **git-secrets** (Prevent commits)
   ```bash
   brew install git-secrets
   git secrets --install
   git secrets --register-aws
   ```

2. **TruffleHog** (Scan history)
   ```bash
   pip install truffleHog
   trufflehog --regex --entropy=True https://github.com/user/repo.git
   ```

3. **GitHub Secret Scanning**
   - Automatically enabled for public repos
   - Enable for private repos in Settings

### Manual Check

```bash
# Search for AWS keys in history
git log -p | grep -i "AKIA"

# Search for secrets in current files
grep -r "AKIA" .
grep -r "aws_secret_access_key" .
```

---

## 📚 Additional Resources

- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [GitHub Codespaces Secrets](https://docs.github.com/en/codespaces/managing-your-codespaces/managing-encrypted-secrets-for-your-codespaces)
- [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/)
- [git-secrets on GitHub](https://github.com/awslabs/git-secrets)
- [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)

---

## 🚨 Emergency Contacts

If you've exposed credentials:

1. **Immediately rotate** credentials (steps above)
2. **Monitor CloudTrail** for unauthorized access
3. **Check AWS Bill** for unexpected charges
4. **Report to security team** if corporate account
5. **Contact AWS Support** if suspicious activity detected

---

## ✅ Security Checklist

Before deploying ScatterPilot:

- [ ] Credentials NOT in Git history
- [ ] Using least-privilege IAM policy
- [ ] MFA enabled on AWS account
- [ ] GitHub secret scanning enabled
- [ ] `.gitignore` includes credential paths
- [ ] Using GitHub Codespaces Secrets (if in Codespace)
- [ ] CloudTrail logging enabled
- [ ] Billing alerts configured
- [ ] Have credential rotation plan (90 days)
- [ ] Team trained on security practices

---

**Remember:** Security is not a one-time setup. Regularly review and update your security practices.

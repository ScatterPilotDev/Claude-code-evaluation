# GitHub Codespaces Setup for ScatterPilot

## 🔐 Secure AWS Credentials in Codespaces

**Never store AWS credentials in files when using public repositories!**

This guide shows you how to use GitHub Codespaces Secrets to securely deploy ScatterPilot.

---

## 🚀 Quick Setup (5 Minutes)

### Step 1: Create Dedicated AWS IAM User

1. **Log into AWS Console**
   - Go to https://console.aws.amazon.com/iam/

2. **Create User**
   ```
   Users → Add users
   User name: scatterpilot-deployer
   Access type: Programmatic access
   ```

3. **Attach Policy**
   - Create custom policy from `scripts/iam-deployment-policy.json`
   - OR attach managed policies (less secure):
     - `AWSLambda_FullAccess`
     - `AmazonDynamoDBFullAccess`
     - `AmazonS3FullAccess`
     - `IAMFullAccess` (limited to ScatterPilot resources)
     - `CloudFormationFullAccess`

4. **Save Credentials**
   ```
   Access key ID: AKIAIOSFODNN7EXAMPLE
   Secret access key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   ```
   ⚠️ **Save these immediately** - you won't see the secret again!

### Step 2: Add Secrets to GitHub

#### Option A: Repository Secrets (Recommended)

1. **Navigate to Repository Settings**
   - Go to your GitHub repository
   - Click **Settings** tab
   - Click **Secrets and variables** → **Codespaces**

2. **Add New Secret**
   Click **New repository secret** and add:

   | Name | Value | Description |
   |------|-------|-------------|
   | `AWS_ACCESS_KEY_ID` | Your access key ID | AWS programmatic access key |
   | `AWS_SECRET_ACCESS_KEY` | Your secret access key | AWS secret (keep safe!) |
   | `AWS_DEFAULT_REGION` | `us-east-1` | Primary deployment region |

3. **Save Secrets**
   - Click **Add secret** for each one

#### Option B: User Secrets (For Personal Use)

For secrets across all your Codespaces:

1. Go to **GitHub Settings** (your profile)
2. Click **Codespaces** → **Secrets**
3. Add the same three secrets

### Step 3: Verify in Codespace

Open your Codespace and verify secrets are loaded:

```bash
# Check environment variables (values are hidden)
echo $AWS_ACCESS_KEY_ID

# Test AWS access
aws sts get-caller-identity
```

Expected output:
```json
{
    "UserId": "AIDAI...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/scatterpilot-deployer"
}
```

### Step 4: Deploy ScatterPilot

```bash
cd scatterpilot
./scripts/00-deploy-all.sh
```

The scripts will automatically use environment variables from Codespaces Secrets!

---

## 🔒 Security Best Practices

### ✅ DO

- ✅ Use repository secrets for team projects
- ✅ Use user secrets for personal projects
- ✅ Create dedicated IAM user for deployment
- ✅ Use least-privilege IAM policies
- ✅ Enable MFA on AWS account
- ✅ Rotate credentials every 90 days
- ✅ Enable GitHub secret scanning
- ✅ Delete IAM user when project ends

### ❌ DON'T

- ❌ Run `aws configure` in Codespaces (creates files)
- ❌ Commit `.aws/credentials` to Git
- ❌ Share credentials via email/Slack
- ❌ Use root AWS account credentials
- ❌ Give `AdministratorAccess` policy
- ❌ Reuse credentials across projects

---

## 🔄 Credential Rotation

Rotate credentials every 90 days:

1. **Create New Access Key**
   ```bash
   aws iam create-access-key --user-name scatterpilot-deployer
   ```

2. **Update GitHub Secrets**
   - Go to repository **Settings** → **Codespaces** → **Secrets**
   - Click **Update** next to `AWS_ACCESS_KEY_ID`
   - Enter new value
   - Repeat for `AWS_SECRET_ACCESS_KEY`

3. **Test New Credentials**
   ```bash
   # Rebuild Codespace or restart terminal
   aws sts get-caller-identity
   ```

4. **Delete Old Key**
   ```bash
   aws iam delete-access-key \
     --user-name scatterpilot-deployer \
     --access-key-id OLD_KEY_ID
   ```

---

## 📋 Troubleshooting

### Secrets Not Available

**Problem:** `echo $AWS_ACCESS_KEY_ID` returns empty

**Solutions:**
1. Secrets added to correct repository?
2. Codespace rebuilt after adding secrets?
   ```bash
   # Rebuild Codespace
   Cmd/Ctrl + Shift + P → "Codespaces: Rebuild Container"
   ```
3. Check secret names match exactly (case-sensitive)

### Access Denied Errors

**Problem:** `aws sts get-caller-identity` fails

**Solutions:**
1. Check IAM policy attached to user
2. Verify user has programmatic access enabled
3. Confirm credentials not expired
4. Test with a different AWS CLI command:
   ```bash
   aws iam get-user --user-name scatterpilot-deployer
   ```

### Wrong Region

**Problem:** Bedrock not available in region

**Solutions:**
1. Update `AWS_DEFAULT_REGION` secret to `us-east-1` or `us-west-2`
2. Override in script:
   ```bash
   export AWS_DEFAULT_REGION=us-east-1
   ./scripts/00-deploy-all.sh
   ```

---

## 🎯 Alternative: AWS CloudShell

For even more security, use AWS CloudShell:

1. Open [AWS CloudShell](https://console.aws.amazon.com/cloudshell)
2. Clone repository:
   ```bash
   git clone https://github.com/youruser/scatterpilot.git
   cd scatterpilot
   ```
3. Deploy:
   ```bash
   ./scripts/00-deploy-all.sh
   ```

**Benefits:**
- No credentials needed (uses your console session)
- Temporary environment
- Automatically authenticated

**Limitations:**
- No persistent storage
- Limited to AWS regions with CloudShell
- Less convenient for development

---

## 📊 Monitoring Secret Usage

### CloudTrail

Monitor who's using your credentials:

```bash
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=Username,AttributeValue=scatterpilot-deployer \
  --max-results 50
```

### Last Used

Check when credentials were last used:

```bash
aws iam get-access-key-last-used \
  --access-key-id AKIAIOSFODNN7EXAMPLE
```

### IAM Access Analyzer

Enable to detect overly permissive policies:

```bash
aws accessanalyzer create-analyzer \
  --analyzer-name scatterpilot-analyzer \
  --type ACCOUNT
```

---

## 🧹 Cleanup

### When Project Ends

1. **Delete Deployment**
   ```bash
   ./scripts/delete-stack.sh
   ```

2. **Delete IAM User**
   ```bash
   # Delete access keys first
   aws iam delete-access-key \
     --user-name scatterpilot-deployer \
     --access-key-id YOUR_KEY_ID

   # Delete user
   aws iam delete-user --user-name scatterpilot-deployer
   ```

3. **Remove GitHub Secrets**
   - Go to repository **Settings** → **Codespaces** → **Secrets**
   - Delete all three secrets

---

## 📚 Additional Resources

- [GitHub Codespaces Secrets Docs](https://docs.github.com/en/codespaces/managing-your-codespaces/managing-encrypted-secrets-for-your-codespaces)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [AWS CloudTrail](https://aws.amazon.com/cloudtrail/)
- [IAM Access Analyzer](https://aws.amazon.com/iam/access-analyzer/)

---

## ✅ Security Checklist

Before deploying:

- [ ] Created dedicated IAM user (not root)
- [ ] Applied least-privilege IAM policy
- [ ] Enabled MFA on AWS account
- [ ] Added secrets to GitHub Codespaces
- [ ] Verified secrets load in Codespace
- [ ] Tested `aws sts get-caller-identity`
- [ ] `.gitignore` includes `.aws/`
- [ ] No credential files in repository
- [ ] GitHub secret scanning enabled
- [ ] Have plan to rotate credentials (90 days)

---

**Ready to deploy securely!** 🔐

See [SECURITY.md](SECURITY.md) for comprehensive security guide.

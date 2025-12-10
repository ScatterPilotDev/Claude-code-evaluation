# ScatterPilot - Quick Start Guide

## 🚨 SECURITY FIRST!

### ⚠️ NEVER commit AWS credentials to Git!

**Choose your secure credential method:**

1. **GitHub Codespaces** (Public Repo): [CODESPACES_SETUP.md](CODESPACES_SETUP.md)
2. **Local Development**: `aws configure` (stores in `~/.aws/`)
3. **EC2/Cloud**: IAM roles (no credentials needed)

**Required:** Read [SECURITY.md](SECURITY.md) before deploying!

---

## ⚡ Fastest Path to Deployment

### Option 1: Automated Installation (Recommended)

```bash
cd scatterpilot
./scripts/00-deploy-all.sh
```

The script will **automatically detect** missing packages and **offer to install them** for you!

---

## 🔧 Common Setup Scenarios

### Scenario 1: Fresh System (Nothing Installed)

When you run `./scripts/00-deploy-all.sh`, the script will:

1. **Detect missing packages** (AWS CLI, SAM CLI, Python, Docker)
2. **Show installation commands** specific to your OS
3. **Offer automatic installation** (on macOS with Homebrew or Linux with pip)
4. **Prompt for AWS credentials** if AWS CLI is installed but not configured

**Example on macOS:**
```
✗ AWS CLI not installed
✗ SAM CLI not installed

Would you like help installing the missing packages?

📦 AWS CLI is missing
   macOS: brew install awscli

📦 SAM CLI is missing
   macOS: brew install aws-sam-cli

═══════════════════════════════════════════════════════════════
Automatic Installation Available
═══════════════════════════════════════════════════════════════

I can automatically install the missing packages using Homebrew:

  • brew install awscli
  • brew install aws-sam-cli

Install missing packages automatically? (y/n): y
```

Just answer **y** and the script will install everything!

---

### Scenario 2: AWS CLI Installed, Needs Configuration

If AWS CLI is installed but credentials aren't configured:

```
AWS CLI is installed but credentials are not configured.

Would you like to configure AWS credentials now? (y/n): y
```

Answer **y** and you'll be guided through:
1. Enter AWS Access Key ID
2. Enter AWS Secret Access Key
3. Enter default region (recommend: **us-east-1**)
4. Enter output format (recommend: **json**)

---

### Scenario 3: Manual Installation Preferred

If you prefer to install manually, the script shows platform-specific commands:

**macOS:**
```bash
brew install awscli
brew install aws-sam-cli
brew install python@3.11
```

**Linux (Ubuntu/Debian):**
```bash
# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# SAM CLI
pip3 install aws-sam-cli

# Python 3.11
sudo apt-get update
sudo apt-get install python3.11
```

**Linux (Amazon Linux/RHEL):**
```bash
# SAM CLI
pip3 install aws-sam-cli

# Python 3.11
sudo yum install python3.11
```

Then run:
```bash
aws configure
./scripts/01-check-prerequisites.sh
```

---

## 📋 Step-by-Step First Deployment

### 1. Install Prerequisites

Run the deployment script - it will help you install what's missing:
```bash
cd scatterpilot
./scripts/00-deploy-all.sh
```

### 2. Configure AWS

When prompted:
```
AWS Access Key ID: YOUR_ACCESS_KEY
AWS Secret Access Key: YOUR_SECRET_KEY
Default region: us-east-1
Default output format: json
```

**Don't have AWS credentials?**
1. Log in to [AWS Console](https://console.aws.amazon.com)
2. Go to **IAM** → **Users** → Your user
3. Click **Security credentials** tab
4. Click **Create access key**
5. Save the credentials securely

### 3. Enable Bedrock Access

Before deployment, you must enable Claude 3.5 Sonnet in AWS Console:

1. Open [Amazon Bedrock Console](https://console.aws.amazon.com/bedrock/)
2. Click **Model access** in left sidebar
3. Click **Enable specific models**
4. Find **Anthropic** → **Claude 3.5 Sonnet v2**
5. Check the box and click **Request model access**
6. Wait ~1 minute for "Access granted" ✅

**Recommended regions:** us-east-1 or us-west-2

### 4. Deploy to AWS

The script will continue automatically after prerequisites pass:
- ✅ Build Lambda functions
- ✅ Create DynamoDB tables
- ✅ Create S3 bucket
- ✅ Deploy API Gateway
- ✅ Set up IAM roles

**Time:** 5-10 minutes

### 5. Test Your Deployment

The script automatically runs tests:
```
✓ API Gateway is accessible
✓ Bedrock conversation successful
✓ DynamoDB tables active
✓ All Lambda functions running
```

### 6. Get Your API URL

The script displays:
```
API Gateway URL:
  https://abc123xyz.execute-api.us-east-1.amazonaws.com/dev
```

**Save this URL!** You'll need it for the frontend.

---

## 🖥️ Testing the Frontend

After deployment:

```bash
cd demo
python3 -m http.server 8000
```

Open browser: http://localhost:8000

1. **Toggle to "Live API" mode** (switch in header)
2. Click **"Start Creating an Invoice"**
3. Send message:
   ```
   Invoice Acme Corp $500 for consulting services on 11/1/2025 due 11/30/2025
   ```
4. Watch the **real AI** extract data and create the invoice!
5. Click **"Download PDF"** to get a real PDF file

---

## ⚡ Fastest Install Commands by Platform

### macOS with Homebrew
```bash
brew install awscli aws-sam-cli python@3.11
aws configure
cd scatterpilot
./scripts/00-deploy-all.sh
```

### Linux with pip
```bash
pip3 install awscli aws-sam-cli
aws configure
cd scatterpilot
./scripts/00-deploy-all.sh
```

### GitHub Codespaces / Cloud9
```bash
pip3 install aws-sam-cli
aws configure
cd scatterpilot
./scripts/00-deploy-all.sh
```

---

## 🐛 Troubleshooting Quick Fixes

### Error: "AWS CLI not installed"
```bash
# macOS
brew install awscli

# Linux
pip3 install awscli
```

### Error: "SAM CLI not installed"
```bash
# macOS
brew install aws-sam-cli

# Linux
pip3 install aws-sam-cli
```

### Error: "AWS credentials not configured"
```bash
aws configure
# Enter your AWS access key ID and secret access key
```

### Error: "Docker not running"
Docker is optional. You can:
1. Start Docker: `open -a Docker` (macOS)
2. Or continue without Docker (slower builds)

### Error: "Bedrock access denied"
1. Go to [Bedrock Console](https://console.aws.amazon.com/bedrock/)
2. Click **Model access** → **Enable specific models**
3. Enable **Claude 3.5 Sonnet v2**
4. Wait for approval (~1 minute)

### Error: "Stack already exists"
If you're re-deploying:
```bash
# The script will automatically update the existing stack
./scripts/03-deploy.sh
```

### Error: Permission denied on scripts
```bash
chmod +x scripts/*.sh
```

---

## 💰 Cost Estimate

**Development/Testing (100 invoices/month):**
- Bedrock (Claude): **$5-10/month**
- DynamoDB: **~$0.50/month**
- Lambda: **FREE** (within free tier)
- API Gateway: **FREE** (12 months)
- S3: **<$0.01/month**

**Total: $5-15/month**

Set up billing alarms (script does this automatically):
```bash
./scripts/06-setup-monitoring.sh
```

---

## ✅ Deployment Checklist

- [ ] AWS CLI installed
- [ ] AWS credentials configured
- [ ] SAM CLI installed
- [ ] Python 3.11+ installed
- [ ] Bedrock model access enabled
- [ ] Region selected (us-east-1 or us-west-2)
- [ ] Deployment completed successfully
- [ ] API URL saved
- [ ] Frontend tested with Live API mode
- [ ] Billing alarms set up
- [ ] Email subscription confirmed

---

## 🚀 What's Next?

After successful deployment:

1. **Test the API** directly:
   ```bash
   curl -X POST https://YOUR_API_URL/conversation \
     -H 'Content-Type: application/json' \
     -d '{"user_id":"test","message":"Create invoice for Acme Corp"}'
   ```

2. **View CloudWatch logs:**
   ```bash
   aws logs tail /aws/lambda/ScatterPilot-Conversation-dev --follow
   ```

3. **Deploy frontend to production:**
   - S3 + CloudFront
   - Netlify
   - Vercel

4. **Add authentication:**
   - Create Cognito User Pool
   - Re-deploy with Cognito ARN

5. **Monitor costs:**
   - Check email for billing alerts
   - View CloudWatch dashboard

---

## 📞 Need Help?

- **Full Documentation:** [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **Architecture Details:** [README.md](README.md)
- **Scripts Reference:** [scripts/README.md](scripts/README.md)
- **Bedrock Setup:** [scripts/02-enable-bedrock-access.md](scripts/02-enable-bedrock-access.md)

---

**🎉 You're ready to deploy!** Just run `./scripts/00-deploy-all.sh` and follow the prompts.

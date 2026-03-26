# GitHub Secrets for CI/CD Deployment

This document describes the GitHub secrets required for the automated frontend and backend deployment workflows.

## Required Secrets

### AWS Credentials

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS IAM access key with S3, CloudFront, and CloudFormation permissions |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret access key |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution ID: `E1X5IX7QKN47RH` |

### Backend Deployment (SAM)

| Secret | Description |
|--------|-------------|
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret for payment events |

### Vite Environment Variables

| Secret | Description | Value |
|--------|-------------|-------|
| `VITE_API_URL` | Backend API endpoint | `https://tph89c0qhc.execute-api.us-east-1.amazonaws.com/staging` |
| `VITE_USER_POOL_ID` | AWS Cognito User Pool ID | `us-east-1_1HrjTVCQY` |
| `VITE_USER_POOL_CLIENT_ID` | AWS Cognito App Client ID | `4peltv6h24g4jkv12v1b694dm2` |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (pk_live_...) | Get from Stripe Dashboard |
| `VITE_STRIPE_CLIENT_ID` | Stripe Connect client ID (ca_...) | Get from Stripe Connect settings |
| `VITE_GA4_MEASUREMENT_ID` | Google Analytics 4 measurement ID | Get from GA4 property settings |

## Setup Instructions

### Step 1: Navigate to Repository Settings

1. Go to your GitHub repository
2. Click **Settings** tab
3. In the left sidebar, click **Secrets and variables** → **Actions**

### Step 2: Add Each Secret

1. Click **New repository secret**
2. Enter the secret name exactly as shown above (case-sensitive)
3. Paste the secret value
4. Click **Add secret**
5. Repeat for each secret

### Step 3: Create IAM User for Deployments

Create a dedicated IAM user. The user needs permissions for both frontend (S3/CloudFront) and backend (SAM/CloudFormation) deployments.

**Frontend Deployment Policy:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3DeployAccess",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::scatterpilot-frontend",
        "arn:aws:s3:::scatterpilot-frontend/*"
      ]
    },
    {
      "Sid": "CloudFrontInvalidation",
      "Effect": "Allow",
      "Action": "cloudfront:CreateInvalidation",
      "Resource": "arn:aws:cloudfront::*:distribution/E1X5IX7QKN47RH"
    }
  ]
}
```

**Backend Deployment Policy:**

For SAM deployments, attach the `AWSCloudFormationFullAccess` and `AWSLambda_FullAccess` managed policies, or create a custom policy with:

- `cloudformation:*` on stack `scatterpilot-vm-staging`
- `lambda:*` for function updates
- `iam:PassRole` for Lambda execution roles
- `s3:*` on SAM deployment bucket
- `apigateway:*` for API Gateway updates
- `logs:*` for CloudWatch log groups

## Security Best Practices

1. **Use dedicated IAM credentials** - Never use root account or overly permissive IAM users
2. **Rotate credentials regularly** - Update AWS keys at least quarterly
3. **Enable branch protection** - Require PR reviews before merging to `main`
4. **Audit secret access** - Review who has access to repository settings
5. **Never commit secrets** - Use `.env.local` for local development (already in `.gitignore`)

## Testing the Workflow

### Manual Trigger - Frontend

1. Go to **Actions** tab in GitHub
2. Select **Deploy Frontend to S3 + CloudFront**
3. Click **Run workflow**
4. Select `main` branch
5. Click **Run workflow**

### Manual Trigger - Backend

1. Go to **Actions** tab in GitHub
2. Select **Deploy Backend with SAM**
3. Click **Run workflow**
4. Select `main` branch
5. Click **Run workflow**

### Verify Frontend Deployment

1. Check the workflow run for green checkmarks
2. Visit https://scatterpilot.com to verify changes
3. CloudFront invalidation takes 5-10 minutes to propagate

### Verify Backend Deployment

1. Check the workflow run for green checkmarks
2. Review the deployment summary for stack outputs
3. Test API endpoints to confirm Lambda functions are updated

### Troubleshooting

| Issue | Solution |
|-------|----------|
| S3 access denied | Verify IAM policy includes correct bucket ARN |
| CloudFront invalidation fails | Check distribution ID matches `E1X5IX7QKN47RH` |
| Frontend build fails | Ensure all VITE_* secrets are set correctly |
| Missing environment variables | Vite requires `VITE_` prefix for client-side env vars |
| SAM build fails | Check Python 3.12 compatibility and requirements.txt syntax |
| SAM deploy fails - stack not found | Stack must already exist; AWS Org SCP blocks new stack creation |
| CloudFormation access denied | IAM user needs CloudFormation and Lambda permissions |
| Parameter override error | Ensure `STRIPE_WEBHOOK_SECRET` is set in GitHub secrets |

## Local Development

For local development, create `frontend/.env.local`:

```bash
VITE_API_URL=https://tph89c0qhc.execute-api.us-east-1.amazonaws.com/staging
VITE_USER_POOL_ID=us-east-1_1HrjTVCQY
VITE_USER_POOL_CLIENT_ID=4peltv6h24g4jkv12v1b694dm2
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_STRIPE_CLIENT_ID=ca_...
VITE_GA4_MEASUREMENT_ID=G-...
```

This file is gitignored and should never be committed.

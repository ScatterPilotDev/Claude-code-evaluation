# ScatterPilot Frontend - Quick Deployment Guide

## Prerequisites

- Node.js 18+ installed
- AWS CLI configured with credentials
- AWS account with S3 access

## 5-Minute Deployment

### Step 1: Install Dependencies (1 min)

```bash
cd scatterpilot/frontend
npm install
```

### Step 2: Build the App (1 min)

```bash
npm run build
```

This creates a `dist/` folder with your production-ready app.

### Step 3: Deploy to S3 (3 min)

**Option A: Automated Script (Recommended)**

```bash
chmod +x deploy-s3.sh
./deploy-s3.sh scatterpilot-frontend us-east-1
```

**Option B: Manual Commands**

```bash
# Create bucket
aws s3 mb s3://scatterpilot-frontend

# Upload files
aws s3 sync dist/ s3://scatterpilot-frontend --delete

# Enable website hosting
aws s3 website s3://scatterpilot-frontend \
  --index-document index.html \
  --error-document index.html

# Make public
aws s3api put-bucket-policy --bucket scatterpilot-frontend --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::scatterpilot-frontend/*"
  }]
}'
```

### Step 4: Access Your App

Your app is now live at:
```
http://scatterpilot-frontend.s3-website-us-east-1.amazonaws.com
```

## Connect to Backend API

### 1. Get your API Gateway URL

```bash
aws cloudformation describe-stacks \
  --stack-name scatterpilot-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text
```

### 2. Update Environment Variable

Create `.env` file:
```bash
echo "VITE_API_URL=https://YOUR_API_URL.amazonaws.com/prod" > .env
```

### 3. Rebuild and Redeploy

```bash
npm run build
./deploy-s3.sh scatterpilot-frontend us-east-1
```

## Production Setup with CloudFront (HTTPS)

For a production deployment with HTTPS, you need CloudFront:

### 1. Deploy to S3 (keep bucket private)

```bash
npm run build
aws s3 sync dist/ s3://scatterpilot-frontend-private
```

### 2. Create CloudFront Distribution

```bash
aws cloudfront create-distribution \
  --origin-domain-name scatterpilot-frontend-private.s3.amazonaws.com \
  --default-root-object index.html
```

Or use the AWS Console:
1. Go to CloudFront
2. Create Distribution
3. Origin: Your S3 bucket
4. Enable OAI (Origin Access Identity)
5. Custom Error Response: 404 → /index.html
6. Wait 10-15 minutes for deployment

### 3. Get CloudFront URL

```bash
aws cloudfront list-distributions \
  --query 'DistributionList.Items[0].DomainName' \
  --output text
```

Your app will be at: `https://xyz123.cloudfront.net`

## Update Deployment

To deploy updates:

```bash
npm run build
aws s3 sync dist/ s3://scatterpilot-frontend --delete
```

If using CloudFront, invalidate cache:

```bash
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

## Costs

- **S3 Storage**: ~$0.023/GB/month
- **S3 Requests**: ~$0.0004 per 1000 requests
- **Data Transfer**: First 1GB free, then ~$0.09/GB
- **CloudFront**: ~$0.085/GB (optional)

**Estimated cost for small app: < $5/month**

## Troubleshooting

### "Access Denied" when visiting S3 URL

Check bucket policy is set:
```bash
aws s3api get-bucket-policy --bucket scatterpilot-frontend
```

### CORS Errors

Update your API Gateway to allow your S3/CloudFront origin:
```yaml
Cors:
  AllowOrigins:
    - 'http://scatterpilot-frontend.s3-website-us-east-1.amazonaws.com'
  AllowHeaders: ['Content-Type', 'Authorization']
  AllowMethods: ['GET', 'POST', 'OPTIONS']
```

### 404 on React Routes

Make sure error document is set to `index.html`:
```bash
aws s3 website s3://scatterpilot-frontend \
  --index-document index.html \
  --error-document index.html
```

## Next Steps

1. Set up custom domain (Route53)
2. Add SSL certificate (AWS Certificate Manager)
3. Implement Cognito authentication
4. Set up CI/CD (GitHub Actions)
5. Add monitoring (CloudWatch)

## Support

Issues? Check:
- AWS CLI is configured: `aws sts get-caller-identity`
- Node.js version: `node --version` (should be 18+)
- Build succeeded: check `dist/` folder exists

#!/bin/bash

# ScatterPilot Frontend Deployment Script
# Deploys the React app to S3 + CloudFront

set -e

# Configuration
BUCKET_NAME="${1:-scatterpilot-frontend}"
REGION="${2:-us-east-1}"
STACK_NAME="scatterpilot-frontend-hosting"

echo "========================================="
echo "ScatterPilot Frontend Deployment"
echo "========================================="
echo "Bucket: $BUCKET_NAME"
echo "Region: $REGION"
echo ""

# Step 1: Build the app
echo "[1/5] Building React app..."
npm run build

# Step 2: Create S3 bucket if it doesn't exist
echo "[2/5] Setting up S3 bucket..."
if aws s3 ls "s3://$BUCKET_NAME" 2>/dev/null; then
  echo "Bucket $BUCKET_NAME already exists"
else
  echo "Creating bucket $BUCKET_NAME..."
  if [ "$REGION" = "us-east-1" ]; then
    aws s3 mb "s3://$BUCKET_NAME"
  else
    aws s3 mb "s3://$BUCKET_NAME" --region "$REGION"
  fi
fi

# Step 3: Configure bucket for static website hosting
echo "[3/5] Configuring static website hosting..."
aws s3 website "s3://$BUCKET_NAME" \
  --index-document index.html \
  --error-document index.html

# Step 4: Set bucket policy for public read access
echo "[4/5] Setting bucket policy..."
cat > /tmp/bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BUCKET_NAME/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket "$BUCKET_NAME" \
  --policy file:///tmp/bucket-policy.json

# Step 5: Upload files
echo "[5/5] Uploading files to S3..."
aws s3 sync dist/ "s3://$BUCKET_NAME" \
  --delete \
  --cache-control "public, max-age=31536000" \
  --exclude "index.html"

# Upload index.html separately with no-cache
aws s3 cp dist/index.html "s3://$BUCKET_NAME/index.html" \
  --cache-control "no-cache, no-store, must-revalidate"

echo ""
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo "Website URL: http://$BUCKET_NAME.s3-website-$REGION.amazonaws.com"
echo ""
echo "To set up CloudFront CDN (recommended for production):"
echo "  aws cloudfront create-distribution --origin-domain-name $BUCKET_NAME.s3-website-$REGION.amazonaws.com"
echo ""
echo "Next steps:"
echo "1. Update VITE_API_URL in .env with your API Gateway URL"
echo "2. Run 'npm run build && ./deploy-s3.sh' to redeploy"
echo "3. Consider setting up CloudFront for HTTPS and better performance"
echo ""

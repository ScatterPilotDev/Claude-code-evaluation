#!/bin/bash

# ScatterPilot Frontend CloudFront Deployment
# Creates S3 bucket + CloudFront distribution for production use

set -e

# Configuration
BUCKET_NAME="${1:-scatterpilot-frontend}"
REGION="${2:-us-east-1}"

echo "========================================="
echo "ScatterPilot CloudFront Setup"
echo "========================================="
echo ""

# Step 1: Build the app
echo "[1/4] Building React app..."
npm run build

# Step 2: Create S3 bucket
echo "[2/4] Creating S3 bucket..."
if aws s3 ls "s3://$BUCKET_NAME" 2>/dev/null; then
  echo "Bucket already exists"
else
  if [ "$REGION" = "us-east-1" ]; then
    aws s3 mb "s3://$BUCKET_NAME"
  else
    aws s3 mb "s3://$BUCKET_NAME" --region "$REGION"
  fi
fi

# Step 3: Upload files (private - CloudFront will access)
echo "[3/4] Uploading files..."
aws s3 sync dist/ "s3://$BUCKET_NAME" --delete

# Step 4: Create CloudFront OAI and Distribution
echo "[4/4] Setting up CloudFront..."
cat > /tmp/cf-config.json <<EOF
{
  "CallerReference": "scatterpilot-$(date +%s)",
  "Comment": "ScatterPilot Frontend Distribution",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-$BUCKET_NAME",
        "DomainName": "$BUCKET_NAME.s3.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-$BUCKET_NAME",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": {
        "Quantity": 2,
        "Items": ["GET", "HEAD"]
      }
    },
    "ForwardedValues": {
      "QueryString": false,
      "Cookies": {
        "Forward": "none"
      }
    },
    "MinTTL": 0,
    "DefaultTTL": 86400,
    "MaxTTL": 31536000,
    "Compress": true
  },
  "CustomErrorResponses": {
    "Quantity": 1,
    "Items": [
      {
        "ErrorCode": 404,
        "ResponsePagePath": "/index.html",
        "ResponseCode": "200",
        "ErrorCachingMinTTL": 300
      }
    ]
  },
  "Enabled": true,
  "PriceClass": "PriceClass_100"
}
EOF

echo ""
echo "========================================="
echo "Manual CloudFront Setup Required"
echo "========================================="
echo ""
echo "Your app is uploaded to S3: $BUCKET_NAME"
echo ""
echo "To create CloudFront distribution:"
echo "1. Go to AWS CloudFront Console"
echo "2. Create Distribution"
echo "3. Origin: $BUCKET_NAME.s3.amazonaws.com"
echo "4. Enable 'Origin Access Identity' for security"
echo "5. Set Default Root Object: index.html"
echo "6. Add Custom Error Response: 404 -> /index.html (for React Router)"
echo ""
echo "Or use AWS CLI:"
echo "  aws cloudformation deploy --template-file cloudfront-template.yaml --stack-name scatterpilot-cdn"
echo ""

#!/bin/bash
# Frontend Deployment Script for ScatterPilot
# Builds and deploys the frontend to S3 and invalidates CloudFront cache

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
FRONTEND_DIR="scatterpilot/frontend"
S3_BUCKET="scatterpilot-frontend"
DIST_DIR="$FRONTEND_DIR/dist"

# CloudFront Distribution ID (set this after creating CloudFront distribution)
# Leave empty if CloudFront is not set up yet
CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}ScatterPilot Frontend Deployment${NC}"
echo -e "${GREEN}========================================${NC}"

# Step 1: Verify .env file exists
echo -e "\n${YELLOW}[1/5]${NC} Checking configuration..."
if [ ! -f "$FRONTEND_DIR/.env" ]; then
    echo -e "${RED}Error: .env file not found in $FRONTEND_DIR${NC}"
    echo "Please create .env file with VITE_API_URL"
    exit 1
fi

# Display current API URL
echo "Current API URL from .env:"
grep VITE_API_URL "$FRONTEND_DIR/.env" || echo "VITE_API_URL not set"

# Step 2: Install dependencies (if needed)
echo -e "\n${YELLOW}[2/5]${NC} Checking dependencies..."
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "Installing npm dependencies..."
    cd "$FRONTEND_DIR"
    npm install
    cd - > /dev/null
else
    echo "Dependencies already installed"
fi

# Step 3: Build the frontend
echo -e "\n${YELLOW}[3/5]${NC} Building frontend..."
cd "$FRONTEND_DIR"
npm run build
cd - > /dev/null

if [ ! -d "$DIST_DIR" ]; then
    echo -e "${RED}Error: Build failed - dist directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build successful${NC}"

# Step 4: Verify S3 bucket exists
echo -e "\n${YELLOW}[4/5]${NC} Verifying S3 bucket..."
if ! aws s3 ls "s3://$S3_BUCKET" > /dev/null 2>&1; then
    echo -e "${RED}Error: S3 bucket $S3_BUCKET not found or not accessible${NC}"
    exit 1
fi
echo -e "${GREEN}✓ S3 bucket verified${NC}"

# Step 5: Deploy to S3
echo -e "\n${YELLOW}[5/5]${NC} Deploying to S3..."
aws s3 sync "$DIST_DIR/" "s3://$S3_BUCKET/" \
    --delete \
    --cache-control "public, max-age=31536000" \
    --exclude "index.html"

# Deploy index.html separately with no-cache
aws s3 cp "$DIST_DIR/index.html" "s3://$S3_BUCKET/index.html" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --content-type "text/html"

echo -e "${GREEN}✓ Deployed to S3${NC}"

# Step 6: Invalidate CloudFront cache (if configured)
if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
    echo -e "\n${YELLOW}[6/7]${NC} Invalidating CloudFront cache..."
    INVALIDATION_ID=$(aws cloudfront create-invalidation \
        --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" \
        --paths "/*" \
        --query 'Invalidation.Id' \
        --output text 2>/dev/null || echo "")

    if [ -n "$INVALIDATION_ID" ]; then
        echo -e "${GREEN}✓ CloudFront invalidation created: $INVALIDATION_ID${NC}"
        echo -e "  Cache will be cleared in 1-2 minutes"
    else
        echo -e "${YELLOW}⚠ CloudFront invalidation failed or permissions missing${NC}"
        echo -e "  You may need to manually invalidate the cache in AWS Console"
    fi
else
    echo -e "\n${YELLOW}[6/7]${NC} CloudFront not configured (skipping cache invalidation)"
    echo -e "  Set CLOUDFRONT_DISTRIBUTION_ID environment variable to enable"
fi

# Step 7: Get website URL
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"

# Try to get the website endpoint
WEBSITE_URL=$(aws s3api get-bucket-website --bucket "$S3_BUCKET" --query 'IndexDocument.Suffix' --output text 2>/dev/null && \
    echo "http://$S3_BUCKET.s3-website-us-east-1.amazonaws.com" || \
    echo "S3 bucket (website endpoint not configured)")

echo -e "\nS3 Website URL: ${GREEN}$WEBSITE_URL${NC}"

if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
    # Try to get CloudFront domain
    CF_DOMAIN=$(aws cloudfront get-distribution \
        --id "$CLOUDFRONT_DISTRIBUTION_ID" \
        --query 'Distribution.DomainName' \
        --output text 2>/dev/null || echo "")

    if [ -n "$CF_DOMAIN" ]; then
        echo -e "CloudFront URL: ${GREEN}https://$CF_DOMAIN${NC}"

        # Check for custom domains
        CUSTOM_DOMAINS=$(aws cloudfront get-distribution \
            --id "$CLOUDFRONT_DISTRIBUTION_ID" \
            --query 'Distribution.DistributionConfig.Aliases.Items[0]' \
            --output text 2>/dev/null || echo "")

        if [ -n "$CUSTOM_DOMAINS" ] && [ "$CUSTOM_DOMAINS" != "None" ]; then
            echo -e "Custom Domain: ${GREEN}https://$CUSTOM_DOMAINS${NC}"
        fi
    fi
fi

echo -e "\nTo verify API connectivity, check the browser console at:"
echo -e "  ${YELLOW}Developer Tools > Console${NC}"
echo -e "\nNote: If using CloudFront, allow 1-2 minutes for cache invalidation."

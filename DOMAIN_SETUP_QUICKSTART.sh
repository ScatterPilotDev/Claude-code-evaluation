#!/bin/bash
# ScatterPilot Domain Setup - Quick Reference Commands
# Copy and paste these commands, replacing placeholder values

set -e

# =============================================================================
# CONFIGURATION - UPDATE THESE VALUES AFTER EACH STEP
# =============================================================================

# Step 1: After requesting certificate, save the ARN here
CERTIFICATE_ARN="arn:aws:acm:us-east-1:373345867629:certificate/YOUR_CERT_ID_HERE"

# Step 5: After creating CloudFront distribution, save the ID here
DISTRIBUTION_ID="YOUR_DISTRIBUTION_ID_HERE"

# Step 5: After creating CloudFront distribution, save the domain here
CLOUDFRONT_DOMAIN="YOUR_CLOUDFRONT_DOMAIN_HERE"

# Route53 Hosted Zone ID (get this from Route53 console or via CLI)
HOSTED_ZONE_ID="YOUR_HOSTED_ZONE_ID_HERE"

# CloudFront Hosted Zone ID (this is always the same for all CloudFront distributions)
CLOUDFRONT_ZONE_ID="Z2FDTNDATAQYW2"

# =============================================================================
# INFRASTRUCTURE DETAILS (already configured)
# =============================================================================
USER_POOL_ID="us-east-1_ahnfveSG0"
USER_POOL_CLIENT_ID="71h4gmdrdkfv85i6odn0u7qhav"
API_URL="https://afqqilggfj.execute-api.us-east-1.amazonaws.com/dev"
S3_BUCKET="scatterpilot-frontend"
REGION="us-east-1"

# =============================================================================
# STEP 1: REQUEST ACM SSL CERTIFICATE
# =============================================================================
echo "Step 1: Requesting ACM certificate..."

aws acm request-certificate \
  --domain-name scatterpilot.com \
  --subject-alternative-names www.scatterpilot.com \
  --validation-method DNS \
  --region $REGION \
  --tags Key=Environment,Value=production Key=Application,Value=ScatterPilot

# SAVE THE CERTIFICATE ARN FROM THE OUTPUT AND UPDATE CERTIFICATE_ARN VARIABLE ABOVE

# =============================================================================
# STEP 2: GET DNS VALIDATION RECORDS
# =============================================================================
echo -e "\nStep 2: Getting DNS validation records..."

aws acm describe-certificate \
  --certificate-arn $CERTIFICATE_ARN \
  --region $REGION \
  --query 'Certificate.DomainValidationOptions[*].ResourceRecord' \
  --output table

# COPY THE CNAME NAME AND VALUE TO CREATE DNS RECORDS IN ROUTE53

# =============================================================================
# STEP 3: GET HOSTED ZONE ID (if you don't have it)
# =============================================================================
echo -e "\nStep 3: Getting Route53 Hosted Zone ID..."

aws route53 list-hosted-zones \
  --query 'HostedZones[?Name==`scatterpilot.com.`].{Id:Id,Name:Name}' \
  --output table

# SAVE THE HOSTED ZONE ID (remove the /hostedzone/ prefix) TO HOSTED_ZONE_ID VARIABLE

# =============================================================================
# STEP 4: WAIT FOR CERTIFICATE VALIDATION
# =============================================================================
echo -e "\nStep 4: Waiting for certificate validation..."

# Check status
aws acm describe-certificate \
  --certificate-arn $CERTIFICATE_ARN \
  --region $REGION \
  --query 'Certificate.Status' \
  --output text

# Or wait (this can take 5-30 minutes)
# aws acm wait certificate-validated \
#   --certificate-arn $CERTIFICATE_ARN \
#   --region $REGION

# =============================================================================
# STEP 5: CREATE CLOUDFRONT DISTRIBUTION
# =============================================================================
# Note: Use AWS Console for this step - it's much easier than CLI
# See DOMAIN_SETUP_GUIDE.md for detailed instructions
# SAVE THE DISTRIBUTION ID AND DOMAIN TO THE VARIABLES ABOVE

# =============================================================================
# STEP 6: CREATE ROUTE53 DNS A RECORDS
# =============================================================================
echo -e "\nStep 6: Creating Route53 DNS records..."

cat > /tmp/dns-records.json << EOF
{
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "scatterpilot.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "$CLOUDFRONT_ZONE_ID",
          "DNSName": "$CLOUDFRONT_DOMAIN",
          "EvaluateTargetHealth": false
        }
      }
    },
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "www.scatterpilot.com",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "$CLOUDFRONT_ZONE_ID",
          "DNSName": "$CLOUDFRONT_DOMAIN",
          "EvaluateTargetHealth": false
        }
      }
    }
  ]
}
EOF

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file:///tmp/dns-records.json

# =============================================================================
# STEP 7: UPDATE COGNITO USER POOL CALLBACK URLs
# =============================================================================
echo -e "\nStep 7: Updating Cognito callback URLs..."

aws cognito-idp update-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-id $USER_POOL_CLIENT_ID \
  --callback-urls \
    "https://scatterpilot.com" \
    "https://www.scatterpilot.com" \
    "http://scatterpilot-frontend.s3-website-us-east-1.amazonaws.com" \
  --logout-urls \
    "https://scatterpilot.com" \
    "https://www.scatterpilot.com" \
    "http://scatterpilot-frontend.s3-website-us-east-1.amazonaws.com" \
  --allowed-o-auth-flows "code" "implicit" \
  --allowed-o-auth-scopes "email" "openid" "profile" \
  --allowed-o-auth-flows-user-pool-client \
  --supported-identity-providers "COGNITO"

# =============================================================================
# STEP 8: DEPLOY FRONTEND WITH CLOUDFRONT INVALIDATION
# =============================================================================
echo -e "\nStep 8: Deploying frontend..."

export CLOUDFRONT_DISTRIBUTION_ID=$DISTRIBUTION_ID
./scripts/deploy-frontend.sh

# =============================================================================
# VERIFICATION COMMANDS
# =============================================================================
echo -e "\n========================================="
echo "Verification Commands"
echo "========================================="

# Check certificate status
echo -e "\nCertificate status:"
aws acm describe-certificate \
  --certificate-arn $CERTIFICATE_ARN \
  --region $REGION \
  --query 'Certificate.{Status:Status,Domain:DomainName}' \
  --output table

# Check CloudFront distribution status
echo -e "\nCloudFront distribution status:"
aws cloudfront get-distribution \
  --id $DISTRIBUTION_ID \
  --query 'Distribution.{Status:Status,DomainName:DomainName,Enabled:DistributionConfig.Enabled}' \
  --output table

# Check DNS records
echo -e "\nDNS resolution (may take 5-10 minutes to propagate):"
dig scatterpilot.com +short
dig www.scatterpilot.com +short

# Check Cognito URLs
echo -e "\nCognito callback URLs:"
aws cognito-idp describe-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-id $USER_POOL_CLIENT_ID \
  --query 'UserPoolClient.{CallbackURLs:CallbackURLs,LogoutURLs:LogoutURLs}' \
  --output table

# Test HTTPS
echo -e "\nTesting HTTPS (wait for DNS propagation first):"
# curl -I https://scatterpilot.com

echo -e "\n========================================="
echo "Setup complete!"
echo "========================================="
echo "Production URL: https://scatterpilot.com"
echo "CloudFront URL: https://$CLOUDFRONT_DOMAIN"
echo ""
echo "Note: DNS propagation can take 5-10 minutes"
echo "Check browser for any CORS or authentication issues"

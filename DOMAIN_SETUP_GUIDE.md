# ScatterPilot Domain Setup Guide
## Attach scatterpilot.com to Frontend with HTTPS

**CRITICAL**: Your current IAM user (`scatterpilot-deploy`) lacks CloudFront and Route53 permissions. You'll need to either:
1. Grant these permissions to the IAM user, OR
2. Use AWS Console for CloudFront/Route53 operations, OR
3. Use an AWS admin account for these commands

---

## Current Infrastructure Details

- **S3 Bucket**: scatterpilot-frontend
- **API Gateway**: https://afqqilggfj.execute-api.us-east-1.amazonaws.com/dev
- **User Pool ID**: us-east-1_ahnfveSG0
- **User Pool Client ID**: 71h4gmdrdkfv85i6odn0u7qhav
- **Region**: us-east-1

---

## STEP 1: Request ACM SSL Certificate

**IMPORTANT**: Certificate MUST be in us-east-1 for CloudFront.

```bash
# Request the certificate
aws acm request-certificate \
  --domain-name scatterpilot.com \
  --subject-alternative-names www.scatterpilot.com \
  --validation-method DNS \
  --region us-east-1 \
  --tags Key=Environment,Value=production Key=Application,Value=ScatterPilot

# Save the certificate ARN from the output
# Example output: "CertificateArn": "arn:aws:acm:us-east-1:373345867629:certificate/xxxxx"
```

**Save this ARN - you'll need it multiple times below!**

---

## STEP 2: Get DNS Validation Records

```bash
# Replace CERTIFICATE_ARN with the ARN from Step 1
CERTIFICATE_ARN="arn:aws:acm:us-east-1:373345867629:certificate/YOUR_CERT_ID_HERE"

aws acm describe-certificate \
  --certificate-arn $CERTIFICATE_ARN \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[*].ResourceRecord' \
  --output table
```

This will output something like:
```
-------------------------------------------------------------------
|                     DescribeCertificate                        |
+----------------+----------------------------------------------+
|      Name      |                   Value                      |
+----------------+----------------------------------------------+
| _xxx.scatterpilot.com | _xxx.acm-validations.aws.            |
+----------------+----------------------------------------------+
```

---

## STEP 3: Add DNS Validation Records to Route53

**Option A: AWS CLI (requires Route53 permissions)**

```bash
# First, get your hosted zone ID
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones \
  --query 'HostedZones[?Name==`scatterpilot.com.`].Id' \
  --output text | cut -d'/' -f3)

echo "Hosted Zone ID: $HOSTED_ZONE_ID"

# Get the validation CNAME details from Step 2
# You'll need to create a change batch JSON file
cat > /tmp/dns-validation.json << 'EOF'
{
  "Changes": [
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "_VALIDATION_NAME_FROM_STEP_2",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [
          {
            "Value": "_VALIDATION_VALUE_FROM_STEP_2"
          }
        ]
      }
    }
  ]
}
EOF

# Apply the change
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file:///tmp/dns-validation.json
```

**Option B: AWS Console (easier)**

1. Go to Route53 > Hosted Zones > scatterpilot.com
2. Click "Create record"
3. Use values from Step 2:
   - Record name: `_xxx` (the part before .scatterpilot.com)
   - Record type: CNAME
   - Value: The validation value from Step 2
4. Click "Create records"

---

## STEP 4: Wait for Certificate Validation

```bash
# Monitor certificate status (run this repeatedly until status is ISSUED)
aws acm describe-certificate \
  --certificate-arn $CERTIFICATE_ARN \
  --region us-east-1 \
  --query 'Certificate.Status' \
  --output text

# Or use wait command (may take 5-30 minutes)
aws acm wait certificate-validated \
  --certificate-arn $CERTIFICATE_ARN \
  --region us-east-1

echo "Certificate validated successfully!"
```

---

## STEP 5: Create CloudFront Distribution

Create a file with the CloudFront distribution configuration:

```bash
cat > /tmp/cloudfront-config.json << 'EOF'
{
  "CallerReference": "scatterpilot-$(date +%s)",
  "Comment": "ScatterPilot Production Frontend",
  "Enabled": true,
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-scatterpilot-frontend",
        "DomainName": "scatterpilot-frontend.s3.us-east-1.amazonaws.com",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        },
        "CustomHeaders": {
          "Quantity": 0
        },
        "ConnectionAttempts": 3,
        "ConnectionTimeout": 10,
        "OriginShield": {
          "Enabled": false
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-scatterpilot-frontend",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": {
        "Quantity": 2,
        "Items": ["GET", "HEAD"]
      }
    },
    "Compress": true,
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "SmoothStreaming": false
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
  "PriceClass": "PriceClass_All",
  "ViewerCertificate": {
    "CloudFrontDefaultCertificate": true,
    "MinimumProtocolVersion": "TLSv1.2_2021",
    "CertificateSource": "cloudfront"
  },
  "HttpVersion": "http2",
  "IsIPV6Enabled": true
}
EOF

# Create the distribution (requires CloudFront permissions)
aws cloudfront create-distribution \
  --distribution-config file:///tmp/cloudfront-config.json \
  --output json > /tmp/cloudfront-output.json

# Extract the distribution ID and domain name
DISTRIBUTION_ID=$(jq -r '.Distribution.Id' /tmp/cloudfront-output.json)
CLOUDFRONT_DOMAIN=$(jq -r '.Distribution.DomainName' /tmp/cloudfront-output.json)

echo "Distribution ID: $DISTRIBUTION_ID"
echo "CloudFront Domain: $CLOUDFRONT_DOMAIN"
```

**Save the Distribution ID - you'll need it for invalidations!**

**Alternative: AWS Console**
1. Go to CloudFront > Create Distribution
2. Origin settings:
   - Origin domain: Select `scatterpilot-frontend.s3.us-east-1.amazonaws.com`
   - Origin access: Public (we'll secure later if needed)
3. Default cache behavior:
   - Viewer protocol policy: Redirect HTTP to HTTPS
   - Allowed HTTP methods: GET, HEAD
   - Cache policy: CachingOptimized
4. Settings:
   - Price class: Use all edge locations
   - Alternate domain name (CNAME): Leave blank for now (add after cert)
   - Custom SSL certificate: Leave as default for now
   - Default root object: `index.html`
5. Custom error responses:
   - Create custom error response
   - HTTP error code: 404
   - Customize error response: Yes
   - Response page path: `/index.html`
   - HTTP response code: 200
6. Click "Create distribution"
7. **Save the Distribution ID and Domain Name**

---

## STEP 6: Update CloudFront with SSL Certificate and Custom Domain

```bash
# Get current distribution config
aws cloudfront get-distribution-config \
  --id $DISTRIBUTION_ID \
  --output json > /tmp/dist-config.json

# Extract the ETag (required for updates)
ETAG=$(jq -r '.ETag' /tmp/dist-config.json)

# Extract just the DistributionConfig
jq '.DistributionConfig' /tmp/dist-config.json > /tmp/dist-config-only.json

# Update the config with your certificate ARN and domain names
# You'll need to manually edit this file or use jq to update it:
# 1. Add "scatterpilot.com" and "www.scatterpilot.com" to Aliases.Items array
# 2. Update ViewerCertificate section with your ACM certificate ARN

# Manual edit option:
nano /tmp/dist-config-only.json

# Look for and update these sections:
# "Aliases": {
#   "Quantity": 2,
#   "Items": ["scatterpilot.com", "www.scatterpilot.com"]
# }
#
# "ViewerCertificate": {
#   "ACMCertificateArn": "YOUR_CERTIFICATE_ARN_FROM_STEP_1",
#   "SSLSupportMethod": "sni-only",
#   "MinimumProtocolVersion": "TLSv1.2_2021",
#   "Certificate": "YOUR_CERTIFICATE_ARN_FROM_STEP_1",
#   "CertificateSource": "acm"
# }

# After editing, update the distribution
aws cloudfront update-distribution \
  --id $DISTRIBUTION_ID \
  --distribution-config file:///tmp/dist-config-only.json \
  --if-match $ETAG
```

**AWS Console Alternative** (MUCH EASIER):
1. Go to CloudFront > Distributions > Select your distribution
2. Click "Edit"
3. Settings section:
   - Alternate domain names (CNAMEs): Add `scatterpilot.com` and `www.scatterpilot.com`
   - Custom SSL certificate: Select the certificate from Step 1
   - Security policy: TLSv1.2_2021 (recommended)
4. Click "Save changes"
5. Wait for distribution to deploy (Status: "Deployed")

---

## STEP 7: Create Route53 DNS A Records

```bash
# Get the CloudFront domain name
CLOUDFRONT_DOMAIN="d1234abcd.cloudfront.net"  # From Step 5 or console

# Get the CloudFront Hosted Zone ID (always the same for CloudFront)
CLOUDFRONT_ZONE_ID="Z2FDTNDATAQYW2"

# Create DNS records
cat > /tmp/dns-records.json << EOF
{
  "Changes": [
    {
      "Action": "CREATE",
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
      "Action": "CREATE",
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

# Apply the changes
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file:///tmp/dns-records.json
```

**AWS Console Alternative**:
1. Go to Route53 > Hosted Zones > scatterpilot.com
2. Click "Create record"
3. For scatterpilot.com:
   - Record name: (leave blank)
   - Record type: A
   - Alias: Yes
   - Route traffic to: Alias to CloudFront distribution
   - Choose distribution: Select your distribution
   - Click "Create records"
4. Repeat for www:
   - Record name: www
   - Record type: A
   - Alias: Yes
   - Route traffic to: Alias to CloudFront distribution
   - Choose distribution: Select your distribution
   - Click "Create records"

---

## STEP 8: Update Cognito User Pool Callback URLs

```bash
# Get current app client config
aws cognito-idp describe-user-pool-client \
  --user-pool-id us-east-1_ahnfveSG0 \
  --client-id 71h4gmdrdkfv85i6odn0u7qhav \
  --output json > /tmp/cognito-client.json

# Update with new callback URLs
aws cognito-idp update-user-pool-client \
  --user-pool-id us-east-1_ahnfveSG0 \
  --client-id 71h4gmdrdkfv85i6odn0u7qhav \
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

echo "Cognito callback URLs updated!"
```

**Verification**:
```bash
aws cognito-idp describe-user-pool-client \
  --user-pool-id us-east-1_ahnfveSG0 \
  --client-id 71h4gmdrdkfv85i6odn0u7qhav \
  --query 'UserPoolClient.{CallbackURLs:CallbackURLs,LogoutURLs:LogoutURLs}' \
  --output table
```

---

## STEP 9: Update CORS in CloudFormation Template (Optional)

The current template has CORS set to `'*'` which allows all origins. For production, you may want to restrict this:

Edit `scatterpilot/infrastructure/template.yaml` line 397:

```yaml
# Current (allows all):
AllowOrigin: "'*'"

# Production (specific domains):
AllowOrigin: "'https://scatterpilot.com,https://www.scatterpilot.com'"
```

Then redeploy:
```bash
cd scatterpilot/infrastructure
sam build
sam deploy --no-confirm-changeset
```

**Note**: Keep `'*'` during testing to avoid CORS issues.

---

## STEP 10: Update Deployment Script with CloudFront Invalidation

Already done! See the updated `scripts/deploy-frontend.sh` file.

To deploy now:
```bash
./scripts/deploy-frontend.sh
```

---

## DNS Verification Commands

```bash
# Check if DNS records are propagating
dig scatterpilot.com
dig www.scatterpilot.com

# Check specific nameserver
dig @8.8.8.8 scatterpilot.com

# Verify HTTPS certificate
curl -vI https://scatterpilot.com 2>&1 | grep -i "SSL\|TLS\|certificate"

# Test the actual site
curl -I https://scatterpilot.com
```

---

## Testing Checklist

- [ ] Certificate shows as "Issued" in ACM
- [ ] CloudFront distribution status is "Deployed"
- [ ] DNS records exist in Route53 for scatterpilot.com and www
- [ ] `dig scatterpilot.com` returns CloudFront IP addresses
- [ ] https://scatterpilot.com loads the application (may take 5-10 min for DNS)
- [ ] https://www.scatterpilot.com also works
- [ ] HTTPS is working (check for lock icon in browser)
- [ ] Browser shows certificate is valid
- [ ] Login/authentication works (Cognito callbacks)
- [ ] API calls succeed (check browser console)
- [ ] No CORS errors in browser console
- [ ] 404 errors redirect to index.html (for React routing)

---

## Troubleshooting

### DNS not resolving
- Wait 5-10 minutes for DNS propagation
- Check nameservers: `dig NS scatterpilot.com`
- Verify A records point to CloudFront

### Certificate errors
- Ensure certificate is in us-east-1
- Verify certificate status is "Issued"
- Check that domain names match exactly

### CORS errors
- Verify API Gateway CORS settings
- Check that Cognito callback URLs include your domain
- Look for errors in browser console (F12)

### CloudFront not serving latest content
- Run invalidation: `aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"`
- Check cache headers in deployment script

### 403 Forbidden from S3
- Verify S3 bucket policy allows public reads
- Check CloudFront origin settings

---

## Environment Variables

Don't forget to update your frontend `.env` file:

```bash
# scatterpilot/frontend/.env
VITE_API_URL=https://afqqilggfj.execute-api.us-east-1.amazonaws.com/dev
VITE_USER_POOL_ID=us-east-1_ahnfveSG0
VITE_USER_POOL_CLIENT_ID=71h4gmdrdkfv85i6odn0u7qhav
VITE_REGION=us-east-1
```

---

## Quick Reference: Key Values

Save these for future use:

```bash
# Certificate ARN (from Step 1)
CERTIFICATE_ARN="arn:aws:acm:us-east-1:373345867629:certificate/YOUR_CERT_ID"

# CloudFront Distribution ID (from Step 5)
DISTRIBUTION_ID="E1234ABCD5678"

# CloudFront Domain (from Step 5)
CLOUDFRONT_DOMAIN="d1234abcd.cloudfront.net"

# Route53 Hosted Zone ID
HOSTED_ZONE_ID="Z1234567890ABC"

# For CloudFront invalidations:
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"
```

---

## Post-Deployment

After everything is working:

1. **Update documentation** with the new domain
2. **Update any hardcoded URLs** in your code
3. **Set up monitoring** for CloudFront and certificate expiration
4. **Consider adding** a CDN cache policy
5. **Enable CloudFront logging** for analytics
6. **Set up AWS WAF** if you need additional security

---

## Cost Implications

- **Route53**: ~$0.50/month per hosted zone + query charges
- **ACM Certificate**: FREE
- **CloudFront**: Pay for data transfer and requests
  - First 1TB/month: $0.085/GB
  - HTTPS requests: $0.010 per 10,000 requests
- **Typical small app**: $5-20/month depending on traffic

---

**Need Help?**

If you encounter permission errors with AWS CLI commands, you have two options:
1. Grant additional permissions to the `scatterpilot-deploy` IAM user for CloudFront and Route53
2. Use the AWS Console for CloudFront and Route53 operations (recommended for first-time setup)

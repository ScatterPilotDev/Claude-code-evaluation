# IAM Permissions Setup for Domain Configuration

## Current Issue

Your IAM user `scatterpilot-deploy` currently lacks permissions for:
- CloudFront operations (create distribution, invalidations)
- Route53 operations (DNS record management)

## Solution Options

### Option 1: Attach Policy to IAM User (Recommended for CLI)

```bash
# Create the policy
aws iam create-policy \
  --policy-name ScatterPilot-CloudFront-Route53-Policy \
  --policy-document file://iam-policy-cloudfront-route53.json \
  --description "Permissions for CloudFront and Route53 management for ScatterPilot domain setup"

# Attach to your IAM user
aws iam attach-user-policy \
  --user-name scatterpilot-deploy \
  --policy-arn arn:aws:iam::373345867629:policy/ScatterPilot-CloudFront-Route53-Policy
```

### Option 2: Use AWS Console (Easier for First-Time Setup)

**Recommended if you're not comfortable with CLI for infrastructure changes.**

1. Sign into AWS Console with admin credentials
2. Navigate to each service:
   - **ACM**: Request certificate and validate
   - **CloudFront**: Create distribution
   - **Route53**: Add DNS records
   - **Cognito**: Update callback URLs

### Option 3: Use AWS Admin Account for This Setup Only

Run the domain setup commands using AWS admin credentials, then switch back to `scatterpilot-deploy` for regular deployments.

```bash
# Temporarily use admin profile
export AWS_PROFILE=admin

# Run domain setup commands
./DOMAIN_SETUP_QUICKSTART.sh

# Switch back to deploy profile
export AWS_PROFILE=default
```

---

## Attaching the Policy via AWS Console

If you prefer to use the AWS Console:

1. Go to **IAM > Users > scatterpilot-deploy**
2. Click **Add permissions > Attach policies directly**
3. Click **Create policy**
4. Choose **JSON** tab
5. Paste the contents of `iam-policy-cloudfront-route53.json`
6. Click **Next: Tags** (optional)
7. Click **Next: Review**
8. Name: `ScatterPilot-CloudFront-Route53-Policy`
9. Click **Create policy**
10. Go back to the user, refresh, and select the new policy
11. Click **Add permissions**

---

## Verifying Permissions

After attaching the policy, verify the permissions:

```bash
# Check CloudFront access
aws cloudfront list-distributions --max-items 1

# Check Route53 access
aws route53 list-hosted-zones --max-items 1

# Check ACM access
aws acm list-certificates --region us-east-1 --max-items 1

# If all commands succeed, you're good to go!
```

---

## Minimum Required Permissions for Production Deployments

After the initial domain setup, you can use a more restricted policy for day-to-day deployments:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "FrontendDeployment",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:PutObjectAcl",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::scatterpilot-frontend",
        "arn:aws:s3:::scatterpilot-frontend/*"
      ]
    },
    {
      "Sid": "CloudFrontInvalidation",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation",
        "cloudfront:GetDistribution"
      ],
      "Resource": "arn:aws:cloudfront::373345867629:distribution/*"
    }
  ]
}
```

This allows the deploy user to:
- Upload files to S3
- Invalidate CloudFront cache
- Nothing else (security best practice)

---

## Security Best Practices

1. **Use separate IAM users** for different purposes:
   - Admin user: Infrastructure changes
   - Deploy user: Daily deployments
   - Developer users: Read-only access

2. **Enable MFA** on all IAM users with administrative access

3. **Rotate access keys** regularly (every 90 days)

4. **Use IAM roles** for EC2/Lambda instead of hardcoding credentials

5. **Monitor CloudTrail** for any unauthorized access attempts

---

## Troubleshooting Permission Errors

### Error: "User: arn:aws:iam::373345867629:user/scatterpilot-deploy is not authorized to perform: cloudfront:CreateDistribution"

**Solution**: Attach the CloudFront-Route53 policy as shown above

### Error: "AccessDenied when calling the ListHostedZones operation"

**Solution**: Attach the CloudFront-Route53 policy as shown above

### Error: "User is not authorized to perform: acm:RequestCertificate"

**Solution**: Attach the CloudFront-Route53 policy as shown above

### Still having issues?

Check the IAM policy simulator:
1. Go to IAM > Users > scatterpilot-deploy
2. Click **Simulate policy**
3. Select the action you're trying to perform
4. See which policy is denying the action

---

## Alternative: Use CloudFormation for Infrastructure

For a more robust, repeatable setup, consider creating a CloudFormation template that includes:
- CloudFront distribution
- ACM certificate
- Route53 records

This would allow you to manage everything with `sam deploy` instead of manual AWS CLI commands.

Would you like me to create a CloudFormation template for this?

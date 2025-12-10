# ScatterPilot Stripe Integration Guide

This guide explains how to set up and deploy the Stripe payment integration for ScatterPilot.

## Overview

ScatterPilot uses Stripe for subscription billing:
- **Free Tier**: 5 invoices per month
- **Pro Tier**: $18/month for unlimited invoices

## Prerequisites

1. A Stripe account (sign up at https://stripe.com)
2. AWS CLI configured with appropriate permissions
3. SAM CLI installed

## Setup Steps

### 1. Get Stripe API Keys

1. Log in to your Stripe Dashboard: https://dashboard.stripe.com
2. Go to **Developers > API Keys**
3. Copy your test keys:
   - **Publishable key**: `pk_test_...`
   - **Secret key**: `sk_test_...`

### 2. Create Stripe Products

Run the setup script to create the Pro subscription product:

```bash
cd scatterpilot/scripts

# Set your Stripe secret key
export STRIPE_SECRET_KEY=sk_test_your_key_here

# Run the setup script
python setup_stripe_products.py
```

This will output:
- `STRIPE_PRO_PRODUCT_ID`
- `STRIPE_PRO_PRICE_ID`

Save these values for the deployment step.

### 3. Configure Webhook

1. In Stripe Dashboard, go to **Developers > Webhooks**
2. Click **Add endpoint**
3. Set the endpoint URL to: `https://your-api-id.execute-api.us-east-1.amazonaws.com/dev/webhook/stripe`
4. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_...`)

### 4. Deploy Backend

Deploy with Stripe parameters:

```bash
cd scatterpilot/infrastructure

sam build

sam deploy --guided \
  --parameter-overrides \
    StripeSecretKey=sk_test_your_key \
    StripeWebhookSecret=whsec_your_secret \
    StripeProPriceId=price_your_price_id \
    FrontendUrl=http://localhost:5173
```

Or update your samconfig.toml with the parameters:

```toml
[default.deploy.parameters]
parameter_overrides = "StripeSecretKey=sk_test_xxx StripeWebhookSecret=whsec_xxx StripeProPriceId=price_xxx FrontendUrl=https://your-frontend-url"
```

### 5. Configure Frontend

Create `.env` in the frontend directory:

```bash
cd scatterpilot/frontend

# Copy the example
cp .env.example .env

# Edit with your values
```

Update `.env` with your values:

```env
VITE_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/dev
VITE_USER_POOL_ID=us-east-1_xxxxxxxxx
VITE_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxx
VITE_AWS_REGION=us-east-1
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 6. Build and Deploy Frontend

```bash
cd scatterpilot/frontend

npm install
npm run build

# Deploy to S3/CloudFront or your hosting provider
```

## Testing

### Test Cards

Use these Stripe test card numbers:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires Auth**: `4000 0025 0000 3155`

Use any future expiry date and any 3-digit CVC.

### Test Flow

1. **Create Free Account**
   - Sign up for ScatterPilot
   - Create up to 5 invoices

2. **Hit Limit**
   - Try to create a 6th invoice
   - Should see upgrade prompt

3. **Upgrade to Pro**
   - Click "Upgrade to Pro" on pricing page
   - Complete Stripe Checkout with test card
   - Should redirect to success page

4. **Verify Subscription**
   - Check Account page shows "Pro" status
   - Create unlimited invoices

5. **Manage Billing**
   - Click "Manage Billing" on Account page
   - Should open Stripe Customer Portal
   - Can cancel subscription, update payment method

### Test Webhook

Use Stripe CLI to test webhooks locally:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local endpoint
stripe listen --forward-to localhost:3000/webhook/stripe

# Trigger test events
stripe trigger checkout.session.completed
```

## API Endpoints

### New Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | /subscription | Get user subscription status | Required |
| POST | /checkout | Create Stripe Checkout session | Required |
| POST | /portal | Create Customer Portal session | Required |
| POST | /webhook/stripe | Stripe webhook handler | None (uses signature) |

### Modified Endpoints

| Method | Path | Change |
|--------|------|--------|
| POST | /invoices | Now checks subscription limits |

## Database Schema

### New Table: ScatterPilot-Subscriptions-{env}

| Field | Type | Description |
|-------|------|-------------|
| user_id | String (PK) | Cognito user ID |
| stripe_customer_id | String (GSI) | Stripe customer ID |
| subscription_id | String | Stripe subscription ID |
| subscription_status | String | free, pro, or cancelled |
| current_period_end | Number | Unix timestamp |
| invoices_this_month | Number | Counter for free tier |
| invoice_count_reset_at | String | ISO timestamp of last reset |

## Webhook Events

| Event | Action |
|-------|--------|
| checkout.session.completed | Upgrade user to Pro |
| customer.subscription.updated | Update subscription status |
| customer.subscription.deleted | Downgrade to Free |
| invoice.payment_succeeded | Reset monthly counter |
| invoice.payment_failed | Log warning |

## Going to Production

Before going live:

1. **Switch to live keys**
   - Replace all `pk_test_...` and `sk_test_...` with `pk_live_...` and `sk_live_...`
   - Create new webhook with live endpoint

2. **Update webhook URL**
   - Create production webhook in Stripe Dashboard
   - Update SAM parameter with new signing secret

3. **Enable fraud prevention**
   - Enable Stripe Radar
   - Set up alerts for suspicious activity

4. **Test thoroughly**
   - Test with real card in test mode
   - Do a small live transaction

## Troubleshooting

### "Stripe price not configured" error
- Ensure `STRIPE_PRO_PRICE_ID` is set in SAM parameters
- Verify the price exists in your Stripe account

### Webhook signature verification failed
- Ensure `STRIPE_WEBHOOK_SECRET` matches your endpoint's signing secret
- Check that the raw body is being passed (not parsed JSON)

### User not upgraded after checkout
- Check CloudWatch logs for StripeWebhook function
- Verify webhook events are being received in Stripe Dashboard
- Ensure `user_id` is in checkout session metadata

### Invoice count not resetting
- Count resets on 1st of month when user creates invoice
- Also resets when subscription payment succeeds

## Support

For issues with this integration:
1. Check CloudWatch logs for Lambda functions
2. Review Stripe Dashboard for webhook delivery status
3. Test with Stripe CLI for local debugging

# Google Analytics 4 Setup Guide for ScatterPilot

## Overview

Google Analytics 4 (GA4) has been successfully integrated into ScatterPilot to track traffic sources, user behavior, and conversion metrics across all key pages and actions.

## What Was Implemented

### 1. Core Analytics Infrastructure

**Files Created/Modified:**
- `frontend/src/utils/analytics.js` - Analytics utility singleton
- `frontend/src/config.js` - Added GA4_CONFIG
- `frontend/.env` - Added VITE_GA_MEASUREMENT_ID
- `frontend/.env.example` - Updated with GA4 variable

**Package Installed:**
- `react-ga4` - Official React wrapper for Google Analytics 4

### 2. Tracking Implementation

#### Automatic Page View Tracking
- All route changes are automatically tracked
- UTM parameters captured from landing page visits
- Page titles and paths logged

#### User Authentication Events
- **Signup completed** - Tracks new user registrations
- **Login** - Tracks user logins
- **Logout** - Tracks when users sign out

#### Invoice Actions
- **Invoice created** - Tracks when user generates an invoice
- **PDF downloaded** - Tracks PDF downloads with invoice ID
- **Invoice viewed** - Available for historical invoice views

#### Conversion Tracking
- **Upgrade button clicked** - Tracks from multiple sources:
  - Pricing page
  - Usage limit prompt
  - Low invoice toast warning
- **Checkout started** - When user initiates Stripe checkout
- **Checkout completed** - When subscription is confirmed on success page

#### Traffic Source Tracking
- **Landing page views** - Automatically captures:
  - `utm_source` (e.g., reddit, linkedin, nextdoor)
  - `utm_medium` (e.g., social, referral, direct)
  - `utm_campaign` (e.g., launch_week, beta_testers)
- **CTA clicks** - Tracks specific call-to-action button clicks

### 3. Privacy Compliance

**Cookie Notice Component** (`frontend/src/components/CookieNotice.jsx`):
- Displays banner on first visit
- Accept/Decline options
- Links to privacy policy
- Stores preference in localStorage

**Privacy Features:**
- IP anonymization enabled
- Cookie flags set for security
- User can decline tracking
- GDPR-friendly implementation

### 4. Pages with Tracking

| Page | Events Tracked |
|------|----------------|
| **Landing Page** | Page view, UTM parameters, CTA clicks |
| **Pricing Page** | Page view, upgrade clicks, checkout started |
| **App Page** | Login, signup, logout events |
| **Chat Interface** | Invoice creation, upgrade prompts |
| **Invoice Preview** | PDF downloads |
| **Success Page** | Checkout completion |
| **Account Page** | Upgrade CTA (via router) |

## How to Set Up Google Analytics 4

### Step 1: Create GA4 Property

1. **Go to Google Analytics:** https://analytics.google.com/

2. **Create Account:**
   - Click "Admin" (gear icon, bottom left)
   - Click "Create Account"
   - Enter account name: "ScatterPilot"
   - Configure account settings

3. **Create Property:**
   - Property name: "ScatterPilot Production"
   - Timezone: Your timezone
   - Currency: USD

4. **Set Up Data Stream:**
   - Choose "Web"
   - Website URL: `https://scatterpilot.com` (or your domain)
   - Stream name: "ScatterPilot Website"
   - Click "Create stream"

5. **Get Measurement ID:**
   - Copy the **Measurement ID** (format: `G-XXXXXXXXXX`)
   - You'll need this for the next step

### Step 2: Configure Environment Variables

1. **Update `.env` file:**
   ```bash
   cd /workspaces/Claude-code-evaluation/scatterpilot/frontend
   ```

2. **Edit `.env`:**
   ```bash
   # Add your GA4 Measurement ID
   VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
   ```
   Replace `G-XXXXXXXXXX` with your actual Measurement ID from Step 1.

### Step 3: Build and Deploy

```bash
# Navigate to frontend directory
cd /workspaces/Claude-code-evaluation/scatterpilot/frontend

# Build production bundle
npm run build

# Deploy to S3
aws s3 sync dist/ s3://scatterpilot-frontend --delete

# Create CloudFront invalidation
export CLOUDFRONT_DISTRIBUTION_ID=E1X5IX7QKN47RH
aws cloudfront create-invalidation \
  --distribution-id $CLOUDFRONT_DISTRIBUTION_ID \
  --paths "/*"
```

### Step 4: Verify Tracking

1. **Real-time Testing:**
   - Open Google Analytics
   - Go to "Reports" > "Realtime"
   - Visit your website
   - You should see yourself in real-time

2. **Event Testing:**
   - Perform actions (signup, create invoice, etc.)
   - Check "Events" in real-time view
   - Verify events are being tracked

3. **Debug Mode (Optional):**
   - Install [Google Analytics Debugger](https://chrome.google.com/webstore/detail/google-analytics-debugger/jnkmfdileelhofjcijamephohjechhna) Chrome extension
   - Open Chrome DevTools
   - Check console for analytics debug logs

## What You'll See in GA4

### Traffic Sources Dashboard

**Acquisition Reports:**
- **Traffic by Source:**
  - reddit.com
  - linkedin.com
  - nextdoor.com
  - Direct traffic
  - Google search

- **Campaign Tracking:**
  - UTM campaign names
  - Medium (social, referral, etc.)
  - Source breakdown

### User Behavior Flow

**Engagement Reports:**
- Page views by page
- Average session duration
- Bounce rate
- Pages per session

### Conversion Tracking

**Custom Events:**
- `Signup` - New user registrations
- `Invoice_Created` - Total invoices generated
- `PDF_Downloaded` - Invoice downloads
- `Upgrade_Button_Clicked` - By source
- `Checkout_Started` - Conversion funnel start
- `Checkout_Completed` - Successful subscriptions

### Key Metrics to Monitor

1. **Traffic Sources:**
   - Which channels drive the most traffic?
   - Best performing social media platform
   - Direct vs. referral traffic ratio

2. **Conversion Rates:**
   - Signup rate by channel
   - Free → Pro upgrade rate
   - Checkout abandonment rate

3. **User Engagement:**
   - Average invoices per user
   - PDF download rate
   - Time on site

4. **Channel Performance:**
   - Reddit → Signup conversion
   - LinkedIn → Pro upgrade rate
   - Nextdoor engagement metrics

## Custom Dimensions to Set Up (Optional)

In GA4, you can create custom dimensions for deeper analysis:

1. **User Subscription Status:**
   - Dimension: `subscription_status`
   - Values: `free`, `pro`

2. **Invoice Count:**
   - Metric: `invoices_created`
   - Track per user

3. **Traffic Source Groups:**
   - Social: reddit, linkedin, nextdoor
   - Direct
   - Referral

## UTM Parameters Guide

When sharing links on social media or in marketing campaigns, use UTM parameters:

### Reddit Example:
```
https://scatterpilot.com/?utm_source=reddit&utm_medium=social&utm_campaign=launch_week
```

### LinkedIn Example:
```
https://scatterpilot.com/?utm_source=linkedin&utm_medium=social&utm_campaign=professional_network
```

### Nextdoor Example:
```
https://scatterpilot.com/?utm_source=nextdoor&utm_medium=social&utm_campaign=local_business
```

### Email Example:
```
https://scatterpilot.com/?utm_source=newsletter&utm_medium=email&utm_campaign=beta_launch
```

## Troubleshooting

### Analytics Not Working?

1. **Check Measurement ID:**
   ```bash
   # Verify .env has correct ID
   cat /workspaces/Claude-code-evaluation/scatterpilot/frontend/.env | grep GA
   ```

2. **Check Browser Console:**
   - Open DevTools → Console
   - Look for `[Analytics]` logs
   - Should see: `[Analytics] GA4 initialized successfully`

3. **Verify Build:**
   ```bash
   # Rebuild if needed
   cd /workspaces/Claude-code-evaluation/scatterpilot/frontend
   npm run build
   ```

4. **Check CloudFront Invalidation:**
   ```bash
   # Make sure cache is cleared
   aws cloudfront create-invalidation \
     --distribution-id E1X5IX7QKN47RH \
     --paths "/*"
   ```

### Events Not Showing Up?

- Wait 24-48 hours for full reporting (GA4 has processing delays)
- Use "Realtime" view for immediate feedback
- Check event names match exactly in GA4 dashboard

## Privacy Considerations

### Cookie Notice
- Automatically displayed on first visit
- User can accept or decline
- Preference stored in localStorage
- Compliant with GDPR requirements

### Data Collection
- IP addresses are anonymized
- No personally identifiable information (PII) tracked
- User emails are NOT sent to GA4
- Invoice IDs are anonymized

### User Rights
- Users can decline tracking via cookie notice
- Analytics disabled if user declines
- No tracking without consent (GDPR compliant)

## Analytics Code Structure

### Singleton Pattern
```javascript
// All analytics calls go through centralized utility
import analytics from '../utils/analytics';

// Track custom events
analytics.trackInvoiceCreated(invoiceId);
analytics.trackUpgradeClicked('pricing_page');
```

### Event Categories
- **User** - Authentication events
- **Invoice** - Invoice-related actions
- **Conversion** - Upgrade and payment events
- **Engagement** - Feature usage
- **Traffic** - Landing page and source tracking
- **Error** - Error tracking (optional)

## Next Steps

1. ✅ Create GA4 property
2. ✅ Add Measurement ID to `.env`
3. ✅ Deploy to production
4. ✅ Verify tracking in real-time
5. 📊 Monitor traffic sources
6. 📈 Analyze conversion rates
7. 🎯 Optimize based on data

## Support

For Google Analytics support:
- [GA4 Documentation](https://support.google.com/analytics/answer/10089681)
- [GA4 Event Reference](https://developers.google.com/analytics/devguides/collection/ga4/events)
- [GTM & GA4 Setup Guide](https://support.google.com/tagmanager/answer/9442095)

---

**Implementation Complete!** 🎉

All tracking code is in place and ready to go. Just add your GA4 Measurement ID and deploy!

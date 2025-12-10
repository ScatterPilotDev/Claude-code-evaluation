import ReactGA from 'react-ga4';

class Analytics {
  constructor() {
    this.initialized = false;
  }

  initialize(measurementId) {
    if (!measurementId) {
      console.warn('[Analytics] No GA4 Measurement ID provided');
      return;
    }

    if (this.initialized) {
      console.warn('[Analytics] Already initialized');
      return;
    }

    try {
      ReactGA.initialize(measurementId, {
        gtagOptions: {
          anonymize_ip: true, // Privacy compliance
          cookie_flags: 'SameSite=None;Secure'
        }
      });
      this.initialized = true;
      console.log('[Analytics] GA4 initialized successfully');
    } catch (error) {
      console.error('[Analytics] Failed to initialize:', error);
    }
  }

  isInitialized() {
    return this.initialized;
  }

  // Track page views
  pageView(path, title) {
    if (!this.initialized) return;

    try {
      ReactGA.send({
        hitType: 'pageview',
        page: path,
        title: title || document.title
      });
      console.log('[Analytics] Page view tracked:', path);
    } catch (error) {
      console.error('[Analytics] Page view tracking failed:', error);
    }
  }

  // Track custom events
  event(category, action, label = null, value = null) {
    if (!this.initialized) return;

    try {
      const eventData = {
        category,
        action,
        ...(label && { label }),
        ...(value && { value })
      };
      ReactGA.event(eventData);
      console.log('[Analytics] Event tracked:', eventData);
    } catch (error) {
      console.error('[Analytics] Event tracking failed:', error);
    }
  }

  // Predefined tracking methods for common actions

  // User Authentication
  trackSignup(method = 'email') {
    this.event('User', 'Signup', method);
  }

  trackLogin(method = 'email') {
    this.event('User', 'Login', method);
  }

  trackLogout() {
    this.event('User', 'Logout');
  }

  // Invoice Actions
  trackInvoiceCreated(invoiceId) {
    this.event('Invoice', 'Created', invoiceId);
  }

  trackInvoiceDownloaded(invoiceId, format = 'PDF') {
    this.event('Invoice', 'Downloaded', `${invoiceId}_${format}`);
  }

  trackInvoiceViewed(invoiceId) {
    this.event('Invoice', 'Viewed', invoiceId);
  }

  // Subscription & Pricing
  trackUpgradeClicked(source = 'unknown') {
    this.event('Conversion', 'Upgrade_Button_Clicked', source);
  }

  trackPricingPageViewed() {
    this.event('Pricing', 'Page_Viewed');
  }

  trackCheckoutStarted() {
    this.event('Conversion', 'Checkout_Started');
  }

  trackCheckoutCompleted(subscriptionId) {
    this.event('Conversion', 'Checkout_Completed', subscriptionId);
  }

  trackSubscriptionCancelled() {
    this.event('Subscription', 'Cancelled');
  }

  // User Engagement
  trackChatMessage(messageCount) {
    this.event('Engagement', 'Chat_Message_Sent', null, messageCount);
  }

  trackFeatureUsed(featureName) {
    this.event('Engagement', 'Feature_Used', featureName);
  }

  // Traffic Source Tracking
  trackLandingPageView(utmSource = null, utmMedium = null, utmCampaign = null) {
    const params = new URLSearchParams(window.location.search);
    const source = utmSource || params.get('utm_source') || 'direct';
    const medium = utmMedium || params.get('utm_medium') || 'none';
    const campaign = utmCampaign || params.get('utm_campaign') || 'none';

    this.event('Traffic', 'Landing_Page_View', `${source}_${medium}_${campaign}`);
  }

  // Error Tracking
  trackError(errorType, errorMessage) {
    this.event('Error', errorType, errorMessage);
  }

  // Set user properties (for logged-in users)
  setUserProperties(properties) {
    if (!this.initialized) return;

    try {
      ReactGA.set(properties);
      console.log('[Analytics] User properties set:', properties);
    } catch (error) {
      console.error('[Analytics] Setting user properties failed:', error);
    }
  }

  // Set user ID (for cross-device tracking)
  setUserId(userId) {
    if (!this.initialized) return;

    try {
      ReactGA.set({ userId });
      console.log('[Analytics] User ID set:', userId);
    } catch (error) {
      console.error('[Analytics] Setting user ID failed:', error);
    }
  }
}

// Create singleton instance
const analytics = new Analytics();

export default analytics;

import { API_BASE_URL } from '../config';
import authService from './auth';

console.log('[API DEBUG] API_BASE_URL from config:', API_BASE_URL);

class ApiService {
  constructor() {
    this.baseUrl = API_BASE_URL;
    this.conversationId = null;
    console.log('[API DEBUG] ApiService initialized with baseUrl:', this.baseUrl);
  }

  /**
   * Get authorization headers with JWT token
   */
  async getAuthHeaders() {
    try {
      const idToken = await authService.getIdToken();
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      };
    } catch (error) {
      console.error('[API DEBUG] Failed to get auth token:', error);
      throw new Error('Authentication required');
    }
  }

  /**
   * Handle API errors, including 401 Unauthorized
   */
  handleApiError(response, errorText) {
    if (response.status === 401) {
      // Clear auth and reload to show login
      authService.signOut();
      window.location.reload();
      throw new Error('Session expired. Please log in again.');
    }
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }

  async sendMessage(message) {
    console.log('[API DEBUG] ========== sendMessage START ==========');
    console.log('[API DEBUG] Message:', message);
    console.log('[API DEBUG] baseUrl:', this.baseUrl);
    console.log('[API DEBUG] Current conversationId:', this.conversationId);
    console.log('[API DEBUG] typeof conversationId:', typeof this.conversationId);

    try {
      const url = `${this.baseUrl}/conversation`;
      const payload = {
        message,
        conversation_id: this.conversationId
      };

      console.log('[API DEBUG] Constructed URL:', url);
      console.log('[API DEBUG] Payload object:', payload);
      console.log('[API DEBUG] Payload JSON:', JSON.stringify(payload));
      console.log('[API DEBUG] Payload JSON length:', JSON.stringify(payload).length);

      console.log('[API DEBUG] Getting auth headers...');
      const headers = await this.getAuthHeaders();
      console.log('[API DEBUG] Auth headers obtained');

      console.log('[API DEBUG] About to call fetch...');
      const fetchStart = Date.now();

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const fetchEnd = Date.now();
      console.log('[API DEBUG] Fetch completed in', fetchEnd - fetchStart, 'ms');
      console.log('[API DEBUG] Response status:', response.status);
      console.log('[API DEBUG] Response statusText:', response.statusText);
      console.log('[API DEBUG] Response ok:', response.ok);
      console.log('[API DEBUG] Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API DEBUG] Response error text:', errorText);
        console.error('[API DEBUG] Request failed with status:', response.status);
        this.handleApiError(response, errorText);
      }

      console.log('[API DEBUG] Parsing response JSON...');
      const data = await response.json();
      console.log('[API DEBUG] Response data:', JSON.stringify(data, null, 2));

      // Store conversation ID for follow-up messages
      if (data.conversation_id) {
        console.log('[API DEBUG] Response contains conversation_id:', data.conversation_id);
        console.log('[API DEBUG] Previous conversationId:', this.conversationId);
        this.conversationId = data.conversation_id;
        console.log('[API DEBUG] Updated conversationId to:', this.conversationId);
        console.log('[API DEBUG] Verification - this.conversationId is now:', this.conversationId);
      } else {
        console.log('[API DEBUG] Response does NOT contain conversation_id');
      }

      console.log('[API DEBUG] ========== sendMessage SUCCESS ==========');
      return data;
    } catch (error) {
      console.error('[API DEBUG] !!!!! API call FAILED !!!!!');
      console.error('[API DEBUG] Error type:', error.constructor.name);
      console.error('[API DEBUG] Error message:', error.message);
      console.error('[API DEBUG] Error stack:', error.stack);
      console.error('[API DEBUG] Full error object:', error);
      console.error('[API DEBUG] ========== sendMessage ERROR ==========');
      throw error;
    }
  }

  async createInvoice(invoiceData) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/invoices`, {
        method: 'POST',
        headers,
        body: JSON.stringify(invoiceData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.handleApiError(response, errorText);
      }

      return await response.json();
    } catch (error) {
      console.error('Create invoice failed:', error);
      throw error;
    }
  }

  async getInvoice(invoiceId) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/invoices/${invoiceId}`, {
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.handleApiError(response, errorText);
      }

      return await response.json();
    } catch (error) {
      console.error('Get invoice failed:', error);
      throw error;
    }
  }

  async listInvoices() {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/invoices`, {
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.handleApiError(response, errorText);
      }

      return await response.json();
    } catch (error) {
      console.error('List invoices failed:', error);
      throw error;
    }
  }

  async generatePdf(invoiceId) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/invoices/${invoiceId}/pdf`, {
        method: 'POST',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.handleApiError(response, errorText);
      }

      return await response.json();
    } catch (error) {
      console.error('Generate PDF failed:', error);
      throw error;
    }
  }

  async downloadInvoicePDF(invoiceId) {
    try {
      // Construct download URL
      const url = `${this.baseUrl}/invoices/${invoiceId}/download`;

      // Make authenticated request - API will return 302 redirect to presigned URL
      const headers = await this.getAuthHeaders();
      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.handleApiError(response, errorText);
      }

      // Fetch follows the redirect automatically and gets the PDF blob
      const blob = await response.blob();

      // Create a download link and trigger download
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `invoice_${invoiceId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the blob URL
      window.URL.revokeObjectURL(downloadUrl);

      return { success: true };
    } catch (error) {
      console.error('Download PDF failed:', error);
      throw error;
    }
  }

  // Subscription methods

  async getSubscription() {
    try {
      console.log('[API] getSubscription - START');
      const headers = await this.getAuthHeaders();

      const url = `${this.baseUrl}/subscription`;
      console.log('[API] Fetching subscription from:', url);

      const response = await fetch(url, {
        headers
      });

      console.log('[API] Response status:', response.status);
      console.log('[API] Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API] Subscription error response:', errorText);
        this.handleApiError(response, errorText);
      }

      const data = await response.json();
      console.log('[API] Subscription data received:', data);
      console.log('[API] getSubscription - SUCCESS');

      return data;
    } catch (error) {
      console.error('[API] Get subscription failed:', error);
      console.error('[API] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async createCheckoutSession(successUrl, cancelUrl) {
    try {
      console.log('[API] createCheckoutSession - START');
      console.log('[API] baseUrl:', this.baseUrl);
      console.log('[API] successUrl:', successUrl);
      console.log('[API] cancelUrl:', cancelUrl);

      const headers = await this.getAuthHeaders();
      console.log('[API] Got auth headers:', Object.keys(headers));

      const requestBody = {
        success_url: successUrl,
        cancel_url: cancelUrl
      };
      console.log('[API] Request body:', requestBody);

      const url = `${this.baseUrl}/checkout`;
      console.log('[API] Full URL:', url);

      console.log('[API] About to call fetch...');
      const fetchStart = performance.now();
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });
      const fetchDuration = performance.now() - fetchStart;
      console.log('[API] Fetch completed in', fetchDuration.toFixed(2), 'ms');

      console.log('[API] Response status:', response.status);
      console.log('[API] Response ok:', response.ok);
      console.log('[API] Response statusText:', response.statusText);
      console.log('[API] Response type:', response.type);
      console.log('[API] Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API] Error response text:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          console.error('[API] Error response JSON:', errorJson);
        } catch (e) {
          console.error('[API] Could not parse error as JSON');
        }
        this.handleApiError(response, errorText);
      }

      console.log('[API] Parsing response body as JSON...');
      let responseData;
      try {
        responseData = await response.json();
        console.log('[API] Response data:', responseData);
        console.log('[API] Response data type:', typeof responseData);
        console.log('[API] Response data keys:', responseData ? Object.keys(responseData) : 'null');
        console.log('[API] Has url field?:', 'url' in (responseData || {}));
        console.log('[API] Has session_id field?:', 'session_id' in (responseData || {}));
        if (responseData && responseData.url) {
          console.log('[API] URL value:', responseData.url);
          console.log('[API] URL type:', typeof responseData.url);
        }
      } catch (parseError) {
        console.error('[API] JSON parse error:', parseError);
        const responseText = await response.text();
        console.error('[API] Raw response text:', responseText);
        throw new Error(`Failed to parse response: ${parseError.message}`);
      }

      console.log('[API] createCheckoutSession - SUCCESS');
      return responseData;
    } catch (error) {
      console.error('[API] ===== CHECKOUT SESSION FAILED =====');
      console.error('[API] Error type:', error.constructor.name);
      console.error('[API] Error name:', error.name);
      console.error('[API] Error message:', error.message);
      console.error('[API] Error stack:', error.stack);
      console.error('[API] Full error object:', error);
      console.error('[API] ===== END ERROR =====');
      throw error;
    }
  }

  async createPortalSession(returnUrl) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/portal`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          return_url: returnUrl
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.handleApiError(response, errorText);
      }

      return await response.json();
    } catch (error) {
      console.error('Create portal session failed:', error);
      throw error;
    }
  }

  async updateInvoiceColor(color) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/invoice-color`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          invoice_color: color
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.handleApiError(response, errorText);
      }

      return await response.json();
    } catch (error) {
      console.error('Update invoice color failed:', error);
      throw error;
    }
  }

  async getProfile() {
    try {
      console.log('[API] getProfile - START');
      const headers = await this.getAuthHeaders();
      console.log('[API] Fetching profile from:', `${this.baseUrl}/profile`);

      const response = await fetch(`${this.baseUrl}/profile`, {
        headers
      });

      console.log('[API] Profile response status:', response.status);
      console.log('[API] Profile response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[API] Profile error response:', errorText);
        this.handleApiError(response, errorText);
      }

      const data = await response.json();
      console.log('[API] Profile data received:', data);
      console.log('[API] Profile data type:', typeof data);
      console.log('[API] Profile data keys:', data ? Object.keys(data) : 'null');
      console.log('[API] getProfile - SUCCESS');

      return data;
    } catch (error) {
      console.error('[API] Get profile failed:', error);
      console.error('[API] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async updateProfile(profileData) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/profile`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(profileData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.handleApiError(response, errorText);
      }

      return await response.json();
    } catch (error) {
      console.error('Update profile failed:', error);
      throw error;
    }
  }

  // Stripe methods

  async getStripeStatus() {
    try {
      console.log('[API] getStripeStatus - START');
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/stripe/status`, {
        headers
      });

      console.log('[API] Stripe status response:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        this.handleApiError(response, errorText);
      }

      const data = await response.json();
      console.log('[API] Stripe status data:', data);
      return data;
    } catch (error) {
      console.error('[API] Get Stripe status failed:', error);
      throw error;
    }
  }

  async connectStripeCallback(code, state) {
    try {
      console.log('[API] connectStripeCallback - START');
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/stripe/callback`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ code, state })
      });

      console.log('[API] Stripe callback response:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        this.handleApiError(response, errorText);
      }

      const data = await response.json();
      console.log('[API] Stripe callback data:', data);
      return data;
    } catch (error) {
      console.error('[API] Stripe callback failed:', error);
      throw error;
    }
  }

  async disconnectStripe() {
    try {
      console.log('[API] disconnectStripe - START');
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/stripe/disconnect`, {
        method: 'POST',
        headers
      });

      console.log('[API] Disconnect Stripe response:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        this.handleApiError(response, errorText);
      }

      const data = await response.json();
      console.log('[API] Disconnect Stripe data:', data);
      return data;
    } catch (error) {
      console.error('[API] Disconnect Stripe failed:', error);
      throw error;
    }
  }

  // Clear conversation for new invoice
  clearConversation() {
    this.conversationId = null;
  }
}

export default new ApiService();

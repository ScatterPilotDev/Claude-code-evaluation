/**
 * LocalStorage utility for conversation management
 * Stores and retrieves the active conversation ID
 */

const STORAGE_KEY = 'activeConversationId';

export const conversationStorage = {
  /**
   * Save the active conversation ID to localStorage
   * @param {string} conversationId - The conversation ID to save
   */
  saveActiveConversation(conversationId) {
    if (!conversationId) {
      this.clearActiveConversation();
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, conversationId);
      console.log('[STORAGE] Saved active conversation:', conversationId);
    } catch (error) {
      console.error('[STORAGE] Failed to save conversation:', error);
    }
  },

  /**
   * Get the active conversation ID from localStorage
   * @returns {string|null} The conversation ID or null if not found
   */
  getActiveConversation() {
    try {
      const conversationId = localStorage.getItem(STORAGE_KEY);
      console.log('[STORAGE] Retrieved active conversation:', conversationId);
      return conversationId;
    } catch (error) {
      console.error('[STORAGE] Failed to get conversation:', error);
      return null;
    }
  },

  /**
   * Clear the active conversation from localStorage
   */
  clearActiveConversation() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('[STORAGE] Cleared active conversation');
    } catch (error) {
      console.error('[STORAGE] Failed to clear conversation:', error);
    }
  },

  /**
   * Check if there's an active conversation stored
   * @returns {boolean}
   */
  hasActiveConversation() {
    return !!this.getActiveConversation();
  }
};

export default conversationStorage;

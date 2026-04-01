import { useState, useEffect } from 'react';
import api from '../services/api';
import authService from '../services/auth';
import { formatDistanceToNow } from 'date-fns';

export default function ConversationList({
  onConversationSelect,
  activeConversationId,
  onNewConversation,
  refreshTrigger
}) {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // Fetch conversations on mount and when refresh trigger changes
  useEffect(() => {
    // Small delay to allow auth to initialize before first fetch
    const timer = setTimeout(() => {
      fetchConversations();
    }, 300);
    return () => clearTimeout(timer);
  }, [refreshTrigger]);

  const isAuthError = (err) => {
    const msg = (err?.message || '').toLowerCase();
    return (
      msg.includes('not authenticated') ||
      msg.includes('authentication required') ||
      msg.includes('no user logged in') ||
      msg.includes('session expired') ||
      msg.includes('cognito not configured') ||
      msg.includes('url is not valid') ||
      msg.includes('user credentials')
    );
  };

  const fetchConversations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Skip fetch if auth is not ready yet
      const authenticated = await authService.isAuthenticated();
      if (!authenticated) {
        setIsLoading(false);
        return;
      }

      const response = await api.listConversations();
      console.log('[CONVERSATIONS] Received conversations:', response);

      // Sort by updated_at descending (most recent first)
      const sortedConversations = (response.conversations || []).sort((a, b) => {
        return new Date(b.updated_at) - new Date(a.updated_at);
      });

      setConversations(sortedConversations);
    } catch (err) {
      console.error('[CONVERSATIONS] Failed to fetch conversations:', err);
      // Silently ignore auth errors — token may not be ready yet
      if (!isAuthError(err)) {
        setError(err.message || 'Failed to load conversations');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConversationClick = (conversation) => {
    onConversationSelect(conversation);
  };

  const handleNewConversationClick = () => {
    onNewConversation();
  };

  // Format relative time
  const formatRelativeTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (e) {
      return 'N/A';
    }
  };

  // Truncate text
  const truncate = (text, maxLength) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  // Get preview text from last message or state
  const getPreviewText = (conversation) => {
    if (conversation.last_message) {
      return truncate(conversation.last_message, 60);
    }
    if (conversation.state) {
      return `State: ${conversation.state}`;
    }
    return 'No messages yet';
  };

  return (
    <div className="mb-6">
      {/* Header with collapse toggle */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 rounded-lg transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          <svg
            className={`w-4 h-4 text-gray-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
            Conversations
          </h3>
        </div>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          {conversations.length}
        </span>
      </div>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="mt-2">
          {/* New Conversation Button */}
          <button
            onClick={handleNewConversationClick}
            className="w-full px-3 py-2 mb-3 bg-gradient-brand hover:bg-gradient-brand-hover text-white font-medium text-sm rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 shadow-md hover:shadow-glow-purple"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Conversation</span>
          </button>

          {/* Conversation List */}
          {isLoading ? (
            <div className="flex items-center justify-center h-24">
              <svg className="animate-spin h-6 w-6 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : error ? (
            <div className="p-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs text-red-600 mb-2">{error}</p>
                <button
                  onClick={fetchConversations}
                  className="text-xs text-red-500 hover:text-red-700 font-medium underline"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-3 text-center">
              <svg
                className="w-12 h-12 text-gray-400 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p className="text-sm text-gray-600">No conversations yet</p>
              <p className="text-xs text-gray-500 mt-1">Start a new chat to begin</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {conversations.map((conversation) => (
                <button
                  key={conversation.conversation_id}
                  onClick={() => handleConversationClick(conversation)}
                  className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                    activeConversationId === conversation.conversation_id
                      ? 'bg-purple-50 border-l-4 border-purple-500 shadow-sm'
                      : 'border-l-4 border-transparent hover:bg-gray-50'
                  }`}
                >
                  <div className="space-y-1.5">
                    {/* Preview Text */}
                    <div className="text-sm text-gray-900 font-medium leading-snug">
                      {getPreviewText(conversation)}
                    </div>

                    {/* Meta info */}
                    <div className="flex items-center justify-between text-xs">
                      {/* Message Count Badge */}
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center space-x-1 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                          </svg>
                          <span>{conversation.message_count || 0}</span>
                        </span>

                        {/* State badge if available */}
                        {conversation.state && (
                          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">
                            {conversation.state}
                          </span>
                        )}
                      </div>

                      {/* Relative Time */}
                      <span className="text-gray-500">
                        {formatRelativeTime(conversation.updated_at)}
                      </span>
                    </div>
                  </div>

                  {/* Resume indicator for active conversation */}
                  {activeConversationId === conversation.conversation_id && (
                    <div className="mt-2 text-xs text-purple-600 font-medium flex items-center space-x-1">
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                      <span>Active</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

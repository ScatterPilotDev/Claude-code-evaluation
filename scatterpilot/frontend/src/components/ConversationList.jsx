import { useState, useEffect } from 'react';
import api from '../services/api';
import authService from '../services/auth';
import { formatDistanceToNow } from 'date-fns';

export default function ConversationList({
  onConversationSelect,
  activeConversationId,
  refreshTrigger
}) {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
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
      const authenticated = await authService.isAuthenticated();
      if (!authenticated) {
        setIsLoading(false);
        return;
      }
      const response = await api.listConversations();
      const sortedConversations = (response.conversations || []).sort((a, b) =>
        new Date(b.updated_at) - new Date(a.updated_at)
      );
      setConversations(sortedConversations);
    } catch (err) {
      console.error('[CONVERSATIONS] Failed to fetch conversations:', err);
      if (!isAuthError(err)) {
        setError(err.message || 'Failed to load conversations');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatRelativeTime = (dateString) => {
    if (!dateString) return '';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return '';
    }
  };

  const truncate = (text, max) => {
    if (!text) return '';
    return text.length > max ? text.substring(0, max) + '…' : text;
  };

  const getPreviewText = (conversation) => {
    if (conversation.last_message) return truncate(conversation.last_message, 55);
    if (conversation.state) return `State: ${conversation.state}`;
    return 'No messages yet';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-16">
        <svg className="animate-spin h-5 w-5 text-sage" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-2">
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs text-red-700 mb-1">{error}</p>
          <button onClick={fetchConversations} className="text-xs text-red-600 hover:text-red-700 font-medium underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 px-3 text-center">
        <svg className="w-8 h-8 text-navy-muted mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p className="text-xs text-navy-muted">No conversations yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {conversations.map((conversation) => {
        const isActive = activeConversationId === conversation.conversation_id;
        return (
          <button
            key={conversation.conversation_id}
            onClick={() => onConversationSelect(conversation)}
            className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 ${
              isActive
                ? 'bg-sage-light text-navy border border-sage/30'
                : 'text-navy-light hover:bg-cream hover:text-navy'
            }`}
          >
            <p className="text-sm font-medium text-navy truncate leading-snug">
              {getPreviewText(conversation)}
            </p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-navy-muted">
                {conversation.message_count || 0} messages
              </span>
              <span className="text-xs text-navy-muted">
                {formatRelativeTime(conversation.updated_at)}
              </span>
            </div>
            {isActive && (
              <div className="mt-1 flex items-center gap-1 text-xs text-sage font-medium">
                <div className="w-1.5 h-1.5 bg-sage rounded-full animate-pulse" />
                Active
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

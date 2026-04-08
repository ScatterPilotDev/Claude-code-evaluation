import { useState, useEffect } from 'react';
import { TrashIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import authService from '../services/auth';
import { formatDistanceToNow } from 'date-fns';

export default function ConversationList({
  onConversationSelect,
  onConversationDelete,
  activeConversationId,
  refreshTrigger
}) {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

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

  const handleDelete = async (e, conversationId) => {
    e.stopPropagation();
    if (confirmDeleteId !== conversationId) {
      setConfirmDeleteId(conversationId);
      return;
    }
    setConfirmDeleteId(null);
    setDeletingId(conversationId);
    try {
      await api.deleteConversation(conversationId);
      setConversations(prev => prev.filter(c => c.conversation_id !== conversationId));
      if (onConversationDelete) onConversationDelete(conversationId);
    } catch (err) {
      console.error('[CONVERSATIONS] Failed to delete:', err);
    } finally {
      setDeletingId(null);
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

  const isJsonContent = (text) => {
    if (!text) return false;
    const t = text.trim();
    return t.startsWith('{') || (t.includes('"action"') && t.includes('"create_invoice"'));
  };

  const extractCustomerName = (text) => {
    if (!text) return null;
    const m = text.match(/"customer_name"\s*:\s*"([^"]+)"/);
    return m ? m[1] : null;
  };

  const getConversationTitle = (conversation) => {
    const { first_user_message, last_message, message_count, state, has_invoice } = conversation;

    if (!message_count || message_count === 0 || state === 'initiated') {
      return 'New conversation';
    }

    if (first_user_message) {
      return truncate(first_user_message, 40);
    }

    if (isJsonContent(last_message)) {
      const customer = extractCustomerName(last_message);
      if (customer) return truncate(`${customer} invoice`, 40);
      return 'Invoice conversation';
    }

    if (last_message) {
      return truncate(last_message, 40);
    }

    return 'Invoice conversation';
  };

  // Group conversations by customer_name
  const groupedConversations = () => {
    const groups = {};
    const ungroupedKey = '__other__';

    for (const conv of conversations) {
      const key = conv.customer_name || ungroupedKey;
      if (!groups[key]) groups[key] = [];
      groups[key].push(conv);
    }

    // Build ordered list: named groups (sorted by most recent conv) first, then ungrouped
    const namedGroups = Object.entries(groups)
      .filter(([k]) => k !== ungroupedKey)
      .sort((a, b) => {
        const aLatest = new Date(a[1][0].updated_at);
        const bLatest = new Date(b[1][0].updated_at);
        return bLatest - aLatest;
      });

    const result = namedGroups;
    if (groups[ungroupedKey]) {
      result.push([null, groups[ungroupedKey]]);
    }
    return result;
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

  const groups = groupedConversations();

  return (
    <div className="space-y-0.5">
      {/* Dismiss confirm-delete on click outside */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setConfirmDeleteId(null)}
        />
      )}

      {groups.map(([groupName, groupConvs]) => (
        <div key={groupName || '__other__'}>
          {groupName && (
            <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-navy-muted uppercase tracking-wider truncate">
              {groupName}
            </p>
          )}
          {groupConvs.map((conversation) => {
            const isActive = activeConversationId === conversation.conversation_id;
            const isDeleting = deletingId === conversation.conversation_id;
            const isConfirming = confirmDeleteId === conversation.conversation_id;

            return (
              <div key={conversation.conversation_id} className="relative group">
                <button
                  onClick={() => onConversationSelect(conversation)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200 pr-8 ${
                    isActive
                      ? 'bg-sage-light text-navy border border-sage/30'
                      : 'text-navy-light hover:bg-cream hover:text-navy'
                  }`}
                >
                  <p className="text-sm font-medium text-navy truncate leading-snug">
                    {getConversationTitle(conversation)}
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

                {/* Delete button — visible on hover or while confirming */}
                <button
                  onClick={(e) => handleDelete(e, conversation.conversation_id)}
                  disabled={isDeleting}
                  title={isConfirming ? 'Click again to confirm delete' : 'Delete conversation'}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 z-20 p-1 rounded transition-all duration-150 ${
                    isConfirming
                      ? 'opacity-100 text-red-600 bg-red-50'
                      : 'opacity-0 group-hover:opacity-100 text-navy-muted hover:text-red-600 hover:bg-red-50'
                  } ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

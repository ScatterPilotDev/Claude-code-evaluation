import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import apiService from '../services/api';
import analytics from '../utils/analytics';
import { isMobileDevice } from '../utils/deviceDetection';

const ChatInterface = forwardRef(({ onInvoiceGenerated, viewMode = 'new', onNewInvoice }, ref) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I can help you generate invoices. Just tell me the details like client name, items, and amounts.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const messagesEndRef = useRef(null);

  // Detect if device is mobile
  const isMobile = useMemo(() => isMobileDevice(), []);

  // Update messages when switching modes
  useEffect(() => {
    console.log('[CHAT] useEffect triggered - viewMode:', viewMode);

    // Only reset messages when explicitly switching to viewing mode
    // Don't reset when going from 'new' to 'created' (invoice just generated)
    if (viewMode === 'viewing') {
      console.log('[CHAT] Switching to viewing mode - showing read-only state');
      // Messages will be hidden by the UI in viewing mode
    }
  }, [viewMode]);

  // Expose reset method to parent
  useImperativeHandle(ref, () => ({
    resetConversation: () => {
      apiService.conversationId = null;
      setMessages([
        { role: 'assistant', content: 'Hi! I can help you generate invoices. Just tell me the details like client name, items, and amounts.' }
      ]);
      setInput('');
    }
  }));

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Debug state changes
  useEffect(() => {
    console.log('[DEBUG STATE] Messages state changed. New count:', messages.length);
    console.log('[DEBUG STATE] Latest message:', messages[messages.length - 1]);
  }, [messages]);

  useEffect(() => {
    console.log('[DEBUG STATE] Loading state changed to:', loading);
  }, [loading]);

  useEffect(() => {
    console.log('[DEBUG STATE] Input state changed to:', input);
  }, [input]);

  const handleSend = async () => {
    console.log('[DEBUG] ========== handleSend called ==========');
    console.log('[DEBUG] Current input:', input);
    console.log('[DEBUG] Current loading state:', loading);
    console.log('[DEBUG] Current messages count:', messages.length);
    console.log('[DEBUG] Current conversationId in apiService:', apiService.conversationId);

    if (!input.trim() || loading) {
      console.log('[DEBUG] handleSend early return - empty input or loading:', { emptyInput: !input.trim(), loading });
      return;
    }

    const userMessage = input.trim();
    console.log('[DEBUG] Sending message:', userMessage);
    console.log('[DEBUG] Clearing input and updating state...');

    setInput('');
    setMessages(prev => {
      console.log('[DEBUG] setMessages called, adding user message. Previous count:', prev.length);
      return [...prev, { role: 'user', content: userMessage }];
    });
    setLoading(true);
    console.log('[DEBUG] State updates queued (input cleared, user message added, loading set to true)');

    try {
      console.log('[DEBUG] About to call apiService.sendMessage');
      console.log('[DEBUG] ConversationId before API call:', apiService.conversationId);

      // Call the real API
      const data = await apiService.sendMessage(userMessage);
      console.log('[DEBUG] API response received:', data);
      console.log('[DEBUG] ConversationId after API call:', apiService.conversationId);

      setMessages(prev => {
        console.log('[DEBUG] setMessages called, adding assistant response. Previous count:', prev.length);
        return [...prev, {
          role: 'assistant',
          content: data.message || data.response
        }];
      });

      // Handle usage limit reached - show upgrade prompt
      if (data.usage_limit_reached) {
        console.log('[DEBUG] Usage limit reached, showing upgrade prompt');
        setMessages(prev => [...prev, {
          role: 'system',
          content: 'upgrade_prompt' // Special marker for upgrade UI
        }]);
        return;
      }

      // If the API returned invoice_ready: true, pass invoice data to preview
      if (data.invoice_ready && data.invoice_data) {
        console.log('[DEBUG] Invoice ready, calling onInvoiceGenerated');

        // Track invoice creation
        analytics.trackInvoiceCreated(data.invoice_id);

        // Add success message to chat
        setMessages(prev => [...prev, {
          role: 'system',
          content: '✓ Invoice created successfully! You can now download the PDF or create a new invoice.'
        }]);

        onInvoiceGenerated({
          invoice_id: data.invoice_id,
          invoice_data: data.invoice_data,
          data: data.invoice_data // Also pass as 'data' for InvoicePreview
        });

        // Show warning toast if running low on invoices (1-2 left)
        if (data.invoices_remaining !== undefined && data.invoices_remaining <= 2 && data.invoices_remaining > 0) {
          setToastMessage(`⚠️ Only ${data.invoices_remaining} invoice${data.invoices_remaining === 1 ? '' : 's'} left on free plan! Upgrade to Pro for unlimited invoices.`);
          setShowToast(true);
          setTimeout(() => setShowToast(false), 8000); // Hide after 8 seconds
        }
      }
    } catch (error) {
      console.error('[DEBUG] !!!!! Error sending message !!!!!');
      console.error('[DEBUG] Error details:', error);
      console.error('[DEBUG] Error message:', error.message);
      console.error('[DEBUG] Error stack:', error.stack);

      setMessages(prev => {
        console.log('[DEBUG] setMessages called, adding error message. Previous count:', prev.length);
        return [...prev, {
          role: 'assistant',
          content: 'Sorry, there was an error connecting to the API. Please check your API configuration in .env and try again.'
        }];
      });
    } finally {
      console.log('[DEBUG] handleSend finished, setting loading to false');
      setLoading(false);
      console.log('[DEBUG] ========== handleSend complete ==========');
    }
  };

  const handleKeyDown = (e) => {
    // On mobile: Enter creates new line, only Send button submits
    // On desktop: Enter submits, Shift+Enter creates new line
    if (e.key === 'Enter' && !isMobile && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Filter out JSON-like messages from display
  const filterMessage = (content) => {
    // Remove markdown code blocks containing JSON
    let filtered = content;

    // Remove ```json ... ``` blocks
    filtered = filtered.replace(/```json\s*\n[\s\S]*?\n```/g, '');

    // Remove ``` ... ``` blocks that contain JSON
    filtered = filtered.replace(/```\s*\n?\s*(\{[\s\S]*?\}|\[[\s\S]*?\])\s*\n?```/g, '');

    // Trim the result
    filtered = filtered.trim();

    // If content looks like raw JSON (starts with { or [), try to parse and filter
    if (filtered.startsWith('{') || filtered.startsWith('[')) {
      try {
        JSON.parse(filtered);
        // It's valid JSON, don't display it
        return null;
      } catch (e) {
        // Not valid JSON, display as-is
        return filtered;
      }
    }

    // If after filtering we have no content, return null
    if (!filtered) {
      return null;
    }

    return filtered;
  };

  // Filter messages for display
  const displayMessages = messages.filter(msg => {
    const filtered = filterMessage(msg.content);
    return filtered !== null;
  });

  console.log('[CHAT] Rendering - viewMode:', viewMode, 'messages count:', messages.length);

  return (
    <div className="flex flex-col h-full bg-cream">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-navy">
              {viewMode === 'viewing' ? 'Historical Invoice' : viewMode === 'created' ? 'Invoice Created!' : 'Invoice Generator'}
            </h2>
            <p className="text-sm text-navy-light">
              {viewMode === 'viewing'
                ? 'Viewing a previously generated invoice'
                : viewMode === 'created'
                ? 'Your invoice is ready - check the preview panel'
                : 'Chat with AI to create your invoice'}
            </p>
          </div>
          {viewMode === 'viewing' && onNewInvoice && (
            <button
              onClick={onNewInvoice}
              className="px-4 py-2 bg-sage hover:bg-sage-dark text-white font-semibold rounded-lg transition-all duration-200 flex items-center space-x-2 shadow-md"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>New Invoice</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {viewMode === 'viewing' ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md p-8 bg-white rounded-xl border border-gray-200 shadow-md">
              <svg
                className="mx-auto h-16 w-16 text-sage mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="text-lg font-semibold text-navy mb-2">Invoice from History</h3>
              <p className="text-sm text-navy-light mb-4">
                You're viewing a previously generated invoice. The full invoice details are displayed on the right.
              </p>
              <p className="text-xs text-navy-muted">
                Click "New Invoice" above to create a new invoice.
              </p>
            </div>
          </div>
        ) : (
          <>
            {displayMessages.map((msg, idx) => {
              // Special handling for upgrade prompt
              if (msg.role === 'system' && msg.content === 'upgrade_prompt') {
                return (
                  <div key={idx} className="flex justify-center">
                    <div className="max-w-md p-6 bg-white rounded-xl border-2 border-purple-500/30 shadow-glow-purple">
                      <div className="text-center">
                        <div className="text-4xl mb-4">🚀</div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                          You've used all 5 free invoices!
                        </h3>
                        <p className="text-navy-light mb-6">
                          Upgrade to Pro for unlimited invoices at just <span className="font-bold text-sage">$18/month</span>
                        </p>
                        <div className="flex flex-col space-y-3">
                          <button
                            onClick={() => {
                              analytics.trackUpgradeClicked('usage_limit_prompt');
                              navigate('/pricing');
                            }}
                            className="w-full px-6 py-3 bg-sage hover:bg-sage-dark text-white font-semibold rounded-lg transition-all duration-200 shadow-md"
                          >
                            Upgrade to Pro
                          </button>
                          <button
                            onClick={() => {
                              analytics.event('CTA', 'Click', 'View_Pricing_From_Limit');
                              navigate('/pricing');
                            }}
                            className="w-full px-6 py-2 text-navy-light font-medium hover:text-navy transition-colors"
                          >
                            View Pricing
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 shadow-md ${
                      msg.role === 'user'
                        ? 'bg-sage text-white'
                        : msg.role === 'system'
                        ? 'bg-green-100 text-green-800 border border-green-300'
                        : 'bg-white text-navy border border-gray-200'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown
                        components={{
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                          strong: ({node, ...props}) => (
                            <strong className="font-semibold text-purple-300" {...props} />
                          ),
                          em: ({node, ...props}) => (
                            <em className="italic text-purple-200" {...props} />
                          ),
                          ul: ({node, ...props}) => (
                            <ul className="list-disc ml-4 my-2 space-y-1" {...props} />
                          ),
                          ol: ({node, ...props}) => (
                            <ol className="list-decimal ml-4 my-2 space-y-1" {...props} />
                          ),
                          li: ({node, ...props}) => <li className="my-0.5" {...props} />,
                          code: ({node, inline, ...props}) =>
                            inline ? (
                              <code
                                className="bg-purple-900/40 px-1.5 py-0.5 rounded text-sm font-mono text-purple-200"
                                {...props}
                              />
                            ) : (
                              <code
                                className="block bg-purple-900/40 p-3 rounded my-2 text-sm font-mono overflow-x-auto text-purple-100"
                                {...props}
                              />
                            ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="flex justify-start animate-fade-in">
                <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-md">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-sage rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-sage rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-sage rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-gray-200">
        {viewMode === 'viewing' ? (
          <div className="flex items-center justify-center py-3 text-sm text-navy-light bg-white rounded-lg border border-gray-200">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Read-only mode - Click "New Invoice" to create a new invoice
          </div>
        ) : viewMode === 'created' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center py-3 text-sm text-green-700 bg-green-100 rounded-lg border border-green-300">
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Invoice created successfully!
            </div>
            <button
              onClick={onNewInvoice}
              className="w-full px-4 py-3 bg-sage hover:bg-sage-dark text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 shadow-md"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Create New Invoice</span>
            </button>
          </div>
        ) : (
          <div className="flex space-x-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isMobile ? "Describe your invoice details..." : "Describe your invoice details... (Enter to send, Shift+Enter for new line)"}
              className="flex-1 px-4 py-3 bg-white border border-gray-300 rounded-lg text-navy placeholder-navy-muted focus:outline-none focus:ring-2 focus:ring-sage focus:border-sage resize-none transition-all duration-200"
              rows="2"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="px-6 py-2 bg-sage hover:bg-sage-dark text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md font-medium"
            >
              Send
            </button>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
          <div className="bg-orange-100 border-2 border-orange-400 rounded-lg shadow-2xl p-4 max-w-md">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 text-2xl">⚠️</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-orange-900 mb-2">
                  {toastMessage}
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      analytics.trackUpgradeClicked('low_invoice_toast');
                      navigate('/pricing');
                      setShowToast(false);
                    }}
                    className="px-3 py-1.5 bg-orange-600 text-white text-xs font-semibold rounded hover:bg-orange-700 transition-colors"
                  >
                    Upgrade Now
                  </button>
                  <button
                    onClick={() => setShowToast(false)}
                    className="px-3 py-1.5 text-orange-800 text-xs font-medium hover:text-orange-900 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

ChatInterface.displayName = 'ChatInterface';

export default ChatInterface;

import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import apiService from '../services/api';
import analytics from '../utils/analytics';
import { isMobileDevice } from '../utils/deviceDetection';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { useVoiceOutput } from '../hooks/useVoiceOutput';

const INITIAL_MESSAGE = {
  role: 'assistant',
  content: "Hi! Who are you invoicing today, and what are you billing for?"
};

const ChatInterface = forwardRef(({ onInvoiceGenerated, viewMode = 'new', onNewInvoice, onMessageSent }, ref) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [customerName, setCustomerName] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const isMobile = useMemo(() => isMobileDevice(), []);

  // Voice state
  const [voiceMode, setVoiceMode] = useState(false);
  const [currentlySpeakingMessageId, setCurrentlySpeakingMessageId] = useState(null);

  const { speak, stop: stopSpeaking, isSpeaking } = useVoiceOutput();

  const { isListening, isSupported: voiceInputSupported, interimTranscript, toggleListening, startListening } = useVoiceInput({
    onTranscript: (text) => {
      setInput(prev => prev + (prev ? ' ' : '') + text);
    },
    onEnd: () => {
      // When recognition ends due to voice mode, we'll auto-resume after AI speaks
    },
  });

  useImperativeHandle(ref, () => ({
    resetConversation: () => {
      apiService.conversationId = null;
      setCustomerName(null);
      setMessages([INITIAL_MESSAGE]);
      setInput('');
    },
    loadConversation: (conversationMessages, conversationId, customer = null) => {
      if (conversationId) apiService.conversationId = conversationId;
      setCustomerName(customer || null);
      const mapped = (conversationMessages || []).map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      setMessages(mapped.length > 0 ? mapped : [INITIAL_MESSAGE]);
      setInput('');
    },
    prefillInput: (text) => {
      setInput(text);
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    setCustomerContext: (name) => {
      setCustomerName(name || null);
    }
  }));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Voice output: speak latest AI message when in voice mode
  const latestAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return { text: messages[i].content, id: i };
    }
    return null;
  }, [messages]);

  const prevLatestAssistantIdRef = useRef(null);

  useEffect(() => {
    if (voiceMode && latestAssistantMessage && latestAssistantMessage.id !== prevLatestAssistantIdRef.current) {
      prevLatestAssistantIdRef.current = latestAssistantMessage.id;
      setCurrentlySpeakingMessageId(latestAssistantMessage.id);
      speak(latestAssistantMessage.text);
    }
  }, [latestAssistantMessage, voiceMode]);

  // Auto-resume listening after AI finishes speaking
  useEffect(() => {
    if (voiceMode && !isSpeaking && currentlySpeakingMessageId !== null && !isListening && !loading) {
      startListening();
    }
  }, [isSpeaking, voiceMode]);

  const handleSend = async (sentViaVoice = false) => {
    if (!input.trim() || loading) return;

    // If user typed manually (not via voice), exit voice mode
    if (!sentViaVoice && voiceMode) {
      setVoiceMode(false);
      stopSpeaking();
    }

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const data = await apiService.sendMessage(userMessage);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message || data.response
      }]);

      if (data.usage_limit_reached) {
        setMessages(prev => [...prev, { role: 'system', content: 'upgrade_prompt' }]);
        return;
      }

      if (data.invoice_ready && data.invoice_data) {
        analytics.trackInvoiceCreated(data.invoice_id);
        setMessages(prev => [...prev, { role: 'system', content: 'invoice_created' }]);
        onInvoiceGenerated({
          invoice_id: data.invoice_id,
          invoice_data: data.invoice_data,
          data: data.invoice_data,
          status: 'draft',
        });

        if (data.invoices_remaining !== undefined && data.invoices_remaining <= 2 && data.invoices_remaining > 0) {
          setToastMessage(`Only ${data.invoices_remaining} invoice${data.invoices_remaining === 1 ? '' : 's'} left on your free plan.`);
          setShowToast(true);
          setTimeout(() => setShowToast(false), 8000);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Something went wrong — please try again."
      }]);
    } finally {
      setLoading(false);
      if (onMessageSent) onMessageSent();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !isMobile && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Strip JSON blocks the user shouldn't see
  const filterMessage = (content) => {
    let filtered = content;
    filtered = filtered.replace(/```json\s*\n[\s\S]*?\n```/g, '');
    filtered = filtered.replace(/```\s*\n?\s*(\{[\s\S]*?\}|\[[\s\S]*?\])\s*\n?```/g, '');
    filtered = filtered.trim();

    if (filtered.startsWith('{') || filtered.startsWith('[')) {
      if (filtered.includes('"action"') && filtered.includes('"create_invoice"')) return null;
      try { JSON.parse(filtered); return null; } catch { return filtered; }
    }
    return filtered || null;
  };

  const displayMessages = messages.filter(msg => filterMessage(msg.content) !== null);

  const lastInvoiceCreatedIdx = displayMessages.reduce(
    (last, m, i) => (m.role === 'system' && m.content === 'invoice_created' ? i : last), -1
  );

  const placeholder = viewMode === 'created'
    ? (isMobile ? 'Ask to change something…' : 'Ask to change something… (Enter to send)')
    : (isMobile ? 'Who are you invoicing?' : 'Who are you invoicing? (Enter to send)');

  return (
    <div className="flex flex-col h-full bg-surface-bg">

      {/* Customer context banner */}
      {customerName && viewMode !== 'viewing' && (
        <div className="px-5 py-2.5 bg-sage-50 border-b border-sage-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-sage-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="text-body-sm text-sage-600 font-medium">Invoicing {customerName}</span>
          </div>
          <button onClick={() => setCustomerName(null)}
            className="text-ink-tertiary hover:text-ink-secondary transition-colors p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Clear customer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-5 py-5 space-y-4">
        {viewMode === 'viewing' ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm p-8 bg-surface-card rounded-card border border-surface-border">
              <svg className="mx-auto h-12 w-12 text-sage-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-heading font-semibold text-ink-primary mb-1">Past Invoice</h3>
              <p className="text-body-sm text-ink-secondary">The full invoice is shown above.</p>
              {onNewInvoice && (
                <button onClick={onNewInvoice}
                  className="mt-4 px-4 py-2 bg-sage-500 text-white text-body-sm font-medium rounded-button hover:bg-sage-600 transition-colors min-h-[44px]">
                  Create New Invoice
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {displayMessages.map((msg, idx) => {

              // Invoice created confirmation
              if (msg.role === 'system' && msg.content === 'invoice_created') {
                const isLatest = idx === lastInvoiceCreatedIdx;
                return (
                  <motion.div key={idx}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start">
                    <div className="max-w-[80%] rounded-2xl px-4 py-3.5 bg-green-50 border border-green-200 text-green-800">
                      <div className="flex items-start gap-2.5">
                        <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <p className="text-sm font-semibold">Invoice ready.</p>
                          <p className="text-xs text-green-700 mt-0.5">Download or send it to your client from the panel on the right.</p>
                          {isLatest && (
                            <button
                              onClick={() => setInput('Create another invoice for the same client')}
                              className="mt-2.5 text-xs text-green-700 hover:text-green-900 border border-green-300 hover:border-green-400 bg-white hover:bg-green-50 rounded-lg px-2.5 py-1.5 transition-all duration-150 min-h-[36px]"
                            >
                              + Another invoice for this client
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              }

              // Usage limit prompt
              if (msg.role === 'system' && msg.content === 'upgrade_prompt') {
                return (
                  <motion.div key={idx}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="flex justify-center">
                    <div className="max-w-sm w-full p-6 bg-white rounded-2xl border border-gray-200 shadow-light-sm text-center">
                      <p className="text-2xl mb-3">🚀</p>
                      <h3 className="text-base font-bold text-navy mb-1">You've used all 5 free invoices</h3>
                      <p className="text-sm text-navy-light mb-5">
                        Upgrade to Pro for unlimited invoices at <span className="font-semibold text-sage">$18/month</span>
                      </p>
                      <button
                        onClick={() => { analytics.trackUpgradeClicked('usage_limit_prompt'); navigate('/pricing'); }}
                        className="w-full py-2.5 bg-sage hover:bg-sage-dark text-white font-semibold rounded-xl transition-colors min-h-[44px]"
                      >
                        Upgrade to Pro
                      </button>
                    </div>
                  </motion.div>
                );
              }

              // Regular message bubble
              const filtered = filterMessage(msg.content);
              if (!filtered) return null;

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] rounded-card px-4 py-3 text-body-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-sage-500 text-white rounded-tr-sm'
                      : 'bg-surface-card text-ink-primary border border-surface-border rounded-tl-sm'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <>
                        <ReactMarkdown
                          components={{
                            p: ({node, ...props}) => <p className="mb-2 last:mb-0 text-ink-primary" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-semibold text-ink-primary" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc ml-4 my-2 space-y-1" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal ml-4 my-2 space-y-1" {...props} />,
                            li: ({node, ...props}) => <li className="my-0.5 text-ink-primary" {...props} />,
                            code: ({node, inline, ...props}) =>
                              inline
                                ? <code className="bg-surface-muted px-1 py-0.5 rounded text-xs font-mono text-ink-secondary" {...props} />
                                : <code className="block bg-surface-muted p-3 rounded-card my-2 text-xs font-mono overflow-x-auto text-ink-secondary" {...props} />,
                          }}
                        >
                          {filtered}
                        </ReactMarkdown>
                        {/* Speaking animation indicator */}
                        {isSpeaking && idx === currentlySpeakingMessageId && (
                          <span className="inline-flex items-center gap-1 ml-2 text-sage-500">
                            <span className="w-1 h-3 bg-sage-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1 h-4 bg-sage-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1 h-3 bg-sage-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        )}
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap">{filtered}</p>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* Typing indicator */}
            <AnimatePresence>
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="flex justify-start"
                >
                  <div className="bg-surface-card border border-surface-border rounded-card rounded-tl-sm px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {[0, 0.15, 0.3].map((delay, i) => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 bg-sage-400 rounded-full"
                          animate={{ y: [0, -5, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay, ease: 'easeInOut' }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Voice mode banner */}
      {voiceMode && (
        <div className="flex items-center justify-center gap-2 py-2 bg-sage-50 border-b border-surface-border text-body-sm text-sage-600 flex-shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 0 1 0 7.072M12 9.5v5m-3.536-6.036a5 5 0 0 0 0 7.072M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
          </svg>
          Voice mode active
          <button
            onClick={() => { setVoiceMode(false); stopSpeaking(); }}
            className="text-ink-tertiary hover:text-ink-primary ml-2 text-body-sm"
          >
            Turn off
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="px-4 md:px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-surface-border bg-surface-card flex-shrink-0">
        {viewMode === 'viewing' ? (
          <div className="flex items-center justify-center py-3 text-body-sm text-ink-secondary bg-surface-muted rounded-input min-h-[44px]">
            Read-only — create a new invoice to chat
          </div>
        ) : (
          <div className="relative flex gap-2.5 items-end">
            {/* Listening indicator */}
            {isListening && (
              <div className="absolute -top-8 left-0 flex items-center gap-2 text-body-sm text-danger-400">
                <span className="w-2 h-2 bg-danger-400 rounded-full animate-pulse" />
                Listening...
              </div>
            )}
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  // Typing manually exits voice mode
                  if (voiceMode) {
                    setVoiceMode(false);
                    stopSpeaking();
                  }
                }}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? 'Listening...' : placeholder}
                rows={2}
                disabled={loading}
                className="w-full px-4 py-3 bg-surface-bg border border-surface-border rounded-input text-body-sm text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-1 focus:ring-sage-500/20 focus:border-sage-500 resize-none transition-all duration-150 min-h-[44px]"
              />
              {/* Interim transcript ghost text overlay */}
              {interimTranscript && (
                <div className="absolute bottom-3 left-4 right-4 text-body-sm text-ink-tertiary italic pointer-events-none truncate">
                  {input ? '' : interimTranscript}
                </div>
              )}
            </div>
            {/* Mic button */}
            {voiceInputSupported && (
              <button
                onClick={() => {
                  // If AI is speaking, stop it first
                  if (isSpeaking) stopSpeaking();
                  // Activate voice mode when mic is tapped
                  if (!isListening) setVoiceMode(true);
                  toggleListening();
                }}
                className={`
                  flex items-center justify-center w-10 h-10 rounded-full transition-all duration-150 flex-shrink-0
                  ${isListening
                    ? 'bg-danger-400 text-white animate-pulse'
                    : 'text-ink-tertiary hover:text-ink-secondary hover:bg-surface-hover'
                  }
                  ${isMobile ? 'min-w-[44px] min-h-[44px] w-11 h-11' : ''}
                `}
                title={isListening ? 'Stop recording' : 'Voice input'}
                aria-label={isListening ? 'Stop voice recording' : 'Start voice input'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="22"/>
                </svg>
              </button>
            )}
            <button
              onClick={() => handleSend(false)}
              disabled={!input.trim() || loading}
              className="px-5 py-3 min-h-[44px] bg-sage-500 hover:bg-sage-600 text-white rounded-button disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 font-medium text-body-sm flex-shrink-0"
            >
              Send
            </button>
          </div>
        )}
      </div>

      {/* Low-quota toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
          >
            <div className="bg-amber-50 border border-amber-300 rounded-xl shadow-light-md px-4 py-3.5 flex items-start gap-3">
              <span className="text-amber-500 text-lg flex-shrink-0">⚡</span>
              <div className="flex-1">
                <p className="text-sm text-amber-900 font-medium">{toastMessage}</p>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => { analytics.trackUpgradeClicked('low_invoice_toast'); navigate('/pricing'); setShowToast(false); }}
                    className="text-xs font-semibold text-amber-800 underline hover:no-underline"
                  >
                    Upgrade to Pro
                  </button>
                  <button onClick={() => setShowToast(false)} className="text-xs text-amber-600 hover:text-amber-800">
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

ChatInterface.displayName = 'ChatInterface';
export default ChatInterface;

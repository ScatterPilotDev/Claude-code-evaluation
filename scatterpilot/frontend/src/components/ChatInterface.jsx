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

const SUGGESTION_CHIPS = [
  'Invoice a client for services',
  'Create a recurring invoice',
  'Bill for materials + labor',
];

const ChatInterface = forwardRef(({ onInvoiceGenerated, viewMode = 'new', onNewInvoice, onMessageSent, onConversationActive }, ref) => {
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

  useEffect(() => {
    if (onConversationActive) {
      onConversationActive(messages.length > 1);
    }
  }, [messages]);

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

  // ── SP avatar ────────────────────────────────────────────────────────────────

  const SpAvatar = () => (
    <div className="w-7 h-7 rounded-full bg-sage-500 flex items-center justify-center flex-shrink-0 shadow-sm ring-2 ring-white">
      <span className="text-[9px] font-bold text-white tracking-wide">SP</span>
    </div>
  );

  const UserAvatar = () => (
    <div className="w-7 h-7 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0 ring-2 ring-white">
      <span className="text-[9px] font-bold text-sage-700">U</span>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#F4F7F3]">

      {/* Customer context banner */}
      {customerName && viewMode !== 'viewing' && (
        <div className="px-5 py-2.5 bg-white border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-sage-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="text-[12.5px] text-sage-700 font-medium">Invoicing {customerName}</span>
          </div>
          <button onClick={() => setCustomerName(null)}
            className="text-ink-tertiary hover:text-ink-secondary transition-colors p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Clear customer">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-5 py-5 space-y-4">
        {viewMode === 'viewing' ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm p-8 bg-white rounded-2xl border border-surface-border shadow-sm">
              <svg className="mx-auto h-10 w-10 text-sage-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-[15px] font-semibold text-ink-primary mb-1">Past Invoice</h3>
              <p className="text-[13px] text-ink-secondary">The full invoice is shown above.</p>
              {onNewInvoice && (
                <button onClick={onNewInvoice}
                  className="mt-4 px-5 py-2.5 bg-sage-500 text-white text-[13px] font-medium rounded-full hover:bg-sage-600 transition-colors min-h-[44px]">
                  Create New Invoice
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {displayMessages.map((msg, idx) => {

              // ── Invoice created confirmation ──────────────────────────────
              if (msg.role === 'system' && msg.content === 'invoice_created') {
                const isLatest = idx === lastInvoiceCreatedIdx;
                return (
                  <motion.div key={idx}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="pl-9">
                    <div className="rounded-2xl overflow-hidden border border-sage-200 shadow-sm bg-white">
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-sage-50 border-b border-sage-100">
                        <div className="w-4 h-4 rounded-full bg-sage-500 flex items-center justify-center flex-shrink-0">
                          <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="text-[10.5px] font-bold text-sage-700 uppercase tracking-widest">Invoice Ready</span>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-[12.5px] text-ink-secondary">Your invoice has been created. Download or send it to your client.</p>
                        {isLatest && (
                          <button
                            onClick={() => setInput('Create another invoice for the same client')}
                            className="mt-2 text-[12px] text-sage-600 hover:text-sage-800 font-medium transition-colors"
                          >
                            + Create another for this client →
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              }

              // ── Usage limit prompt ────────────────────────────────────────
              if (msg.role === 'system' && msg.content === 'upgrade_prompt') {
                return (
                  <motion.div key={idx}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="flex justify-center">
                    <div className="max-w-sm w-full p-6 bg-white rounded-2xl border border-surface-border shadow-sm text-center">
                      <div className="w-12 h-12 rounded-full bg-sage-50 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-sage-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <h3 className="text-[15px] font-bold text-ink-primary mb-1">You've used all 5 free invoices</h3>
                      <p className="text-[13px] text-ink-secondary mb-5">
                        Upgrade to Pro for unlimited invoices — <span className="font-semibold text-sage-600">$18/month</span>
                      </p>
                      <button
                        onClick={() => { analytics.trackUpgradeClicked('usage_limit_prompt'); navigate('/pricing'); }}
                        className="w-full py-2.5 bg-sage-500 hover:bg-sage-600 text-white font-semibold rounded-full transition-colors min-h-[44px] text-[13px]"
                      >
                        Upgrade to Pro
                      </button>
                    </div>
                  </motion.div>
                );
              }

              // ── Regular message bubble ────────────────────────────────────
              const filtered = filterMessage(msg.content);
              if (!filtered) return null;

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`flex items-end gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && <SpAvatar />}

                  <div className={`max-w-[78%] text-[13px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#3D5636] text-white rounded-2xl rounded-br-sm px-4 py-3'
                      : 'bg-white border-l-2 border-sage-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm text-ink-primary'
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
                                ? <code className="bg-sage-50 px-1 py-0.5 rounded text-xs font-mono text-sage-700" {...props} />
                                : <code className="block bg-sage-50 p-3 rounded-xl my-2 text-xs font-mono overflow-x-auto text-sage-700" {...props} />,
                          }}
                        >
                          {filtered}
                        </ReactMarkdown>
                        {isSpeaking && idx === currentlySpeakingMessageId && (
                          <span className="inline-flex items-center gap-1 ml-2 text-sage-400">
                            <span className="w-1 h-2.5 bg-sage-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1 h-3.5 bg-sage-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1 h-2.5 bg-sage-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        )}
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap text-white/95">{filtered}</p>
                    )}
                  </div>

                  {msg.role === 'user' && <UserAvatar />}
                </motion.div>
              );
            })}

            {/* Suggestion chips — shown on first open before any conversation */}
            {messages.length === 1 && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.25 }}
                className="pl-9 flex flex-col gap-2 pt-1"
              >
                {SUGGESTION_CHIPS.map((chip, i) => (
                  <motion.button
                    key={chip}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.18 + i * 0.07 }}
                    onClick={() => { setInput(chip); setTimeout(() => inputRef.current?.focus(), 50); }}
                    className="text-left px-3.5 py-2 text-[12.5px] text-sage-700 bg-white border border-sage-200 rounded-xl hover:bg-sage-50 hover:border-sage-300 hover:shadow-sm transition-all duration-150 font-medium w-fit"
                  >
                    {chip} →
                  </motion.button>
                ))}
              </motion.div>
            )}

            {/* Typing indicator */}
            <AnimatePresence>
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-end gap-2.5 justify-start"
                >
                  <SpAvatar />
                  <div className="bg-white border-l-2 border-sage-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-1.5">
                      {[0, 0.2, 0.4].map((delay, i) => (
                        <motion.div
                          key={i}
                          className="w-1.5 h-1.5 bg-sage-400 rounded-full"
                          animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 0.7, repeat: Infinity, delay, ease: 'easeInOut' }}
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
        <div className="flex items-center justify-center gap-2 py-2 bg-sage-50 border-b border-surface-border text-[12.5px] text-sage-600 flex-shrink-0">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 0 1 0 7.072M12 9.5v5m-3.536-6.036a5 5 0 0 0 0 7.072M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
          </svg>
          Voice mode active
          <button
            onClick={() => { setVoiceMode(false); stopSpeaking(); }}
            className="text-ink-tertiary hover:text-ink-primary ml-2 text-[12px]"
          >
            Turn off
          </button>
        </div>
      )}

      {/* Input area — elevated unified container */}
      <div className="px-4 md:px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-surface-border bg-white flex-shrink-0">
        {viewMode === 'viewing' ? (
          <div className="flex items-center justify-center py-3 text-[13px] text-ink-secondary bg-surface-muted rounded-xl min-h-[44px]">
            Read-only — create a new invoice to chat
          </div>
        ) : (
          <div className="relative flex items-end bg-white rounded-xl border border-[#C8CEC3] shadow-sm focus-within:border-sage-400 focus-within:ring-2 focus-within:ring-sage-500/10 transition-all duration-200 overflow-hidden">
            {isListening && (
              <div className="absolute top-2.5 left-4 flex items-center gap-1.5 text-[11px] text-danger-400 font-medium pointer-events-none">
                <span className="w-1.5 h-1.5 bg-danger-400 rounded-full animate-pulse" />
                Listening…
              </div>
            )}
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  if (voiceMode) { setVoiceMode(false); stopSpeaking(); }
                }}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? '' : placeholder}
                rows={2}
                disabled={loading}
                className={`w-full px-4 bg-transparent text-[13px] text-ink-primary placeholder:text-ink-tertiary focus:outline-none resize-none leading-relaxed min-h-[52px] ${isListening ? 'pt-7 pb-2.5' : 'py-3'}`}
              />
              {interimTranscript && (
                <div className="absolute bottom-3 left-4 right-4 text-[13px] text-ink-tertiary italic pointer-events-none truncate">
                  {input ? '' : interimTranscript}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-2 flex-shrink-0">
              {voiceInputSupported && (
                <button
                  onClick={() => {
                    if (isSpeaking) stopSpeaking();
                    if (!isListening) setVoiceMode(true);
                    toggleListening();
                  }}
                  className={`
                    flex items-center justify-center rounded-full transition-all duration-150 flex-shrink-0
                    ${isListening ? 'bg-danger-400 text-white animate-pulse' : 'bg-sage-50 text-sage-500 hover:bg-sage-100'}
                    ${isMobile ? 'w-10 h-10 min-w-[40px] min-h-[40px]' : 'w-8 h-8'}
                  `}
                  title={isListening ? 'Stop recording' : 'Voice input'}
                  aria-label={isListening ? 'Stop voice recording' : 'Start voice input'}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="22"/>
                  </svg>
                </button>
              )}
              <button
                onClick={() => handleSend(false)}
                disabled={!input.trim() || loading}
                className="px-4 py-2 bg-sage-500 hover:bg-sage-600 text-white text-[13px] font-semibold rounded-full disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 min-h-[36px] whitespace-nowrap"
              >
                Send
              </button>
            </div>
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
            <div className="bg-amber-50 border border-amber-300 rounded-2xl shadow-md px-4 py-3.5 flex items-start gap-3">
              <span className="text-amber-500 text-lg flex-shrink-0">⚡</span>
              <div className="flex-1">
                <p className="text-[13px] text-amber-900 font-medium">{toastMessage}</p>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => { analytics.trackUpgradeClicked('low_invoice_toast'); navigate('/pricing'); setShowToast(false); }}
                    className="text-[12px] font-semibold text-amber-800 underline hover:no-underline"
                  >
                    Upgrade to Pro
                  </button>
                  <button onClick={() => setShowToast(false)} className="text-[12px] text-amber-600 hover:text-amber-800">
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

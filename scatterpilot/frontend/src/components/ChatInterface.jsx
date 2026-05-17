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

  const placeholder = 'Message ScatterPilot AI…';

  // ── SP avatar ────────────────────────────────────────────────────────────────

  const SpAvatar = () => (
    <div className="w-7 h-7 rounded-full bg-sage-500 flex items-center justify-center flex-shrink-0 shadow-sm ring-2 ring-white">
      <span className="text-[9px] font-bold text-white tracking-wide">SP</span>
    </div>
  );

  const UserAvatar = () => (
    <div className="w-7 h-7 rounded-full bg-[#F4F7F3] border border-[#E2E5DE] flex items-center justify-center flex-shrink-0">
      <span className="text-[9px] font-bold text-[#4A6741]">U</span>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white">

      {/* Customer context banner */}
      {customerName && viewMode !== 'viewing' && (
        <div className="px-5 py-2.5 bg-[#F4F7F3] border-b border-[#E2E5DE] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-white border border-[#E2E5DE] flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-[#4A6741]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="text-[12.5px] text-[#4A6741] font-medium">Invoicing {customerName}</span>
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
                    className="pl-[40px]">
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
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`flex items-start gap-3 py-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && <SpAvatar />}

                  <div className={`text-[14px] leading-[1.6] text-[#1A2318] ${
                    msg.role === 'user' ? 'max-w-[72%] text-right' : 'flex-1 min-w-0'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <>
                        <ReactMarkdown
                          components={{
                            p: ({node, ...props}) => <p className="mb-2 last:mb-0 text-[#1A2318]" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-semibold text-[#1A2318]" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc ml-4 my-2 space-y-1" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal ml-4 my-2 space-y-1" {...props} />,
                            li: ({node, ...props}) => <li className="my-0.5 text-[#1A2318]" {...props} />,
                            code: ({node, inline, ...props}) =>
                              inline
                                ? <code className="bg-[#F4F7F3] px-1.5 py-0.5 rounded text-[12px] font-mono text-[#4A6741]" {...props} />
                                : <code className="block bg-[#F4F7F3] p-3 rounded-lg my-2 text-[12px] font-mono overflow-x-auto text-[#4A6741]" {...props} />,
                          }}
                        >
                          {filtered}
                        </ReactMarkdown>
                        {isSpeaking && idx === currentlySpeakingMessageId && (
                          <span className="inline-flex items-center gap-1 ml-2 text-[#8BA888]">
                            <span className="w-1 h-2.5 bg-[#8BA888] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1 h-3.5 bg-[#4A6741] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1 h-2.5 bg-[#8BA888] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        )}
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap text-[#1A2318]">{filtered}</p>
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
                className="pl-[40px] flex flex-col gap-1.5 pt-1"
              >
                {SUGGESTION_CHIPS.map((chip, i) => (
                  <motion.button
                    key={chip}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.18 + i * 0.07 }}
                    onClick={() => { setInput(chip); setTimeout(() => inputRef.current?.focus(), 50); }}
                    className="text-left px-3 py-1.5 text-[13px] text-[#4A6741] bg-white border border-[#E2E5DE] rounded-lg hover:border-[#4A6741] hover:bg-[#F4F7F3] transition-all duration-150 w-fit"
                  >
                    {chip}
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
                  <div className="flex items-center gap-1.5 py-2">
                    {[0, 0.2, 0.4].map((delay, i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 bg-[#8BA888] rounded-full"
                        animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 0.7, repeat: Infinity, delay, ease: 'easeInOut' }}
                      />
                    ))}
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
      <div className="px-4 md:px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-[#E2E5DE] bg-white flex-shrink-0">
        {viewMode === 'viewing' ? (
          <div className="flex items-center justify-center py-3 text-[13px] text-[#8A9484] bg-[#F4F7F3] rounded-lg min-h-[44px]">
            Read-only — create a new invoice to chat
          </div>
        ) : (
          <div className="relative flex items-end bg-[#F9FAFB] rounded-lg border border-[#E2E5DE] focus-within:border-[#4A6741] focus-within:ring-1 focus-within:ring-[#4A6741]/20 transition-all duration-200 overflow-hidden">
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
                    flex items-center justify-center rounded-md transition-all duration-150 flex-shrink-0
                    ${isListening ? 'bg-danger-400 text-white animate-pulse' : 'text-[#8BA888] hover:text-[#4A6741]'}
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
                className="px-4 py-2 bg-[#4A6741] hover:bg-[#3D5636] text-white text-[13px] font-medium rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 min-h-[36px] whitespace-nowrap"
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

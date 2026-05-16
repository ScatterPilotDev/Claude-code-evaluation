import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ChatInterface from './ChatInterface';
import InvoicePreview from './InvoicePreview';
import { useBreakpoint } from '../utils/useBreakpoint';
import api from '../services/api';
import conversationStorage from '../utils/conversationStorage';

export default function InvoiceCreationPanel({
  isOpen,
  clientContext,
  onClose,
  onInvoiceCreated,
  subscription,
}) {
  const chatRef = useRef(null);
  const { isMobile } = useBreakpoint();
  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [viewMode, setViewMode] = useState('new');
  const [hasActiveConversation, setHasActiveConversation] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [resumeConversationId, setResumeConversationId] = useState(null);

  // Reset + check for saved conversation when panel opens
  useEffect(() => {
    if (isOpen) {
      setCurrentInvoice(null);
      setViewMode('new');
      setShowCloseConfirm(false);
      setHasActiveConversation(false);

      const savedId = conversationStorage.getActiveConversation();
      if (savedId) {
        setResumeConversationId(savedId);
        setShowResumePrompt(true);
      } else {
        setShowResumePrompt(false);
        setResumeConversationId(null);
        const t = setTimeout(() => {
          if (chatRef.current) {
            chatRef.current.resetConversation();
            if (clientContext) {
              chatRef.current.setCustomerContext(clientContext);
              chatRef.current.prefillInput(`Create a new invoice for ${clientContext}`);
            }
          }
        }, 80);
        return () => clearTimeout(t);
      }
    }
  }, [isOpen, clientContext]);

  // ESC key — warn if conversation active
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && isOpen) {
        if (showCloseConfirm) {
          setShowCloseConfirm(false);
        } else if (viewMode === 'new' && hasActiveConversation) {
          setShowCloseConfirm(true);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, showCloseConfirm, viewMode, hasActiveConversation, onClose]);

  const handleClose = () => {
    if (viewMode === 'new' && hasActiveConversation) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  };

  const confirmClose = () => {
    if (api.conversationId) {
      conversationStorage.saveActiveConversation(api.conversationId);
    }
    setShowCloseConfirm(false);
    onClose();
  };

  const handleResume = async () => {
    setShowResumePrompt(false);
    try {
      const data = await api.getConversation(resumeConversationId);
      const messages = data.messages || [];
      setTimeout(() => {
        if (chatRef.current) {
          chatRef.current.loadConversation(messages, resumeConversationId);
        }
      }, 80);
    } catch {
      conversationStorage.clearActiveConversation();
      setResumeConversationId(null);
    }
  };

  const handleStartFresh = () => {
    conversationStorage.clearActiveConversation();
    setResumeConversationId(null);
    setShowResumePrompt(false);
    setTimeout(() => {
      if (chatRef.current) {
        chatRef.current.resetConversation();
        if (clientContext) {
          chatRef.current.setCustomerContext(clientContext);
          chatRef.current.prefillInput(`Create a new invoice for ${clientContext}`);
        }
      }
    }, 80);
  };

  const handleInvoiceGenerated = (invoice) => {
    setCurrentInvoice(invoice);
    setViewMode('created');
    onInvoiceCreated?.(invoice);
  };

  const handleNewInvoice = () => {
    setCurrentInvoice(null);
    setViewMode('new');
    if (chatRef.current) chatRef.current.resetConversation();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="invoice-panel-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={handleClose}
          />

          {/* Slide-over panel */}
          <motion.div
            key="invoice-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed right-0 top-0 bottom-0 w-full md:w-[480px] bg-surface-card shadow-modal z-50 flex flex-col"
          >
            {/* Dark header bar */}
            <div className="flex items-center justify-between px-5 py-4 bg-[#1A2318] flex-shrink-0">
              <div className="flex items-center gap-3">
                {/* SP logo mark on dark background */}
                <div className="w-8 h-8 rounded-lg bg-[#3D5636] border border-[#4A6741]/50 flex items-center justify-center flex-shrink-0">
                  <span className="text-[11px] font-bold text-sage-200 tracking-wide">SP</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-white tracking-[-0.01em]">ScatterPilot AI</span>
                    {/* Pulsing online indicator */}
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
                    </span>
                  </div>
                  <p className="text-[11px] text-sage-400 leading-none mt-0.5">Invoice Assistant</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {viewMode === 'created' && (
                  <button
                    onClick={handleNewInvoice}
                    className="text-[12px] text-sage-300 hover:text-white font-medium transition-colors duration-150 px-2 py-1"
                  >
                    New invoice
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-sage-400 hover:text-white transition-colors duration-150"
                  aria-label="Close panel"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Resume conversation prompt — dark themed */}
            {showResumePrompt && (
              <div className="px-5 py-3 bg-[#243320] border-b border-[#1A2318]/60 flex items-center justify-between gap-3 flex-shrink-0">
                <p className="text-[12.5px] text-sage-300">Resume your previous conversation?</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={handleStartFresh}
                    className="text-[12px] text-sage-500 hover:text-sage-200 transition-colors"
                  >
                    Start fresh
                  </button>
                  <button
                    onClick={handleResume}
                    className="px-3 py-1.5 bg-sage-500 text-white text-[12px] font-medium rounded-full hover:bg-sage-600 transition-colors"
                  >
                    Resume
                  </button>
                </div>
              </div>
            )}

            {/* Panel body */}
            <div className="flex-1 overflow-hidden flex flex-col relative">
              {currentInvoice ? (
                <div className="flex-1 overflow-y-auto">
                  <InvoicePreview
                    invoiceId={currentInvoice.invoice_id}
                    invoiceData={currentInvoice.data || currentInvoice.invoice_data}
                    invoiceStatus={currentInvoice.status || 'draft'}
                    onNewInvoice={handleNewInvoice}
                    subscription={subscription}
                  />
                </div>
              ) : (
                <ChatInterface
                  ref={chatRef}
                  onInvoiceGenerated={handleInvoiceGenerated}
                  viewMode={viewMode}
                  onNewInvoice={handleNewInvoice}
                  onConversationActive={setHasActiveConversation}
                />
              )}

              {/* Close confirmation overlay */}
              {showCloseConfirm && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center p-6 z-10">
                  <div className="bg-surface-card border border-surface-border rounded-card shadow-modal p-6 max-w-xs w-full">
                    <h3 className="text-heading font-semibold text-ink-primary mb-1">Close this invoice?</h3>
                    <p className="text-body-sm text-ink-secondary mb-5">Your conversation will be saved as a draft.</p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setShowCloseConfirm(false)}
                        className="w-full py-2.5 bg-sage-500 hover:bg-sage-600 text-white text-body-sm font-medium rounded-button transition-colors"
                      >
                        Keep editing
                      </button>
                      <button
                        onClick={confirmClose}
                        className="w-full py-2.5 bg-surface-hover hover:bg-surface-muted text-ink-secondary text-body-sm font-medium rounded-button transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

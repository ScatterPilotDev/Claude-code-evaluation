import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import ChatInterface from './ChatInterface';
import InvoicePreview from './InvoicePreview';

export default function InvoiceCreationPanel({
  isOpen,
  clientContext,
  onClose,
  onInvoiceCreated,
  subscription,
}) {
  const chatRef = useRef(null);
  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [viewMode, setViewMode] = useState('new');

  // Reset + prefill when panel opens
  useEffect(() => {
    if (isOpen) {
      setCurrentInvoice(null);
      setViewMode('new');
      // Let framer-motion mount the panel before touching the ref
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
  }, [isOpen, clientContext]);

  // ESC key close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && isOpen) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

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
            onClick={onClose}
          />

          {/* Slide-over panel */}
          <motion.div
            key="invoice-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed right-0 top-0 bottom-0 w-[480px] bg-surface-card shadow-modal z-50 flex flex-col"
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 h-14 border-b border-surface-border flex-shrink-0">
              <h2 className="text-heading font-semibold text-ink-primary">
                {viewMode === 'created' ? 'Invoice ready' : 'New Invoice'}
              </h2>
              <div className="flex items-center gap-2">
                {viewMode === 'created' && (
                  <button
                    onClick={handleNewInvoice}
                    className="text-body-sm text-sage-500 hover:text-sage-600 font-medium transition-colors duration-150 px-2 py-1"
                  >
                    New invoice
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-hover text-ink-tertiary hover:text-ink-primary transition-colors duration-150"
                  aria-label="Close panel"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-hidden flex flex-col">
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
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

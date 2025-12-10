/**
 * ScatterPilot Demo Application
 * Main application logic for chat interface and invoice management
 */

// Application state
const appState = {
    isDemo: true,  // Start in demo mode
    conversationId: null,
    invoiceData: null,
    apiUrl: ''  // Will be set when live mode is enabled
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    // Set initial time for first message
    document.getElementById('initialTime').textContent = getCurrentTime();

    // Setup mode toggle
    const modeToggle = document.getElementById('modeToggle');
    modeToggle.addEventListener('change', toggleMode);

    // Auto-resize textarea
    const messageInput = document.getElementById('messageInput');
    messageInput.addEventListener('input', autoResizeTextarea);
}

function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function toggleMode(event) {
    appState.isDemo = event.target.checked;

    if (!appState.isDemo) {
        // Prompt for API URL
        const apiUrl = prompt(
            'Enter your API Gateway URL:\n\n' +
            'Example: https://abc123.execute-api.us-east-1.amazonaws.com/dev',
            appState.apiUrl
        );

        if (apiUrl) {
            appState.apiUrl = apiUrl.trim();
            showStatus('✅ Connected to Live API', 'success');
        } else {
            // Revert to demo mode
            event.target.checked = true;
            appState.isDemo = true;
        }
    } else {
        showStatus('📱 Demo Mode Active', 'info');
    }
}

function startDemo() {
    // Hide welcome, show chat
    document.getElementById('welcomeSection').style.display = 'none';
    document.getElementById('chatInterface').style.display = 'grid';

    // Reset if needed
    if (appState.conversationId) {
        mockAPI.reset();
        appState.conversationId = null;
        appState.invoiceData = null;

        // Clear messages except first one
        const messagesContainer = document.getElementById('chatMessages');
        const messages = messagesContainer.querySelectorAll('.message');
        for (let i = messages.length - 1; i > 0; i--) {
            messages[i].remove();
        }
    }

    // Focus input
    document.getElementById('messageInput').focus();
}

function autoResizeTextarea(event) {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = (textarea.scrollHeight) + 'px';
}

function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();

    if (!message) return;

    // Add user message to chat
    addMessage('user', message);

    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';

    // Disable send button
    const sendButton = document.getElementById('sendButton');
    sendButton.disabled = true;

    // Show typing indicator
    showTypingIndicator();

    try {
        let response;

        if (appState.isDemo) {
            // Use mock API
            response = await mockAPI.processMessage(message);
        } else {
            // Call real API
            response = await callLiveAPI(message);
        }

        // Remove typing indicator
        hideTypingIndicator();

        // Add assistant response
        addMessage('assistant', response.message);

        // Update conversation ID
        if (response.conversationId) {
            appState.conversationId = response.conversationId;
        }

        // Check if invoice is ready
        if (response.invoiceReady && response.invoiceData) {
            appState.invoiceData = response.invoiceData;
            displayInvoicePreview(response.invoiceData);
        }

    } catch (error) {
        hideTypingIndicator();
        addMessage('assistant', `Sorry, there was an error: ${error.message}. Please try again.`);
        console.error('Error:', error);
    }

    // Re-enable send button
    sendButton.disabled = false;
    messageInput.focus();
}

function addMessage(role, content) {
    const messagesContainer = document.getElementById('chatMessages');

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const avatar = role === 'assistant' ? '🤖' : '👤';

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            <div class="message-bubble">${escapeHtml(content).replace(/\n/g, '<br>')}</div>
            <div class="message-time">${getCurrentTime()}</div>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showTypingIndicator() {
    const messagesContainer = document.getElementById('chatMessages');

    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant';
    typingDiv.id = 'typingIndicator';

    typingDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <div class="message-bubble">
                <div class="typing-indicator">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        </div>
    `;

    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

async function callLiveAPI(message) {
    const response = await fetch(`${appState.apiUrl}/conversation`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // Add authorization header if using Cognito
            // 'Authorization': 'Bearer YOUR_TOKEN'
        },
        body: JSON.stringify({
            conversation_id: appState.conversationId,
            message: message
        })
    });

    if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
}

function displayInvoicePreview(invoiceData) {
    const previewContainer = document.getElementById('invoicePreview');
    const previewContent = document.getElementById('previewContent');

    const data = invoiceData.data;

    previewContent.innerHTML = `
        <div class="invoice-section">
            <h3>Invoice Details</h3>
            <div class="invoice-field">
                <span class="field-label">Invoice Number</span>
                <span class="field-value">${data.invoice_number || 'TBD'}</span>
            </div>
            <div class="invoice-field">
                <span class="field-label">Invoice Date</span>
                <span class="field-value">${formatDisplayDate(data.invoice_date)}</span>
            </div>
            <div class="invoice-field">
                <span class="field-label">Due Date</span>
                <span class="field-value">${formatDisplayDate(data.due_date)}</span>
            </div>
        </div>

        <div class="invoice-section">
            <h3>Bill To</h3>
            <div class="invoice-field">
                <span class="field-label">Customer</span>
                <span class="field-value">${data.customer_name}</span>
            </div>
            ${data.customer_email ? `
                <div class="invoice-field">
                    <span class="field-label">Email</span>
                    <span class="field-value">${data.customer_email}</span>
                </div>
            ` : ''}
        </div>

        <div class="invoice-section">
            <h3>Line Items</h3>
            <table class="line-items-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th class="text-right">Qty</th>
                        <th class="text-right">Price</th>
                        <th class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.line_items.map(item => `
                        <tr>
                            <td>${escapeHtml(item.description)}</td>
                            <td class="text-right">${item.quantity}</td>
                            <td class="text-right">$${parseFloat(item.unit_price).toFixed(2)}</td>
                            <td class="text-right">$${parseFloat(item.total).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="invoice-section">
            <h3>Summary</h3>
            <div class="invoice-field">
                <span class="field-label">Subtotal</span>
                <span class="field-value">$${parseFloat(data.subtotal).toFixed(2)}</span>
            </div>
            ${parseFloat(data.discount) > 0 ? `
                <div class="invoice-field">
                    <span class="field-label">Discount</span>
                    <span class="field-value">-$${parseFloat(data.discount).toFixed(2)}</span>
                </div>
            ` : ''}
            <div class="invoice-field">
                <span class="field-label">Tax (${(parseFloat(data.tax_rate) * 100).toFixed(1)}%)</span>
                <span class="field-value">$${parseFloat(data.tax_amount).toFixed(2)}</span>
            </div>
            <div class="invoice-total">
                <div class="total-row">
                    <span>Total</span>
                    <span>$${parseFloat(data.total).toFixed(2)}</span>
                </div>
            </div>
        </div>

        ${data.notes ? `
            <div class="invoice-section">
                <h3>Notes</h3>
                <p>${escapeHtml(data.notes)}</p>
            </div>
        ` : ''}
    `;

    previewContainer.style.display = 'flex';
}

function closePreview() {
    document.getElementById('invoicePreview').style.display = 'none';
}

function editInvoice() {
    showStatus('💡 Tip: Continue the conversation to modify the invoice', 'info');
    document.getElementById('messageInput').focus();
}

function generatePDF() {
    if (!appState.invoiceData) {
        showStatus('⚠️ No invoice data available', 'error');
        return;
    }

    showLoading('Generating PDF...');

    // Simulate brief processing time
    setTimeout(() => {
        try {
            const invoiceData = appState.invoiceData.data;
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            // Set up colors
            const primaryColor = [59, 130, 246]; // #3B82F6
            const grayColor = [107, 114, 128];
            const lightGrayColor = [229, 231, 235];

            // Header
            doc.setFontSize(24);
            doc.setTextColor(...primaryColor);
            doc.text('INVOICE', 20, 25);

            // Invoice details
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.text(`Invoice Number: ${invoiceData.invoice_number}`, 20, 35);
            doc.text(`Invoice Date: ${formatDisplayDate(invoiceData.invoice_date)}`, 20, 42);
            doc.text(`Due Date: ${formatDisplayDate(invoiceData.due_date)}`, 20, 49);

            // Bill To section
            doc.setFontSize(12);
            doc.setTextColor(...primaryColor);
            doc.text('Bill To:', 20, 65);
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.text(invoiceData.customer_name, 20, 72);

            if (invoiceData.customer_email) {
                doc.text(invoiceData.customer_email, 20, 79);
            }

            // Line items table
            const tableStartY = 95;
            let currentY = tableStartY;

            // Table header
            doc.setFillColor(...lightGrayColor);
            doc.rect(20, currentY, 170, 8, 'F');
            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.text('Description', 22, currentY + 5.5);
            doc.text('Qty', 130, currentY + 5.5, { align: 'right' });
            doc.text('Price', 155, currentY + 5.5, { align: 'right' });
            doc.text('Total', 185, currentY + 5.5, { align: 'right' });

            // Table rows
            currentY += 8;
            doc.setFont(undefined, 'normal');

            invoiceData.line_items.forEach((item, index) => {
                // Check if we need a new page
                if (currentY > 250) {
                    doc.addPage();
                    currentY = 20;
                }

                const rowY = currentY + 5.5;

                // Description (with text wrapping if needed)
                const descriptionLines = doc.splitTextToSize(item.description, 100);
                doc.text(descriptionLines, 22, rowY);

                // Other columns
                doc.text(item.quantity.toString(), 130, rowY, { align: 'right' });
                doc.text(`$${parseFloat(item.unit_price).toFixed(2)}`, 155, rowY, { align: 'right' });
                doc.text(`$${parseFloat(item.total).toFixed(2)}`, 185, rowY, { align: 'right' });

                // Row separator
                const rowHeight = Math.max(8, descriptionLines.length * 5);
                currentY += rowHeight;
                doc.setDrawColor(...lightGrayColor);
                doc.line(20, currentY, 190, currentY);
            });

            // Summary section
            currentY += 10;
            const summaryX = 130;

            // Subtotal
            doc.text('Subtotal:', summaryX, currentY);
            doc.text(`$${parseFloat(invoiceData.subtotal).toFixed(2)}`, 185, currentY, { align: 'right' });
            currentY += 7;

            // Discount
            if (parseFloat(invoiceData.discount) > 0) {
                doc.text('Discount:', summaryX, currentY);
                doc.text(`-$${parseFloat(invoiceData.discount).toFixed(2)}`, 185, currentY, { align: 'right' });
                currentY += 7;
            }

            // Tax
            doc.text(`Tax (${(parseFloat(invoiceData.tax_rate) * 100).toFixed(1)}%):`, summaryX, currentY);
            doc.text(`$${parseFloat(invoiceData.tax_amount).toFixed(2)}`, 185, currentY, { align: 'right' });
            currentY += 10;

            // Total (bold and larger)
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.setDrawColor(...primaryColor);
            doc.line(summaryX, currentY - 3, 190, currentY - 3);
            doc.text('Total:', summaryX, currentY + 2);
            doc.text(`$${parseFloat(invoiceData.total).toFixed(2)}`, 185, currentY + 2, { align: 'right' });

            // Notes section
            if (invoiceData.notes) {
                currentY += 15;
                if (currentY > 230) {
                    doc.addPage();
                    currentY = 20;
                }

                doc.setFontSize(10);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(...primaryColor);
                doc.text('Notes:', 20, currentY);

                doc.setFont(undefined, 'normal');
                doc.setTextColor(0, 0, 0);
                const notesLines = doc.splitTextToSize(invoiceData.notes, 170);
                doc.text(notesLines, 20, currentY + 7);
            }

            // Footer
            doc.setFontSize(8);
            doc.setTextColor(...grayColor);
            doc.text(
                'Generated by ScatterPilot - AI-Powered Invoice Generation',
                105,
                280,
                { align: 'center' }
            );

            // Save the PDF
            doc.save(`invoice-${invoiceData.invoice_number || 'draft'}.pdf`);

            hideLoading();
            showStatus('✅ Invoice PDF downloaded successfully!', 'success');
        } catch (error) {
            hideLoading();
            showStatus('⚠️ Error generating PDF: ' + error.message, 'error');
            console.error('PDF generation error:', error);
        }
    }, 800);
}

function showStatus(message, type = 'info') {
    const statusBar = document.getElementById('statusBar');
    const statusText = document.getElementById('statusText');

    statusText.textContent = message;
    statusBar.style.display = 'flex';

    // Auto-hide after 5 seconds
    setTimeout(() => {
        statusBar.style.display = 'none';
    }, 5000);
}

function showLoading(message = 'Processing...') {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = overlay.querySelector('.loading-text');
    loadingText.textContent = message;
    overlay.style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showArchitecture() {
    document.getElementById('architectureModal').style.display = 'flex';
}

function closeArchitecture() {
    document.getElementById('architectureModal').style.display = 'none';
}

// Close modal on background click
document.addEventListener('click', (event) => {
    const modal = document.getElementById('architectureModal');
    if (event.target === modal) {
        closeArchitecture();
    }
});

// Utility functions
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function formatDisplayDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

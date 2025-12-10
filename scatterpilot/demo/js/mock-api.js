/**
 * Mock API for ScatterPilot Demo
 * Simulates the Bedrock conversation flow without requiring AWS credentials
 */

class MockAPI {
    constructor() {
        this.conversationState = {
            stage: 0,
            collectedData: {},
            conversationId: this.generateId()
        };

        this.responses = [
            // Initial greeting (stage 0)
            "Great! I'll help you create an invoice. Let's start with the basics.\n\nWho is this invoice for? (Customer name)",

            // After customer name (stage 1)
            "Perfect! And when would you like this invoice dated? You can say 'today' or provide a specific date.",

            // After invoice date (stage 2)
            "Got it. When is this invoice due? (e.g., '30 days from now', 'February 15, 2024', etc.)",

            // After due date (stage 3)
            "Excellent! Now let's add the items or services. What's the first item you'd like to include?\n\n(Please provide: description, quantity, and unit price)",

            // After first line item (stage 4)
            "Added! Would you like to add another item? (Type 'no' to continue, or describe the next item)",

            // After deciding on more items (stage 5)
            "Great! What tax rate should I apply? (e.g., '8%', '0%' if no tax)",

            // After tax rate (stage 6)
            "Do you have any discount to apply? (Enter amount or '0' for no discount)",

            // After discount (stage 7)
            "Would you like to add any notes or payment terms to the invoice? (or type 'no')",

            // Final confirmation (stage 8)
            null // Triggers invoice generation
        ];
    }

    generateId() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    parseInitialMessage(message) {
        // Comprehensive parsing of the initial message to extract all possible information
        const extracted = {
            customerName: null,
            invoiceDate: null,
            dueDate: null,
            lineItems: [],
            total: null
        };

        // Extract customer name - look for patterns like "invoice X" or "bill X"
        const customerPatterns = [
            /invoice\s+([A-Z][a-zA-Z\s&.]+?)(?:\s+\$|\s+for|\s+\d)/i,
            /bill\s+([A-Z][a-zA-Z\s&.]+?)(?:\s+\$|\s+for|\s+\d)/i,
            /(?:customer|client|for)\s+([A-Z][a-zA-Z\s&.]+?)(?:\s+\$|\s+for|\s+\d)/i
        ];

        for (const pattern of customerPatterns) {
            const match = message.match(pattern);
            if (match) {
                extracted.customerName = match[1].trim();
                break;
            }
        }

        // Extract dates - look for various date formats
        const datePatterns = [
            { regex: /(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{2,4})/g, type: 'numeric' },
            { regex: /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s*(\d{4})/gi, type: 'named' }
        ];

        const dateMatches = [];
        for (const { regex, type } of datePatterns) {
            let match;
            while ((match = regex.exec(message)) !== null) {
                if (type === 'numeric') {
                    // Could be MM.DD.YYYY or DD.MM.YYYY - try to parse intelligently
                    const [_, first, second, year] = match;
                    const fullYear = year.length === 2 ? '20' + year : year;

                    // Assume MM.DD.YYYY format (US standard)
                    const month = parseInt(first) - 1;
                    const day = parseInt(second);

                    if (month >= 0 && month < 12 && day > 0 && day <= 31) {
                        dateMatches.push({
                            date: new Date(parseInt(fullYear), month, day),
                            raw: match[0],
                            position: match.index
                        });
                    }
                } else if (type === 'named') {
                    const months = ['january', 'february', 'march', 'april', 'may', 'june',
                                  'july', 'august', 'september', 'october', 'november', 'december'];
                    const month = months.indexOf(match[1].toLowerCase());
                    const day = parseInt(match[2]);
                    const year = parseInt(match[3]);
                    dateMatches.push({
                        date: new Date(year, month, day),
                        raw: match[0],
                        position: match.index
                    });
                }
            }
        }

        // Assign dates based on context clues
        if (dateMatches.length > 0) {
            // Look for "performed" or "dated" keywords for invoice date
            const performedMatch = message.match(/(?:performed|dated|on)\s+(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})/i);
            if (performedMatch) {
                const dateMatch = dateMatches.find(d => d.raw === performedMatch[1]);
                if (dateMatch) {
                    extracted.invoiceDate = this.formatDate(dateMatch.date);
                }
            } else if (dateMatches.length >= 1) {
                extracted.invoiceDate = this.formatDate(dateMatches[0].date);
            }

            // Look for "due" keyword for due date
            const dueMatch = message.match(/due\s+(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})/i);
            if (dueMatch) {
                const dateMatch = dateMatches.find(d => d.raw === dueMatch[1]);
                if (dateMatch) {
                    extracted.dueDate = this.formatDate(dateMatch.date);
                }
            } else if (dateMatches.length >= 2) {
                extracted.dueDate = this.formatDate(dateMatches[1].date);
            }
        }

        // Extract line items - look for patterns with quantities and descriptions
        const itemPatterns = [
            // "10 security cameras" or "10 cameras at $125"
            /(\d+)\s+([a-zA-Z\s]+?)(?:\s+at\s+\$(\d+(?:\.\d+)?)|(?=\s+and|\s*\+|\.|$))/gi,
            // "NVR configuration at $500"
            /([a-zA-Z\s]+?)\s+(?:at|for)\s+\$(\d+(?:\.\d+)?)/gi
        ];

        // Try to extract structured line items
        const tempMessage = message.toLowerCase();

        // Pattern 1: Quantity + item + price
        const qtyItemPrice = /(\d+)\s+([a-z\s]+?)\s+at\s+\$(\d+(?:\.\d+)?)/gi;
        let match;
        while ((match = qtyItemPrice.exec(message)) !== null) {
            const qty = parseInt(match[1]);
            const desc = match[2].trim();
            const price = parseFloat(match[3]);

            if (desc.length > 2) {
                extracted.lineItems.push({
                    description: desc.charAt(0).toUpperCase() + desc.slice(1),
                    quantity: qty.toString(),
                    unitPrice: price.toFixed(2)
                });
            }
        }

        // Pattern 2: Item + price (quantity = 1)
        const itemPrice = /([a-z][a-z\s]+?)\s+(?:at|for)\s+\$(\d+(?:\.\d+)?)/gi;
        while ((match = itemPrice.exec(message)) !== null) {
            const desc = match[1].trim();
            const price = parseFloat(match[2]);

            // Avoid duplicates and ensure it's a reasonable description
            if (desc.length > 3 && !extracted.lineItems.some(item =>
                item.description.toLowerCase().includes(desc.toLowerCase()))) {
                extracted.lineItems.push({
                    description: desc.charAt(0).toUpperCase() + desc.slice(1),
                    quantity: "1",
                    unitPrice: price.toFixed(2)
                });
            }
        }

        // Extract total amount mentioned
        const totalMatch = message.match(/\$(\d+(?:,\d{3})*(?:\.\d+)?)/);
        if (totalMatch) {
            extracted.total = parseFloat(totalMatch[1].replace(/,/g, ''));
        }

        return extracted;
    }

    async processMessage(userMessage) {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 700));

        const stage = this.conversationState.stage;
        let response = '';
        let invoiceReady = false;

        // Process based on current stage
        switch(stage) {
            case 0: // Initial message - parse comprehensively
                const extracted = this.parseInitialMessage(userMessage);

                // Store extracted data
                if (extracted.customerName) {
                    this.conversationState.collectedData.customerName = extracted.customerName;
                }
                if (extracted.invoiceDate) {
                    this.conversationState.collectedData.invoiceDate = extracted.invoiceDate;
                }
                if (extracted.dueDate) {
                    this.conversationState.collectedData.dueDate = extracted.dueDate;
                }
                if (extracted.lineItems.length > 0) {
                    this.conversationState.collectedData.lineItems = extracted.lineItems;
                }

                // Build response showing what was extracted
                let extractedInfo = [];
                if (extracted.customerName) extractedInfo.push(`Customer: ${extracted.customerName}`);
                if (extracted.invoiceDate) extractedInfo.push(`Invoice Date: ${extracted.invoiceDate}`);
                if (extracted.dueDate) extractedInfo.push(`Due Date: ${extracted.dueDate}`);
                if (extracted.lineItems.length > 0) {
                    extractedInfo.push(`Line Items: ${extracted.lineItems.length} item(s)`);
                }

                if (extractedInfo.length > 0) {
                    response = `Great! I've extracted the following information:\n\n${extractedInfo.join('\n')}\n\n`;
                } else {
                    response = "Great! I'll help you create an invoice.\n\n";
                }

                // Determine what's missing and ask for it
                if (!this.conversationState.collectedData.customerName) {
                    response += "Who is this invoice for? (Customer name)";
                    this.conversationState.stage = 1;
                } else if (!this.conversationState.collectedData.invoiceDate) {
                    response += "When would you like this invoice dated?";
                    this.conversationState.stage = 2;
                } else if (!this.conversationState.collectedData.dueDate) {
                    response += "When is this invoice due?";
                    this.conversationState.stage = 3;
                } else if (!this.conversationState.collectedData.lineItems || this.conversationState.collectedData.lineItems.length === 0) {
                    response += "Now let's add the items or services. What's the first item you'd like to include?\n\n(Please provide: description, quantity, and unit price)";
                    this.conversationState.stage = 4;
                } else {
                    // We have everything for line items, move to additional items check
                    response += "Would you like to add more items, or should we continue with tax and discount? (Type 'continue' to move on, or describe another item)";
                    this.conversationState.stage = 5;
                }
                break;

            case 1: // Customer name
                this.conversationState.collectedData.customerName = this.extractCustomerName(userMessage);
                response = this.responses[1];
                this.conversationState.stage = 2;
                break;

            case 2: // Invoice date
                this.conversationState.collectedData.invoiceDate = this.extractDate(userMessage, 'invoice');
                response = this.responses[2];
                this.conversationState.stage = 3;
                break;

            case 3: // Due date
                this.conversationState.collectedData.dueDate = this.extractDate(userMessage, 'due');
                this.conversationState.collectedData.lineItems = [];
                response = this.responses[3];
                this.conversationState.stage = 4;
                break;

            case 4: // First line item
                const firstItem = this.extractLineItem(userMessage);
                if (firstItem) {
                    this.conversationState.collectedData.lineItems.push(firstItem);
                    response = this.responses[4];
                    this.conversationState.stage = 5;
                } else {
                    response = "I couldn't quite understand that. Please provide the item description, quantity, and price.\n\nFor example: 'Web development services, 40 hours at $150 per hour'";
                }
                break;

            case 5: // Additional items
                if (userMessage.toLowerCase().includes('no') || userMessage.toLowerCase().includes('done') ||
                    userMessage.toLowerCase().includes('continue') || userMessage.toLowerCase().includes('next')) {
                    response = this.responses[5];
                    this.conversationState.stage = 6;
                } else {
                    const item = this.extractLineItem(userMessage);
                    if (item) {
                        this.conversationState.collectedData.lineItems.push(item);
                        response = "Added! Would you like to add another item? (Type 'no' to continue)";
                    } else {
                        response = "Please describe the item with quantity and price, or type 'no' to continue.";
                    }
                }
                break;

            case 6: // Tax rate
                this.conversationState.collectedData.taxRate = this.extractTaxRate(userMessage);
                response = this.responses[6];
                this.conversationState.stage = 7;
                break;

            case 7: // Discount
                this.conversationState.collectedData.discount = this.extractDiscount(userMessage);
                response = this.responses[7];
                this.conversationState.stage = 8;
                break;

            case 8: // Notes
                if (!userMessage.toLowerCase().includes('no')) {
                    this.conversationState.collectedData.notes = userMessage;
                }

                // Generate invoice
                response = this.generateConfirmationMessage();
                invoiceReady = true;
                break;
        }

        return {
            conversationId: this.conversationState.conversationId,
            message: response,
            invoiceReady: invoiceReady,
            invoiceData: invoiceReady ? this.buildInvoiceData() : null
        };
    }

    extractCustomerName(message) {
        // Simple extraction - in real scenario, Bedrock would be more intelligent
        const patterns = [
            /(?:for|customer|client|name is)\s+([A-Z][a-zA-Z\s&.]+?)(?:\.|$|,)/i,
            /^([A-Z][a-zA-Z\s&.]+?)(?:\.|$)/,
            /([A-Z][a-zA-Z\s&.]+)/
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }

        return message.trim();
    }

    extractDate(message, type) {
        const today = new Date();

        if (message.toLowerCase().includes('today')) {
            return this.formatDate(today);
        }

        // Try to extract dates in various formats
        const datePatterns = [
            /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,  // MM/DD/YYYY or DD/MM/YYYY
            /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,     // YYYY-MM-DD
            /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s*(\d{4})/i
        ];

        for (const pattern of datePatterns) {
            const match = message.match(pattern);
            if (match) {
                if (pattern === datePatterns[2]) {
                    // Month name format
                    const months = ['january', 'february', 'march', 'april', 'may', 'june',
                                  'july', 'august', 'september', 'october', 'november', 'december'];
                    const month = months.indexOf(match[1].toLowerCase());
                    const day = parseInt(match[2]);
                    const year = parseInt(match[3]);
                    return this.formatDate(new Date(year, month, day));
                } else {
                    // Assume YYYY-MM-DD format
                    return match[0];
                }
            }
        }

        // Check for relative dates
        const daysMatch = message.match(/(\d+)\s*days?\s*(from\s*now)?/i);
        if (daysMatch) {
            const days = parseInt(daysMatch[1]);
            const futureDate = new Date(today);
            futureDate.setDate(today.getDate() + days);
            return this.formatDate(futureDate);
        }

        // Default: 30 days from now for due date, today for invoice date
        if (type === 'due') {
            const dueDate = new Date(today);
            dueDate.setDate(today.getDate() + 30);
            return this.formatDate(dueDate);
        }

        return this.formatDate(today);
    }

    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    extractLineItem(message) {
        // Try to extract quantity and price
        const patterns = [
            // "10 hours at $150" or "10 hours @ $150"
            /(\d+(?:\.\d+)?)\s*(?:hours?|units?|items?|qty)?\s*(?:at|@|for)\s*\$?(\d+(?:\.\d+)?)/i,
            // "40 x $150" or "40 * $150"
            /(\d+(?:\.\d+)?)\s*[x*×]\s*\$?(\d+(?:\.\d+)?)/i,
            // "quantity: 5, price: $100"
            /(?:qty|quantity)[:\s]*(\d+(?:\.\d+)?).*?(?:price|cost)[:\s]*\$?(\d+(?:\.\d+)?)/i,
        ];

        let quantity = null;
        let price = null;
        let description = message;

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                quantity = parseFloat(match[1]);
                price = parseFloat(match[2]);
                // Remove the matched part from description
                description = message.replace(match[0], '').trim();
                break;
            }
        }

        // If no pattern matched, try simpler extraction
        if (!quantity || !price) {
            const numbers = message.match(/\d+(?:\.\d+)?/g);
            if (numbers && numbers.length >= 2) {
                quantity = parseFloat(numbers[0]);
                price = parseFloat(numbers[numbers.length - 1]);
            }
        }

        if (quantity && price) {
            // Clean up description
            description = description
                .replace(/^\s*[-,;:]\s*/, '')
                .replace(/\s*[-,;:]\s*$/, '')
                .trim();

            if (!description) {
                description = "Service/Product";
            }

            return {
                description: description,
                quantity: quantity.toString(),
                unitPrice: price.toFixed(2)
            };
        }

        return null;
    }

    extractTaxRate(message) {
        const match = message.match(/(\d+(?:\.\d+)?)\s*%?/);
        if (match) {
            const rate = parseFloat(match[1]);
            // Convert percentage to decimal
            return (rate > 1 ? rate / 100 : rate).toFixed(2);
        }
        return "0.00";
    }

    extractDiscount(message) {
        if (message.toLowerCase().includes('no') || message.trim() === '0') {
            return "0.00";
        }

        const match = message.match(/\$?(\d+(?:\.\d+)?)/);
        if (match) {
            return parseFloat(match[1]).toFixed(2);
        }
        return "0.00";
    }

    generateConfirmationMessage() {
        const data = this.conversationState.collectedData;
        const subtotal = this.calculateSubtotal(data.lineItems);
        const taxAmount = subtotal * parseFloat(data.taxRate);
        const discount = parseFloat(data.discount || 0);
        const total = subtotal - discount + taxAmount;

        return `Perfect! I've created your invoice. Here's a summary:\n\n` +
               `Customer: ${data.customerName}\n` +
               `Invoice Date: ${data.invoiceDate}\n` +
               `Due Date: ${data.dueDate}\n` +
               `Items: ${data.lineItems.length}\n` +
               `Subtotal: $${subtotal.toFixed(2)}\n` +
               `Tax: $${taxAmount.toFixed(2)}\n` +
               `Discount: $${discount.toFixed(2)}\n` +
               `Total: $${total.toFixed(2)}\n\n` +
               `You can review the invoice in the preview pane and download it as a PDF!`;
    }

    calculateSubtotal(lineItems) {
        return lineItems.reduce((sum, item) => {
            return sum + (parseFloat(item.quantity) * parseFloat(item.unitPrice));
        }, 0);
    }

    buildInvoiceData() {
        const data = this.conversationState.collectedData;
        const subtotal = this.calculateSubtotal(data.lineItems);
        const taxAmount = subtotal * parseFloat(data.taxRate);
        const discount = parseFloat(data.discount || 0);
        const total = subtotal - discount + taxAmount;

        return {
            action: "create_invoice",
            data: {
                customer_name: data.customerName,
                customer_email: null,
                customer_address: null,
                invoice_date: data.invoiceDate,
                due_date: data.dueDate,
                invoice_number: `INV-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
                line_items: data.lineItems.map(item => ({
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: item.unitPrice,
                    total: (parseFloat(item.quantity) * parseFloat(item.unitPrice)).toFixed(2)
                })),
                tax_rate: data.taxRate,
                discount: discount.toFixed(2),
                notes: data.notes || null,
                subtotal: subtotal.toFixed(2),
                tax_amount: taxAmount.toFixed(2),
                total: total.toFixed(2)
            }
        };
    }

    reset() {
        this.conversationState = {
            stage: 0,
            collectedData: {},
            conversationId: this.generateId()
        };
    }
}

// Global instance
const mockAPI = new MockAPI();

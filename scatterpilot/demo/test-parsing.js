/**
 * Test script for mock AI parsing functionality
 */

// Load the mock API
const fs = require('fs');
eval(fs.readFileSync('./js/mock-api.js', 'utf8'));

// Test the parsing with the user's example message
const testMessage = "Can you invoice Distilled Distilling $9576 for installing 10 security cameras at $125 and NVR configuration at $500 performed 10.1.2025. The invoice is due 10.31.2025";

console.log("Testing Mock AI Parsing...\n");
console.log("Input Message:");
console.log(testMessage);
console.log("\n" + "=".repeat(80) + "\n");

const api = new MockAPI();
const extracted = api.parseInitialMessage(testMessage);

console.log("Extracted Data:");
console.log(JSON.stringify(extracted, null, 2));

console.log("\n" + "=".repeat(80) + "\n");

// Verify extraction
const checks = {
    "Customer Name": extracted.customerName === "Distilled Distilling",
    "Invoice Date": extracted.invoiceDate === "2025-10-01",
    "Due Date": extracted.dueDate === "2025-10-31",
    "Line Items Count": extracted.lineItems.length === 2,
    "Item 1 - Security Cameras": extracted.lineItems[0]?.description.toLowerCase().includes("security cameras") &&
                                 extracted.lineItems[0]?.quantity === "10" &&
                                 extracted.lineItems[0]?.unitPrice === "125.00",
    "Item 2 - NVR Configuration": extracted.lineItems[1]?.description.toLowerCase().includes("nvr configuration") &&
                                  extracted.lineItems[1]?.unitPrice === "500.00"
};

console.log("Validation Results:");
for (const [check, passed] of Object.entries(checks)) {
    console.log(`  ${passed ? '✓' : '✗'} ${check}: ${passed ? 'PASS' : 'FAIL'}`);
}

const allPassed = Object.values(checks).every(v => v);
console.log("\n" + "=".repeat(80));
console.log(allPassed ? "✓ All tests PASSED!" : "✗ Some tests FAILED");
console.log("=".repeat(80));

// Test the full conversation flow
console.log("\n\nTesting Full Conversation Flow...\n");

(async () => {
    const api2 = new MockAPI();
    const response = await api2.processMessage(testMessage);

    console.log("AI Response:");
    console.log(response.message);
    console.log("\nConversation State:");
    console.log(`  Stage: ${api2.conversationState.stage}`);
    console.log(`  Collected Data:`, api2.conversationState.collectedData);
})();

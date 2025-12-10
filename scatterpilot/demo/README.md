# ScatterPilot Demo

**Professional web interface for AI-powered invoice generation**

This demo showcases the complete ScatterPilot experience with a beautiful, production-ready chat interface.

## 🚀 Quick Start (30 Seconds)

**No AWS credentials required! Works completely offline in Demo Mode.**

1. Open `index.html` in your web browser
2. Click "Start Creating an Invoice"
3. Have a natural conversation with the AI
4. Watch as it extracts invoice data automatically
5. Download a professional invoice

That's it! 🎉

## 📺 Demo Mode vs Live API Mode

### Demo Mode (Default)

- **No setup required** - Works immediately
- **Fully functional** - Complete conversation flow
- **Intelligent mock AI** - Simulates Claude's conversational extraction
- **Perfect for showcasing** - No AWS costs, no credentials needed

### Live API Mode

- **Real Bedrock integration** - Actual Claude 3.5 Sonnet
- **Connect to deployed stack** - Uses your API Gateway URL
- **Production data** - Saves to DynamoDB, generates real PDFs

Toggle between modes using the switch in the top-right corner.

## 📖 How to Use

### Demo Mode Usage

1. **Start the Demo**
   ```bash
   # From the demo directory
   open index.html
   # Or just double-click index.html
   ```

2. **Create an Invoice**
   - Click "Start Creating an Invoice"
   - Answer the AI's questions naturally
   - Watch it extract structured data
   - Review and download your invoice

3. **Example Conversation**
   ```
   AI: Who is this invoice for?
   You: Acme Corporation

   AI: When would you like this invoice dated?
   You: Today

   AI: When is this invoice due?
   You: 30 days from now

   AI: What's the first item?
   You: Web development services, 40 hours at $150 per hour

   ... and so on!
   ```

### Live API Mode Usage

1. **Deploy ScatterPilot**
   ```bash
   cd ..  # Back to project root
   make deploy-guided
   ```

2. **Get Your API URL**
   ```bash
   make get-api-url
   ```

3. **Switch to Live Mode**
   - Toggle the "Demo Mode / Live API" switch
   - Enter your API Gateway URL
   - Start creating invoices with real AI!

## 🎨 Features

### Conversation Interface
- ✅ Clean, modern chat UI
- ✅ Real-time typing indicators
- ✅ Message timestamps
- ✅ Mobile-responsive design
- ✅ Keyboard shortcuts (Enter to send)

### Invoice Preview
- ✅ Live preview as data is collected
- ✅ Professional formatting
- ✅ Itemized line items
- ✅ Tax and discount calculations
- ✅ Real-time total updates

### PDF Generation
- ✅ Download as HTML invoice
- ✅ Print-ready formatting
- ✅ Professional styling
- ✅ Company branding ready

### User Experience
- ✅ Loading states
- ✅ Error handling
- ✅ Status notifications
- ✅ Architecture diagram
- ✅ Smooth animations

## 🛠️ Demo Mode AI Logic

The mock API intelligently extracts:

- **Customer names** from natural language
- **Dates** in multiple formats (today, MM/DD/YYYY, "30 days from now")
- **Line items** from descriptions like "40 hours at $150"
- **Tax rates** as percentages or decimals
- **Discounts** as dollar amounts
- **Notes** and special instructions

### Supported Input Patterns

**Dates:**
- "today", "tomorrow"
- "January 15, 2024"
- "01/15/2024"
- "30 days from now"

**Line Items:**
- "40 hours at $150"
- "10 units @ $50"
- "Consulting services, 40 x $150"
- "quantity: 5, price: $100"

**Tax:**
- "8%", "8 percent"
- "0.08" (as decimal)
- "no tax", "0"

## 📱 Mobile Support

Fully responsive design works on:
- 💻 Desktop browsers
- 📱 Mobile phones
- 📱 Tablets
- 🖥️ Large displays

## 🎭 Perfect for Demos

This interface is designed for:

### Presentations
- Clean, professional appearance
- No setup time required
- Consistent behavior every time
- No dependency on internet/AWS

### Portfolio
- Showcase AI integration skills
- Demonstrate frontend abilities
- Show UX/UI design expertise
- Highlight serverless architecture

### Interviews
- Walk through the architecture
- Explain the conversation flow
- Demonstrate the technology stack
- Toggle to real API seamlessly

## 🏗️ Technical Architecture

```
┌─────────────────────────┐
│   index.html            │  Main page structure
├─────────────────────────┤
│   styles.css            │  Professional styling
├─────────────────────────┤
│   js/mock-api.js        │  Simulated Bedrock AI
│   js/app.js             │  Application logic
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│   Live API (Optional)   │
│   ↓                     │
│   API Gateway           │
│   ↓                     │
│   Lambda Functions      │
│   ↓                     │
│   Amazon Bedrock        │
└─────────────────────────┘
```

## 🎨 Customization

### Change Colors
Edit CSS variables in `styles.css`:
```css
:root {
    --primary-color: #3B82F6;  /* Change to your brand color */
    --secondary-color: #8B5CF6;
}
```

### Modify Conversation Flow
Edit responses in `js/mock-api.js`:
```javascript
this.responses = [
    "Your custom greeting...",
    "Your custom question...",
    // ...
];
```

### Add Your Logo
Replace the SVG in the header (lines 22-26 of `index.html`)

## 🔧 Troubleshooting

### Demo mode not working?
- Ensure JavaScript is enabled
- Check browser console for errors
- Try a different browser (Chrome, Firefox, Safari all supported)

### Live API mode failing?
- Verify API Gateway URL is correct
- Check CORS is enabled
- Ensure Cognito is configured (if using auth)
- Check network tab in browser DevTools

### PDF not downloading?
- Check popup blocker settings
- Ensure file downloads are allowed
- Try right-click → "Save As"

## 📚 Next Steps

### For Development
```bash
# Go back to project root
cd ..

# Test locally with real Bedrock
python scripts/local-test.py

# Run unit tests
make test

# Deploy to AWS
make deploy
```

### For Production

1. **Deploy the Stack**
   ```bash
   make deploy-guided
   ```

2. **Set Up Cognito**
   - Create User Pool
   - Configure in SAM template
   - Update demo with auth

3. **Custom Domain**
   - Set up CloudFront
   - Configure custom domain
   - Update CORS settings

4. **Monitoring**
   ```bash
   make logs
   make describe-stack
   ```

## 💡 Tips for Best Demo Experience

1. **Start Simple**: Use the default demo flow first
2. **Show the Toggle**: Demonstrate switching to Live API
3. **Explain the AI**: Walk through how Bedrock extracts data
4. **Highlight Security**: Point out input sanitization, rate limiting
5. **Show the Code**: Open DevTools to show clean architecture

## 🌟 What Makes This Special

- **Zero Configuration**: Works immediately without setup
- **Production Quality**: Real animations, error handling, accessibility
- **Educational**: Clear code structure, well-commented
- **Versatile**: Demo mode OR live API with one toggle
- **Complete**: Full conversation flow, not just a mockup

## 📄 License

Part of ScatterPilot - MIT License

## 🤝 Support

For questions or issues:
- Check the main [README](../README.md)
- Review the [architecture diagram](#)
- Open an issue on GitHub

---

**Built with ❤️ to showcase modern serverless AI applications**

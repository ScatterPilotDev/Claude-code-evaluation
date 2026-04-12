# ScatterPilot Phase 4 — Brand Identity, Feature Audit & Delivery

**Focus:** Professional logo and brand system, audit all promised features against reality, build or honestly scope what's missing.

The repo root is `~/Claude-code-evaluation` and the frontend is at `~/Claude-code-evaluation/scatterpilot/frontend/`. Always commit from the repo root. After committing, also run: `git push origin main`

---

## PROMPT P4-1: Feature Audit — What Are We Promising vs. Delivering?

```
You are auditing ScatterPilot for feature parity — what the pricing page promises vs. what actually works. The repo root is ~/Claude-code-evaluation. Frontend at scatterpilot/frontend/.

YOUR TASK: Go through the ENTIRE codebase and create a detailed audit of every feature listed on the pricing page. Be brutally honest.

Explore:
- The pricing page component (PricingPage.jsx and/or the landing page pricing section) — extract EVERY feature listed under Solo, Pro, and Agency
- For each feature, search the codebase to determine if it's actually implemented
- Check the backend (functions/, layers/) and frontend (src/) for real functionality
- Check if plan-level gating exists (does the app actually differentiate between Solo, Pro, and Agency?)

Create a file at ~/Claude-code-evaluation/FEATURE_AUDIT.md with this structure:

## Solo Plan Features ($29/mo)

### ✅ Unlimited invoices
- Status: LIVE
- Location: [files]
- Notes: [how it works]

### ✅ Unlimited clients  
- Status: LIVE
- Location: [files]
- Notes: [how it works]

(continue for each feature...)

## Pro Plan Features ($49/mo) — "Everything in Solo, plus:"

### ❓ Remove ScatterPilot branding
- Status: NOT IMPLEMENTED / PARTIALLY IMPLEMENTED / LIVE
- What exists: [description]
- What's missing: [description]
- Effort to implement: LOW / MEDIUM / HIGH

### ❓ Priority AI
- Status: ...

(continue for each feature...)

## Agency Plan Features ($99/mo) — "Everything in Pro, plus:"

### ❓ Team seats
- Status: ...

(continue for each feature...)

## Plan Gating Audit

Check if the app actually enforces plan restrictions:
- Does a Solo user get blocked from Pro features?
- Does a trial user get Pro access as promised?
- Is there middleware/checks that verify the user's plan before granting access?
- Are there any features that are "available" to everyone regardless of plan?

## Summary

- Total features promised: X
- Actually implemented: X
- Partially implemented: X
- Not implemented at all: X
- Plan gating exists: YES / NO / PARTIAL

Be thorough. Check every feature claim. This audit determines what we build next.

DO NOT change any code in this prompt. Only create the audit document.

Commit from ~/Claude-code-evaluation with message: "docs: feature audit — promised vs delivered across all pricing tiers"

After committing, also run: git push origin main
```

---

## PROMPT P4-2: Logo & Brand Identity

```
You are creating a professional logo and brand identity system for ScatterPilot, an AI-powered invoicing platform for high-earning consultants and agencies. The repo root is ~/Claude-code-evaluation. Frontend at scatterpilot/frontend/.

Explore:
- The current favicon (src or public directory — should be a sage "S" monogram from Phase 1)
- Where the logo/brand mark appears: landing page nav, sidebar, auth pages, invoice PDFs, favicon
- The design system tokens in tailwind.config.js (sage palette, typography)

YOUR TASK: Design and implement a cohesive brand identity system.

### Logo Concept

Create an SVG logo system with these variants:

**1. Logo Mark (icon only):**
A geometric monogram combining "S" and "P" — clean, minimal, works at 16x16 (favicon) through 64x64.

Design direction:
- NOT a generic rounded "S" — it should feel intentional and designed
- Use the sage-500 (#4A6741) as the primary color
- The mark should suggest precision, professionalism, and forward motion
- Think: the confidence of the Stripe "S", the cleanliness of Linear's mark, the approachability of Notion's icon
- Geometric construction — should look like it was built on a grid
- Works in single color (sage on white, white on sage, white on dark)

**2. Wordmark (text logo):**
"ScatterPilot" in DM Sans, weight 600, with the logo mark to the left.
- Tracking: slightly tight (-0.01em)
- The "Scatter" and "Pilot" can be differentiated subtly (e.g., "Scatter" in sage-900, "Pilot" in sage-500)
- Or keep it all one color for simplicity

**3. Compact variant:**
Logo mark + "SP" abbreviation for very tight spaces.

### Implementation

Create these files:

**frontend/src/components/brand/Logo.jsx**
A React component with props:
- variant: 'mark' | 'wordmark' | 'compact' (default: 'wordmark')
- size: 'sm' (24px) | 'md' (32px) | 'lg' (48px) | 'xl' (64px)
- color: 'default' (sage) | 'white' | 'dark'
- className: for additional styling

The logo should be pure SVG rendered inline (not an image file) so it scales perfectly and can change color via props.

**frontend/public/favicon.svg**
Replace the existing favicon with the new logo mark.

**frontend/public/logo-og.png**
Create a 1200x630 Open Graph image for social sharing:
- Background: #FAFBF9
- Centered: Logo mark + "ScatterPilot" wordmark
- Below: "AI-Powered Invoicing" tagline in text-ink-secondary
- This needs to be a static file — generate it using an SVG-to-PNG approach, or create it as an SVG that can be screenshotted. If you can't generate a PNG programmatically, create the SVG version and add a TODO comment.

### Replace Every Logo Instance

Update these locations to use the new <Logo> component:

1. **Landing page nav** — Logo variant='wordmark' size='md'
2. **Sidebar** — Replace "SCATTERPILOT" text with Logo variant='wordmark' size='sm' 
3. **Auth pages** — Logo variant='wordmark' size='lg' centered above the form card
4. **Invoice PDF** — Add the logo mark to the PDF header (this may require converting the SVG to a format the PDF library supports — check how the PDF generator works and adapt)
5. **Favicon** — Logo variant='mark' as favicon.svg
6. **Public invoice page** — Logo variant='wordmark' size='md' in the header

### Extended Color Palette

The sage-500 primary is strong but needs supporting accent colors for visual variety. Add these to the Tailwind config as semantic tokens:

```javascript
// Extended brand accents — use sparingly for visual interest
brand: {
  sage: '#4A6741',        // Primary — buttons, active states, logo
  forest: '#2D4A2D',      // Darker sage — headings on dark backgrounds
  moss: '#8BA888',         // Light sage — decorative, hover states, illustrations
  sand: '#C4B99A',         // Warm neutral — subtle accents, dividers, backgrounds
  cream: '#F5F0E8',        // Warm off-white — alternate section backgrounds
  charcoal: '#2C2C2C',    // Near-black — premium text alternative
}
```

### Apply Visual Variety

Update these areas to use the extended palette:

1. **Landing page** — alternate section backgrounds between #FAFBF9 (default) and cream (#F5F0E8) for visual rhythm. The dark CTA section should use forest (#2D4A2D) instead of sage-900.

2. **Testimonial cards** — use sand (#C4B99A) as a subtle border accent or initial avatar background for variety.

3. **How It Works section** — use moss (#8BA888) for the step number watermarks instead of sage-200.

4. **Footer** — use charcoal (#2C2C2C) instead of ink-primary for a slightly warmer feel.

5. **Invoice PDF** — use sand as a subtle accent rule color or table header secondary tone.

### DO NOT:
- Change the core sage-500 primary or any existing functional colors
- Modify the UI component primitives (Button, Card, Badge, etc.)
- Change any app functionality
- Break any existing pages

Commit from ~/Claude-code-evaluation with message: "feat: professional logo system, extended brand palette, visual variety"

After committing, also run: git push origin main
```

---

## PROMPT P4-3: Deliver Pro Features — Branding Removal + Reports

```
You are implementing missing Pro plan features for ScatterPilot. The repo root is ~/Claude-code-evaluation. Frontend at scatterpilot/frontend/.

Read ~/Claude-code-evaluation/FEATURE_AUDIT.md first to understand what's missing.

YOUR TASK: Fix critical structural issues found in the audit, implement Pro features, and establish proper plan gating.

### CRITICAL FIX 1: Remove Conflicting Pricing Page

The audit found TWO pricing pages coexisting:
- Old: Pricing.jsx with a free/$18 model
- New: PricingPage.jsx with $29/$49/$99 (the correct one)

DELETE the old Pricing.jsx entirely. Search for any routes, imports, or links that reference it and redirect them to PricingPage.jsx (or /app/pricing). The old free/$18 model is dead — remove all traces.

### CRITICAL FIX 2: Fix Trial Invoice Limit

The audit found that trialing users may hit a 5-invoice free-tier limit despite being promised Pro access. 

Find where the invoice creation limit is enforced (likely in the conversation or invoice creation Lambda). Update the logic:
- If subscription_status === 'trialing' → treat as Pro plan → unlimited invoices
- If subscription_status === 'active' → check subscription_plan for limits (Solo/Pro/Agency all get unlimited)
- If no subscription and no trial → apply the free-tier 5-invoice limit (or block entirely since we don't have a free tier anymore)
- Use the access_control.py utility that already exists but isn't connected to all gating paths

### CRITICAL FIX 3: Connect Plan Gating to All Features

The audit found that "all paid plans get identical features." Fix this:

**Backend gating** — in relevant Lambda functions, check the user's subscription_plan before allowing access:
- Invoice creation: all paid plans + trialing = unlimited
- PDF generation: check plan for branding (see Feature 1 below)
- Reports endpoint: check plan, only return data for Pro+ (see Feature 2 below)
- Invoice color themes: already Pro-gated per audit — verify it works
- Custom business name on invoices: already Pro-gated per audit — verify it works

**Frontend gating** — components should check billingStatus and show upgrade prompts for restricted features.

Now implement the missing features:

### Feature 1: ScatterPilot Branding (Plan-Tiered)

The branding should be respectful of paying customers at ALL tiers:

**Pro & Agency plans:** Remove "Powered by ScatterPilot" entirely from:
1. Invoice PDF — no ScatterPilot mention anywhere
2. Public invoice page (/pay/:invoiceId) — no branding visible to the client
3. Email templates (if any exist)

**Solo plan & Trial:** Keep a VERY subtle ScatterPilot mention, but make it nearly invisible — not promotional:
1. Invoice PDF — tiny footer text, 7px, light gray (#C8CEC3), reads "ScatterPilot" only (not "Powered by ScatterPilot"). Positioned at the very bottom edge. Should look like a watermark, not an advertisement.
2. Public invoice page — small text-[11px] text-ink-tertiary/50 in the footer area: "ScatterPilot" as a simple link. No "Powered by", no logo, no emphasis.
3. The branding should NEVER look like we're using their invoice as ad space. These are paying customers.

The check should be on the INVOICE OWNER's plan, not the viewer's. When generating a PDF or serving a public invoice, look up the owner's subscription_plan.

### Feature 2: Reports & Analytics (Pro+)

Replace the "coming soon" placeholder on the Reports page with real, functional reports.

Build these four reports using the data already available in DynamoDB:

**Report 1: Revenue by Client**
- Bar chart showing total billed amount per client
- Data source: iterate all invoices, group by client name, sum amounts
- Sort by highest revenue first
- Show top 10 clients
- Use a simple chart library — if recharts is already installed, use it. If not, build with pure CSS bars (simpler, no new dependency).

**Report 2: Monthly Revenue Trend**
- Line or bar chart showing revenue per month (last 6-12 months)
- Data source: group invoices by month (from creation date), sum amounts
- Show both "invoiced" (created) and "received" (paid) as two lines/bar groups
- Include current month even if incomplete

**Report 3: Invoice Status Breakdown**
- Simple donut or horizontal bar showing: X drafts, Y sent, Z paid, W overdue
- Data source: count invoices by status
- Use the design system's status colors (sage for sent, success for paid, danger for overdue, muted for draft)

**Report 4: Outstanding Aging**
- Shows how long unpaid invoices have been outstanding
- Buckets: Current (not yet due), 1-30 days overdue, 31-60, 61-90, 90+
- Data source: calculate days between due_date and now for unpaid invoices
- Color-coded: green → amber → red as aging increases

### Technical Approach

**Data fetching:**
- Create a new API endpoint GET /reports/summary that returns all the aggregated data the frontend needs
- The Lambda queries DynamoDB for all user invoices and computes the aggregations server-side
- Return a JSON response with: revenueByClient, monthlyTrend, statusBreakdown, agingBuckets
- Cache the response for 5 minutes if possible (or compute fresh each time — invoice volumes for consultants are low enough)

**Frontend:**
- Replace the placeholder ReportsPage.jsx with real charts
- Gate access: if user's plan is 'solo', show a preview/blur with "Upgrade to Pro for full reports" overlay
- If plan is 'pro' or 'agency' or 'trialing': show full reports
- Page layout: 2x2 grid of report cards, each in a Card component
- Each card: title, chart area, summary stat below

**If recharts is available:**
- Use BarChart for revenue by client
- Use LineChart for monthly trend
- Use PieChart for status breakdown
- Style with sage design system colors

**If recharts is NOT available:**
- Build charts with pure CSS (flex bars, width percentages) — this is perfectly fine for simple data
- Don't install recharts just for this — check package.json first

### Plan Gating Infrastructure

If plan-level gating doesn't already exist in the frontend, add a simple utility:

```javascript
// src/utils/planAccess.js
export function canAccessFeature(billingStatus, feature) {
  const plan = billingStatus?.subscription_plan;
  const status = billingStatus?.subscription_status;
  
  // Trial gets Pro access
  if (status === 'trialing') return true;
  
  const featureAccess = {
    remove_branding: ['pro', 'agency'],
    reports: ['pro', 'agency'],
    invoice_templates: ['pro', 'agency'],
    team_seats: ['agency'],
    client_portal: ['agency'],
    api_access: ['agency'],
  };
  
  return featureAccess[feature]?.includes(plan) || false;
}
```

Use this utility wherever you need to gate features.

Commit from ~/Claude-code-evaluation with message: "feat: implement Pro features — branding removal, real reports with charts"

After committing, also run: git push origin main
```

---

## PROMPT P4-4: Honest Pricing — Align Promises with Reality

```
You are aligning ScatterPilot's pricing page with what actually exists. The repo root is ~/Claude-code-evaluation. Frontend at scatterpilot/frontend/.

Read ~/Claude-code-evaluation/FEATURE_AUDIT.md to understand what's implemented vs. not.

After P4-3, the state should be:
- Solo: all features live ✅
- Pro: branding removal ✅, reports ✅, priority AI ❓, invoice templates ❓
- Agency: team seats ❌, client portal ❌, API access ❌, custom integrations ❌, dedicated support ❌

YOUR TASK: Update the pricing page to be HONEST about what's available now vs. coming soon, while still being compelling.

### FIRST: Clean Up Old Pricing References

The old Pricing.jsx (free/$18 model) should have been deleted in P4-3. Verify it's gone. If any references remain — old routes, navigation links, landing page sections pointing to the wrong pricing component — clean them up now.

Verify that ONLY one pricing model exists across the entire app:
- Solo: $29/mo / $290/yr
- Pro: $49/mo / $490/yr
- Agency: $99/mo / $990/yr

If the landing page pricing section uses different data/components than the in-app PricingPage.jsx, consolidate them to use the same plan definitions.

### Updated Pricing Card Content

**Solo ($29/mo):**
- ✓ Unlimited invoices
- ✓ Unlimited clients
- ✓ AI invoice creation
- ✓ Stripe payments
- ✓ Professional PDF invoices
- ✓ Client management
(All true and live. No changes needed.)

**Pro ($49/mo):**
- Everything in Solo, plus:
- ✓ Clean invoices — no ScatterPilot branding
- ✓ Reports & analytics dashboard
- ✓ Priority support (change from "Priority AI" — this is more honest and deliverable. Set up a support@scatterpilot.com email and respond faster for Pro users.)
- 🔜 Invoice templates — "Coming soon" tag
(Remove "Priority AI" claim unless there's actual differentiation in the AI. Replace with something real. Add a subtle "Coming soon" badge next to unreleased features — style it as a small pill: bg-amber-50 text-amber-600 text-label-sm px-2 py-0.5 rounded-pill)

**Agency ($99/mo):**
- Everything in Pro, plus:
- 🔜 Team seats — "Coming Q3 2026"
- 🔜 Client portal — "Coming Q3 2026"
- 🔜 API access — "Coming Q3 2026"
- ✓ Dedicated support — (Provide a direct email/Calendly link for Agency users)
(Be transparent that these are coming. The Agency tier should still be available but position it as an early adopter price — "Lock in Agency pricing now. Features launching Q3 2026.")

### Design for "Coming Soon" Features

For features with the 🔜 tag:
- Show the feature name normally
- Append a small badge: "Soon" in bg-amber-50 text-amber-600 border border-amber-200 text-label-sm rounded-pill px-2 py-0.5
- Don't gray out or strike through — it should feel like something exciting coming, not something missing

### Agency Card — Special Treatment

Add a note below the Agency feature list:
"Early adopter pricing. Lock in $99/mo before features launch and prices increase."

This creates urgency while being transparent about the timeline.

### In-App Pricing Page

Update BOTH:
1. The landing page pricing section (LandingPage.jsx)
2. The in-app pricing page (PricingPage.jsx)

Make sure they show the SAME features — no discrepancy between what the public site says and what logged-in users see.

### FAQ Updates

Update the FAQ answers:

"What happens when my trial ends?"
→ "Your 14-day Pro trial gives you full access to all Pro features. After it ends, you can choose any plan or continue viewing your existing data. You won't lose anything."

"Can I change plans?"
→ "Yes, you can upgrade, downgrade, or cancel anytime from your Settings page. Changes take effect immediately."

Add a new FAQ:
"When are Agency features launching?"
→ "Team seats, client portal, and API access are in active development and launching Q3 2026. Subscribe to Agency now to lock in the current pricing."

Commit from ~/Claude-code-evaluation with message: "feat: align pricing with reality — honest feature labels, coming soon badges"

After committing, also run: git push origin main
```

---

## PROMPT P4-5: Mobile-First Responsive Redesign

```
You are making ScatterPilot fully responsive and mobile-first. The repo root is ~/Claude-code-evaluation. Frontend at scatterpilot/frontend/.

CRITICAL CONTEXT: The app currently has a fixed 220px sidebar that takes up half the screen on mobile. Cards get squeezed, buttons wrap, and the experience is unusable on phones. This needs to become a professional mobile experience. Consultants check invoices on their phones between meetings — mobile isn't optional.

Explore:
- Layout.jsx and Sidebar.jsx — how the sidebar currently works
- Every page component — check for hardcoded widths, fixed positioning issues
- The current Tailwind config for any existing responsive breakpoints
- The landing page — check its mobile behavior
- Auth pages — check mobile layout
- The invoice creation slide-over panel — especially problematic on mobile

YOUR TASK: Make every screen in ScatterPilot work beautifully on mobile (375px+), tablet (768px+), and desktop (1024px+).

### Sidebar → Mobile Navigation

**Desktop (1024px+):** Keep the current fixed 220px sidebar. No changes.

**Tablet (768px-1023px):** Collapse sidebar to icon-only mode:
- 64px wide, show only icons (no labels)
- Tooltip on hover showing the label
- Logo: show only the mark, not wordmark
- "+ New Invoice" becomes a "+" icon button

**Mobile (<768px):** Replace sidebar entirely with bottom navigation:
- Fixed bottom bar, 64px height, bg-surface-card border-t border-surface-border
- 5 icons in a row: Home, Clients, Invoices, Reports, Settings (or a "More" menu)
- Active state: text-sage-500, inactive: text-ink-tertiary
- The "New Invoice" button moves to a floating action button (FAB):
  - Fixed position, bottom-20 right-4 (above the bottom nav)
  - 56px circle, bg-sage-500, white "+" icon
  - shadow-dropdown for depth
  - This is the PRIMARY action — it should be the most prominent thing on mobile

**Remove the ml-[220px] offset on mobile** — content should be full-width.

### Page-Level Responsive Fixes

**Dashboard (Home):**
- Metric cards: stack vertically on mobile (flex-col), horizontal on desktop (flex-row)
- "You're owed" card: full width on mobile
- Needs Attention list: full width, cards stack
- Activity feed: full width

**Clients Page:**
- Grid: 1 column on mobile, 2 on tablet, 3 on desktop (grid-cols-1 md:grid-cols-2 lg:grid-cols-3)
- Client cards: full width on mobile
- Search bar: full width on mobile

**Client Detail Page:**
- Stats bar: 2x2 grid on mobile instead of 4-column row
- Invoice table: horizontal scroll on mobile OR card view (each invoice as a card instead of table row)

**Invoices Page:**
- Status filter pills: horizontally scrollable on mobile (overflow-x-auto, no wrap)
- Stats bar: stack or scroll on mobile
- Invoice table on mobile: switch to card view
  - Each invoice becomes a card showing: client name, amount, status badge, date
  - Tap card → opens slide-over or navigates to detail
  - Don't try to render a table on a 375px screen

**Invoice Creation Panel:**
- Desktop: 480px slide-over from right (keep as-is)
- Mobile: full-screen overlay instead of slide-over
  - Takes over the entire screen
  - Header with back arrow (not X) to close
  - Chat area fills available space
  - Input area sticky at bottom with proper keyboard handling
  - This is crucial — creating an invoice on mobile should feel like using iMessage

**Invoice Preview/Detail:**
- Full width on mobile
- Action buttons stack vertically or use a compact icon bar
- PDF preview: offer download button prominently (PDFs are hard to preview on mobile)

**Pricing Page:**
- Plan cards: stack vertically on mobile (1 column)
- Monthly/Annual toggle: centered, comfortable tap target (44px+ height)
- Feature lists: readable at mobile font sizes

**Settings Page:**
- Cards: full width, stack vertically
- Buttons: full width on mobile
- Stripe connection status: readable single-column layout

**Reports Page:**
- Charts: full width, stack vertically (1 column on mobile, 2x2 grid on desktop)
- Charts should be touch-friendly

### Landing Page Mobile

- Hero: single column, image/mockup below text (not beside)
- Navigation: hamburger menu on mobile with slide-out drawer
- Pricing cards: stack vertically
- Features: single column, image above/below text
- Testimonials: single column or horizontal scroll
- Footer: 2-column grid on mobile (instead of 4)

### Auth Pages Mobile

- Card should be nearly full-width on mobile: max-w-md → w-full px-4 on small screens
- Inputs should be comfortable tap targets (min 44px height)
- Buttons: full width

### Global Mobile Fixes

- All tap targets: minimum 44x44px (Apple HIG guideline)
- No horizontal scroll on any page (overflow-x-hidden on body for mobile)
- Font sizes: don't go below 14px on mobile for body text
- Padding: reduce px-8 to px-4 on mobile throughout
- Modals: full-screen on mobile instead of centered overlay with backdrop
- Toasts: full-width at bottom on mobile instead of fixed bottom-right

### Technical Approach

- Use Tailwind responsive prefixes throughout: default styles are mobile, md: for tablet, lg: for desktop
- Create a useMediaQuery hook or useBreakpoint hook if one doesn't exist:
  ```javascript
  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  ```
- Use this hook sparingly — prefer Tailwind responsive classes over JS-driven layout changes
- Only use the hook for structural changes (sidebar → bottom nav, table → cards)

### Testing Checklist

After implementation, verify these screens at 375px width:
- [ ] Landing page — hero, features, pricing, footer
- [ ] Sign up page
- [ ] Login page
- [ ] Onboarding (all 4 steps)
- [ ] Dashboard with invoices
- [ ] Dashboard empty state
- [ ] Clients list
- [ ] Client detail
- [ ] Invoices list
- [ ] Invoice creation (chat)
- [ ] Invoice preview
- [ ] Settings
- [ ] Pricing page
- [ ] Reports
- [ ] Public invoice page (/pay/:id)

Commit from ~/Claude-code-evaluation with message: "feat: mobile-first responsive redesign — bottom nav, card views, full-screen panels"

After committing, also run: git push origin main
```

---

## PROMPT P4-6: Voice Invoice Creation

```
You are adding voice input to ScatterPilot's invoice creation chat. The repo root is ~/Claude-code-evaluation. Frontend at scatterpilot/frontend/.

CONTEXT: ScatterPilot's core pitch is "describe your invoice like you'd tell your assistant." On mobile, the most natural way to do this is by speaking. Users should be able to tap a microphone button and dictate their invoice details just like sending a voice text.

Explore:
- The invoice creation chat component (InvoiceCreationPanel.jsx or ChatInterface.jsx)
- How the chat input works (the text input, send button, submission handler)
- Whether any speech/voice libraries are already installed

YOUR TASK: Add full conversational voice to the invoice creation chat — voice INPUT (user speaks) AND voice OUTPUT (ScatterPilot speaks back) using the Web Speech API.

### How It Works

Two browser-native APIs, both free, both zero-dependency:

1. **SpeechRecognition** (voice input) — user speaks, browser transcribes to text, text goes into chat
2. **SpeechSynthesis** (voice output) — AI responds with text, browser reads it aloud

Together they create a full voice conversation. The user taps mic, says "Invoice Acme Corp for 10 hours of consulting at $250 per hour, due in 30 days" — ScatterPilot responds OUT LOUD: "Got it. I've created an invoice for Acme Corp — 10 hours of consulting at $250 per hour, totaling $2,500, due in 30 days. Want me to send it?" — user says "Yes, send it."

This is the assistant experience. Like talking to a real office manager.

### UI Design

Add a microphone button to the chat input area:

**Desktop layout:**
```
┌─────────────────────────────────────────┐
│ [text input                    ] 🎤 [→] │
└─────────────────────────────────────────┘
```
- Microphone icon button: between the text input and send button
- Default state: text-ink-tertiary, ghost button style
- Supported: normal mic icon

**Mobile layout (full-screen chat):**
```
┌─────────────────────────────────────────┐
│ [text input                  ] 🎤  [→]  │
└─────────────────────────────────────────┘
```
- Same position, but slightly larger tap target on mobile (44x44px)

**Recording state:**
- Mic button turns: bg-danger-400 text-white (red pulse to indicate recording)
- Add a CSS pulse animation: `animate-pulse` or custom keyframe with scale
- The text input shows real-time transcription as the user speaks
- A small "Listening..." label appears above or inside the input
- Tap the mic button again to stop recording

**After recording stops:**
- The transcribed text sits in the input field, editable
- User can review/edit before sending
- User hits send (or it auto-sends — make this configurable, default to NOT auto-send so user can review)

### Implementation

Create a custom hook: `frontend/src/hooks/useVoiceInput.js`

```javascript
import { useState, useRef, useCallback, useEffect } from 'react';

export function useVoiceInput({ onTranscript, onEnd, language = 'en-US' }) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;        // Keep listening until stopped
      recognition.interimResults = true;    // Show results as user speaks
      recognition.lang = language;
      
      recognition.onresult = (event) => {
        let interim = '';
        let final = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }
        
        setInterimTranscript(interim);
        if (final) {
          onTranscript?.(final);
        }
      };
      
      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
        onEnd?.();
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setInterimTranscript('');
      };
      
      recognitionRef.current = recognition;
    }
    
    return () => {
      recognitionRef.current?.abort();
    };
  }, [language]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  }, [isListening]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    isSupported,
    interimTranscript,
    startListening,
    stopListening,
    toggleListening,
  };
}
```

### Integration with Chat Input

In the chat input component:

1. Import and use the hook
2. Wire onTranscript to append text to the input value
3. Show interim transcript in the input as a grayed-out preview
4. The mic button only renders if `isSupported` is true (graceful degradation)

```javascript
const { isListening, isSupported, interimTranscript, toggleListening } = useVoiceInput({
  onTranscript: (text) => {
    setInputValue(prev => prev + (prev ? ' ' : '') + text);
  },
});
```

### Microphone Button Component

```jsx
{isSupported && (
  <button
    onClick={toggleListening}
    className={`
      flex items-center justify-center w-10 h-10 rounded-full transition-all duration-150
      ${isListening 
        ? 'bg-danger-400 text-white animate-pulse' 
        : 'text-ink-tertiary hover:text-ink-secondary hover:bg-surface-hover'
      }
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
```

### Listening Indicator

When recording, show a subtle indicator near the input:

```jsx
{isListening && (
  <div className="absolute -top-8 left-0 flex items-center gap-2 text-body-sm text-danger-400">
    <span className="w-2 h-2 bg-danger-400 rounded-full animate-pulse" />
    Listening...
  </div>
)}
```

And show interim (in-progress) transcript as ghost text in the input:
```jsx
{interimTranscript && (
  <span className="text-ink-tertiary italic">{interimTranscript}</span>
)}
```

### Browser Permissions

The first time the user taps the mic, the browser will ask for microphone permission. This is standard — no additional permission UI needed from our side. If the user denies permission, `isSupported` effectively becomes false and the mic button can be hidden or show a tooltip: "Microphone access denied."

### Edge Cases

- If speech recognition isn't supported (older browsers): mic button simply doesn't render
- If user speaks and no text is detected: input stays empty, no error
- If user is already typing and taps mic: append voice text after existing text
- Network issues: the Web Speech API on Chrome requires internet (it sends audio to Google). Safari's speech recognition works offline. Handle the error gracefully — catch it in onerror and stop listening.
- Long dictation: continuous mode handles this. The user can speak for as long as they want.

### DO NOT:
- Add any backend endpoints — this is purely frontend
- Install any npm packages — both Speech APIs are native browser APIs
- Change how the AI processes messages — voice text goes through the same chat pipeline as typed text
- Break the existing typed input behavior
- Auto-enable voice mode — it should always be opt-in via the mic button

### Voice Output — Speech Synthesis

Create a custom hook: `frontend/src/hooks/useVoiceOutput.js`

```javascript
import { useState, useCallback, useRef } from 'react';

export function useVoiceOutput() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef(null);

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const speak = useCallback((text) => {
    if (!isSupported || !text) return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;       // Normal speed
    utterance.pitch = 1.0;      // Normal pitch
    utterance.volume = 1.0;
    
    // Prefer a natural-sounding voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => 
      v.name.includes('Samantha') ||  // macOS/iOS
      v.name.includes('Google US English') ||  // Chrome
      v.name.includes('Microsoft') ||
      (v.lang === 'en-US' && v.localService)
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
    
    if (preferred) utterance.voice = preferred;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isSupported]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking, isSupported };
}
```

### Voice Conversation Mode

The voice experience has TWO modes, controlled by whether the user initiated via mic:

**Text mode (default):** User types, AI responds as text. Normal chat. No voice output.

**Voice mode (activated by tapping mic):** User speaks, AI responds BOTH as text AND spoken aloud. Voice mode stays active until:
- User types a message manually (switches back to text mode)
- User taps a "mute" button to silence responses
- The conversation ends / panel closes

Track this with a state variable:
```javascript
const [voiceMode, setVoiceMode] = useState(false);
```

When `voiceMode` is true and a new AI message arrives in the chat:
```javascript
useEffect(() => {
  if (voiceMode && latestAiMessage && !isSpeaking) {
    speak(latestAiMessage.text);
    // After speaking finishes, automatically start listening again
    // so the user can respond without tapping the mic again
  }
}, [latestAiMessage, voiceMode]);
```

**Auto-resume listening:** After ScatterPilot finishes speaking, automatically restart the speech recognition so the user can respond immediately — true hands-free conversation. The flow is:
1. User taps mic → starts listening
2. User speaks → transcribed → sent to AI
3. AI responds → text appears in chat AND is spoken aloud
4. Speech finishes → automatically start listening again
5. User speaks next response → loop continues
6. User taps mic to end voice mode, or types manually

### Voice Mode Indicator

When voice mode is active, show a subtle indicator at the top of the chat panel:

```jsx
{voiceMode && (
  <div className="flex items-center justify-center gap-2 py-2 bg-sage-50 border-b border-surface-border text-body-sm text-sage-600">
    <svg className="w-4 h-4" /* speaker icon */ />
    Voice mode active
    <button onClick={() => setVoiceMode(false)} className="text-ink-tertiary hover:text-ink-primary ml-2">
      Turn off
    </button>
  </div>
)}
```

### Speaking Indicator on AI Messages

When ScatterPilot is speaking an AI message, show a small speaker animation on that message bubble:

```jsx
{isSpeaking && message.id === currentlySpeakingMessageId && (
  <span className="inline-flex items-center gap-1 ml-2 text-sage-500">
    <span className="w-1 h-3 bg-sage-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
    <span className="w-1 h-4 bg-sage-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
    <span className="w-1 h-3 bg-sage-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
  </span>
)}
```

### Test Scenarios

After implementation, verify:
1. Desktop Chrome: mic button appears, click records, text appears in input
2. Mobile Safari: mic button appears, tap records, tap stops, text in input
3. Mobile Chrome: same as Safari
4. Browser without support: mic button hidden, typed input works normally
5. User types some text, then uses voice: voice text appends after typed text
6. Rapid toggle: clicking mic on/off quickly doesn't crash
7. Voice mode: tap mic, speak, AI responds in text AND aloud
8. Auto-resume: after AI finishes speaking, listening restarts automatically
9. Exit voice mode: user types manually → voice mode deactivates, AI stops speaking responses
10. Mute: tapping "Turn off" in voice mode banner stops speech and returns to text mode
11. Long AI response: speech handles multi-sentence responses without cutting off
12. Interruption: user taps mic while AI is speaking → stops speech, starts listening

Commit from ~/Claude-code-evaluation with message: "feat: conversational voice — speak invoices, ScatterPilot talks back, hands-free mode"

After committing, also run: git push origin main
```

---

# EXECUTION ORDER

1. **P4-1:** Feature Audit (creates FEATURE_AUDIT.md — no code changes)
2. **P4-2:** Logo & Brand Identity (visual system, extended palette)
3. **P4-3:** Build Pro Features (branding removal, real reports)
4. **P4-4:** Honest Pricing (align promises with delivered features)
5. **P4-5:** Mobile-First Responsive Redesign (NEW)
6. **P4-6:** Conversational Voice Invoice Creation (NEW)

After Phase 4:
- Professional logo across all touchpoints
- Extended color palette for visual variety
- Pro features actually delivered
- Pricing that's honest and compelling
- Clear roadmap for Agency features
- Feature audit document for future planning
- Fully responsive mobile experience with bottom nav
- Conversational voice invoicing — speak to ScatterPilot, it talks back

# ScatterPilot Phase 3 — Landing Page & Pre-Auth Experience

**Focus:** Transform the entire pre-authentication experience — landing page, auth screens, and public-facing pages — to match the premium quality of the in-app experience.

The repo root is `~/Claude-code-evaluation` and the frontend is at `~/Claude-code-evaluation/scatterpilot/frontend/`. Always commit from the repo root. After committing, also run: `git push origin main`

---

## PROMPT P3-1: Landing Page — Complete Redesign

```
You are completely redesigning the ScatterPilot landing page. ScatterPilot is an AI-powered invoicing platform for high-earning consultants ($150-500/hr) and agencies ($5k-50k/month). The repo root is ~/Claude-code-evaluation. Frontend at scatterpilot/frontend/.

CRITICAL CONTEXT: The in-app experience uses a premium sage-green design system (primary #4A6741, background #FAFBF9, text #1A2318, font DM Sans). The current landing page uses a completely different, generic purple-gradient aesthetic that looks like a vibe-coded side project. This redesign MUST bring the landing page into visual alignment with the app interior — same fonts, same color palette, same level of polish.

Explore:
- The current landing page component (likely src/pages/LandingPage.jsx or similar)
- The current landing page CSS/styles
- The router configuration to understand how the landing page is served
- The design system tokens in tailwind.config.js (sage palette, typography, shadows, etc.)

YOUR TASK: Completely rebuild the landing page to convert high-earning professionals.

### Design Direction
- Light background (#FAFBF9), sage accents, DM Sans typography
- Stripe-level confidence and whitespace
- One primary CTA throughout: "Start Free Trial" (sage-500 button)
- Secondary CTA: "Watch Demo" or "See How It Works" (outlined)
- NO purple, NO pink gradients, NO generic clip art
- The page should feel like a premium financial tool, not a startup experiment

### Page Structure (top to bottom)

**Navigation Bar:**
- Fixed top, bg-white/80 backdrop-blur-md border-b border-surface-border
- Left: ScatterPilot logo/wordmark (use the sage "S" monogram + "ScatterPilot" in font-display font-semibold)
- Center (desktop): Features, Pricing, About
- Right: "Log In" (ghost button) + "Start Free Trial" (primary sage button, small)
- Clean, minimal, 64px height

**Hero Section:**
```
The smartest way to invoice.
Get paid faster.

AI-powered invoicing for consultants and agencies
who value their time. Create professional invoices
in 30 seconds — not 30 minutes.

[Start Free Trial]  [See How It Works]

No credit card required · 14-day free trial · Cancel anytime
```

- Headline: text-display-xl (56-64px), font-bold, text-ink-primary, max-w-3xl
- "Get paid faster." on second line in text-sage-500 for emphasis
- Subheadline: text-body-lg (18px), text-ink-secondary, max-w-xl, mt-4
- CTA buttons: mt-8, primary sage + secondary outlined, gap-4
- Trust line below buttons: text-body-sm text-ink-tertiary, mt-4
- Right side (or below on mobile): a REAL screenshot/mockup of the ScatterPilot dashboard showing the sage sidebar, metric cards, and "You're owed" display. Build this as a styled component that looks like a browser window with the actual app UI inside it — NOT a generic illustration. Use a slightly rotated perspective (transform: perspective(1000px) rotateY(-5deg)) with shadow-modal for depth.

**Social Proof Bar:**
- Below hero, py-12, border-y border-surface-border
- Center: "Trusted by consultants and agencies worldwide"
- Below: key stats in a row:
  - "$2M+ invoiced" 
  - "500+ invoices sent"
  - "30 second average creation time"
  - "4.9/5 user rating"
- Stats in text-heading font-semibold, labels in text-body-sm text-ink-tertiary
- NOTE: These are aspirational/launch numbers. Replace with real data as it grows.

**How It Works — 3 Steps:**
- Section title: "Invoice in three steps" in text-display, centered
- Three columns (grid-cols-3 on desktop):

Step 1: "Describe your work"
- Icon: chat bubble (sage-100 bg, sage-500 icon)
- "Tell ScatterPilot about your project in plain English. No forms, no templates — just a natural conversation."

Step 2: "AI creates your invoice"  
- Icon: document with sparkle
- "Our AI extracts the details, formats everything professionally, and generates a polished PDF in seconds."

Step 3: "Send & get paid"
- Icon: dollar/payment
- "Share a payment link or download the PDF. Your client pays online — money hits your bank account."

- Each step: Card component with p-6, subtle numbering ("01", "02", "03" in text-display text-sage-200 as a background watermark element)

**Features Section:**
- Section title: "Everything you need. Nothing you don't." centered
- Alternating left-right layout (feature text + product screenshot), 3 features:

Feature 1: "AI that speaks your language"
- "Describe your invoice like you'd text a colleague. ScatterPilot's AI understands context, calculates totals, and creates professional invoices from natural conversation."
- Right: mockup of the chat panel with AI conversation

Feature 2: "Know your numbers instantly"  
- "See exactly how much you're owed, what's been paid, and what's overdue — the moment you open the app."
- Left: mockup of the dashboard metric cards

Feature 3: "Get paid without chasing"
- "Send invoices with built-in payment links. Clients pay with one click. No more awkward follow-up emails."
- Right: mockup of a public invoice page with the Pay button

For mockups: build these as actual styled div components that replicate the real UI (using the sage design system), wrapped in a browser-chrome frame. This is WAY more convincing than screenshots or illustrations.

**Pricing Section:**
- Section title: "Simple, transparent pricing" centered
- Monthly/Annual toggle (same as PricingPage.jsx)
- Three plan cards: Solo ($29), Pro ($49, featured), Agency ($99)
- Same design as the in-app pricing page but adapted for landing page context
- Each card: bg-surface-card rounded-card shadow-card border, feature lists with checkmarks
- CTA: "Start Free Trial" on each card
- Below: "14-day free trial on all plans. No credit card required."
- REUSE the pricing data/structure from PricingPage.jsx if possible — don't duplicate the plan definitions

**Testimonial Section:**
- Section title: "Built for professionals who bill big"
- 2-3 testimonial cards in a row
- Each: quote text in text-body-lg italic, person name + role + company below
- Use placeholder testimonials for now with realistic consulting/agency personas:
  - "ScatterPilot cut my invoicing time from 30 minutes to 30 seconds. I actually look forward to billing now." — Sarah K., Brand Strategist
  - "The AI understood my project scope on the first try. My clients comment on how professional my invoices look." — Marcus T., UX Consultant  
  - "I switched from Bonsai because ScatterPilot's invoice creation is genuinely faster. The payment links are a game-changer." — Priya R., Agency Director
- Style: bg-surface-card rounded-card p-6 shadow-card
- Photo: use initial circles (like the app's client avatars) — bg-sage-100 text-sage-600

**Final CTA Section:**
- Full-width section, bg-sage-900 text-white, py-20
- "Ready to get paid faster?" in text-display-lg text-white
- "Start your free 14-day trial. No credit card required." in text-body-lg text-sage-200
- [Start Free Trial] button — bg-white text-sage-900 (inverted), large
- Subtle: "Set up in under 2 minutes"

**Footer:**
- bg-ink-primary (#1A2318), text-white
- Four columns:
  - Product: Features, Pricing, Integrations, Changelog
  - Company: About, Blog, Careers, Contact
  - Resources: Help Center, API Docs, Status, Security
  - Legal: Privacy, Terms, Cookie Policy
- Bottom row: "© 2026 ScatterPilot" + social icons (minimal)
- "Powered by AWS" or similar trust badge (optional)
- Most links can be "#" for now — just build the structure

### Technical Requirements
- The landing page MUST use the same Tailwind config and design tokens as the app
- Smooth scroll to sections when clicking nav links (Features, Pricing)
- "Start Free Trial" and "Sign Up" buttons → navigate to /signup
- "Log In" → navigate to /login
- Responsive: looks great on desktop, tablet, and mobile
- Performance: no heavy images — the mockups are built with CSS/HTML components
- Animation: subtle fade-in on scroll for each section (use Intersection Observer, not a heavy library). Keep it tasteful — this is a financial tool, not a portfolio site.

### What to Remove
- ALL existing landing page styles that don't use the design system (purple, pink, gradients)
- The generic invoice mockup illustration
- "Join 80+ founders" social proof with colored circles
- "Watch Demo" button if there's no demo to watch (replace with "See How It Works" that scrolls to the steps section)
- Any CSS that conflicts with the sage design system

After committing, also run: git push origin main

Commit from ~/Claude-code-evaluation with message: "feat: complete landing page redesign — sage design system, product mockups, conversion-optimized"
```

---

## PROMPT P3-2: Auth Pages — Sign In, Sign Up, Verification

```
You are redesigning ScatterPilot's authentication pages to match the sage design system. The repo root is ~/Claude-code-evaluation. Frontend at scatterpilot/frontend/.

Explore:
- Current auth page components (login, signup, verification, forgot password)
- How auth pages are styled currently (the purple-pink gradient buttons)
- The auth flow (Cognito integration, how forms submit)
- The design system in tailwind.config.js

YOUR TASK: Restyle ALL auth pages to match the sage brand. Do NOT change any auth logic, Cognito integration, or form behavior — ONLY the visual design.

### Design Direction

Auth pages should feel like a calm, confident extension of the landing page. The user just came from a sage-green professional landing page — the login screen should feel like the same product.

### Common Layout (all auth pages)

- Background: bg-surface-bg (#FAFBF9) — NOT the current light blue/purple
- Centered card: max-w-md mx-auto mt-20, bg-surface-card rounded-card shadow-modal border border-surface-border p-8
- Above the card: ScatterPilot wordmark/logo centered (same as landing page nav), mb-8
- Below the card: subtle footer text "© 2026 ScatterPilot" in text-body-sm text-ink-tertiary

### Sign In Page (/login)

```
        SCATTERPILOT

┌─────────────────────────────────┐
│                                 │
│   Welcome back                  │
│   Sign in to your account       │
│                                 │
│   Email address                 │
│   ┌───────────────────────────┐ │
│   │ you@example.com           │ │
│   └───────────────────────────┘ │
│                                 │
│   Password                      │
│   ┌───────────────────────────┐ │
│   │ ••••••••                  │ │
│   └───────────────────────────┘ │
│              Forgot password? → │
│                                 │
│   ┌───────────────────────────┐ │
│   │        Sign in            │ │
│   └───────────────────────────┘ │
│                                 │
│   Don't have an account? Sign up│
│                                 │
└─────────────────────────────────┘
```

- "Welcome back" in text-heading-lg text-ink-primary
- "Sign in to your account" in text-body text-ink-secondary
- Inputs: use the design system Input component (sage focus ring, rounded-input)
- Sign in button: full width, bg-sage-500 hover:bg-sage-600 text-white rounded-button py-3 font-medium
  - NO purple/pink gradient
- "Forgot password?" link: text-body-sm text-sage-500 hover:text-sage-600, right-aligned
- "Don't have an account? Sign up" — text-body-sm text-ink-secondary, "Sign up" as text-sage-500 link

### Sign Up Page (/signup)

Same card layout. Content:
- "Create your account" heading
- "Start your 14-day free trial" subheading in text-ink-secondary
- Fields: Email, Password (with requirements hint below in text-body-sm text-ink-tertiary)
- "Create account" button: same sage-500 primary style
- "Already have an account? Sign in" at bottom
- Below the button: "By creating an account, you agree to our Terms of Service and Privacy Policy" in text-body-sm text-ink-tertiary

### Email Verification Page

Same card layout. Content:
- "Verify your email" heading
- "We sent a verification code to [email]" in text-body text-ink-secondary
- The email shown in font-medium text-ink-primary
- Verification code input: centered, large (text-heading-lg inside, py-4), tracking-widest for the digits
- "Verify Email" sage button
- "Resend code" link in text-sage-500
- "Back to signup" link in text-ink-tertiary

### Forgot Password Page

Same card layout. Content:
- "Reset your password" heading
- "Enter your email and we'll send you a reset code" subtext
- Email input
- "Send reset code" sage button
- "Back to sign in" link

### Reset Password Page (after getting code)

Same card layout. Content:
- "Set new password" heading
- Code input
- New password input
- Confirm password input
- "Reset password" sage button

### Styling Rules
- ALL buttons on auth pages: bg-sage-500 hover:bg-sage-600 text-white. NO purple. NO gradients.
- ALL inputs: border-surface-border focus:border-sage-500 focus:ring-sage-500/20
- ALL links: text-sage-500 hover:text-sage-600
- Error states: text-danger-400, border-danger-400
- Loading states on buttons: show a spinner, disable the button
- Transitions: transition-all duration-150 on all interactive elements

### DO NOT CHANGE:
- Cognito auth logic
- Form submission handlers
- Token management
- Route protection
- Any API calls

ONLY change the visual CSS/Tailwind classes and layout structure.

After committing, also run: git push origin main

Commit from ~/Claude-code-evaluation with message: "feat: redesign auth pages — sage design system, professional login/signup/verification"
```

---

## PROMPT P3-3: Polish Pass — Visual Consistency Across All Public Pages

```
You are doing a final visual consistency pass across ALL public-facing ScatterPilot pages. The repo root is ~/Claude-code-evaluation. Frontend at scatterpilot/frontend/.

YOUR TASK: Ensure every page a user can see BEFORE logging in is visually consistent with the sage design system.

### Pages to Check & Fix:

1. **Landing page** — verify it uses sage design system throughout, no remnant purple/pink/blue styles
2. **Auth pages** (login, signup, verification, forgot password, reset password) — verify sage styling
3. **Public invoice page** (/pay/:invoiceId) — verify it matches the sage brand
4. **Payment success page** (/pay/:invoiceId/success) — verify sage styling
5. **Any 404/error page** — if one exists, restyle it; if not, create a simple one

### Specific Things to Hunt Down and Fix:

1. **CSS conflicts:** Search the entire frontend codebase for any remaining hardcoded colors that don't belong:
   - Search for: #6B46C1, #805AD5, #9F7AEA, purple, violet, indigo (the old purple theme)
   - Search for: pink, gradient, bg-gradient (old button gradients)
   - Search for: any hex color (#xxx) that isn't part of the sage design system
   - Replace all with appropriate sage design system equivalents

2. **Font consistency:** Every page should use DM Sans. Search for any font-family declarations that reference other fonts and remove them (except JetBrains Mono for code/monospace).

3. **Button consistency:** Every button on every public page should use the sage button styles. No purple, no gradients, no off-brand colors.

4. **Favicon & Meta:**
   - Ensure the sage "S" favicon (from Phase 1) is in place
   - Update <title> to "ScatterPilot — AI-Powered Invoicing"
   - Update meta description: "Create professional invoices in 30 seconds with AI. Built for consultants and agencies who value their time. Start your free trial."
   - Add Open Graph tags:
     - og:title: "ScatterPilot — AI-Powered Invoicing"
     - og:description: same as meta description
     - og:type: "website"
     - og:url: "https://scatterpilot.com"

5. **Cookie banner** — if there's a cookie consent banner, restyle it to match the sage design system (bg-surface-card, sage buttons, not the default blue/generic style)

6. **Loading states:** If there's a global loading/splash screen shown before the app mounts, make sure it shows the ScatterPilot brand mark on the sage background, not a generic spinner.

7. **Scroll behavior:** Ensure smooth scrolling is enabled globally (html { scroll-behavior: smooth; })

8. **Mobile responsiveness:** Test that the landing page, auth pages, and public invoice page all look good at 375px width (iPhone). Fix any overflow, cramped text, or broken layouts.

### Build Verification
Run `cd scatterpilot/frontend && npm run build` — fix any errors.

After committing, also run: git push origin main

Commit from ~/Claude-code-evaluation with message: "feat: visual consistency pass — purge legacy colors, meta tags, responsive fixes"
```

---

# EXECUTION ORDER

1. **P3-1:** Landing Page Redesign → commit → push → verify at scatterpilot.com
2. **P3-2:** Auth Pages Redesign → commit → push → verify login/signup flows
3. **P3-3:** Polish Pass → commit → push → full visual audit

After Phase 3, the experience from first impression to daily use is one cohesive, premium brand. No more jarring transitions between a generic landing page and a premium app interior.

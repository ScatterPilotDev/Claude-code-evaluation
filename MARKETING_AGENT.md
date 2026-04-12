# ScatterPilot Marketing Agent Setup

The repo root is `~/Claude-code-evaluation`. Always commit from the repo root. After committing, also run: `git push origin main`

---

## PROMPT: Marketing Task Scheduler + Strategy Tracker

```
You are building a marketing task system for ScatterPilot. The repo root is ~/Claude-code-evaluation. Backend at scatterpilot/functions/. Infrastructure at scatterpilot/infrastructure/template.yaml.

IMPORTANT: AWS Organization policy blocks new CloudFormation stack creation — ONLY update the existing scatterpilot-vm-staging stack. SES is in sandbox — can only send to verified addresses. Recipient: ale@scatterpilot.com.

### TASK 1: Create the Marketing Strategy Document

Create ~/Claude-code-evaluation/MARKETING.md — a living strategy document that tracks goals, content calendar, and progress:

```markdown
# ScatterPilot Marketing Strategy
Last updated: 2026-04-12

## Mission
Get the first 10 paying customers through direct outreach, content marketing, and community engagement. No paid ads until product-market fit is confirmed.

## Target Customer
- Solo consultants billing $150-500/hr
- Small agency owners (2-10 people) billing $5k-50k/month
- Freelancers tired of complex invoicing tools
- People who already use Stripe

## Key Message
"ScatterPilot creates professional invoices in 30 seconds through AI conversation. Stop formatting — start getting paid."

---

## Content Calendar

### Week 1 (Launch Week)
- [x] Day 1 (Apr 11): LinkedIn launch post — "ScatterPilot isn't perfect. But it's here!" — POSTED
- [ ] Day 3 (Apr 13): LinkedIn — short post with screenshot/screen recording of creating an invoice in 30 seconds
  - Content angle: Show, don't tell. Record yourself creating a real invoice via the AI chat.
  - Caption: "30 seconds. That's how long it takes to create a professional invoice with ScatterPilot. No templates, no forms — just tell it what the work was. [link]"
- [ ] Day 5 (Apr 15): LinkedIn — problem-focused post
  - Content angle: The pain of invoicing
  - Caption: "I used to spend 30 minutes per invoice — formatting line items in Word, saving as PDF, attaching to email. Now I just tell ScatterPilot: 'Invoice Acme for 10 hours of strategy consulting at $250/hr, net 30.' Done. [link]"
- [ ] Day 7 (Apr 17): LinkedIn — feature spotlight (voice invoicing)
  - Content angle: The voice feature as a differentiator
  - Caption: "What if you could create an invoice by just talking? ScatterPilot's voice mode lets you dictate your invoice like you're talking to an assistant. It talks back to confirm the details. Try it. [link]"

### Week 2
- [ ] Day 8 (Apr 18): LinkedIn — social proof / early feedback
  - Share any feedback from James or other testers (with permission)
- [ ] Day 10 (Apr 20): LinkedIn — behind the scenes / building in public
  - "I built ScatterPilot with AI. Here's what I learned about building a SaaS in 2026."
- [ ] Day 12 (Apr 22): LinkedIn — address objection
  - "Why would I pay $29/mo when I can just use a Word template?" — explain the time savings math

### Week 3
- [ ] Day 14 (Apr 24): Reddit post — r/freelance
  - Title: "I built a free tool that creates invoices from a conversation — looking for feedback"
  - Follow subreddit self-promo rules. Be genuine. Ask for feedback, not signups.
- [ ] Day 15 (Apr 25): LinkedIn — milestone or learning post
- [ ] Day 16 (Apr 26): Indie Hackers product launch
  - Create product page at indiehackers.com/products
  - Post: "Show IH: ScatterPilot — AI invoicing for consultants"
- [ ] Day 17 (Apr 27): LinkedIn — customer story (even if it's your own)

### Week 4
- [ ] Day 20 (Apr 30): Hacker News — Show HN post
  - Title: "Show HN: ScatterPilot – Create invoices by talking to an AI"
  - Post on a Tuesday or Wednesday morning for best visibility
  - Be in the comments, answer every question
- [ ] Day 21 (May 1): LinkedIn — monthly recap / what's next
- [ ] Review: assess what's working, double down on winning channels

### Ongoing (2-3x per week)
- Post about freelancing, consulting, getting paid — always with subtle ScatterPilot mention
- Engage with comments on every post (LinkedIn algorithm rewards engagement)
- Reply to freelancer/consultant posts with helpful advice (not pitches)
- Share wins: new signups, customer feedback, feature launches

---

## Direct Outreach Tracker

| Person | Relationship | Reached Out | Response | Signed Up | Converted |
|--------|-------------|-------------|----------|-----------|-----------|
| James J. | Friend / Cybersec | Apr 11 | Testing | Yes | Pending |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |

Goal: personally reach out to 10 people in Week 1-2.

---

## Community Posting Tracker

| Platform | Subreddit/Group | Date | Post Title | Link | Upvotes/Engagement |
|----------|----------------|------|------------|------|-------------------|
| LinkedIn | Feed | Apr 11 | Launch post | | |
| | | | | | |

---

## Growth Metrics (update weekly)

| Week | Signups | Active Trials | Conversions | MRR | Invoices Created |
|------|---------|--------------|-------------|-----|-----------------|
| W1 (Apr 11-17) | | | | | |
| W2 (Apr 18-24) | | | | | |
| W3 (Apr 25-May 1) | | | | | |
| W4 (May 2-8) | | | | | |

---

## Channel Strategy

### LinkedIn (PRIMARY — start here)
- Post 2-3x per week
- Content types: problem posts, feature demos, building in public, customer stories
- Engage in comments on other consultant/freelancer posts
- Connect with 5-10 target customers per week

### Reddit (SECONDARY — Week 3)
- r/freelance, r/consulting, r/smallbusiness, r/SaaS, r/entrepreneur
- Follow each sub's self-promo rules carefully
- Frame as asking for feedback, not selling
- Be helpful in other threads too — build reputation first

### Indie Hackers (SECONDARY — Week 3)
- Create product page
- Post launch story
- Engage in community — comment on other products
- Share revenue milestones (even $0 MRR is interesting if you're building in public)

### Hacker News (STRATEGIC — Week 4)
- One shot at Show HN — make it count
- Post Tuesday/Wednesday 9-11 AM ET
- Title must be concise and clear
- Be in comments for 2+ hours after posting
- Don't be salesy — HN hates that

### Twitter/X (OPTIONAL — when bandwidth allows)
- Mirror LinkedIn content
- Use #buildinpublic #freelance #indiehacker
- Engage with indie hacker community

---

## Not Now (Save for Later)
- Paid ads (Google, LinkedIn, Facebook) — wait until 20+ paying customers
- SEO / blog content — wait until product-market fit confirmed
- Affiliate program — wait until 50+ customers
- Product Hunt launch — wait until the product is more polished
- Partnerships — wait until established credibility
```

### TASK 2: Marketing Task Reminder Lambda

Create a Lambda that runs daily at 7:00 AM ET (1 hour before the stats digest) and emails the day's marketing tasks.

**File:** functions/analytics/marketing_tasks.py

**Schedule:** cron(0 11 * * ? *) — 11:00 UTC = 7:00 AM ET

**Logic:**

The Lambda reads ~/Claude-code-evaluation/MARKETING.md? No — Lambda can't read the repo at runtime. Instead, encode the task schedule directly in the Lambda code as a data structure:

```python
CONTENT_CALENDAR = [
    # (date_str, task_description, platform, content_type)
    ("2026-04-13", "Create and post a screen recording showing invoice creation in 30 seconds", "LinkedIn", "demo"),
    ("2026-04-15", "Post about the invoicing pain point — 30 minutes formatting vs 30 seconds with ScatterPilot", "LinkedIn", "problem"),
    ("2026-04-17", "Feature spotlight: voice invoicing — record yourself dictating an invoice", "LinkedIn", "feature"),
    ("2026-04-18", "Share early tester feedback (ask James for a quote first)", "LinkedIn", "social_proof"),
    ("2026-04-20", "Behind the scenes post — building a SaaS with AI in 2026", "LinkedIn", "building_in_public"),
    ("2026-04-22", "Address the objection: why pay $29 vs using a Word template?", "LinkedIn", "objection"),
    ("2026-04-24", "Post to r/freelance — frame as asking for feedback", "Reddit", "community"),
    ("2026-04-25", "LinkedIn milestone or learning post", "LinkedIn", "milestone"),
    ("2026-04-26", "Launch on Indie Hackers — create product page and launch post", "Indie Hackers", "launch"),
    ("2026-04-27", "Customer story post (even if it's your own experience)", "LinkedIn", "story"),
    ("2026-04-30", "Show HN post — Tuesday morning, be in comments all day", "Hacker News", "launch"),
    ("2026-05-01", "Monthly recap — what worked, what's next", "LinkedIn", "recap"),
]

RECURRING_TASKS = [
    "Engage with 3-5 LinkedIn posts from consultants/freelancers (comment thoughtfully, don't pitch)",
    "Check ScatterPilot daily digest — note any new signups to follow up with personally",
    "Review and respond to any product feedback or support emails",
]

WEEKLY_TASKS = {
    0: "Monday: Plan this week's 2-3 LinkedIn posts. Draft content.",  # Monday
    2: "Wednesday: Connect with 5 new consultants/freelancers on LinkedIn.",  # Wednesday
    4: "Friday: Update MARKETING.md with this week's metrics. Review what's working.",  # Friday
}
```

**Email format:**

Subject: "ScatterPilot Marketing — [date] Action Items"

```html
<div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #FAFBF9;">
  <h1 style="color: #1A2318; font-size: 24px;">Today's Marketing Tasks</h1>
  <p style="color: #5F6B5A; font-size: 14px;">[Day, Month Date, Year]</p>
  
  <hr style="border: none; border-top: 1px solid #E2E5DE; margin: 16px 0;">
  
  <!-- If there's a scheduled content post today -->
  <h2 style="color: #4A6741; font-size: 16px; text-transform: uppercase;">📝 Scheduled Content</h2>
  <div style="background: #F4F7F3; border-radius: 8px; padding: 16px; margin: 8px 0;">
    <p style="font-weight: 600; color: #1A2318; margin: 0 0 4px 0;">[Platform] — [Content Type]</p>
    <p style="color: #5F6B5A; margin: 0;">[Task description]</p>
  </div>
  
  <!-- If no scheduled content today -->
  <!-- Show: "No scheduled content today. Consider a spontaneous post about freelancing or getting paid." -->
  
  <hr style="border: none; border-top: 1px solid #E2E5DE; margin: 16px 0;">
  
  <h2 style="color: #4A6741; font-size: 16px; text-transform: uppercase;">🔄 Daily Tasks</h2>
  <!-- List RECURRING_TASKS -->
  <ul style="color: #1A2318; font-size: 15px; padding-left: 20px;">
    <li style="margin-bottom: 8px;">Engage with 3-5 LinkedIn posts from consultants/freelancers</li>
    <li style="margin-bottom: 8px;">Check daily digest — follow up with any new signups personally</li>
    <li style="margin-bottom: 8px;">Review and respond to feedback or support emails</li>
  </ul>
  
  <!-- If there's a weekly task for today's day-of-week -->
  <hr style="border: none; border-top: 1px solid #E2E5DE; margin: 16px 0;">
  <h2 style="color: #4A6741; font-size: 16px; text-transform: uppercase;">📅 Weekly Task</h2>
  <p style="color: #1A2318; font-size: 15px;">[Weekly task for today]</p>
  
  <hr style="border: none; border-top: 1px solid #E2E5DE; margin: 16px 0;">
  
  <p style="color: #8A9484; font-size: 12px; text-align: center;">
    Update progress in MARKETING.md when tasks are complete.<br>
    ScatterPilot Marketing · scatterpilot.com
  </p>
</div>
```

### Infrastructure (template.yaml)

Add:
1. MarketingTasksFunction — Python 3.12, CommonLayer, 15s timeout, 128MB
2. Schedule: cron(0 11 * * ? *) = 7:00 AM ET daily
3. IAM: ses:SendEmail, ses:SendRawEmail
4. Env vars: DIGEST_RECIPIENT=ale@scatterpilot.com, SES_SENDER=ale@scatterpilot.com
5. MarketingTasksLogGroup — 30-day retention

This function does NOT need DynamoDB access — it's purely calendar-driven.

### Error Handling
- If SES fails, log error, return 200 anyway
- If current date has no scheduled tasks, still send the daily + weekly tasks
- Always send something — even on quiet days, the recurring tasks keep you accountable

Commit from ~/Claude-code-evaluation with message: "feat(backend): marketing task scheduler — daily email with content calendar and action items"

After committing, also run: git push origin main
```

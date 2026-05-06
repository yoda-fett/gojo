# Gojo Design Principles v2 — Owner Dashboard & Direct Booking First
**Document Type:** UX Design Principles  
**Status:** POC v2.0 — Owner-Dashboard-First  
**Date:** April 2026  
**Authored with:** Maya (Design Thinking Coach, BMAD CIS)  

---

## Context: POC Scope

For the Gojo POC, we are building one user experience: **The Owner/Manager**.

**The Owner/Manager** — the property owner or general manager. Checks business health daily or weekly. Wants to understand performance at a glance. Can handle data density if it is well-structured. Does not want to be trained — wants to be informed.

**Note on Staff Register:** Staff workflows (check-in, checkout, folio posting, night audit) are deferred to post-POC. The principles that governed staff experience are documented in the prior version for reference, but do not apply to this POC.

---

## Owner Dashboard Principles (Movement I)

*Designed for the person reading the score, not playing an instrument.*

---

### Principle 1: One Number, One Story

> "The best hook in a song is one line that you can't forget."

Every dashboard metric is a single number with a single narrative. The number answers one question. The trend indicator answers whether that answer is better or worse than yesterday.

**What this means in practice:**
- KPI cards: large bold number (36px), trend arrow, sparkline — nothing else visible without tap
- No metric card contains more than: a label, a value, a trend indicator, and an optional sparkline
- Dashboard layout: **4 KPI cards maximum** above the fold (not 5, not 3)
- Default view shows today — date range selection is secondary
- Colour reinforces the number's meaning (Teal for positive, Coral for negative or alert)

**What this prevents:**
- Dashboard clutter; analysis paralysis from too many simultaneous metrics
- Owners spending time interpreting composite numbers instead of understanding direction
- Metric overload above the fold

**The five numbers an owner absolutely needs:**
1. Occupancy Rate today (%)
2. Revenue Today (₹)
3. Arrivals Today (count)
4. Departures Today (count)
5. *(Optional Phase 1)* Rooms Needing Attention (count)

---

### Principle 2: Trend Over Snapshot

> "A single note means nothing. Three notes in sequence tell you where the music is going."

Owners are not interested in isolated numbers — they are interested in direction. Every metric on the owner dashboard is shown in context: vs. yesterday, vs. last week, vs. same period last year.

**What this means in practice:**
- All KPI cards carry a trend indicator: ↑ Teal for improvement, ↓ Coral for decline, = Gray for flat
- Trend statement always written in plain language: "Up 4% vs last week" — not "↑4.2%"
- Charts default to 30-day view; weekly and monthly available via toggle
- No pie charts for time-series data — use line charts only
- Occupancy and revenue shown together on one dual-axis chart to surface rate/volume relationship
- Sparklines on KPI cards show 7-day trend at a glance

**What this prevents:**
- Owner misinterpreting a single good day as sustained improvement
- Reactive decision-making based on noise instead of trend
- Metrics that hide seasonal patterns or external factors

---

### Principle 3: Summary First, Detail on Demand

> "The verse tells the story. The bridge goes deeper for those who want it."

The owner dashboard is scannable in 30 seconds. Full reports are one tap away but never the default view. The owner who wants to investigate can go deeper — the owner who just wants a pulse check is done in under a minute.

**What this means in practice:**
- Above the fold: 4 KPI cards + occupancy/revenue chart + top 2–3 alerts — nothing else
- No data tables visible on the owner dashboard without the owner explicitly requesting one
- Every section of the dashboard has a "View Full Report" or "View all" link
- Exception-based alerts surface automatically: "2 rooms have unpaid balances", "OTA sync failed"
- Deep reports (Revenue by room type, Occupancy by date range, full audit trail) accessible via sidebar navigation
- Mobile dashboard shows KPI numbers and alerts only; reports accessible via "View details" links

**What this prevents:**
- Owners who want a quick status check being overwhelmed by tabular data
- Scroll fatigue from too much information above the fold
- Dashboard bounces between summary and detail views

---

### Principle 4: Plain Language Everywhere

> "If the audience needs a programme note to understand the music, the composer wasn't done yet."

Gojo uses plain English throughout — including in data. Numbers are labelled in plain English, not hotel industry abbreviations. An owner with no formal hotel training should understand every metric on their dashboard without a glossary.

**What this means in practice:**
- "Occupancy Rate" not "Occ %"
- "Revenue Today" not "RevPAR"
- "Rooms Available to Sell" not "ATS"
- Trend indicators read as: "Up 4% vs last week" — not "↑4.2%"
- Alert messages: "Room 203 checked out with unpaid balance ₹2,400 from yesterday" — not "Non-zero folio balance detected"
- Chart labels: "Occupancy %" not abbreviated in any form
- OTA names: "Booking.com" (full name), not "BDC" or "OTA code 1"
- Button text: "View revenue report" not "Analytics" or "Reports"

**Note on advanced features:** RevPAR, ATS, and other hotel metrics available in advanced reports with inline definitions on first use, but never on the primary dashboard.

**What this prevents:**
- Owner confusion requiring support calls
- Misinterpretation of metrics due to industry jargon
- Owners trusting the system less because they don't understand it

---

### Principle 5: Context-Aware Empty States

> "Silence in music is intentional. Make it say something."

When data is missing — no bookings yet, no revenue this week, new property just onboarded — the screen explains why and tells the owner what to do next. Empty states are never blank.

**What this means in practice:**
- No bookings today: "No arrivals today. Your next arrival is [date]. [View all reservations]"
- New property, no data: "Your dashboard will populate as bookings come in. [Set up your first booking]"
- Channel Manager not connected: "Connect your OTA channels to see booking source data here. [Connect now]"
- Empty states follow brand kit spec: icon (52px) + heading (15px SemiBold) + body (13px) + single CTA, max 360px wide
- Icons use tinted brand colours (10% tint of relevant colour: Teal for action, Amber for caution, Gray for neutral)

**What this prevents:**
- Owner confusion about whether the system is broken or data is truly absent
- Owner abandonment due to blank screens
- Missed onboarding moments

---

### Principle 6: No Surprises, Always in Control

> "The owner should never wonder what just happened."

Every change to the owner's property data is visible. The owner is never surprised by a system decision. The system tells the owner what it did and why.

**What this means in practice:**
- OTA amendments auto-apply after owner confirmation, not silently
- Rate changes from channel manager shown with timestamp and source ("Booking.com updated your rate for 18–22 Apr to ₹5,200")
- Audit trail records all changes: who, when, what changed, previous value
- Real-time notifications when critical events occur (OTA sync failure, unpaid folio, new booking)
- System never makes a binding business decision without explicit owner approval (e.g., rate updates, booking cancellations)
- Status indicators on every major entity: "Synced ✓", "Pending sync", "Sync failed", "Manual entry"

**What this prevents:**
- Owner discovering a rate mismatch after guests have booked at wrong rate
- Owner blaming Gojo for an OTA change they didn't authorize
- Distrust due to "mysterious" system behaviour
- Data integrity issues from silent conflicts

---

### Principle 7: Direct Booking Is Not Secondary

> "Every channel is equal in the owner's eyes. Treat them that way."

Direct bookings are not a feature bolted onto the OTA flow. Direct bookings are a **first-class channel** with the same visibility, reliability, and integration as OTA bookings.

**What this means in practice:**
- Direct bookings appear in the same reservation list as OTA bookings — marked as "Direct" source
- Direct bookings counted in occupancy, revenue, and all KPI calculations
- Direct booking status (enabled/disabled, URL, recent activity) visible on dashboard
- Direct bookings flow into all reports: occupancy by source, revenue by source, reservation audit trail
- Owner can toggle direct bookings on/off without affecting other channels
- Direct bookings have the same SLA for OTA sync/confirmation workflows (when applicable)
- Direct booking landing page is not a separate product — it's an integrated channel

**What this prevents:**
- OTA dependency trap: owner relying entirely on OTAs because direct bookings feel like an afterthought
- Owner mistrusting direct booking data quality vs. OTA data
- Operational complexity from separate direct booking and OTA workflows
- Revenue leakage to OTAs when direct bookings could close the sale

---

---

## System Principles (Both Registers, Applies to Future Staff Register Too)

---

### Principle 8: Desktop First, Then Adapt

> "A symphony is written for the full orchestra. The piano reduction comes after."

The owner register is designed on a 1280px desktop viewport first. Mobile is a read-only companion — the owner checking numbers on their phone in the morning, not managing operations from it.

**What this means in practice:**
- Owner dashboard layouts optimised for 1280px: persistent sidebar + content area with full horizontal real estate
- The dual-axis chart, 4-card KPI row, exception list, and bookings table all optimised for wide screens
- Mobile (375px) renders a simplified read-only variant: KPI numbers and alerts visible without horizontal scrolling
- Exception: KPI numbers and active alerts must be readable on mobile without scroll — the owner's morning pulse check works on any device
- No cramming five KPI cards onto a 375px screen when the owner's primary working device is a laptop
- Responsive tables collapse to a card view on mobile, showing key fields only

**What this prevents:**
- Designing the owner dashboard mobile-first and discovering the desktop layout is an afterthought
- Owners on desktop squinting at a design optimised for phones
- Mobile users being overwhelmed by responsive tables that shrink to unreadable widths

---

### Principle 9: The System Owns Its Failures

> "When the music stops unexpectedly, the conductor tells the audience why — not just that it stopped."

When something goes wrong, Gojo takes responsibility for communicating what happened, what the system is doing about it, and what — if anything — the owner needs to do. Error codes and silence are never acceptable.

**Every error message follows a three-line structure:**
1. **What happened** — plain English, specific. "OTA sync for Booking.com failed at 14:32." Not "Error 403." Not "Sync failed."
2. **What Gojo is doing** — "We're retrying every 5 minutes. Your rates and inventory are held at the last successful sync."
3. **What you need to do (if anything)** — one specific action with a direct link. "Check your Booking.com API credentials. [Verify connection →]" If no action required: "Nothing to do — we'll handle it."

**Error card design:**
- White card with Coral left border (4px)
- Icon: Exclamation circle (Coral)
- All three lines visible — no truncation, no "read more"
- Dismissable but logged in audit trail

**What this prevents:**
- Owners feeling they broke something when the system encountered an expected edge case
- Support calls generated by cryptic error states the system could have explained
- Owner distrust due to silent failures
- Data integrity issues from unacknowledged sync failures

---

---

## Applying These Principles Together

### The Owner Register Design Model

| Dimension | Specification |
|---|---|
| **Data density** | Moderate — summary of many signals, not raw data |
| **Interaction pattern** | Browse-driven, exploratory, self-service reporting |
| **Error tolerance** | Low — flag and explain, but don't block |
| **Primary device** | Desktop (1280px) — persistent view |
| **Secondary device** | Mobile (375px) — read-only, pulse-check only |
| **Language** | Nouns + numbers ("Occupancy", "Revenue"), plain English, no jargon |
| **Colour use** | Data differentiation (trend, severity, source), always paired with text |
| **Visual metaphor** | Business dashboard — at-a-glance control centre |

### Navigation Structure

**Desktop (1280px):** Persistent left sidebar
- **OVERVIEW:** Dashboard, Front Desk (future), CRS Calendar (future)
- **MANAGE:** Bookings, Housekeeping (future), GST Invoices (future)
- **INSIGHTS:** Revenue, Occupancy, Reservations, Folios, Audit Trail
- **TOOLS:** Channels (Phase 3), AI Pricing (post-POC)

**Mobile (375px):** Hamburger drawer with same structure

The Gojo logo at the top of the sidebar is always clickable and always navigates to Dashboard (home) — universal "go home" affordance.

---

## Reference: Anti-Patterns to Avoid

These patterns from competitor analysis inform what NOT to do:

| Anti-Pattern | Why It Fails | Gojo Response |
|---|---|---|
| Dense data tables as primary view | Requires owner to scan horizontally; analysis paralysis | KPI cards above fold; reports one tap away |
| Multiple tabs on one screen | Forces owner to context-switch; fragmented mental model | One screen, one view; drill-down into detail |
| Abbreviations and jargon | Owner with no hotel training is lost | Plain language always; glossary only in advanced reports |
| Error messages as codes | Non-actionable; owner doesn't know what to do | Three-line error structure: what happened / what we're doing / what you need to do |
| Status colours without text | Inaccessible; requires training | Colour + text label always; dog-ear affordance for drilldown |
| Direct bookings as an afterthought | Owner doesn't trust the channel | Direct bookings as first-class channel; same visibility and integration as OTAs |
| Mobile-first then scale to desktop | Desktop becomes an afterthought | Desktop-first design; mobile as read-only companion |

---

## Principle Application Checklist

Before finalising any owner dashboard screen, verify:

- [ ] All metrics have trend indicators (↑/↓/=) with written direction
- [ ] KPI row shows 4 cards maximum
- [ ] No tables visible without explicit "View Full" link
- [ ] All text uses plain English (no abbreviations, no jargon)
- [ ] Empty states explain why data is absent and what to do next
- [ ] All system actions are logged and visible in audit trail
- [ ] Direct booking treated identically to OTA bookings in all metrics
- [ ] Error messages follow three-line structure
- [ ] Chart uses line graphs only for time-series (no pie charts)
- [ ] Colour always paired with text label
- [ ] All interactive elements have visible affordances (hover, focus states)
- [ ] Desktop layout tested at 1280px; mobile tested at 375px
- [ ] Minimum 4.5:1 contrast ratio on all text
- [ ] Logo is always clickable and navigates to Dashboard

---

*Document Owner: Product/Design | Status: POC v2.0 — Owner-Dashboard-First*  
*Revised: 2026-04-19 | Previous: 2026-04-15*  
*Staff register principles (prior version) archived for reference; apply to post-POC staff screens.*

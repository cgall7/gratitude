# Pollinate — Strategy Document

**Version:** 2.1  
**Date:** August 2026  
**Domain:** pollinateapp.xyz  

> **Changelog 2.1 — 2026-08-17, ratified by Colin (CEO action items thread).** Positioning re-researched from zero at Colin's request. Killed sentence: *"It's a journal that becomes social."* — it led with the container, not the gift. The hero sentence is now **"gratitude you compile for someone, until it's ready to give,"** and the hero is the Private Hive arc *ending in the reveal*. Delivery reframed as a spectrum (in-app → link → keepsake); a hive is valuable at zero deliveries. "Public hive" naming rejected — the two modes are **Private Hive** and **the Hive**. Slice 1 ships the full arc minus the reply (8b.8 → Slice 1.1). §1 and §2 amended in place below.

---

## 1. Executive Summary

Pollinate is a social gratitude app where journaling becomes connection. The hero feature — **Private Hives** — lets you keep a personal gratitude journal FOR someone: you write entries about a friend, partner, or child over time, then periodically review them on a "trip down memory lane" and package curated entries to send as a meaningful gift.

We sit at the intersection of three proven markets — gratitude apps ($1.3B), social networking ($200B+), and gifting ($250B+) — with no direct competitor occupying the same space. Pollinate is not a payments app, not a workplace tool, and not a standalone journal. It's **gratitude you compile for someone, until it's ready to give.** The dinner-party version: *I've been writing things down about my daughter all year, and on her birthday she gets all of it at once.* That's the app. Everything else is the place it lives.

**The core insight:** Nobody has built a practice that becomes a gift. Private Hives turn daily gratitude — about someone specific — into a curated, accumulative act that blooms into connection. You write gratitude FOR someone over weeks or months. When the moment is right, you package those entries and send them. The recipient experiences a "trip down memory lane" they didn't know existed. This two-sided emotional bloom — the author's review and the recipient's package-open — doesn't exist anywhere else.

**Delivery is a spectrum, not a gate (added 2.1).** A Private Hive must be worth keeping even if its person can never install the app — a young child, a grandparent, someone you've lost. The hive is a letter drawer, not an outbox: it is valuable at zero deliveries, because the compiling itself is the practice. Delivery paths, in order of arrival: **(1) send in-app** (Slice 1) — the full bloom; **(2) send as a link** (post-Slice 1) — a beautiful web-read moment that doubles as the viral loop, since the recipient's first experience of Pollinate is the strongest thing we make; **(3) keep, or export as a keepsake** (later) — for the person who will never install anything. The moat is accumulated *time*, not features — no competitor can copy a year of someone's entries.

**Business model:** Freemium. The free tier gives users one private hive, one friend connection, one seed, full daily journal access, and a yearly review — sealing a hive is always free and unconditional, regardless of tier (2026-08-17). Where the send gate lands is pending Colin's ruling: `sealed_at`/`sent_at` cap every tier at ≤1 send/hive forever, so it can only bind as an account-level count, and only if free hives are concurrent rather than lifetime (see Slices 8b.5 open item). **Pollinate Plus** ($2.99/month or $29.99/year) unlocks unlimited hives, friends, seeds, and monthly review cadence. Gifting happens via Cash App payment links shared through iMessage — Pollinate generates a gratitude note and a Cash App $cashtag link, the user sends it via iMessage, and Pollinate never touches money. We are not a money transmitter.

> **Build Slices:**
> - **Slice 1 (Demo Mode):** Journal + private hives + social seeds + honeycomb + feed. No money. TestFlight / internal testing. Validates the core emotional and social loop.
> - **Slice 2 (Public Launch):** Freemium paywall ($2.99/mo or $29.99/yr) + Cash App gifting via iMessage links. App Store / Play Store launch.
> - **Slice 3+:** Transaction fee research (MDK / Lightning) IF legally viable. Requires formal legal counsel. Not committed.

> **App Tab Bar:** Today (journal + private hives) | Hive (social) | Wallet (shell in Slice 1, Cash App links in Slice 2) | Garden (recap, wrapped, history)

---

## 2. Market Positioning

### The Intersection

```
         Gratitude Apps ($1.3B)
              │
              │  ← We are here
              │         ╱
     ─────────┼────────╱────────
              │      ╱
              │    ╱
    Social Networking        Gifting
    ($200B+)                 ($250B+)
```

**Our position:** We are not competing with Venmo (we're about gratitude, not debt-splitting). We are not competing with workplace recognition tools (we're consumer, not enterprise). We are not competing with standalone gratitude journals — we're building gratitude you compile for someone, until it's ready to give. The journal is the practice. The reveal is the payoff. Private Hives are the bridge: a practice that becomes a gift. We are the only product in the intersection.

### Competitive Matrix

| Category | Social? | Money? | Time Capsules? | Network Effect? |
|---|---|---|---|---|
| Solo gratitude journals | ✗ | ✗ | ✗ | ✗ |
| Social gratitude apps | Shallow | ✗ | ✗ | Weak |
| Greeting card / gifting apps | ✗ | One-way | ✗ | ✗ |
| Workplace recognition | ✓ | ✓ | ✗ | Locked in enterprise |
| Time capsule apps | ✗ | ✗ | ✓ | ✗ |
| P2P payment apps (Venmo, Cash App) | Shallow | ✓ | ✗ | Locked to payments |
| **Pollinate** | **✓** | **Cash App links (Slice 2)** | **✓** | **✓** |

> **Note:** "Solo gratitude journals" (Three Good Things, Presently, Reflectly) remain competitors — but Pollinate includes a journal too. The difference is ours is social: entries feed into a shared network, and Private Hives turn the journal into a gift you curate FOR someone. Standalone journals can't offer that.

### Positioning Statement

> For people who want to express genuine gratitude to the people they care about, Pollinate is a social gratitude app that makes appreciation a living practice — with Private Hives you keep FOR someone, time-capsule seeds that bloom on future dates, and a honeycomb network that grows with every connection. We are a freemium consumer app, not a money transmitter. Gifting happens through Cash App links the user sends via iMessage — we never touch money. We are not competing with standalone gratitude journals. We're building gratitude you compile for someone, until it's ready to give. The journal is the practice. Private Hives are the payoff: the full arc — write → review → package → send → open — ending in the reveal, the one moment in the product that can make a person cry. Unlike Venmo (transactional) or greeting card apps (one-off), Pollinate combines the emotional depth of sustained gratitude with the delight of delayed delivery and the connection of a living social network.

### Naming Rule (added 2.1)

The one clean line through the product is **audience**: a **Private Hive** is for an audience of one; **the Hive** is for an audience of your invited people. Never "Public" — the social layer is mutual-consent connections, RLS-gated to members, and "public" would be a privacy claim pointing the opposite way from the truth. Performative gratitude is the failure mode of every competitor we beat. The schema's own visibility value for the social layer is `shared`; user-facing copy says "the Hive."

---

## 3. Target Audience

### Primary: The Connector (22–35)
- Socially active, maintains a tight friend group
- Already uses social media, comfortable sharing appreciation publicly
- Values meaningful connections but finds existing tools too transactional or too performative
- Will adopt because: the product makes them feel good AND look good to their friends

### Secondary: The Thoughtful Planner (25–40)
- Remembers birthdays, writes cards, plans surprises
- Craves ways to deliver meaningful messages at the right moment
- Will adopt because: **Private Hives** solve the "I want to build something meaningful for someone over time" problem. They write gratitude entries FOR a specific person — a partner, a child, a best friend — and when the moment is right, they get a "trip down memory lane" review prompt, package curated entries, and send them as a gift. This is the greeting card evolved into a living practice.

### Tertiary: The Meaning-Seeker (18–45)
- Looking for more intentional, gratitude-driven living
- May already journal or meditate, but finds solo journaling isolating
- Will adopt because: Pollinate turns a private habit into a social one. Gratitude written FOR someone creates accountability and emotional payoff that solo journaling can't match.

### Cold-Start Strategy: Private Hives as the Hook

We don't launch to individuals. We launch to **pre-existing friend groups** who've committed to try — but the hook isn't the feed. The hook is Private Hives:

1. **Maker communities** — tight-knit, appreciative culture, comfortable with digital tools. Each member starts a hive FOR someone in the group.
2. **Recovery/support groups** — gratitude is already a daily practice, high emotional stakes. Hives become a way to honor sponsors, peers, and the journey.
3. **Church/faith communities** — built-in gratitude culture, existing social graph. Hives for family members and community leaders.
4. **New parents / partners** — the most natural hive authors. A parent keeping a hive for their child, or a partner keeping one for their significant other, has months of entries by the first review.
5. **College friend groups** — digitally native, socially engaged. Hives for roommates and close friends.

**Goal:** Launch with 5–10 seeded groups (20–100 people each). Each person starts at least one Private Hive. The feed gets content from shared entries, but the real retention driver is the accumulated hive history nobody wants to abandon.

---

## 4. Business Model

### Overview

Pollinate is a **freemium consumer app**. The primary revenue stream is subscription. Gifting is facilitated through Cash App payment links — Pollinate never touches money and is not a money transmitter. Transaction fees are a future research topic only, deferred to Slice 3+ pending legal counsel.

### Revenue Streams

#### 1. Freemium Subscription (Primary — Slice 2)

| Feature | Free Tier | Pollinate Plus ($2.99/mo or $29.99/yr) |
|---|---|---|
| Daily journal | Full access | Full access |
| Private Hives | 1 hive | Unlimited |
| Friend connections | 1 friend | Unlimited |
| Seeds (time capsules) | 1 seed | Unlimited |
| Review cadence | Yearly only | Monthly |
| Sends (curated hive entries sent to friends; sealing itself is unconditional and never gated, 2026-08-17) | *pending Colin's ruling — see business model note above* | *pending* |
| Honeycomb visualization | ✓ | ✓ |
| Social feed | ✓ | ✓ |
| Garden / recap / history | ✓ | ✓ |

**Why this works:**
- The free tier is genuinely useful — one hive, full journal access, yearly reviews. Users can experience the core loop without paying.
- The upgrade triggers are natural: a second hive (for another person), monthly reviews (instead of yearly), more seeds, more packages. These are needs that emerge from engagement, not artificial limits.
- $2.99/month is impulse territory — less than a coffee. $29.99/year offers ~16% savings and anchors to annual commitment.

#### 2. Cash App Gifting via iMessage (Slice 2 — No Revenue to Pollinate)

- Pollinate generates a gratitude note + a Cash App payment link ($cashtag + amount)
- The user sends the link via iMessage — Pollinate never sends, receives, or holds money
- The recipient reads the gratitude in Pollinate (or downloads to read it), then taps the link to claim in Cash App
- **Pollinate is NOT a money transmitter.** We generate a link; the user sends it through their own messaging app; Cash App processes the payment. Zero regulatory burden for Pollinate.
- This is a feature, not a revenue stream. It enhances the emotional experience without adding compliance complexity.

#### 3. Transaction Fees (Slice 3+ — Research Only)

- Deferred indefinitely pending legal research
- Would require MDK / Lightning integration and formal legal opinion on money transmitter status
- NOT committed. NOT in the roadmap as a certainty.
- If pursued: small fee on peer-to-peer gratitude payments, structured to avoid money transmitter classification
- Requires: legal counsel, compliance review, and a clear regulatory path before any engineering investment

### Unit Economics (Estimates — Subscription Model)

| Metric | Estimate |
|---|---|
| Subscription price | $2.99/mo or $29.99/yr |
| Free-to-paid conversion target | 5–8% |
| Monthly revenue per paying user | $2.99 |
| Annual revenue per paying user (annual plan) | $29.99 |
| Blended ARPU (across free + paid, at 6% conversion) | ~$1.80/mo |
| MAU needed for $1M ARR (at $1.80 ARPU/mo) | ~46K MAU |
| CAC (community-led, low paid acquisition) | $2–5 |
| Target LTV (12-month retention × subscription) | $20–36 |
| Gross margin | ~95% (no payment processing costs) |

### Why This Business Works

- **Freemium removes all friction to adoption.** Users download for free, experience Private Hives, and upgrade when they want more. No wallet funding, no KYC, no payment friction in the core loop.
- **Private Hives create deep retention.** A user with months of hive entries for someone they love has enormous switching cost. The accumulated history IS the product.
- **Cash App links add gifting without liability.** Users can attach real money to gratitude without Pollinate becoming a money transmitter. The gratitude is the product; the payment is an optional enhancement the user handles themselves.
- **Subscription revenue is predictable and high-margin.** No transaction processing costs, no custody risk, no chargeback exposure. Pure software economics.
- **Network effects compound.** Each hive that joins creates content, seeds, packages, and connections that can't be replicated elsewhere.

---

## 5. Growth Strategy

### Phase 1: Cold Start (0 → 1,000 users)

**Strategy: Private Hives as the Hook**

The hook isn't the social feed. The hook is writing gratitude FOR someone.

- Recruit 5–10 pre-existing friend groups (20–100 people each)
- Each member starts a Private Hive for someone they care about — a partner, child, best friend, or group member
- The act of writing gratitude FOR a specific person is inherently motivating. It's not a journal "for yourself" — it's a growing gift.
- Seeds (time-capsule messages) create future touchpoints without any money
- Focus on communities with existing gratitude culture (churches, recovery groups, maker communities, new parents)

**Key activation event:** A user writes their first Private Hive entry for someone they care about and sees it accumulate. The "aha" moment is realizing this is a living gift they're building over time. If they then share an entry to the Hive feed and see a friend's entry appear too, social conversion is dramatically higher.

**Metrics:**
- 5+ groups active within 4 weeks of launch
- 50%+ of seeded users write a hive entry within first week
- 3+ daily journal/hive entries per active tester
- 40%+ of entries shared to the Hive feed
- 60%+ seed bloom rate (seeds that successfully bloom on their scheduled date)
- 2+ seeds planted per active user in first month

### Phase 2: Viral Loop (1,000 → 10,000 users)

**Strategy: Receive → Download → Hook → Start → Forward**

The viral loop runs through Private Hives and packages — no money required:

1. User A writes gratitude entries in a Private Hive for User B over weeks/months
2. User A gets a "trip down memory lane" review prompt, curates a package, and sends it to User B (who may not have Pollinate yet)
3. User B receives a notification: "Sarah curated a gratitude package for you 🌸"
4. User B downloads Pollinate to read the package — the emotional payoff is immediate and powerful
5. User B is hooked — they start their own Private Hive for someone they care about
6. User B eventually packages and sends to User C → loop repeats

**Why this works:**
- The first experience is *receiving a curated gift of gratitude*. The emotional impact is enormous and the friction is zero (free download, no wallet, no KYC).
- No money is required in the core loop. Cash App links are an optional enhancement, not a gate.
- Each new user brings their entire friend graph as potential hive subjects and package recipients.
- Seeds create future pull — a user who plants a seed for a friend's birthday in 3 months has a reason to return.

**Amplification:**
- Package-open "bloom" moments are shareable to Instagram/social media ("Sarah sent me a gratitude package that made me cry 🌸")
- Annual Harvest is inherently shareable (Spotify Wrapped model)
- Pay-it-forward chains: receive a package → start your own hive → send to others

### Phase 3: Retention Engine (10,000 → 100,000 users)

**Strategy: Unquittable Through Accumulated History**

By Phase 3, active users have:
- Private Hives full of months or years of entries for people they love
- Pending seeds scheduled months out
- A gratitude graph showing months/years of connections
- Review cadence prompts (monthly for Plus, yearly for free) that surface "trips down memory lane"
- An Annual Harvest they want to share

**Switching cost:** Leaving Pollinate means abandoning your hive history — the gratitude you've been building FOR someone — your pending seeds, and your accumulated social graph. Same moat as Venmo ("all my friends are here") but deeper ("all my gratitude history for the people I love is here").

**Retention mechanics:**
- Private Hives: accumulated entries create emotional lock-in. You can't recreate months of gratitude for your child or partner on a new app.
- Review prompts: monthly (Plus) or yearly (free) "trip down memory lane" notifications drive re-engagement by surfacing past entries at the right cadence.
- Seeds: 2 seeds/month × 12 months = 24 future touchpoints
- Bloom notifications: drive re-engagement on scheduled dates
- Dormant hexagons: visual nudge to reconnect with friends you haven't appreciated recently
- Annual Harvest: creates anticipation for year-end (like Spotify Wrapped)

### Phase 4: Scale (100,000+)

**Strategy: Platform + Community**

- Public profiles and gratitude identity ("Verified Pollinator — 342 entries, 18 packages sent")
- Gratitude-to-charity: send a package to a friend's chosen cause in their honor
- Team / group Pollinate: structured hives for teams, classrooms, or communities
- Explore transaction fee model (Slice 3+) IF legal research supports it

---

## 6. Cash App Strategy

Cash App is our gifting partner — not through infrastructure integration, but through **payment links**. Pollinate generates gratitude content and a Cash App payment link; the user sends it via iMessage; Cash App processes the payment. Pollinate never touches money.

### Why Cash App Links (Not Integration)

| Factor | Detail |
|---|---|
| Zero regulatory burden | Pollinate generates a link. The user sends it. Cash App processes it. We are not a money transmitter. |
| User base | 59M monthly active Cash App users — recipients likely already have it installed |
| UX | User writes gratitude in Pollinate → taps "Add Cash App gift" → Pollinate generates $cashtag link → user sends via iMessage → recipient reads gratitude, taps link, claims in Cash App |
| No custody | We never hold, route, or touch funds. No wallet infrastructure to build or maintain. |
| No KYC | Cash App handles all identity verification. Pollinate has zero compliance requirements for payments. |
| Simplicity | No Lightning invoices, no QR scans, no wallet funding flows. Just a link. |

### The Gifting Flow (Slice 2)

1. User writes a gratitude entry or curates a package in Pollinate
2. User taps "Add Cash App Gift" (optional)
3. Pollinate generates a gratitude note + Cash App payment link (`$cashtag` + amount)
4. Pollinate opens iMessage with the gratitude note and link pre-filled
5. User sends the iMessage to the recipient
6. Recipient reads the gratitude in Pollinate (downloads if needed), taps the Cash App link
7. Cash App opens, recipient claims the payment
8. **Pollinate never touches money at any point in this flow.**

### Fallback Options (Non-Cash App Users)

| Option | How It Works | UX |
|---|---|---|
| Venmo links | Pollinate generates a Venmo payment link (Deeplink API). Same iMessage flow. | Same as Cash App — user sends via iMessage, recipient claims in Venmo. |
| Apple Pay / Cash | Pollinate generates a standard payment link or Apple Pay request. | User sends via iMessage. Recipient pays through Apple's native flow. |
| Generic link | Pollinate generates a gratitude note with a placeholder for any payment method the user prefers. | Maximum flexibility. User adds their own payment link or handles it offline. |

### Strategic Priority

- **Slice 2 (Public Launch):** Cash App payment links via iMessage. Zero infrastructure, zero regulatory burden. Venmo and Apple Pay as fallbacks.
- **Slice 3+ (Research Only):** Explore MDK / Lightning integration for in-app transaction fees. This would require: formal legal counsel, money transmitter status review, compliance framework, and a clear regulatory path. NOT committed. NOT started. Research phase only.

---

## 7. Competitive Moats

### 1. Private Hives — Practice That Becomes a Gift
A Private Hive is a gratitude journal you keep FOR someone — accumulating entries over weeks, months, or years — that becomes a finished keepsake when you seal it, and a delivered gift if you then send it (sending is optional and separate; the hive is valuable at zero deliveries). This mechanic doesn't exist in any other product. Greeting cards are one-off. Standalone journals are for yourself. Social posts are performative. Private Hives are a sustained, intimate practice that blooms into connection. Once a user has months of hive entries for someone they love, they can't replicate that anywhere else.

### 2. Network Effects
Once a friend group is exchanging gratitude, seeds, and packages on Pollinate, the social graph + shared history creates lock-in. You can't replicate the history of gratitude between friends on a new app. Same moat as Venmo: all my friends are here.

### 3. Data Accumulation
The gratitude graph grows over months and years. Hive history, pending seeds, connection states, review cadence data — deeply personal and unrepeatable. Switching apps means abandoning emotional history.

### 4. Future Pull (Seeds + Review Prompts)
Every seed is a scheduled reason to return. A user with 24 pending seeds has 24 future obligations to open the app. Review prompts — monthly for Plus, yearly for free — create "trip down memory lane" moments that surface past entries and drive re-engagement. No competitor has this dual mechanism. They all rely on willpower-based daily habits, which fail.

### 5. Brand & Metaphor Coherence
The bee ecosystem isn't a skin — it's a cohesive design language mapping metaphor to mechanics. Hives, seeds, honeycomb, pollination, bloom — every term reinforces the emotional logic of the product. Competitors can copy features, but they can't copy the coherence of the world.

### 6. Intersection Moat
No single competitor covers social gratitude + Private Hives (practice-as-gift) + delayed delivery (seeds) + network effects. We're not better at one thing — we're the only product in the intersection.

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Low daily journal/hive entry rate | Medium | High | Make journaling frictionless — quick entry flow, prompts/suggestions, streak-free design. Private Hives add motivation: you're writing FOR someone, not just for yourself. The social feed and review prompts are the motivators, not a streak nag. |
| Low seed plant rate | Medium | High | Auto-suggest seeds from contacts/birthdays. Make planting a seed as easy as sending a note. |
| Freemium conversion too low | Medium | High | Ensure free tier is useful but upgrade triggers are natural (second hive, monthly reviews, more sends). Test paywall placement and messaging. The emotional payoff of receiving a package should drive recipients to start their own hive and eventually upgrade. |
| Regulatory uncertainty if we pursue transaction fees | High (if pursued) | High | Defer all transaction fee work to Slice 3+. Require formal legal counsel before any engineering investment. Cash App link model (Slice 2) carries zero regulatory risk. |
| User acquisition cost too high | Low | High | Community-led growth (seeded groups). Viral loop: receive package → download → start hive → send to others. Low CAC. No money friction in core loop. |
| Big Tech launches a competitor | Low | High | Network effects + data accumulation + Private Hives mechanic + brand coherence are hard to replicate quickly. We'll have a head start. |
| Recipients don't download Pollinate to read packages | Medium | Medium | Make the package-open experience compelling enough to justify a download. Consider a lightweight web-based reader for first exposure, then prompt app install for full experience. |

---

## 9. North Star & Key Results

### North Star Metric
**Weekly Active Hive Authors (WAHA)** — users who write at least one gratitude entry (journal or private hive) AND either share it, package it, or plant a seed per week.

This captures the full core loop: writing gratitude + packaging/sharing/delaying delivery. It reflects both the practice (writing) and the social payoff (sharing, packaging, seeding) in a single number.

### Supporting Metrics

| Metric | What It Measures |
|---|---|
| Private Hives created | Adoption of the hero feature |
| Hive entries per hive per week | Depth of engagement with Private Hives |
| Reviews completed (monthly/yearly) | Engagement with "trip down memory lane" prompts |
| Packages sent | The gifting/sharing core action |
| Seeds planted per user per month | Future-pull engagement |
| Free-to-paid conversion rate | Freemium business viability |
| Monthly Active Users (MAU) | Top-line growth |
| 30-day retention | Product stickiness |
| Entries shared to Hive feed | Social engagement |

### Key Results (12-Month Targets)

| Quarter | WAHA | Hives Created | Packages Sent/Mo | Free→Paid Conversion | 30-Day Retention | Seeds/User/Mo |
|---|---|---|---|---|---|---|
| Q1 (Slice 1 Launch) | 500 | 800 | 100 | N/A (free) | 30% | 1.0 |
| Q2 (Slice 2 Launch) | 2,000 | 3,500 | 500 | 3% | 35% | 1.5 |
| Q3 | 8,000 | 15,000 | 2,500 | 5% | 40% | 2.0 |
| Q4 | 25,000 | 50,000 | 8,000 | 6% | 42% | 2.0 |

---

## 10. What Not to Build

- **We don't process payments.** Cash App links are generated and sent by users via iMessage. We have no payment infrastructure, no transaction processing, no payment routing.
- **We don't hold user funds.** We are not a wallet, not a custodian, not a money transmitter. Money never flows through Pollinate.
- **We don't handle KYC/compliance.** Cash App, Venmo, and Apple Pay handle all identity verification and compliance for payments.
- **We don't build wallet infrastructure.** No MDK, no Lightning nodes, no wallet SDK — in Slice 1 or Slice 2. (Slice 3+ research only, pending legal counsel.)
- **We don't build a price feed.** Not needed — we don't process crypto or display exchange rates.
- **We don't build our own on-ramp.** Not needed — users fund their own Cash App / Venmo accounts independently.

> **Slice 3+ Research Note:** MDK / Lightning integration, wallet infrastructure, and transaction fee processing are research topics ONLY. They are not committed, not started, and require formal legal counsel before any engineering investment. If the legal path is unclear or blocked, we do not pursue them. The freemium subscription model is the business — transaction fees are a potential future enhancement, not the foundation.

**Principle:** Build the social layer, the emotional moments, the Private Hives experience, and the viral loop. Outsource everything related to money. We are a gratitude and connection app, not a payments company.

---

## 11. Go/No-Go Criteria for MVP Launch

Before shipping Slice 1 (Demo Mode) to TestFlight / internal testers:

- [ ] A user can sign up and add a friend in under 2 minutes
- [ ] A user can write a daily gratitude journal entry
- [ ] A user can share an entry to the Hive feed
- [ ] A user can create a Private Hive, write entries for someone, and see all their entries
- [ ] A user can seal a Private Hive with no recipient (the grandmother/child/lost-someone case — must complete with no connection required)
- [ ] A user can send a sealed hive to a connected friend
- [ ] A "trip down memory lane" review prompt fires correctly at the right cadence (yearly for free, monthly for Plus)
- [ ] A user can plant a seed (time-capsule message) with a future bloom date
- [ ] Seed bloom notifications fire correctly and on time
- [ ] The Honeycomb feed shows real activity from the user's Hive
- [ ] Hexagon UI renders with correct visual states
- [ ] At least 2 seeded groups have been tested end-to-end (real users, real gratitude, real hives)
- [ ] Wallet tab is present as a shell (Cash App links come in Slice 2)
- [ ] Push notifications work for all key events (seed bloom, package received, review prompt, hive entry shared)

**If any of the above fail, we don't ship.** The core loop — writing gratitude, keeping Private Hives, packaging and sharing, planting seeds — must work end-to-end.

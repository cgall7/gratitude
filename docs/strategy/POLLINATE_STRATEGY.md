# Pollinate — Strategy Document

**Version:** 1.0  
**Date:** August 2026  
**Domain:** pollinateapp.xyz — **not yet registered.** Colin will buy it; treat as pending until confirmed owned.

---

## SAGE ADDENDUM — 2026-08-13, ratified with Colin

Decisions confirmed in thread, layered on top of the original doc below (original text unedited):

- **Architecture: Option A.** Pollinate is this app, evolving — same Expo/React Native + Supabase repo and team, not a from-scratch native/Swift/standalone-backend build. "MDK wallet infrastructure" (§10, §4.1) is net-new work on top of Supabase, not a backend rewrite.
- **Platform: iOS only for now.** Android is cut from every project until further notice.
- **Rebrand confirmed:** gratitude-app → Pollinate, all branding/copy/bundle-id updates. The mascot design already delivered to Pixel and Deezine stands as-is — no new creative direction needed there.
- **Self-custody claim (§4 "Why this business works," §10 "What not to build") is likely NOT achievable as literally written with MDK.** MDK's public SDK (`@moneydevkit/nextjs`) issues ONE Lightning node/mnemonic per deployment, controlled by the developer — there is no per-end-user embedded wallet primitive in its documented API surface. To give each user their own "nectar" balance, Pollinate would hold one pooled Lightning account and track individual balances as ledger rows in our own Postgres (Supabase) — the same shape as Cash App or Venmo internally, not literal self-custody. This changes the regulatory framing in §8 ("self-custody model means we don't hold funds") and §10 ("we don't hold user funds") — those lines are not true under the only integration path MDK's docs currently show. Recommend rewriting this section once the custody model is confirmed with MDK directly (their Discord, not just docs) rather than shipping copy that makes a custody claim we can't back up. Full technical detail: see addendum in `Pollinate_PRD.md` §4.1.
- **Pricing:** leaning freemium (receiving/viewing always free) + transaction fee on tips as primary revenue, subscription as a later power-user layer — NOT a hard trial-then-lockout paywall. See addendum in `Pollinate_Delivery_Slices.md` Project 12 for the reasoning; this doc's own §4 revenue-stream ordering (transaction fees primary, subscription Phase 4) already pointed this way before the delivery doc's Project 12 introduced a 14-day-trial-then-read-only mechanic that fights the Phase 2 viral loop below.
- **Nostr:** recommend NOT building Pollinate as a native Nostr app (identity, key management, relays user-facing). Target personas (§3) are mainstream Venmo/Cash-App users, not Nostr-native — adding npub/key UX directly contradicts Design Principle 1 ("the crypto is invisible"). Nostr Wallet Connect (NIP-47) is worth a look later as one *additional* funding/send path alongside Cash App and MDK, not as the app's identity backbone.

---

## 1. Executive Summary

Pollinate is a social gratitude network that combines the emotional act of expressing gratitude with the tangible act of giving money. Users send appreciation notes (optionally with real money tips) to friends, plant time-capsule "seeds" that bloom on future dates, and watch their network grow through a honeycomb visualization.

We sit at the intersection of three proven markets — gratitude apps ($1.3B), P2P payments ($400B+), and workplace recognition ($2B+) — with no direct competitor occupying the same space.

**The core insight:** Nobody has combined social gratitude + real money + delayed delivery + network effects into a single consumer product. Workplace recognition proved the model in enterprise. Venmo proved the UX in payments. Gratitude apps proved the demand. We're building the consumer version.

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
    P2P Payments    Workplace Recognition
    ($400B+)        ($2B+)
```

**Our position:** We are not competing with Venmo (we're about gratitude, not debt-splitting). We are not competing with gratitude journals (we're social, not solo). We are not competing with Bonusly (we're consumer, not enterprise). We are the only product in the intersection.

### Competitive Matrix

| Category | Social? | Money? | Time Capsules? | Network Effect? |
|---|---|---|---|---|
| Solo gratitude journals | ✗ | ✗ | ✗ | ✗ |
| Social gratitude apps | Shallow | ✗ | ✗ | Weak |
| Service worker tipping | ✗ | One-way | ✗ | ✗ |
| Workplace recognition | ✓ | ✓ | ✗ | Locked in enterprise |
| Time capsule apps | ✗ | ✗ | ✓ | ✗ |
| Crypto/Lightning tipping | ✗ | Micro | ✗ | ✗ |
| **Pollinate** | **✓** | **✓** | **✓** | **✓** |

### Positioning Statement

> For socially active people who want to express genuine gratitude to friends, Pollinate is a social gratitude network that makes appreciation visible, meaningful, and tangible — with real money tips, time-capsule seeds, and a living network visualization. Unlike Venmo (transactional), gratitude journals (lonely), or workplace tools (enterprise-only), Pollinate combines the emotional depth of gratitude with the social engagement of payments and the anticipation of delayed delivery.

---

## 3. Target Audience

### Primary: The Connector (22–35)
- Socially active, maintains a tight friend group
- Already uses Venmo publicly, posts on social media
- Values meaningful connections but finds existing tools too transactional or too performative
- Has Cash App (59M US users do)
- Will adopt because: the product makes them feel good AND look good to their friends

### Secondary: The Thoughtful Planner (25–40)
- Remembers birthdays, writes cards, plans surprises
- Craves ways to deliver meaningful messages at the right moment
- Will adopt because: seeds solve the "I want to say this later" problem

### Tertiary: Crypto-Curious (20–35)
- Has Cash App, familiar with Bitcoin basics
- Wants a meaningful use case for crypto beyond speculation
- Will adopt because: the technology is invisible and the experience is human

### Cold-Start Strategy: Pre-seeded Hives

We don't launch to individuals. We launch to **pre-existing friend groups** who've committed to try:

1. **Maker communities** — tight-knit, appreciative culture, comfortable with digital tools
2. **Recovery/support groups** — gratitude is already a daily practice, high emotional stakes
3. **Church/faith communities** — built-in gratitude culture, existing social graph
4. **Startup teams / founder groups** — cash App savvy, appreciate innovation
5. **College friend groups** — digitally native, social payment norms already established

**Goal:** Launch with 5–10 seeded hives (20–100 people each). Each hive creates immediate network density and content for the feed.

---

## 4. Business Model

### Revenue Streams

#### 1. Transaction Fees (Primary)
- Small fee on tips sent through the platform (e.g., 1–2%)
- Lightning fees are near-zero, so even a 1% fee is profitable
- Must be low enough to not discourage micro-tips ($0.10 tips need to remain viable)
- Could structure as: first $50/month free, then 1% above that

#### 2. Gratitude Pass (Subscription) — Phase 4
- Monthly subscription (e.g., $5–10/month)
- Auto-distributes a set amount of tips to your hive each month
- Premium features: advanced Garden visualization, custom hexagon themes, unlimited seeds
- Targets power users who want to be consistent gratitude senders

#### 3. On-Ramp / Off-Ramp Fees — Phase 2+
- Revenue share with Coinbase Onramp / MoonPay for users who fund via Apple Pay
- Revenue share with Strike / MoonPay for cash-out flows
- These partners typically offer 0.5–1.5% revenue share

#### 4. Enterprise / Team Pollinate — Phase 4+
- Consumer-first, but the workplace recognition market is $2B+
- Once consumer product is proven, offer a "Team Pollinate" for companies
- This is the Bonusly play — but with a consumer product people already love

### Unit Economics (Estimates)

| Metric | Estimate |
|---|---|
| Cost per Lightning transaction | ~$0.01 (routing fees) |
| Average tip size | $2–5 |
| Fee per tip (1%) | $0.02–0.05 |
| Monthly active users needed for $1M ARR (at $0.50/user/month avg fee) | ~167K MAU |
| CAC (community-led, low paid acquisition) | $2–5 |
| Target LTV (12-month retention × avg monthly fees + subscription) | $15–30 |

### Why This Business Works

- **Micro-transactions are the wedge.** Stripe can't do $0.10 tips. We can. This creates a category of giving that didn't exist before.
- **Seeds create recurring engagement without subscription pressure.** Users come back because they have pending seeds, not because a streak nags them.
- **Self-custody is a trust differentiator.** We never hold user funds. This reduces regulatory burden and builds trust vs. Venmo/Cash App.
- **Network effects compound.** Each hive that joins creates content, seeds, and connections that can't be replicated elsewhere.

---

## 5. Growth Strategy

### Phase 1: Cold Start (0 → 1,000 users)

**Strategy: Seeded Hives**
- Recruit 5–10 pre-existing friend groups (20–100 people each)
- Onboard entire groups together — the feed needs content from day 1
- Focus on communities with existing gratitude culture (churches, recovery groups, maker communities)
- Each hive gets a dedicated onboarding session and a "seed budget" ( Pollinate pre-funds each new user's wallet with $2 in sats so they can send their first tip immediately)

**Key activation event:** A user receives their first gratitude note + tip. This is the "aha" moment. If they receive before they fund, conversion is dramatically higher.

**Metrics:**
- 5+ hives active within 4 weeks of launch
- 50%+ of seeded users send a note within first week
- 20%+ attach a tip to their first note
- 2+ seeds planted per active user in first month

### Phase 2: Viral Loop (1,000 → 10,000 users)

**Strategy: Receive → Hook → Fund → Forward**

The viral loop:
1. User A sends gratitude + tip to User B (who doesn't have Pollinate yet)
2. User B gets a push notification / SMS: "Sarah sent you gratitude + $5"
3. User B downloads Pollinate to read the note and claim the tip
4. User B's wallet already has $5 — zero onboarding friction
5. User B is prompted to send gratitude to someone else
6. User B sends to User C → loop repeats

**Why this works:**
- The first experience is *receiving*, not funding. The friction is zero.
- Cash App users can fund in 4 taps when they're ready
- Each new user brings their entire friend graph as potential recipients
- Seeds create future pull — a user who plants a seed for a friend's birthday in 3 months has a reason to return

**Amplification:**
- Bloom events are shareable to Instagram/social media ("Sarah planted a seed that just bloomed for me 🌱")
- Annual Harvest is inherently shareable (Spotify Wrapped model)
- Pay-it-forward chains create shareable stories

### Phase 3: Retention Engine (10,000 → 100,000 users)

**Strategy: Unquittable Through Accumulated History**

By Phase 3, active users have:
- A honeycomb full of friends with rich state (blooming, seeded, dormant)
- Pending seeds scheduled months out
- A gratitude graph showing months/years of connections
- An Annual Harvest they want to share

**Switching cost:** Leaving Pollinate means abandoning your gratitude history, your pending seeds, and your accumulated social graph. Same moat as Venmo ("all my friends are here") but deeper ("all my gratitude history is here").

**Retention mechanics:**
- Seeds: 2 seeds/month × 12 months = 24 future touchpoints
- Bloom notifications: drive re-engagement on scheduled dates
- Dormant hexagons: visual nudge to reconnect with friends you haven't appreciated recently
- Annual Harvest: creates anticipation for year-end (like Spotify Wrapped)

### Phase 4: Scale (100,000+)

**Strategy: Platform + Community**

- Public API: other apps can send/receive gratitude and tips
- Gratitude identity: public profiles and badges ("Verified Pollinator — 342 notes sent")
- Gratitude-to-charity: send tips to a friend's chosen cause in their honor
- Team Pollinate: enterprise version for companies (the Bonusly play)

---

## 6. Cash App Strategy

Cash App is our most important strategic partnership — not through a formal integration, but through **infrastructural alignment**.

### Why Cash App is the Default

| Factor | Detail |
|---|---|
| User base | 59M monthly active users — largest Lightning-enabled consumer wallet in the US |
| Infrastructure | Built on Spiral's LDK — same infrastructure as our MDK wallet. Payments are natively compatible. |
| KYC | Cash App users are already verified. Zero additional identity checks to fund Pollinate. |
| UX | Users don't need to own Bitcoin. Cash App sends USD, auto-converts to sats via Lightning. User thinks in dollars. |
| Fees | Zero fees on Lightning sends from Cash App. |
| Distribution | When we tell users "just scan this in Cash App," 59M+ already have it installed. |

### The Funding Flow (Current — 4 taps)
1. User taps "Add Funds" in Pollinate
2. Cash App highlighted as recommended
3. Pollinate generates Lightning invoice (QR code)
4. User opens Cash App → Money → Bitcoin → Scan QR
5. Cash App shows: "Pay $10.00 (≈ 16,400 sats)"
6. User confirms with Face ID
7. Sats arrive instantly

### The Funding Flow (Ideal — 1 tap, if deep-linking becomes available)
- Pollinate generates invoice → deep-links into Cash App with invoice pre-loaded → user confirms
- Cash App doesn't currently document a Lightning invoice deep-link scheme
- We monitor for this capability — it would reduce friction from 4 taps to 1

### Fallback Strategy (Non-Cash App Users)

| Option | Provider | KYC | UX |
|---|---|---|---|
| Apple Pay / Card | Coinbase Onramp | One-time (name, DOB, SSN last 4). 100M+ Coinbase users skip entirely. | Embedded SDK, stays in-app. Apple Pay → Face ID → done. |
| Apple Pay / Card | MoonPay | Native KYC handling | Hosted widget or headless. 160 countries. |
| Lightning-native | Strike | Strike handles KYC | API integration. Could serve as both on-ramp and off-ramp. |
| Any Lightning wallet | Strike, Muun, Phoenix, Wallet of Satoshi, Breez, etc. | Each wallet handles their own | Standard QR invoice. No integration needed. |

### Strategic Priority
- **Short-term:** QR scan flow with Cash App (works today, 4 taps)
- **Medium-term:** Deep-link integration if Cash App opens it (1 tap)
- **Long-term:** Explore a formal Cash App partnership / Spiral ecosystem collaboration

---

## 7. Competitive Moats

### 1. Network Effects
Once a friend group is exchanging gratitude and tips on Pollinate, the social graph + transaction history creates lock-in. You can't replicate the history of gratitude between friends on a new app. Same moat as Venmo: all my friends are here.

### 2. Data Accumulation
The gratitude graph grows over months and years. History, pending seeds, connection states — deeply personal and unrepeatable. Switching apps means abandoning emotional history.

### 3. Future Pull (Seeds)
Every seed is a scheduled reason to return. A user with 24 pending seeds has 24 future obligations to open the app. No competitor has this mechanism — they all rely on willpower-based daily habits, which fail.

### 4. Brand & Metaphor Coherence
The bee ecosystem isn't a skin — it's a cohesive design language mapping metaphor to mechanics. Competitors can copy features, but they can't copy the coherence of the world.

### 5. Intersection Moat
No single competitor covers social + money + delayed delivery + network effects. We're not better at one thing — we're the only product in the intersection.

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cash App changes Lightning support | Low | High | Multi-path funding (Coinbase, MoonPay, Strike, any Lightning wallet) means no single dependency |
| Lightning routing failures | Medium | Medium | MDK handles routing; Lightning reliability improving rapidly. Retry logic + user-friendly error states. |
| Low tip attach rate | Medium | High | Pre-fund new user wallets ($2 in sats) so they can send immediately. Make tipping optional — the note is the point. |
| Low seed plant rate | Medium | High | Auto-suggest seeds from contacts/birthdays. Make planting a seed as easy as sending a note. |
| Regulatory scrutiny on crypto payments | Medium | High | Self-custody model means we don't hold funds. Small amounts + social context reduce money laundering risk. KYC handled by partners. |
| User acquisition cost too high | Low | High | Community-led growth (seeded hives). Viral loop: receive → hook → fund → forward. Low CAC. |
| Cash App deep-linking never materializes | Medium | Low | QR flow is 4 taps — acceptable friction. Multiple funding paths mean Cash App isn't the only option. |
| Big Tech launches a competitor | Low | High | Network effects + data accumulation + brand coherence are hard to replicate quickly. We'll have a head start. |

---

## 9. North Star & Key Results

### North Star Metric
**Weekly Active Gratitude Senders (WAGS)** — users who send at least one gratitude note (with or without a tip) per week.

This captures engagement, social behavior, and the core loop in a single number.

### Key Results (12-Month Targets)

| Quarter | WAGS | Avg notes/user/week | Tip attach rate | 30-day retention | Seeds planted/user/month |
|---|---|---|---|---|---|
| Q1 (Launch) | 500 | 2.0 | 15% | 30% | 1.0 |
| Q2 | 2,000 | 2.5 | 18% | 35% | 1.5 |
| Q3 | 8,000 | 3.0 | 20% | 40% | 2.0 |
| Q4 | 25,000 | 3.0 | 22% | 42% | 2.0 |

---

## 10. What Not to Build

- **We don't build wallet infrastructure** — MDK handles this
- **We don't handle KYC/compliance** — Cash App and Coinbase handle this
- **We don't handle payment routing** — Lightning Network handles this
- **We don't hold user funds** — self-custodial wallets
- **We don't build a price feed** — free APIs available
- **We don't build our own on-ramp** — partner with Coinbase, MoonPay, Strike

**Principle:** Build the social layer, the emotional moments, and the viral loop. Outsource the infrastructure.

---

## 11. Go/No-Go Criteria for MVP Launch

Before shipping MVP to the App Store:

- [ ] A user can sign up, create a wallet, and add a friend in under 2 minutes
- [ ] A user can send a gratitude note with a tip via Cash App QR scan (verified end-to-end)
- [ ] A user can plant a solo seed with a future bloom date
- [ ] Seed bloom notifications fire correctly and on time
- [ ] The Honeycomb feed shows real activity from the user's Hive
- [ ] Hexagon UI renders with correct visual states
- [ ] Balance displays correctly in sats and USD
- [ ] At least 2 seeded hives have been tested end-to-end (real users, real money)
- [ ] Cash-out flow is functional (even if via manual Lightning withdrawal)
- [ ] Push notifications work for all key events

**If any of the above fail, we don't ship.** The core loop must work end-to-end.

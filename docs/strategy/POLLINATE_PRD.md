# Pollinate — Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** August 2026  
**Domain:** pollinateapp.xyz — **not yet registered**, Colin buying it, treat as pending.

---

## SAGE ADDENDUM — 2026-08-13, MDK technical findings

Read the live docs at docs.moneydevkit.com (llms.txt index, `/`, `/nextjs`, `/agent-wallet`) before assigning Project 3. Quoting exact language found:

**What MDK actually ships today, per its own docs:**
- `@moneydevkit/nextjs` — "Embed the moneydevkit checkout loop inside your Next.js App Router project." Requires `'use server'` server actions, an `MDK_ACCESS_TOKEN`, and an `MDK_MNEMONIC` env var — i.e. **one Lightning node/keypair per deployment, held by the developer**, not one wallet per end user. This is a hosted-checkout product (closest analog: Stripe Checkout), with subscriptions, webhooks, and L402 API-gating built for merchants selling things to customers — not a peer-to-peer social-tipping primitive.
- `@moneydevkit/replit` — same model, Express+Vite stack.
- **Agent Wallet** ("self-custodial Lightning wallet for AI agents") is a *separate*, CLI-only Node tool (`npx @moneydevkit/agent-wallet init`) that writes a mnemonic to `~/.mdk-wallet/config.json` and runs a local daemon on `localhost:3456`. Built for AI-agent tool-use payments, not embeddable in a consumer mobile app.
- **No React Native, Expo, or mobile SDK is mentioned anywhere in the docs.** Everything is Node.js/Next.js server-side.
- **No hold-invoice/escrow, per-customer sub-wallet, or programmatic multi-tenant custody API is documented.** `programmaticPayout()` sends from the one merchant-controlled node.

**What this means for §3.4 and §4.1 as written:**
- "Each user gets a self-custodial Lightning wallet via MDK on account creation" and "Users own their private keys — Pollinate never holds custody" are **not supported by anything in MDK's current public docs.** The realistic integration is: Pollinate runs ONE MDK-backed Lightning account, and each user's "nectar" balance is a ledger row in our own Postgres (Supabase), debited/credited on events — Pollinate is custodial to its users, the same shape as Cash App/Venmo internally. This is arguably the *right* UX call anyway (Design Principle 1: crypto is invisible; true self-custody means seed phrases and key-loss risk, which fights that principle) — but it is a different regulatory and trust story than §8/§10 currently claim, and §13.6's legal copy needs to reflect actual custody, not aspirational self-custody.
- **3.9 (escrow for seed tips) and 8.3 have no documented MDK primitive to build on** — this would be our own logic (hold funds as a ledger-state flag until bloom date, then move them), not an MDK "hold invoice" feature. Re-estimate 8.3 accordingly; it's larger than "L" implied, or at least larger than the SDK made it sound.
- **MDK requires a Next.js server** (`'use server'` App Router), which Supabase Edge Functions (Deno-based) don't run. Realistic shape: a small standalone Next.js service (e.g. on Vercel) that holds `MDK_MNEMONIC`, exposes invoice/payout endpoints, and writes results into Supabase Postgres via service-role key. This is new infrastructure — small, but real, and worth naming explicitly rather than folding silently into "3.1 MDK SDK integration."
- Before committing engineering weeks: confirm this reading directly with the MDK team (their Discord is linked from the docs) — the docs are sparse enough on multi-tenant custody that I'd rather get it in writing than build against an inference.

**CONFIRMED at code level — Fizz, 2026-08-13, `RESEARCH/MDK_NEXTJS_SPIKE.md`.** Installed `@moneydevkit/nextjs@0.22.0` + `@moneydevkit/core@0.22.0` for real and read the shipped `.d.ts` files rather than docs prose: `getBalance()`'s own doc comment scopes it to "the merchant node tied to this server's `MDK_ACCESS_TOKEN`"; `programmaticPayout()` warns "never expose it through a client-controlled route without your own authorization" — MDK has no per-user permission/balance concept at all, matching the read above exactly. **New hard blocker found, independent of custody:** the underlying engine, `@moneydevkit/lightning-js`, is a NAPI-RS native Rust addon. Its published platform binaries cover win32/darwin/linux/android/freebsd — **no iOS target exists, and NAPI addons cannot run inside a React Native/Hermes JS runtime on any platform regardless.** MDK's Lightning node structurally cannot run client-side in the iOS app under any packaging — reinforces (doesn't change) the standalone Next.js service conclusion above, it just closes off "run it on-device later" as an option permanently, not just for now.

**Nostr question (Colin asked "should we make this a native Nostr app?"):** No — recommend against it for the core product. MDK's docs have zero Nostr integration (no NIP-57 zap support mentioned), and Nostr identity/key management is user-facing complexity that directly fights §5 Design Principle 1 ("the crypto is invisible") for a mainstream (non-crypto-native) target audience per §2. Nostr Wallet Connect (NIP-47) could be evaluated later as an *additional* funding/send rail alongside Cash App, since some Lightning wallets already speak it — but that's an optional Phase 2+ integration, not core architecture.

---

## 1. Product Overview

### What is Pollinate?

Pollinate is a social gratitude network where users send appreciation and real money tips to friends, plant time-capsule "seeds" that unlock on future dates, and watch their network grow over time.

### Core Value Proposition

> Expressing gratitude should feel as good as Venmo-ing a friend — but mean 100x more.

Pollinate combines three proven markets into one consumer product:
1. **Gratitude/wellness apps** ($1.3B market) — people want to practice gratitude
2. **P2P payments** ($400B+ annual volume) — people love sending money socially
3. **Workplace recognition** ($2B+ market) — gratitude + money = engagement at scale

No existing product combines social gratitude + real money + delayed delivery + network effects.

### Why Now

- Venmo normalized social money — a generation expects money to be social and lightweight
- Money Dev Kit (MDK) made micro-payments viable — $0.10 tips without fees eating them
- Social media fatigue is peaking — people crave authenticity; gratitude is the most authentic social content

---

## 2. User Personas

### Persona A: "The Connector" (Primary)
- **Who:** Socially active 22–35 year old with a tight friend group
- **Behavior:** Uses Venmo publicly, posts Instagram stories, organizes group gifts
- **Pain:** Wants to show appreciation in a meaningful way but Venmo feels transactional and Instagram feels performative
- **Needs:** A way to send gratitude that feels personal, visible to their circle, and optionally includes a real gift

### Persona B: "The Thoughtful Planner"
- **Who:** 25–40 year old who remembers birthdays, anniversaries, milestones
- **Behavior:** Writes cards, plans surprises, sets calendar reminders for friends' events
- **Pain:** Digital communication is all instant. There's no way to "send something later" that builds anticipation
- **Needs:** Time-delayed messages that create emotional weight through anticipation

### Persona C: "The Crypto-Curious"
- **Who:** 20–35 year old with Cash App, familiar with Bitcoin/Lightning basics
- **Behavior:** Uses Cash App for payments, maybe owns some Bitcoin, comfortable with QR codes
- **Pain:** Crypto feels speculative and impersonal. Wants to use it for something meaningful
- **Needs:** A use case where the technology is invisible and the experience is human

---

## 3. Core Product Features

### 3.1 The Hive (Friend Network)
**Priority: MVP (Phase 1)**

The Hive is the user's personal gratitude network. Each friend is represented as a hexagon in a honeycomb visualization.

**Requirements:**
- Users can add friends to their Hive (via phone contact sync, username search, or invite link)
- Each friend appears as a hexagon in the honeycomb UI
- Hexagon visual states:
  - **Blooming** (golden glow) — recently received gratitude
  - **Seeded** (sprout icon) — has a pending seed waiting to bloom
  - **Dormant** (muted gray) — hasn't received gratitude recently
  - **Active** (pulsing) — online and posting today
- Tapping a hexagon opens an action menu: Send a note, Plant a seed, Send a tip, View history
- Honeycomb grows as new friends are added
- Visual states update in real-time based on network activity

**Acceptance Criteria:**
- User can add at least 1 friend via each method (contacts, search, invite link)
- Hexagon states render correctly and update within 30 seconds of the underlying event
- Action menu appears on tap with all 4 options
- Honeycomb layout adjusts dynamically as friends are added (min 1, max 500+ hexagons)

---

### 3.2 Gratitude Notes (Instant Gratitude)
**Priority: MVP (Phase 1)**

Users can send instant gratitude notes to friends. These appear in the social feed (The Honeycomb).

**Requirements:**
- Compose screen: text input for gratitude note (max 500 characters), optional photo/image attachment
- Optional tip attachment (see 3.4 Tips & Money)
- Recipient selection from Hive
- Privacy setting: Hive-only (friends see it), 1:1 private (just sender + recipient), Public (anyone in community)
- Note appears in The Honeycomb feed immediately after sending
- Recipient receives a push notification
- Sender can see read receipts

**Acceptance Criteria:**
- User can compose and send a note in under 30 seconds
- Notes appear in the feed within 5 seconds
- Push notification delivered within 10 seconds
- Privacy settings correctly limit visibility

---

### 3.3 Seeds (Time Capsules)
**Priority: MVP (Phase 1)**

Seeds are sealed gratitude notes — optionally with tips attached — that unlock ("bloom") on a future date or event.

**Requirements (MVP — Solo Seeds only):**
- Compose screen: text input, optional tip attachment, date picker for bloom date
- Once planted, the seed is sealed — content is not visible to recipient until bloom date
- Recipient sees a teaser: "Sarah planted a seed for you — blooms in 47 days"
- On bloom date:
  1. Push notification to recipient: "A seed from Sarah just bloomed."
  2. Visual reveal animation (wax seal breaks, hexagon blooms)
  3. Gratitude note text appears
  4. If tip attached, it arrives as a second beat after the note
  5. Bloom event appears in The Honeycomb feed
  6. Reply prompt: "Plant a seed back? Send a note? Pass the tip forward?"
- Sender receives notification when seed is opened

**Seed Types (Phase 2):**
| Type | Description |
|---|---|
| Solo Seed | One sender, one recipient, set date (MVP) |
| Collective Seed | Multiple friends contribute notes + pooled tips to one sealed seed |
| Seed Chain | Sequential unlocks — advent calendar style |
| Surprise Seed | App picks a random unlock date in 1–6 months |
| "Bloom When" Seed | Unlocks on a condition, not a date ("Bloom when you get the job") |
| Reciprocal Seed | Two people both write, neither sees until mutual unlock |

**Acceptance Criteria:**
- User can plant a seed for any Hive member
- Seed content is completely hidden from recipient until bloom date/time
- Push notification fires on bloom date within 1 minute of scheduled time
- Bloom animation plays smoothly (< 3 seconds)
- Feed event is created and visible to the appropriate privacy audience
- Sender gets notified when recipient opens the bloom

---

### 3.4 Tips & Money (via Money Dev Kit)
**Priority: MVP (Phase 1)**

Real money tips powered by Money Dev Kit's self-custodial Lightning wallet. Tips are called "nectar" in-app but the UI primarily uses "tips" and dollar amounts.

**Requirements:**

#### Wallet
- Each user gets a self-custodial Lightning wallet via MDK on account creation
- Wallet generates Lightning invoices for receiving
- Wallet can send Lightning payments
- Balance displayed in both sats and USD equivalent (using a price API)
- Users own their private keys — Pollinate never holds custody

#### Funding (Add Funds)
Three funding paths, presented in priority order:

**Path 1: Cash App (Default/Recommended)**
- Pollinate generates a Lightning invoice (QR code + invoice string)
- UI highlights Cash App as recommended option
- User opens Cash App → Money → Bitcoin → Scan QR
- Cash App shows dollar amount + sat equivalent
- User confirms with Face ID/PIN
- Sats arrive in Pollinate wallet instantly
- Zero additional KYC (Cash App handles it)
- Zero fees on Lightning sends
- Users don't need to own Bitcoin — Cash App converts USD to sats automatically

**Path 2: Apple Pay / Card (Fallback)**
- Coinbase Onramp SDK embedded in-app (no browser redirect)
- Supports Apple Pay
- 100M+ Coinbase users skip KYC entirely (pre-verified)
- First-time users: one-time KYC (name, DOB, last 4 of SSN)
- Subsequent top-ups: Apple Pay → Face ID → done
- Minimum: $10
- Backup provider: MoonPay (Apple Pay + Google Pay + cards, 160 countries)
- Alternative: Strike (Lightning-native, potential on-ramp + off-ramp)

**Path 3: Any Lightning Wallet**
- Standard Lightning invoice (QR + `lnbc...` string)
- Any Lightning-compatible wallet can pay: Strike, Muun, Wallet of Satoshi, Phoenix, Breez, etc.
- No integration needed — it's a standard Lightning invoice

#### Sending Tips
- Attach a tip to a gratitude note (instant delivery)
- Attach a tip to a seed (held in escrow until bloom, then delivered)
- Collective tips: multiple friends pool tips into one seed (Phase 2)
- Forward a tip: pass some/all received tips forward (Phase 2)
- UI always presents the gratitude note text first, the money second
- Minimum tip: 100 sats (~$0.10)

#### Cash Out (Phase 2)
- Off-ramp: sats → fiat → bank account
- Via MoonPay or Strike

**Acceptance Criteria:**
- Wallet is created automatically on sign-up (no manual setup)
- User can generate an invoice and receive funds via any of the 3 paths
- Balance updates within 30 seconds of receiving payment
- User can send a tip attached to a note or seed
- USD/sats conversion is accurate within 1% of market rate
- Transaction history is viewable

---

### 3.5 The Honeycomb (Social Feed)
**Priority: MVP (Phase 1)**

The social feed where gratitude is visible, social, and alive.

**Requirements:**
- Feed shows activity from the user's Hive:
  - Gratitude notes friends have sent to each other (respecting privacy settings)
  - Tip transfers (amount visible or hidden, sender's choice)
  - Seed teasers (sealed, blurred cards: "Sarah planted a seed for Marcus — blooms in 47 days")
  - Bloom events (when a seed unlocks, it appears as a celebration in the feed)
  - Chain milestones (Phase 2): "A gratitude chain reached 10 people across 4 cities"
- Feed is chronological (most recent first)
- Users can react to feed items (emoji reactions)
- Users can comment on feed items
- Infinite scroll / pagination
- Empty state: prompts to send gratitude or add friends

**Acceptance Criteria:**
- Feed loads within 2 seconds
- Feed updates in real-time as new events occur (or polls every 15 seconds)
- Privacy settings correctly filter what's visible to each user
- Seed teasers show countdown but never reveal content
- Bloom events include the full revealed note

---

### 3.6 The Garden (Gratitude Graph) — Phase 3
**Priority: Phase 3**

A living visualization of the user's gratitude history.

**Requirements:**
- Interactive graph showing all gratitude connections (sent and received)
- Pending seeds shown as "underground" edges
- Visualized over time — can scrub through history
- Annual Harvest: Spotify Wrapped-style year-in-review
  - Total notes sent/received
  - Total tips sent/received (in sats and USD)
  - Seeds planted/bloomed
  - Most appreciated connections
  - Gratitude streaks
  - Shareable card for social media

---

### 3.7 Pay-It-Forward Chains (Flight Paths) — Phase 2
**Priority: Phase 2**

When someone receives a tip, they're prompted to pass some or all forward.

**Requirements:**
- After receiving a tip, prompt: "Pass this forward?"
- User can send a portion to another friend with a note
- Chain is tracked visually: "This tip started with Maya → landed on James → carried to Priya → bloomed on Marcus"
- Chain milestones appear in The Honeycomb
- Chains are shareable as standalone stories (exportable images)

---

## 4. Technical Architecture

### 4.1 Wallet & Payments
- **Money Dev Kit (MDK):** Self-custodial Lightning wallet SDK by Spiral
  - Generate invoices, receive payments, send payments, display balance
  - Webhook notifications for incoming payments
  - No custody — users own their keys
- **Funding integrations:**
  - Cash App: No SDK needed — standard Lightning invoice, user scans QR in Cash App
  - Coinbase Onramp: Embedded SDK for Apple Pay funding
  - MoonPay: Hosted widget or headless SDK (backup)
  - Strike: API integration (potential on-ramp + off-ramp)
- **Price API:** Free Bitcoin price feed for USD/sats conversion (e.g., CoinGecko, CoinDesk)
- **Escrow for seeds:** Lightning hold invoices or time-locked transactions (MDK supports this)

### 4.2 Social Layer
- **Gratitude graph:** Data layer for tracking gratitude connections, visualizing relationships, accumulating history
- **Feed system:** Real-time social feed with privacy controls
- **Push notifications:** For bloom reveals, incoming tips, new notes, seed teasers
- **Friend management:** Contact sync, username search, invite links

### 4.3 Client Platform
- **Primary:** iOS (Swift / SwiftUI)
- **Secondary:** Android (Kotlin / Jetpack Compose)
- **Web:** Dashboard / marketing site at pollinateapp.xyz

### 4.4 What We Build vs. What Partners Handle
| We Build | Partners Handle |
|---|---|
| MDK wallet integration | Wallet infrastructure (MDK) |
| Cash App QR flow | KYC/compliance (Cash App, Coinbase) |
| Coinbase Onramp SDK embed | Payment routing (Lightning Network) |
| Balance display + USD conversion | Price feeds (free APIs) |
| Feed, Hive, Seeds UI | Custody (self-custodial — we never hold funds) |
| Push notification system | Fraud/chargebacks (Coinbase, MoonPay) |

---

## 5. Design Principles

1. **The crypto is invisible.** Users see "tips" and "dollars." Bitcoin, Lightning, and sats are infrastructure, not user-facing language. Progressive disclosure: users can dig deeper if curious.

2. **Words first, money second.** The gratitude note is always the primary content. Tips are the exclamation mark, not the sentence.

3. **Receive before you fund.** The viral loop: first tip a user touches is received, not funded. They're hooked before they ever need to add money.

4. **The bee theme is visual, not verbal.** Hexagons, honeycomb patterns, golden palette, bloom animations. The copy uses plain English.

5. **Friction is front-loaded.** One-time KYC for non-Cash App users. After that, it's Face ID → done.

---

## 6. Success Metrics

| Metric | Target (MVP) |
|---|---|
| Gratitude notes per user/week | 3+ |
| Tip attach rate (% of notes with money) | 20%+ |
| Seeds planted per user/month | 2+ |
| Bloom open rate (% opened on unlock day) | 80%+ |
| Bloom reply rate (% that trigger a reply) | 30%+ |
| 30-day retention | 40%+ |
| Avg Hive size (friends per user) | 8+ |
| Collective seed participation (contributors per group seed) | 4+ |

---

## 7. Timeline Overview

| Phase | Duration | Focus |
|---|---|---|
| Phase 1: MVP | 8–12 weeks | Core loop: notes, tips, solo seeds, feed, hexagon UI |
| Phase 2: Growth | 8–12 weeks | Collective seeds, chain tracking, surprise/conditional seeds, bloom events in feed |
| Phase 3: Moat | 8–12 weeks | Garden visualization, Annual Harvest, seed rituals, hexagon states |
| Phase 4: Scale | TBD | Public API, gratitude identity, charity flow, subscription |

---

## 8. Open Questions

1. **Deep-linking with Cash App:** Cash App doesn't currently document a Lightning invoice deep-link scheme. Can we reduce the 4-tap QR flow to 1 tap? Monitor for API updates.
2. **Escrow mechanism for seeds:** MDK hold invoices vs. time-locked transactions — which is more reliable for seed tips that may not bloom for months?
3. **Off-ramp strategy:** Strike vs. MoonPay for cash-out. Which has better UX and lower fees for small amounts?
4. **Group seed pooling:** How do we handle refunds if a collective seed recipient never claims it?
5. **Spam/abuse prevention:** How do we prevent bad actors from using the tip system for money laundering at scale? (Small amounts + social graph should help, but need a plan.)
6. **International launch:** Lightning works globally, but KYC requirements vary. What's our country rollout priority?

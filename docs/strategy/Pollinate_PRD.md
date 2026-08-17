# Pollinate — Product Requirements Document (PRD)

**Version:** 3.1  
**Date:** August 2026  
**Domain:** pollinateapp.xyz  

---

## 1. Product Overview

### What is Pollinate?

Pollinate is a **consumer social gratitude app** where you write gratitude for the people closest to you, revisit it on reflective "trips down memory lane," package it into curated gifts, and grow a living honeycomb of appreciation with your community.

It starts as a personal journal. It grows into a social network. The magic is in the **Private Hives** — personal gratitude journals you keep FOR the people you love most, written sporadically over time, periodically revisited with a beautiful animated review, and packaged to share when you're ready.

### What Makes This Different

Every gratitude app on the market is either a private diary nobody sees, or a public feed of strangers. Pollinate is neither. It's built for **the 5–20 people who matter most to you.** You write gratitude about them over time, revisit it on "trips down memory lane," and when you're ready, you package up the best moments and send them directly. It lands with the emotional weight of something that took time to create — because it did.

This is not a workplace tool. This is not enterprise. This is a **consumer app** designed to make people feel genuinely, tangibly appreciated — by the people who actually know them.

### The Core Loop

```
Write gratitude (daily journal or for someone in a private hive)
    ↓
Some stays private. Some you keep in a private hive for someone.
    ↓
Periodically, Pollinate prompts: "Trip down memory lane — revisit your hive."
    ↓
You review your entries — animated, warm, reflective.
    ↓
You package the best moments and send them to a connected friend.
    ↓
The recipient feels something real — because someone spent time on this.
    ↓
They're inspired to do it for someone else.
    ↓
The network grows. The honeycomb fills in. The garden accumulates.
```

### Delivery Slices

| Slice | Focus | Money? | Distribution |
|---|---|---|---|
| **Slice 1: Demo Mode** | Journal + private hives + social seeds + honeycomb + feed | No | TestFlight / internal track |
| **Slice 2: Public Launch** | Freemium paywall ($2.99/mo or $29.99/yr) + Cash App gifting via iMessage | Cash App links (Pollinate is NOT a money transmitter) | App Store / Play Store |
| **Slice 3: Transaction Research** | Evaluate MDK/Lightning integration IF transaction fees make sense. Requires legal/compliance research. | TBD based on research | — |

---

## 2. Design Philosophy: This App Must Be FUN

### Motion, Animation, and Delight

Pollinate is not a utility app. It's an **emotional experience.** Every interaction should feel alive, playful, and rewarding. If the app feels sterile or corporate, we've failed.

**Animation principles:**
- **Bloom is the hero moment — and there are two of them.** When a user takes a "trip down memory lane" through their private hive, their own entries bloom back to them one by one — warm, reflective, surprising. When a recipient opens a packaged collection of gratitude, it blooms for them — a curated gift that unfolds entry by entry. Both moments should feel like unwrapping something precious. Wax seal cracks, hexagon transforms, content reveals. This is the emotional payoff of the entire app. It must be **gorgeous.**
- **Every action has a reaction.** Writing a journal entry? The text settles into the page like ink. Planting a seed? It drops into the soil with a satisfying thunk. Sending a note to a friend? It flutters across the honeycomb like a bee.
- **Haptic feedback everywhere.** Every tap, every bloom, every sent note gets a haptic. Success feels different from error. Bloom feels different from a routine save.
- **The honeycomb breathes.** Hexagons aren't static. Blooming friends glow softly. Dormant friends fade. Active friends pulse gently. The hive feels alive even when you're just looking at it.
- **Transitions are smooth.** Screen changes use spring animations, not fades. Navigating the app should feel fluid, like moving through a garden.
- **Empty states are beautiful, not empty.** No blank screens. Every empty state is an illustrated invitation to do something meaningful.
- **Micro-interactions delight.** Long-press a hexagon for a wiggle. Drag to reorder. Pull-to-refresh makes the comb shimmer. Small details that make people smile.
- **Color and light.** Warm honey gold, amber glows, soft cream. Dark mode by default (the app glows in the dark like a lantern). Bloom events light up the screen.

**The benchmark:** When someone receives their first bloom, they should audibly say "oh wow." If they don't, the animation isn't good enough yet.

---

## 3. User Personas

### Persona A: "The Thoughtful Giver" (Primary)
- 25–45 years old. Remembers birthdays, writes cards, plans surprises.
- Wants to express gratitude that feels meaningful, not transactional.
- The Private Hive concept is built for them: write gratitude about someone over months, revisit it on "trips down memory lane," and package the best moments to send when ready.
- They'll pay $2.99/mo because this replaces greeting cards, gifts, and "thinking of you" texts.

### Persona B: "The Community Builder"
- 22–40 years old. Runs a maker group, church community, recovery circle, or tight friend group.
- Wants a space where appreciation is visible and communal.
- They'll create public hives, send seeds to multiple people, and grow the network.
- They'll pay because they want to add more than one person to their hives.

### Persona C: "The Daily Practitioner"
- Any age. Wants a daily gratitude practice that isn't lonely.
- Starts with the journal. Discovers private hives. Gets hooked when they take their first "trip down memory lane" and realize how much they've written about someone they love.
- Free tier is enough for them initially. They upgrade when they want more hives, monthly reviews, and unlimited sends.

---

## 4. App Structure

### Tab Bar

```
Today  |  Hive  |  Wallet  |  Garden
```

| Tab | What it is | Free tier | Paid tier ($2.99/mo) | MVP1 status |
|---|---|---|---|---|
| **Today** | Journal + Private Hives | 1 private hive. Daily journal full. | Unlimited private hives. | ✅ Full |
| **Hive** | Honeycomb + feed + social seeds | 1 friend in public hives. Can receive unlimited. | Unlimited friends in public hives. | ✅ Full |
| **Wallet** | Gifting | Shell: "Coming Soon" | Cash App gifting via iMessage links | 🔲 Shell in MVP1, Cash App in Slice 2 |
| **Garden** | Recap, Wrapped, history | Full solo features | Full + social features (Phase 3) | ✅ Full (solo) |

### Today Tab — "Where You Write"

The compose experience. Whether writing for yourself or capturing gratitude for someone in a private hive, you write here.

- **My Daily Journal** — personal gratitude entries, prompts, theme tagging, streak tracking, Evening Mirror reflection
- **Private Hives** — personal gratitude journals you keep FOR specific people (see §5.1)
- Each entry can be: kept private, shared to feed, or written into a private hive for someone

### Hive Tab — "Where You Connect"

The social layer. Activates when the user adds their first friend.

- **Honeycomb** — friends as hexagons with visual states
- **Feed** — shared gratitude, bloom events, seed teasers, reactions
- **Social Seeds** — plant a time-capsule seed for a friend (words only, or with a Cash App gift link in Slice 2)
- **Friend management** — add by email, username, contact sync, invite link
- When a user sends a package from a private hive, the sharing event appears in the Hive feed

### Wallet Tab — "Where You Gift" (Slice 2)

- **MVP1:** Shell only. Shows a beautiful "Coming Soon" state. No functionality.
- **Slice 2:** Cash App gifting via iMessage. Pollinate generates a gratitude note + a Cash App payment link. User sends via iMessage. Recipient reads the gratitude in Pollinate, taps the link to claim in Cash App. **Pollinate never touches the money.** We are NOT a money transmitter.

### Garden Tab — "Where You Reflect"

- **Recap** — monthly gratitude summary
- **Wrapped** — year-end review (4 slides, shareable)
- **History** — all entries, seeds, hives
- **Gratitude graph** — visualization of connections over time (Phase 3)

---

## 5. Core Product Features

### 5.1 Private Hives — THE Hero Feature

**Priority: MVP (Slice 1) — This is the heart of the app.**

A Private Hive is a personal gratitude journal you keep FOR someone close to you. You write entries sporadically — a thought, a memory, a moment of gratitude about that person — and they're always there for you to see. The hive grows quietly in the background of your life. Then, once a month or once a year, Pollinate taps you on the shoulder: *"Hey — let's take a trip down memory lane."* You review what you've written, relive those moments, and when you're ready, you can package up the best entries and send them directly to that person in the app.

**This is the gratitude practice that becomes a gift.** Not because it was sealed and timed — but because you spent months quietly noticing someone, and then you showed them.

#### How It Works

1. **Start a hive:** Name the person you're grateful for, choose a cover theme, set a review cadence (monthly, yearly, or manual)
2. **Write entries over time:** Days, weeks, months. Each entry is a moment of gratitude about that person — a sentence, a paragraph, a photo, a memory. No required cadence. Write when you feel it. **You can always see everything you've written.** Nothing is hidden from you.
3. **The hive grows:** Your entries accumulate in a beautiful, living space. A quiet counter tracks how many moments you've captured. The hive breathes — entries drift gently, photos warm the space, the cover evolves as more entries are added.
4. **Trip Down Memory Lane:** On your review cadence (monthly or yearly), Pollinate sends a push notification: *"It's time to revisit your hive for [Name]. 12 moments of gratitude are waiting."* You open the hive and entries appear one by one — a guided, animated walk through everything you've written. Each entry blooms into view. Photos, words, memories. It's reflective, warm, and genuinely fun. This is the author's bloom moment.
5. **Seal, then (optionally) Send — two acts, decoupled (2026-08-17 amendment):** After the review, when the hive is ready, you **seal** it — the author's completion act. Sealing selects entries into a curated collection, adds a note, and finishes the keepsake. It requires no recipient — a hive for a grandmother, a six-year-old, or someone you've lost completes here. **Send is a separate, optional step:** if the person is a connected friend, send the sealed package in-app. The recipient gets a notification: *"Colin packaged [N] moments of gratitude for you."* They open it, and your collected memories bloom for them — one by one, with the same beautiful animation.
6. **Reply:** Recipient can react, reply, or start their own hive for someone.

#### The Emotional Design

This isn't a feature — it's a **practice that becomes a gift.** Most gratitude apps are write-and-forget. Private Hives are write-and-remember. The "trip down memory lane" is where the magic happens: you sit down, your own words come back to you, and you realize how much this person means to you. Then you get to show them.

The packaging moment is intentional. You're not dumping a year of raw entries on someone. You're curating. You're choosing which moments to share. That act of selection — "these are the ones I want you to see" — is itself an act of care.

**Two bloom moments, not one:**
- **The author's bloom:** The trip down memory lane. Your own words, animated back to you. Reflection, warmth, surprise at how much you've written.
- **The recipient's bloom:** Opening a package of curated gratitude. Not a wall of text — a thoughtfully selected collection that someone chose for you.

#### Review Cadence

| Cadence | When | Best for |
|---|---|---|
| **Monthly** | First of every month | Active relationships, ongoing appreciation |
| **Yearly** | Anniversary or set date | Birthdays, holidays, "year in review" |
| **Manual** | Whenever the author opens the hive | Low-pressure, write-when-inspired |

The review prompt is the app's core re-engagement mechanic. It's not a notification saying "come back to the app." It's saying "you wrote 8 beautiful things about someone you love — don't you want to see them again?"

#### Free vs. Paid

| | Free | Paid ($2.99/mo or $29.99/yr) |
|---|---|---|
| Private hives | 1 hive | Unlimited hives |
| Entries per hive | Unlimited | Unlimited |
| Review cadence | Yearly only | Monthly, yearly, or manual |
| Send | *(2026-08-17 flag — not yet ruled: `sealed_at`/`sent_at` are one-directional per hive, so "1/hive/year" is vacuous — every tier gets ≤1 send per hive, forever. Pending Colin: is free "1 hive" concurrent or lifetime? See Slices 8b.5 open item.)* | *(same, pending)* |

#### Acceptance Criteria

- User can create a private hive for any contact (email or username)
- User can always see their own entries — nothing is hidden from the author
- Entries persist in Supabase (survives device loss — a year of entries cannot live on one phone)
- Review prompt fires on the configured cadence (monthly/yearly) via push notification
- "Trip down memory lane" experience presents entries sequentially with bloom animation
- User can select entries from a hive to package into a curated collection
- User can send a package to a connected friend in the app
- Recipient receives notification and can open the package with bloom animation
- Recipient can react and reply to received packages
- Package contents visible ONLY to the recipient (enforced by Supabase RLS)
- Feed event created when a package is sent (with appropriate privacy — "Colin sent gratitude to [Name]" without revealing contents)
- Bloom animation for both review and package-open is smooth, emotional, and gorgeous

---

### 5.2 Social Seeds — Short-Form Time Capsules

**Priority: MVP (Slice 1)**

Seeds are the short-form version of private hives. A single sealed gratitude note (with optional photo) sent to a friend that blooms on a future date. Quick to create, but the anticipation makes it powerful.

#### Seed vs. Private Hive

| | Private Hive | Social Seed |
|---|---|---|
| Length | Multiple entries over months | One note, one moment |
| Recipient | One specific person (packages sent to connected friends) | One friend (or multiple in Phase 2) |
| Author visibility | Always visible to author; periodically reviewed | Always visible to author |
| Recipient visibility | Sees only packaged entries sent to them | Sees content on bloom date |
| Creation | Sporadic, ongoing | 2-minute compose |
| Best for | "Here's everything I've been grateful for about you" | "Open this on your first day" / "Bloom in 30 days" |
| Where created | Today tab | Hive tab (from hexagon action menu) |

#### Acceptance Criteria

- Content completely hidden until bloom date
- Push notification fires within 1 minute
- Bloom animation: wax seal breaks → hexagon blooms → note appears → celebration
- Feed event created with correct privacy audience
- Sender notified when recipient opens the bloom

---

### 5.3 The Journal (Today Tab — Personal)

**Priority: MVP (Slice 1)**

The daily gratitude practice. What a solo user does on day one before they have friends.

**Requirements:**
- Write one gratitude entry per day with prompts and theme tagging
- Streak tracking (but NOT the primary retention mechanic — seeds and hives are)
- Evening Mirror reflection
- Entries can be kept private, shared to feed, or written into a private hive for someone
- Must be genuinely pleasant to use — the compose experience should feel like opening a beautiful notebook

**Acceptance Criteria:**
- User can write and save an entry in under 30 seconds
- Streak updates immediately
- Entry persists in Supabase (survives device loss)
- Can share to feed or write into a private hive from the compose screen

---

### 5.4 The Honeycomb (Social Feed)

**Priority: MVP (Slice 1)**

The feed where gratitude is visible, social, and alive. Not performative posts — genuine appreciation between people who know each other.

**Requirements:**
- Feed shows: shared gratitude notes, seed teasers (sealed, blurred, countdown), bloom events (celebration), reactions
- Chronological (most recent first)
- Emoji reactions on feed items
- Real-time updates (WebSocket or 15s polling)
- Infinite scroll
- Beautiful empty state: "Your honeycomb is waiting. Add your first friend."

**Acceptance Criteria:**
- Feed loads within 2 seconds
- Privacy settings correctly filter visibility
- Seed teasers show countdown but never reveal content
- Bloom events include full revealed note with celebration animation
- Reactions update in real-time

---

### 5.5 The Hive (Friend Network & Hexagon UI)

**Priority: MVP (Slice 1)**

Each friend is a hexagon in a living honeycomb. The visualization IS the app's signature visual element.

**Requirements:**
- Add friends via email, username, contact sync, invite link
- Friend request/accept/decline/block
- Hexagon visual states:
  - **Blooming** (golden glow) — gratitude flowed in this friendship recently, either direction (ruled 2026-08-17, Lumen: the member's full inbox is invisible by design — RLS `notes_select_participant` exposes only notes the viewer is party to — so bloom is viewer-relative, a property of the friendship, not the person. Derived client-side from `last_note_received_at` and `last_note_sent_at` (not yet in schema) with **two windows, one per direction — the streams do different emotional jobs, and the band arithmetic travels with the second stream** (amended 2026-08-17 after Sage's density block: R59's 48h is justified by ~1 note/member/week in ONE direction; feeding two streams into one 48h window computes to ≈3.1–3.4-of-7 and breaches Pixel's ≤3-of-7 readable band). Receive keeps 48h — the invitation persists until the next session. Send gets 24h (**48+24 is ruled, 2026-08-17, same footing as R59's 48 — a human decision, not a computation's output**; the gate's arithmetic near the cap depends on model choice, so the ruling is the authority and the inequality its instrument; retune against real note volume via the measurement issue): reinforcement is immediate and decays by tomorrow, and a same-session burst of your own thank-yous lighting several cells is self-caused signal that clears overnight. Steady state at the assumed rate: ≈2.4–2.7-of-7, inside the band with headroom. The band invariant needs its own gate over the derivation — expected-density arithmetic importing the shipped window constants and a named assumed-rate constant, asserting ≤3-of-7 — because check-demo-hive.mjs's band assertion runs over authored demo fixtures and never calls `isBlooming`. Gate contract (amended 2026-08-17, per Sage — the assumption is the only load-bearing input and the one thing nobody has measured): (a) the assertion is named for what it checks — "expected density stays ≤3-of-7 **at the assumed rate**," never the band alone; (b) the gate prints its assumption on every run, green included — e.g. `assumed 1 note/member/week → expected 2.4–2.7 of 7 (cap 3)` — so a green cannot be mistaken for a measurement; (c) the script header states its honest scope: a pure function of three repo constants, it fails exactly when a window widens without re-derivation, and it can never notice the assumption itself is wrong — only measured real note volume can, which is a TestFlight-era follow-up (filed); (d — amended 2026-08-17, per Sage's inversion: three free parameters, one constraint means the gate is always satisfiable by editing the one unmeasured input) **the assumed-rate constant is pinned inside the density gate itself**, label carrying the measurement issue id — "assumed rate matches the unmeasured placeholder — changes only via issue 1fb9022f" — so the gate's only cheap satisfying edit is fixing a window; the print remedy in (b) stays, because with the rate pinned the printed assumption signposts the amendment procedure instead of an escape route. Window pins live in check-hive-state-utils.mjs, **both windows, labels carrying their asymmetric status** (a pin with the same label shape would flatten ruled into guessed): `'receive window matches R59's ruled value — retune via issue 1fb9022f'` (upgrading the existing `=== 48` pin's label) and `'send window matches the 2026-08-17 ruled value — retune via issue 1fb9022f'` (supersedes the earlier "placeholder" label: 48+24 is ruled, and a placeholder label would flatten a ruling into a guess in the other direction). Division of labor, stated so neither gate reads as redundant later: **at three green pins the density inequality is a constant and can never fire — that is not deadness.** The pins catch unceremonied change (each names the authority a change must answer to); the density inequality validates *ceremonied* change — when a window pin is legitimately updated, it is the gate that says whether the new configuration still fits the band. Red pin + red density = unceremonied breach; updated pin + red density = ceremony done, arithmetic broken. Build note: the new script registers a `check:bloom-density` alias in package.json — run-checks.mjs cross-checks aliases in both directions and reds the whole suite on drift with a message that says nothing about bloom. (e — amended 2026-08-17, per Sage: the formula is a fourth free input, and the nearest to the verdict — 48+48 fails Poisson by 1.7%, and any model refinement, e.g. crediting reciprocity, moves it green) **the model is pinned: the gate implements the clamped linear-union form** `density = 1 − Π(1 − min(1, wᵢ·rate/168))`, named, with the derivation in the header, amendable only under ceremony like the rate pin. The clamp is load-bearing, not defensive style (amended 2026-08-17, per Sage): unclamped, the form is non-monotone — at w ≥ 168 a per-stream term goes negative, and an even number of negative terms multiplies back positive, so two 336h windows report exactly **zero** expected blooming and pass. The conservative-bound proof (`union ≥ Poisson`) needs λ < 1; the clamp restores it everywhere, and **a pinned formula's domain is pinned with it, with one fixture past the domain edge** (see f). Linear union is chosen *because* it is the conservative bound — per-stream it uses expected count where Poisson uses P(≥1), so every refinement toward realism only lowers the estimate, which makes "improving the model" legible as a loosening act rather than a neutral correction; under the pinned form the rejected 48+48 reds at 3.43 with real margin instead of hinging on 0.05. (f) **the gate carries fixtures on both sides, chosen outside the model-sensitive band** so it demonstrates its own discrimination on every run (the same reason check-hive-state-utils.mjs asserts four false-direction cases): green fixture (48, 24) → 2.44/2.71 under both models; red fixture (96, 24) → 3.57/4.43 under both; **out-of-domain fixture (336, 336) → clamped 1.0 → red** — the case the unclamped form passed at zero, kept so the clamp can never be "simplified away" silently; the live constants are one row among several. **48+48 is deliberately not a fixture** — it sits inside the band where the model decides, and pinning it would pin the model by accident rather than by decision. (g) the assertion is phrased as a **fraction** (expected blooming fraction ≤ 3/7), not a count — and labeled as what it is: **a calibration-budget claim about an expectation, not a guarantee about any comb a user sees** (amended 2026-08-17, per Sage's realized-distribution analysis). At the ruled config the *realized* comb exceeds 3-of-7 on ≈27% of days at n=7, and launch-sized combs are worse: n=2–4 members exceed the band 33–63% of the time, and one two-member comb in seven shows every cell blooming (p² = 15%) — a ring that is universal and therefore carries no information. The gate **prints** the realized tail beside the expectation (`P(realized comb exceeds band | n=7) ≈ 27%`) but does not assert on it: no acceptable tail probability has been ruled, and inventing one inside a gate repeats the class this thread spent the afternoon retiring. (h) whether 3/7 is even the right *form* of the invariant at small n is an open design question handed to Pixel (owner of §21.9 / R59): at n=2, one-of-two blooming is 50% and perceptually fine while two-of-two fails for a different reason — no unmarked cell to contrast against — so the true invariant may be figure-ground ("at least one dormant cell as ground; marked in the minority at larger n") rather than any single fraction. The fraction assertion is **interim until Pixel restates §21.9**; the gate holds whichever form gets ruled, and cannot pick it. The send direction is load-bearing: your own thank-you blooms the cell immediately — the shipped receive-only derivation inverted the loop into a scoreboard where your own action never changes the screen)
  - **Seeded** (sprout icon) — has a pending seed/hive
  - **Dormant** (muted gray) — hasn't received gratitude in 30+ days ("They could use some appreciation")
  - **Active** (gentle pulse) — online and posting today
- Tap hexagon → action menu (bottom sheet): Send a note, Plant a seed, View history
- Honeycomb grows as friends are added
- States computed from backend data, updated in real-time

**Free vs. Paid:**
- Free: 1 friend in public hives (can receive unlimited)
- Paid: unlimited friends

**Acceptance Criteria:**
- User can add friends via each method
- Hexagon states render correctly and update within 30 seconds
- Action menu appears on tap with spring animation
- Honeycomb adjusts dynamically (1–500+ hexagons)

---

### 5.6 Gifting & Money — Slice 2 (Research Required)

**Priority: Slice 2 — NOT MVP1. Requires significant research.**

#### The Problem We Need to Solve

We want users to be able to attach a small monetary gift to their gratitude. But we do **NOT** want Pollinate to be a money transmitter. Money transmitter status brings massive regulatory burden (MSB registration, state-by-state licensing, KYC/AML compliance, bonding requirements). That kills a small startup.

#### Approach: Cash App Links via iMessage (Slice 2 — Cleanest Path)

Instead of handling money ourselves, we let the user attach a **Cash App payment link** to their gratitude. Pollinate generates the gratitude note + a pre-filled Cash App link. The user sends it via iMessage (or in-app if the recipient has Pollinate). The recipient reads the gratitude in Pollinate, taps the link, and claims the money in Cash App.

**Flow:**
```
User writes gratitude note in Pollinate
    ↓
Taps "Attach a gift" → enters $ amount
    ↓
Pollinate generates: gratitude note + Cash App $cashtag payment link
    ↓
User sends via iMessage (or in-app notification if recipient has Pollinate)
    ↓
Recipient reads gratitude in Pollinate
    ↓
Taps "Claim your gift" → opens Cash App
    ↓
Money flows through Cash App. Pollinate never touches it.
```

**Why this works:**
- Pollinate is NOT a money transmitter — we never touch, hold, or route funds
- Cash App handles all KYC, compliance, fraud, chargebacks
- 59M+ US users already have Cash App
- Zero fees on Lightning sends from Cash App
- The gratitude note is the primary content; the money is the exclamation mark
- UX is clean: write gratitude → attach gift → send → recipient reads + claims

**What we need to research (Slice 2 prerequisite):**
1. Can we deep-link into Cash App with a pre-filled payment? (Cash App URL scheme: `https://cash.app/$cashtag/amount`)
2. Can we detect if the recipient claimed the payment? (Probably not — Cash App doesn't offer webhooks for peer-to-peer payments. We'd mark it as "sent" not "claimed.")
3. What about non-Cash App users? Options: Venmo deep links, Apple Pay via iMessage, or just let the user choose their payment app
4. Can we eventually earn revenue through Cash App's affiliate/referral program? (Research needed)

#### Future: Transaction Fees (Slice 3+ — TBD)

If we eventually want to earn transaction fees on tips, we'd need to integrate MDK/Lightning directly. This makes us potentially a money transmitter depending on how it's structured. **This requires legal counsel before any engineering work begins.** Options to research:

| Model | How it works | Money transmitter? | Revenue |
|---|---|---|---|
| **Cash App links (Slice 2)** | Pollinate generates links, Cash App handles money | ❌ No — we don't touch money | Possible affiliate revenue (research) |
| **MDK with platform fees** | Pollinate processes Lightning payments, takes 1% | ⚠️ Possibly — depends on structuring | 1% of tip volume |
| **MDK as non-custodial wallet** | Users self-custody, Pollinate only provides UX | ⚠️ Possibly less risky, but untested legally | 1% of tip volume |
| **Subscription only** | No transaction fees. Revenue from $2.99/mo subscriptions only | ❌ No money movement at all | $2.99–29.99/user |

**Recommendation for Slice 2:** Start with Cash App links. It's clean, legal, and gets money into the product without regulatory risk. Research MDK/Lightning and transaction fees in parallel for a potential Slice 3.

---

### 5.7 The Garden (Reflection Layer)

**Priority: MVP (solo features) / Phase 3 (social features)**

**MVP1 scope:**
- Monthly Recap (existing feature)
- Year-end Wrapped (existing feature, 4 slides, shareable)
- Entry history (all entries, seeds, hives in chronological view)

**Phase 3 scope:**
- Gratitude graph visualization
- Annual Harvest (Spotify Wrapped-style recap with social data)
- Shared history with friends
- Flight path chains (pay-it-forward tracking)

---

## 6. Freemium Model

### Free Tier (MVP1)

| Feature | Free limit |
|---|---|
| Daily journal | Full, unlimited |
| Private hives | **1 hive** |
| Review cadence | **Yearly only** |
| Send | *(pending Colin's ruling — see 2026-08-17 flag above)* |
| Social seeds | **1 active seed at a time** |
| Public hives (social) | **1 friend** |
| Feed | Full access (view and react) |
| Receiving | Unlimited (can receive unlimited seeds, hives, notes) |
| Garden (Recap, Wrapped) | Full |
| Gifting | Not available (Slice 2) |

### Paid Tier — "Pollinate Plus" ($2.99/month or $29.99/year)

| Feature | Paid unlocks |
|---|---|
| Private hives | **Unlimited hives** |
| Review cadence | **Monthly, yearly, or manual** |
| Send | *(pending Colin's ruling — see 2026-08-17 flag in §5.1)* |
| Social seeds | **Unlimited active seeds** |
| Public hives | **Unlimited friends** |
| "Bloom When" conditional seeds | Unlocked |
| Surprise seeds (random date) | Unlocked |
| Reciprocal seeds | Unlocked |
| Gifting (Cash App links) | Unlocked (Slice 2) |
| Premium hexagon themes | Unlocked |
| Advanced Garden visualizations | Unlocked (Phase 3) |

### Why This Model Works

- **Receiving is always free.** The viral loop works: someone sends you a hive, you download Pollinate to read it, you're hooked. No paywall between you and receiving gratitude.
- **The upgrade trigger is natural.** A free user creates one private hive for Mom for Mother's Day. They love it. They want to do the same for Dad for Father's Day. "Upgrade to create unlimited hives." That's a natural, motivated upgrade — not a nag.
- **$2.99/mo is impulse territory.** Less than a coffee. For something that replaces greeting cards and gift planning.
- **$29.99/yr is a 17% discount.** Annual subscribers are the backbone.
- **No transaction fees in the core model.** Revenue comes from subscriptions. If we add transaction fees later (Slice 3+), it's upside, not the foundation.

---

## 7. Data Architecture

### The Core Rule

```
If losing the user's phone would destroy the data → it must be in Supabase.
If it's a draft, cache, or UI state → local is fine.
If it's a private key → local secure storage only, NEVER backend.
```

### Must be in Supabase (source of truth)

| Data | Why |
|---|---|
| User accounts & auth | Server-side |
| Profiles (name, avatar, username) | Cross-device, visible to others |
| Friendships (social graph) | Shared state |
| **Journal entries (ALL)** | Must survive device loss. Tied to user_id. |
| **Private hive contents** | Author's personal gratitude journal for someone. Must persist to survive device loss. **A year of entries cannot live on one phone.** Always visible to author. |
| Seeds (metadata + contents) | Bloom scheduler runs on backend |
| Gratitude notes (sent between users) | Shared state |
| Feed events | Aggregated server-side |
| **Packaged collections** | Curated subsets of hive entries sent to recipients. Shared state — recipient must be able to access what was sent to them. |
| Likes, comments, reactions | Shared social state |
| Hive states | Computed from backend data |
| Push notification tokens | Backend sends notifications |
| Subscription status | IAP receipt validated server-side (Slice 2) |

### Local only

| Data | Why |
|---|---|
| Draft entries (not yet posted) | Sync on publish |
| UI state (selected tab, scroll position) | Ephemeral |
| Cached images | Performance |
| Offline draft queue | Sync when online |

### Privacy & Access Control (Critical)

Every entry has:
- `user_id` (the author)
- `visibility`: `private` | `shared` | `packaged` | `sent`

A user can always read their own entries — **the author never loses visibility of what they've written.** This is fundamental to the Private Hives concept.

A user can read entries where:
- They are the author (always, regardless of visibility)
- The entry is `shared` and they are in the author's hive (feed)
- The entry is `packaged` and sent to them as a recipient (they see only the packaged subset)

Row-level security (RLS) policies in Supabase enforce this at the database level. **This is not optional.** The cross-account privacy leak found in the current codebase must be fixed before any tester touches the app.

**Private Hive data model notes:**
- Hive entries belong to a `hive_id` and are always visible to the hive's author
- "Packaging" creates a curated subset of entries sent to a specific recipient
- Recipients see only what was packaged and sent to them — never the full hive
- The author's full hive is never exposed to anyone else

---

## 8. Success Metrics

### Slice 1 (Demo Mode — No Money)

| Metric | Target | What it validates |
|---|---|---|
| Active testers | 30+ across 3+ groups | Cold-start viability |
| Daily journal entries per tester/week | 3+ | The journal sticks |
| Friends added per tester | 3+ | Network formation begins |
| Entries shared to feed | 20%+ of entries | Solo → social bridge |
| Private hives created | 10+ total | The hero feature lands |
| Private hive reviews completed ("trips down memory lane") | 5+ total | The review mechanic engages |
| Packages sent from private hives | 5+ total | The sharing loop works |
| Social seeds planted | 10+ total | Time capsule mechanic understood |
| Seed bloom open rate | 80%+ | Notifications drive re-engagement |
| 7-day retention (unprompted) | 30%+ | People come back without nagging |
| NPS | 30+ | Product-market fit signal |
| "Would you send this to a friend?" | 70%+ yes | Viral loop potential |
| Data loss incidents | 0 | Reliability |

### Slice 2 (Public Launch with Freemium)

| Metric | Target |
|---|---|
| Free → Paid conversion | 5%+ (industry standard for freemium) |
| Monthly active users | 1,000+ within 60 days |
| Private hives created per paid user | 2+ per year |
| 30-day retention (paid) | 50%+ |
| Annual subscription rate (% of paid who choose yearly) | 40%+ |
| Cash App gifts sent (if launched) | Track but no target |

---

## 9. Design Principles

1. **This app must be FUN.** Every interaction should delight. Bloom animations, haptic feedback, breathing hexagons, spring transitions. If it feels sterile, we've failed.
2. **The journal is the on-ramp.** Solo on day one. Social when friends join. Never a dead end.
3. **Private hives are the hero.** A personal gratitude journal you keep FOR someone — written over time, revisited on "trips down memory lane," and packaged to share when you're ready. This is the practice that becomes a gift, and it doesn't exist anywhere else.
4. **Words first, money second.** The gratitude note is the message. The money (when it comes) is the exclamation mark. A seed with just words is still awesome.
5. **The bee theme is visual, not verbal.** Hexagons, honeycomb, golden palette, bloom animations. The copy uses plain English.
6. **Receiving is always free.** The viral loop depends on it. Never paywall the receiving experience.
7. **We are NOT a money transmitter.** Cash App links handle money. We handle gratitude.
8. **Consumer, not enterprise.** This is for friends and family, not HR teams.

---

## 10. Open Questions

1. **Cash App deep-linking:** Can we pre-fill a payment amount in a Cash App URL? Format appears to be `https://cash.app/$cashtag/amount` — needs verification.
2. **Non-Cash App users:** What's the fallback for gifting? Venmo deep links? Apple Pay via iMessage? Let the user pick their payment app?
3. **Private hive data model:** Should hive entries and packaged collections share a table with a `type` field, or be separate? Entries are always visible to the author; packages are curated subsets sent to recipients. Likely: entries in one table, packages as a join table linking selected entries to a recipient.
4. **Collective private hives:** Can multiple people write into a single private hive for one recipient? (Group gift — 5 friends each write entries, all packaged together.) This is powerful but adds complexity. Phase 2.
5. **Review cadence timing:** Should the "trip down memory lane" fire on a fixed date (anniversary), relative date (first of month), or dynamic (when N entries accumulated)? What feels most natural?
6. **Package composition:** Should packages be limited to text, or support photos, voice notes, and other media? What's the MVP1 scope for package contents?
7. **Bloom animation budget:** The bloom reveal — both for the author's "trip down memory lane" and the recipient's "package opened" — is the most important animation in the app. What's the engineering budget? It needs to be best-in-class. Consider Lottie or Rive for complex sequences.
8. **Transaction fee legal research:** If we eventually want to process payments ourselves via MDK/Lightning, what's the legal structure that avoids money transmitter status? Need a fintech lawyer's opinion before any engineering work.

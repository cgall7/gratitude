# Pollinate — The Ruling: One App, Not Three

**From:** Colin  
**To:** Engineering + Design  
**Re:** Your scope/alignment memo — the answer, the tab structure, the data architecture, and what's in/out for MVP1

---

## The One Sentence You Asked For

> **The daily journal (Today / Recap / Wrapped) is part of Pollinate. It is not legacy. It is the foundation the social network grows on. The strategy doc's §2 positioning has been updated to reflect this.**

---

## Amendment — 2026-08-17 (re-researched from zero at Colin's request; ratified by Colin in the CEO action items thread)

Colin asked for items 3 (scope) and 4 (positioning) to be re-derived ignoring all prior rulings, from one question: *what will users fall in love with.* The hero survived the re-research and sharpened. Four changes, applied in place below and in the strategy doc (v2.1):

1. **The hero sentence changed.** Killed: *"A journal that becomes social"* (the Marketing §1 line below originally read this way). Now: **"gratitude you compile for someone, until it's ready to give."** The hero is the Private Hive arc *ending in the reveal* — opening a package someone spent months writing you is the only moment in the product that can make a person cry, and it is the tell-a-friend moment Slice 1 exists to discover.
2. **Delivery is a spectrum, not a gate.** A hive must be worth keeping even if its person can never install the app (a child, a grandparent, someone you've lost). The hive is a letter drawer, not an outbox — valuable at zero deliveries. In-app send ships in Slice 1; send-as-a-link (the viral loop) and keepsake export come later.
3. **Naming: never "Public."** The two-mode model Colin sketched is ruled in as **Private Hive** (audience of one) and **the Hive** (audience of your invited people). The social layer is mutual-consent and RLS-gated; "public" would be a false privacy claim. The schema's word is `shared`.
4. **Slice 1 scope: the full arc minus the reply.** Write → review → seal → (send) → open all ship. **Seal and send are two acts, deliberately decoupled** (amended same day, per Sage; the schema already made this call in migration `20260815000003`): *seal* is the author's completion act on the hive — sets `sealed_at`, requires no recipient, so the grandmother/child/lost-someone hives complete the arc as keepsakes; *send* is optional and separate — chooses a connected friend, writes `packaged`/`sent`. Sealing must never be gated on picking a recipient. 8b.8 (reply) moves to Slice 1.1 — it has roundtrip mechanics and no new emotion; a moved recipient responds by starting their own hive, which is the same creation flow we already build. Sequence: write-and-review first, in testers' hands the moment it works; then package → send → open.
   **Acceptance bar for the reveal (8b.4 / 8b.6): pacing, not particle effects.** Entries surface one at a time, dates visible — *March 12… April 3…* — because time is the material of the gift. One tap per memory; the recipient cannot skim. If a tester screenshots it or cries, it passes. If they scroll it like a feed, it fails, whatever it looks like.

---

## Why I'm Making This Call

Your memo is right that there are three things in play right now, and that nobody has ruled on which one is real. Here's the ruling, with the reasoning behind it.

### The journal is the solo on-ramp. The network is the payoff. They're one product.

The strategy doc positioned gratitude journals as a **competitor** — the lonely, private, doesn't-stick thing we're replacing. That's half right. **Standalone** journals are our competitor. Three Good Things, Presently, Reflectly — they're dead ends. You write into a void, nobody sees it, and you quit in two weeks.

But a journal that **feeds into a social network** isn't a competitor. It's the input layer. A journal entry in Pollinate can:

1. **Stay private** (like any journal)
2. **Be shared to the Honeycomb feed** (social)
3. **Be sealed as a Seed** for a future date (time capsule)
4. **Be written into a Private Hive** (a personal gratitude journal kept FOR someone, reviewed periodically, then sealed as a keepsake — sending is optional and separate; the Christmas concept)
5. **Have a tip attached** (money via MDK — Slice 2)

A journal entry in Three Good Things can do exactly one of those: stay private. That's the competitive gap.

### On the Christmas concept specifically

The Christmas concept — a personal gratitude journal kept *for* someone — is a **Private Hive**. It lives in the Today tab alongside your personal journal. You write entries over time — a thought, a memory, a moment of gratitude about that person — and they're always there for you to see. Nothing is hidden from the author. Then, on a cadence you choose (monthly, yearly, or manual), Pollinate taps you on the shoulder: "Hey — let's take a trip down memory lane." You review what you've written, relive those moments, and when you're ready, you **seal** the hive — the author's completion act, no recipient required. If the person is a connected friend, sending is a separate, optional step after the seal (2026-08-17 amendment, item 4). This is the journal + private hives used together, and it's the strongest product story because it works with just two people.

**The journal + private hives + seeds = a gift you spend a year making.** That's not in any competitor. That's the moat.

---

## The Tab Bar (Project 10 — Unblocked)

The current tabs — `Today | Honeycomb | Recap | Wrapped` — aren't wrong, they're incomplete. The strategy doc's IA — `Hive | Feed | Wallet | Profile` — isn't wrong either, it's the social-mode IA. Both exist in the same app. Here's the unified structure:

### Unified Tab Bar

```
Today  |  Hive  |  Wallet  |  Garden
```

| Tab | What it is | Solo user (day 1) | Social user (has friends) |
|---|---|---|---|
| **Today** | Journal + Private Hives | Full feature. Write daily gratitude. Start a private hive for someone (always visible to you, reviewed periodically, then sealed — sending is optional and separate). | Same, but now you can also share today's entry to the feed or seal it as a social seed. |
| **Hive** | Social layer: honeycomb + feed | Empty state: "Add your first friend." | Full feature. Hexagons with states. Tap → action menu. Feed flows here. |
| **Wallet** | Balance, funding, tips | **Shell only in MVP1.** Shows $0.00 + "Coming Soon." Tab exists but no functionality. | Full feature in Slice 2: balance, transactions, send tips, funding. |
| **Garden** | Reflection: Recap, Wrapped, history | Shows your entries, streak, monthly recap. Solo reflection. | Adds: gratitude graph, Annual Harvest, shared history with friends. |

### What lives where

**TODAY TAB — "Where you write"**
- My Daily Journal (personal gratitude entries — your practice, your streak)
- Private Hives (personal gratitude journals you keep FOR someone — always visible to you, reviewed on a trip down memory lane, then sealed; sending is optional and separate)
  - "Hive for Mateo" (47 entries — yearly review)
  - "Hive for Mom" (3 entries — monthly review)
  - + Start a private hive for someone
- Each entry can be: kept private, shared to feed, or written into a private hive
- The compose experience lives here. Whether you're writing for yourself or for Mateo, you're writing in Today.

**HIVE TAB — "Where you connect"**
- Honeycomb (friends as hexagons with visual states)
- Feed (shared gratitude, bloom events, seed teasers, reactions)
- Social seeds (plant a seed for a friend — instant, not the year-long kind)
- Friend management (add, search, invite)
- When a user sends a package from a private hive, the sharing event appears in the Hive feed

**WALLET TAB — "Where money lives" (Slice 2)**
- MVP1: Shell only. Tab exists, shows empty state. No MDK, no funding, no tips.
- Slice 2: Balance (sats + USD), add funds (Cash App / Coinbase Onramp), send tips, transaction history

**GARDEN TAB — "Where you reflect"**
- Recap (monthly gratitude summary)
- Wrapped (year-end review)
- Gratitude graph (visualization of connections over time)
- History (all entries, seeds, shared notes)

### Why this structure works

The distinction between Today and Hive is **audience and timing:**

| | Today | Hive |
|---|---|---|
| What you do | Write gratitude | See and send to friends |
| Audience | Yourself or one specific person (private hive) | Your friend network |
| Timing | Daily practice + periodic review | Real-time / near-real-time |
| Solo user | Full feature (journal works alone) | Empty state ("add your first friend") |
| Christmas concept | Lives here (write into private hive) | Sharing event appears here when a package is sent |

---

## Wallet & Money: Deferred to Slice 2

**To be crystal clear: the wallet and money integration is NOT in MVP1.**

- The Wallet **tab shell** should be built in MVP1 (so the tab bar is complete and doesn't change later)
- The Wallet tab in MVP1 shows: `$0.00` + a "Coming Soon" state
- **No MDK SDK integration in MVP1**
- **No funding flows in MVP1** (no Cash App QR, no Coinbase Onramp)
- **No tips in MVP1** (no Lightning payments)
- **No transaction history in MVP1**

All of this moves to Slice 2. The wallet issues in the Linear breakdown (ENG-9, ENG-13, ENG-14, etc.) are **Slice 2 work, not Cycle 1–5 work.**

**Why:** Slice 1 (Demo Mode) validates the social-gratitude loop — journal → share → seed → bloom → return. Money is a separate axis. If the emotional loop doesn't work without money, money won't save it. We test the foundation first, then add money.

---

## Data Architecture: What's Supabase vs. Local

### The Core Rule

```
If losing the user's phone would destroy the data → it must be in Supabase.
If it's a draft, cache, or UI state → local is fine.
If it's a private key → local secure storage only, NEVER backend.
```

### Must be in Supabase (source of truth)

| Data | Why |
|---|---|
| User accounts & auth | Server-side accounts |
| Profiles (name, avatar, username) | Consistent across devices, visible to others |
| Friendships (social graph) | Shared state — both users see the relationship |
| **Journal entries (ALL of them)** | **Critical fix.** Must be tied to user_id. A year of entries for Mateo's Christmas seed must survive a lost phone. |
| **Private hive contents** | Author's personal gratitude journal for someone. Must persist to survive device loss. Always visible to author. |
| Seeds (metadata: sender, recipient, bloom date, status) | Bloom scheduler runs on backend — can't fire if data is on an offline phone |
| Seed contents (the note text) | Server-side, sealed until bloom date. Access controlled. |
| Gratitude notes (sent between users) | Shared state — both sender and recipient need access |
| Feed events | Aggregated server-side |
| Likes, comments, reactions | Shared social state |
| Hive states (blooming/seeded/dormant/active) | Computed from backend data |
| Push notification tokens | Backend sends bloom notifications |

### Local only (never hits Supabase)

| Data | Why |
|---|---|
| Draft entries (not yet posted) | Still composing. Sync on publish. |
| UI state (selected tab, scroll position) | Ephemeral, device-specific |
| Cached images (avatars, shared photos) | Performance. Fetch from CDN, cache locally. |
| **Wallet private keys** | iOS Keychain / Android Keystore. NEVER in Supabase. Self-custody. (Slice 2) |
| Offline draft queue | Write offline, queue locally, sync when online. |

### Both (local cache + Supabase source of truth)

| Data | Local | Supabase |
|---|---|---|
| Journal entries | Cached for offline reading/writing. Draft auto-saves locally. On publish: sync to Supabase. | Source of truth. All published entries. |
| Hive state | Cached locally. Updated via WebSocket or polling. | Source of truth. |
| Feed events | Cached locally. Refreshed on app open. | Source of truth. |

### The Privacy Fix

The cross-account leak (one account's private sentence published to another's honeycomb) is caused by entries not being properly tied to user accounts. The fix:

1. Every entry in Supabase has a `user_id` column (the author)
2. Every entry has a `visibility` column: `private` | `shared` | `packaged` | `sent`
3. Access control — a user can only read entries where:
   - They are the author (`user_id = current_user`) — the author always has access to their own entries
   - The entry is `shared` and they are in the author's hive
   - The entry is `sent` and they are the recipient of that package
4. Row-level security (RLS) policies in Supabase enforce this at the database level

Moving to Supabase isn't just about persistence — it's the privacy fix. RLS policies make it structurally impossible for one user to read another's private entries.

---

## Slice 1 Success Criteria (Revised — No Money)

| Criterion | Target | What it validates |
|---|---|---|
| Active testers | 30+ across 3+ groups | Cold-start viability |
| Daily journal entries per tester/week | 3+ | The journal sticks (solo mode works) |
| Friends added per tester | 3+ | Network formation begins |
| Entries shared to feed | 20%+ of entries | Solo → social bridge works |
| Seeds planted | 10+ total | Time capsule mechanic is understood |
| Seeds bloomed during testing | 5+ | Bloom experience lands emotionally |
| 7-day retention (unprompted) | 30%+ | People come back without being nagged |
| Seed bloom open rate | 80%+ | Bloom notifications drive re-engagement |
| Private hives created | 10+ | The hero gets adopted |
| Memory Lane reviews completed | 5+ | The author's bloom moment lands |
| Packages sent | 5+ | The arc completes end to end |
| Package open rate | 80%+ | The reveal is anticipated, not ignored |
| Hives **sealed** with 5+ entries and no send | 3+ | The letter drawer is valuable at zero deliveries — seal requires no recipient, so this is directly measurable via `sealed_at` (added 2026-08-17) |
| Qualitative: "Would you send this to a friend?" | 70%+ yes | Viral loop potential |
| Qualitative: NPS | 30+ | Product-market fit signal |
| No critical data loss (entries, friendships, seeds) | 0 incidents | Reliability |

**What Slice 1 validates:** The social-gratitude loop (journal → share → seed → bloom → return) works without money. The journal creates content. The feed creates social connection. Seeds create future pull.

**What Slice 1 does NOT validate:** Money. That's Slice 2.

---

## The Two Urgent Engineering Fixes (Before Any Testing)

### 1. Run the Supabase Migration (P0 — Today)

Four people's merged work is invisible on devices because migrations haven't been applied to prod. `notes`, `seeds`, `seed_contents`, `list_hive_state`, `plant_seed` all return 404. (Amended 2026-08-17: this list previously named `list_my_seeds` — `list_my_seeds` (never in schema); no such function was ever merged. Seeds are listed by direct `seeds` table selects under RLS — see src/services/SeedsStore.js.) Assign an owner. Run `supabase db push`. Verify endpoints return 200. Test on a real device.

### 2. Fix Journal Storage (P0 — This Week)

Entries live in `gratitude_entries_v1` as a local blob tied to no user. A year of entries for Mateo's Christmas seed would exist on exactly one device with no backup. And there's a path where one account's private sentence gets published to a different account's honeycomb.

**Both must be fixed before any tester touches the app.** The journal storage must move to Supabase, tied to user accounts, with RLS policies for access control.

---

## What I Need From Each of You Now

### Engineering

1. **Today:** Run the Supabase migration. Assign an owner. Verify all 404 endpoints return 200. Test on a real device.
2. **This week:** Move journal storage from local blob to Supabase, tied to `user_id`. Implement RLS policies. Fix the cross-account privacy leak. This blocks all seed and private hive work.
3. **Unblock Project 10:** Tab bar is `Today | Hive | Wallet | Garden`. Wallet tab is a shell showing "Coming Soon." Start building the app shell.
4. **Wallet is Slice 2:** Do NOT build MDK integration, funding flows, or tips in MVP1. Build the tab shell only.
5. **Re-prioritize:** Migrations → storage fix → app shell → private hives → demo prep. Notes and Seeds are code-complete but dead in prod until migrations run.

### Design

1. **Tab bar is decided:** `Today | Hive | Wallet | Garden`. Design accordingly.
2. **Today tab includes Private Hives.** Design the private hive creation flow: "Start a private hive for someone" → compose entries over time → always visible to author → periodic trip down memory lane review → **seal** (the completion act; closing a letter drawer, not addressing an envelope) → optionally send to a connected friend.
3. **The Christmas concept is a Private Hive,** not a separate product. It's a personal gratitude journal kept for a specific person, reviewed on a trip down memory lane, then sealed — and optionally sent. Design the compose + review + seal + (send) experience; the compose flow ends in a seal moment, not a recipient picker.
4. **Wallet tab in MVP1 = shell only.** Design a beautiful "Coming Soon" empty state. No balance, no funding UI, no transactions. Just the shell so the tab bar is complete.
5. **@Pixel's Wrapped goes into the Garden tab,** not as a top-level tab.
6. **Honeycomb tap → action menu is still needed.** Current reveal card is fine for solo browsing. The action menu (Send note, Plant seed, View history) is the social layer. Design as bottom sheet. (Cash App gift link appears in Slice 2.)

### Marketing

1. **Positioning updated (2026-08-17 amendment):** "Gratitude you compile for someone, until it's ready to give." Lead with the Christmas concept for tester recruitment.
2. **Slice 1 success criteria revised** (see above). No money metrics. The demo validates social gratitude + seeds.
3. **Recruit testers who will write journal entries and plant seeds,** not just poke around.

---

## Summary: The Ruling

| Question | Answer |
|---|---|
| Is the journal part of Pollinate? | **Yes. It's the foundation.** |
| Is it legacy? | **No.** |
| What's the tab bar? | **Today \| Hive \| Wallet \| Garden** |
| Where do private hives live? | **Today tab, alongside personal journal** |
| Where does Wrapped go? | **Garden tab** |
| Is the Christmas concept separate? | **No. It's a Private Hive — a personal gratitude journal for someone, reviewed on trips down memory lane, then sealed — and optionally sent. (2026-08-17)** |
| What's the hero sentence? | **"Gratitude you compile for someone, until it's ready to give." Never "a journal that becomes social." (2026-08-17)** |
| Private vs. "Public" hives? | **Private Hive (audience of one) and the Hive (audience of your people). Never "Public." (2026-08-17)** |
| What ships of Private Hives in Slice 1? | **The full arc — write → review → seal → (send) → open. Seal and send are decoupled; sealing never requires a recipient. The reply (8b.8) moves to Slice 1.1. (2026-08-17)** |
| Is the wallet in MVP1? | **No. Shell only. Money is Slice 2.** |
| What's the most urgent task? | **Run the Supabase migration. Then fix journal storage. Both block testing.** |
| What does Slice 1 validate? | **Social gratitude + delayed delivery (seeds). Not money.** |

The team is executing well. The ambiguity was mine to resolve. It's resolved now. We're building one app. The journal is where gratitude starts. Private hives are where you journal gratitude for someone, revisit it on trips down memory lane, and package it to share. The Hive is where it's shared. The Garden is where you see it all. Money comes later.

Let's go. 🐝

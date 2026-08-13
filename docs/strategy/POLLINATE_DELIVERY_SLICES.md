# Pollinate — Delivery Slices & Re-sliced Epic Breakdown

**What changed:** Instead of a single Phase 1 MVP, we're slicing the work into two delivery milestones:

1. **Slice 1: Demo Mode** — Full product works end-to-end for friends & family testing. No paywall. Every feature is free. Payment infrastructure is built (wallet, funding, tips all work) but the app isn't monetized. Distributed via TestFlight / internal track. Goal: validate the core loop with real users.
2. **Slice 2: Free Trial → Paywall** — After testing validates the loop, ship to App Store / Play Store with a free trial period, then paywall. Monetization layers turn on.

---

## SAGE ADDENDUM — 2026-08-13, re-sliced against our real stack (ratified: Option A, iOS-only)

Original table below is kept intact for reference. Overrides:

**Project 1 (Foundation & Infrastructure) — collapses almost entirely.**
- 1.1 iOS project setup → N/A. We're Expo/React Native already; the work is EAS/`expo prebuild` for a dev client (Fizz already has a working native dev build on main), not a fresh Xcode project.
- 1.2 Android — **cut**, iOS only per Colin.
- 1.3/1.4/1.5/1.6/1.8 (backend repo, Postgres, auth, push, API docs) → **mostly N/A.** Supabase already provides Postgres, auth (email/password, sessions), storage, and realtime. The only genuinely new backend surface is the **MDK payments service** (see Project 3 below) — a small standalone Next.js service, not a full backend.
- 1.7 CI/CD → light lift, not a fresh pipeline; we already build/run via Expo.

**Project 2 (Accounts & Onboarding)** — 2.2/2.4 shrink to schema extensions on existing Supabase auth/storage, not new infra. 2.3 (auto-create wallet) now means "create a ledger row," not "call an MDK per-user wallet API" — see Project 3.

**Project 3 (MDK Wallet Integration) — re-scoped, not re-estimated down.** MDK's real product is a single-mnemonid Next.js checkout SDK, not a per-user embedded wallet (full findings in `Pollinate_PRD.md` addendum). Realistic shape:
- New: a small standalone Next.js service holding `MDK_MNEMONIC`, exposed to our Expo app via HTTPS endpoints, writing to Supabase Postgres via service-role key.
- New: an internal ledger table in Supabase (`nectar_balances`, `nectar_transactions`) — Pollinate is custodial-to-its-users (Cash App/Venmo shape), not literally self-custodial. Flagging because §8/§10 of the strategy doc claim otherwise.
- 3.9 (escrow) has no MDK primitive to lean on — it's our own ledger-state logic (hold as pending until bloom, then credit), re-estimate up from the original "L."
- **Do not start building until Colin confirms the custody-model read with the MDK team directly** (Discord link in their docs) — this is a regulatory/legal-copy question, not just an engineering one.

**Project 4 (Cash App Funding Flow)** — stands as designed once Project 3's payments service exists. No stack conflict.

**Project 5 (Coinbase Onramp/Apple Pay)** — doc already says don't build yet. Confirmed cut from Slice 1.

**Project 6 (The Hive)** — biggest head start. HoneycombGrid, hex-clipped portraits, tap hit-testing, tab bar, demo hive data are shipped or in-flight on `deezine/hive-today-and-week` / `bumble/hive-week-data`. Net-new: 6.4 visual states (blooming/seeded/dormant/active — we have paler "demo" state, not these four), 6.5 action menu (send note/plant seed/send tip/view history — none of these actions exist yet), 6.7/6.8 real hive-state endpoint + realtime (currently static demo data).

**Projects 7–10 (Notes, Seeds, Feed, App Shell)** — genuinely net-new except App Shell (10.1 tab bar, 10.2 home scaffold already shipped as Tab Bar C). These + Project 6's net-new items + Project 3 are the real 4-6 week core, same critical path as the original doc names (3.1 payments service, 6.3 hexagon grid [ahead], 8.3 escrow, 8.8 bloom animation).

**Project 11 (Demo Mode Testing)** — 11.1 TestFlight setup narrows to iOS-only. 11.2/11.3 analytics/crash reporting are net-new (nothing installed today). Rest stands.

**Project 12 (Paywall) — recommend softening 12.2-12.5's hard trial-then-lockout.** Strategy doc §4 already picks transaction fees as primary revenue with subscription as a Phase 4 layer, and the Phase 2 viral loop (receive → hook → fund → forward) depends on a brand-new User B being able to receive AND send back with zero friction — a "read-only after 14-day trial" wall (12.4) breaks that loop for exactly the users it's supposed to convert. Recommend: Option C but without the hard lockout — receiving/viewing always free, no expiry; a small transaction fee (1-2%) on tips funds the free tier; subscription unlocks power features (unlimited seeds, custom themes, no fee) as an upsell, not a requirement to use the app. Final call is Colin's — flagging the internal contradiction in the source doc between §4's own model and Project 12's mechanic.

**Projects 13-14** — 13.3 landing page blocked on domain purchase (pending, Colin buying it). 13.6 legal copy needs a real rewrite once custody model is confirmed (can't reuse the existing gratitude-app privacy/ToS patch). Project 14 (MoonPay) stays deferred.

---



## SLICE 1: DEMO MODE (Friends & Family Testing)

**Goal:** Get the full core loop into the hands of 30–100 friends & family. Real gratitude, real tips (small amounts), real seeds blooming. No paywall, no subscription, no friction. Validate that people actually use it.

**Distribution:** TestFlight (iOS) + Internal Testing track (Android). Invite-only.

**Duration:** 4–6 weeks of building, then 2–4 weeks of testing.

**Success criteria for graduating from Demo Mode:**

- [ ] 30+ active testers across 3+ friend groups
- [ ] 50%+ of testers send at least 1 gratitude note per week
- [ ] 15%+ attach a tip to at least one note
- [ ] 10+ seeds planted, at least 5 bloom during testing
- [ ] 30%+ of testers return on day 7 without prompting
- [ ] NPS or qualitative feedback is net positive
- [ ] No critical bugs or data loss in wallet transactions

---



### Project 1: Foundation & Infrastructure


| #   | Issue                    | Description                                                | Est | Labels         |
| --- | ------------------------ | ---------------------------------------------------------- | --- | -------------- |
| 1.1 | iOS project setup        | Xcode, Swift/SwiftUI, SPM, navigation scaffold             | S   | ios, infra     |
| 1.2 | Android project setup    | Android Studio, Kotlin/Compose, Gradle                     | S   | android, infra |
| 1.3 | Backend repo & structure | Node/TypeScript or Go, env management                      | S   | backend, infra |
| 1.4 | Database setup           | PostgreSQL: users, friendships, notes, seeds, transactions | M   | backend, db    |
| 1.5 | Authentication system    | Phone OTP or email/password. JWT sessions.                 | M   | backend, auth  |
| 1.6 | Push notifications       | APNs (iOS) + FCM (Android). Topic routing.                 | M   | backend, infra |
| 1.7 | CI/CD pipeline           | Build, test, lint. Staging + TestFlight/internal track.    | M   | infra, devops  |
| 1.8 | API design & docs        | REST or GraphQL. OpenAPI spec. Versioning.                 | M   | backend, api   |


---



### Project 2: Accounts & Onboarding


| #   | Issue                        | Description                                                       | Est | Labels                |
| --- | ---------------------------- | ----------------------------------------------------------------- | --- | --------------------- |
| 2.1 | Sign-up flow (UI)            | Phone/email entry, OTP, profile setup (name, avatar, username)    | M   | ios, android, design  |
| 2.2 | User model & API             | Backend CRUD for user accounts. Username uniqueness.              | S   | backend, db           |
| 2.3 | Auto-create wallet on signup | MDK wallet created during account creation. Linked to user.       | M   | backend, wallet       |
| 2.4 | Avatar upload                | Image upload to S3/Cloudinary. Resize. CDN.                       | S   | backend, infra        |
| 2.5 | Contact sync                 | Import phone contacts (with permission). Match existing users.    | M   | ios, android, backend |
| 2.6 | Invite link system           | Unique invite links. Deep link into app. Auto-add friend.         | M   | ios, android, backend |
| 2.7 | Onboarding screens           | Welcome flow, first-time tooltips, "add your first friend" prompt | S   | ios, android, design  |


---



### Project 3: MDK Wallet Integration


| #   | Issue                      | Description                                                                        | Est | Labels          |
| --- | -------------------------- | ---------------------------------------------------------------------------------- | --- | --------------- |
| 3.1 | MDK SDK integration        | Integrate SDK into backend. Per-user wallet. Key management.                       | L   | backend, wallet |
| 3.2 | Generate Lightning invoice | API endpoint: generate BOLT11 invoice for amount. Return invoice string + QR data. | M   | backend, wallet |
| 3.3 | Receive payment detection  | Webhook/polling for paid invoices. Update balance. Fire real-time event.           | M   | backend, wallet |
| 3.4 | Send Lightning payment     | API endpoint: pay a given invoice. Handle routing failures, retries.               | M   | backend, wallet |
| 3.5 | Balance + USD conversion   | API: return balance in sats + USD. Integrate price API (CoinGecko).                | S   | backend, wallet |
| 3.6 | Transaction history        | API: list all incoming/outgoing transactions with metadata.                        | S   | backend, wallet |
| 3.7 | Wallet UI — balance        | Show balance (sats + USD) on home/wallet screen. Real-time updates.                | M   | ios, android    |
| 3.8 | Wallet UI — transactions   | List of transactions. Tap for detail.                                              | S   | ios, android    |
| 3.9 | Escrow for seed tips       | Hold invoice / time-locked payment for seed-attached tips. Release on bloom.       | L   | backend, wallet |


---



### Project 4: Cash App Funding Flow


| #   | Issue                       | Description                                                                                                | Est | Labels                |
| --- | --------------------------- | ---------------------------------------------------------------------------------------------------------- | --- | --------------------- |
| 4.1 | "Add Funds" screen          | Cash App highlighted as recommended. Other options below.                                                  | S   | ios, android, design  |
| 4.2 | Invoice generation          | Generate Lightning invoice for user-specified dollar amount. Convert to sats.                              | S   | backend, wallet       |
| 4.3 | QR code rendering           | Render invoice as large scannable QR. Copyable invoice string.                                             | S   | ios, android          |
| 4.4 | Payment detection + success | On payment arrival: update balance, success animation, haptic.                                             | S   | ios, android, backend |
| 4.5 | Funding instructions        | Visual guide: "1. Open Cash App → 2. Money → 3. Bitcoin → 4. Scan QR"                                      | S   | ios, android, design  |
| 4.6 | Pre-funded demo wallets     | Auto-credit each new tester's wallet with $2 in sats on signup. They can send immediately without funding. | S   | backend, wallet       |


> **Note:** In Demo Mode, the pre-funded $2 per user removes ALL funding friction for testers. They can send tips immediately. Cash App QR flow is still built and testable, but not required to experience the product.

---



### Project 5: Apple Pay / Card Fallback (Coinbase Onramp) - this is still an idea. Do not build this yet 


| #   | Issue                        | Description                                                 | Est | Labels                |
| --- | ---------------------------- | ----------------------------------------------------------- | --- | --------------------- |
| 5.1 | Coinbase Onramp SDK          | Embedded widget. Stays in-app. No browser redirect.         | M   | ios, android, backend |
| 5.2 | Apple Pay flow               | Apple Pay sheet → Face ID → confirm. Min $10.               | M   | ios, backend          |
| 5.3 | KYC handling                 | First-time KYC via Coinbase SDK. Track status.              | S   | backend               |
| 5.4 | Payment confirmation webhook | Coinbase webhook → confirm → credit wallet with sats.       | S   | backend, wallet       |
| 5.5 | Funding options UI           | Cash App (default) → Apple Pay/Card → Any Lightning wallet. | S   | ios, android, design  |


> **Note:** MoonPay backup can be deferred to Slice 2 if time is tight. Coinbase Onramp covers Apple Pay for demo testers.

---



### Project 6: The Hive (Friend Network & Hexagon UI) - we have some of this built already. What else do we need?


| #   | Issue                     | Description                                                            | Est | Labels                |
| --- | ------------------------- | ---------------------------------------------------------------------- | --- | --------------------- |
| 6.1 | Friendship model          | Friendships table. Request/accept/decline. Block.                      | S   | backend, db           |
| 6.2 | Add friend flow           | Search by username, contacts, or invite link.                          | M   | ios, android, backend |
| 6.3 | Hexagon grid component    | Custom honeycomb layout. 1–500+ hexagons. Dynamic positioning.         | L   | ios, android, design  |
| 6.4 | Hexagon visual states     | Blooming (gold glow), Seeded (sprout), Dormant (gray), Active (pulse). | M   | ios, android          |
| 6.5 | Hexagon tap → action menu | Bottom sheet: Send note, Plant seed, Send tip, View history.           | S   | ios, android          |
| 6.6 | Friend profile view       | Shared gratitude history, connection stats, pending seeds.             | M   | ios, android, backend |
| 6.7 | Hive state endpoint       | API: all hive members + current states + last interaction.             | S   | backend, api          |
| 6.8 | Real-time state updates   | Push state updates on events. WebSocket or polling.                    | M   | backend, ios, android |


---



### Project 7: Gratitude Notes (Send & Receive)


| #   | Issue                   | Description                                                                              | Est | Labels                |
| --- | ----------------------- | ---------------------------------------------------------------------------------------- | --- | --------------------- |
| 7.1 | Compose note screen     | Text (max 500 chars), optional image, recipient selector, privacy setting, optional tip. | M   | ios, android, design  |
| 7.2 | Note model & API        | Notes table: sender, recipient, text, image, privacy, tip_amount, tip_status. CRUD.      | S   | backend, db           |
| 7.3 | Send note with tip      | Lightning payment from sender → recipient. Atomic: note + payment together.              | M   | backend, wallet       |
| 7.4 | Send note without tip   | Create note, notify recipient, fire feed event.                                          | S   | backend               |
| 7.5 | Receive notification    | Push notification: "Sarah sent you gratitude 🌸". Deep link to note.                     | S   | backend, ios, android |
| 7.6 | Note detail view        | Full-screen: sender, text, image, tip amount, timestamp. Read receipt.                   | M   | ios, android          |
| 7.7 | Image attachment upload | Upload to S3/Cloudinary. Compress/resize.                                                | S   | backend, infra        |


---



### Project 8: Seeds (Solo Seeds — Time Capsules)


| #    | Issue                       | Description                                                                                 | Est | Labels                |
| ---- | --------------------------- | ------------------------------------------------------------------------------------------- | --- | --------------------- |
| 8.1  | Seed model & API            | Seeds table: sender, recipient, text, image, tip_amount, escrow_status, bloom_date, status. | S   | backend, db           |
| 8.2  | Plant seed flow (UI)        | Compose: text, optional image, optional tip, date picker. Preview. Confirm.                 | M   | ios, android, design  |
| 8.3  | Escrow tip for seed         | Hold invoice / time-locked payment. Release on bloom date.                                  | L   | backend, wallet       |
| 8.4  | Seed teaser (pre-bloom)     | "Sarah planted a seed for you — blooms in 47 days." Countdown. Blurred visual.              | S   | ios, android          |
| 8.5  | Seed teaser in feed         | Teaser card in Honeycomb feed (respecting privacy).                                         | S   | backend, ios, android |
| 8.6  | Bloom scheduler             | Backend cron/queue: check for seeds due to bloom. Trigger bloom.                            | M   | backend               |
| 8.7  | Bloom notification          | Push notification on bloom date: "A seed from Sarah just bloomed."                          | S   | backend, ios, android |
| 8.8  | Bloom reveal animation      | Wax seal breaks → hexagon blooms → note appears → tip arrives → celebration. < 3 sec.       | L   | ios, android, design  |
| 8.9  | Bloom event in feed         | Create feed event on bloom. Full revealed note. Appropriate audience.                       | S   | backend, ios, android |
| 8.10 | Reply prompt after bloom    | "Plant a seed back? Send a note? (Pass tip forward — coming soon)"                          | S   | ios, android, design  |
| 8.11 | Notify sender on bloom open | Push to sender: "Marcus opened your seed!"                                                  | S   | backend, ios, android |


> **Demo testing tip:** Let testers plant seeds with short bloom windows (1 hour, 1 day) so they experience the bloom during the testing period. Don't require them to wait weeks.

---



### Project 9: The Honeycomb (Social Feed)


| #    | Issue                   | Description                                                                   | Est | Labels                |
| ---- | ----------------------- | ----------------------------------------------------------------------------- | --- | --------------------- |
| 9.1  | Feed model & API        | Feed events table. Aggregation query for user's hive feed.                    | M   | backend, db           |
| 9.2  | Feed endpoint           | Paginated. Filters by type. Respects privacy.                                 | M   | backend, api          |
| 9.3  | Feed UI — note cards    | Render gratitude notes. Sender, recipient, text, tip (if visible), timestamp. | M   | ios, android, design  |
| 9.4  | Feed UI — seed teasers  | Sealed cards with countdown. Blurred content.                                 | S   | ios, android          |
| 9.5  | Feed UI — bloom events  | Celebration cards with full revealed note.                                    | M   | ios, android, design  |
| 9.6  | Feed UI — tip transfers | Tip amounts (visible or hidden per sender preference).                        | S   | ios, android          |
| 9.7  | Feed reactions          | Emoji reactions on feed items. Store + display counts.                        | M   | backend, ios, android |
| 9.8  | Feed real-time updates  | New items without refresh. WebSocket or 15s polling.                          | M   | backend, ios, android |
| 9.9  | Feed empty state        | Illustration + prompt to send gratitude or add friends.                       | S   | ios, android, design  |
| 9.10 | Feed infinite scroll    | Pagination. 20 items per load.                                                | S   | ios, android          |


> **Note:** Comments on feed items can be deferred to Slice 2 if needed. Reactions are higher priority for demo engagement.

---



### Project 10: Home, Navigation & App Shell


| #    | Issue           | Description                                                                                     | Est | Labels                |
| ---- | --------------- | ----------------------------------------------------------------------------------------------- | --- | --------------------- |
| 10.1 | Tab bar         | Hive, Feed, Wallet, Profile. Badge counts.                                                      | S   | ios, android, design  |
| 10.2 | Home screen     | Quick stats (balance, pending seeds, unread). Quick actions (send note, plant seed, add funds). | M   | ios, android, design  |
| 10.3 | Deep linking    | Push notification deep links + invite links. Route to correct screen.                           | M   | ios, android          |
| 10.4 | Settings screen | Account, privacy, notification preferences, logout.                                             | S   | ios, android          |
| 10.5 | Profile screen  | Avatar, username, stats (notes sent/received, tips, seeds). History preview.                    | M   | ios, android, backend |


---



### Project 11: Demo Mode Testing & Launch Prep


| #     | Issue                             | Description                                                                                                    | Est | Labels              |
| ----- | --------------------------------- | -------------------------------------------------------------------------------------------------------------- | --- | ------------------- |
| 11.1  | TestFlight / internal track setup | Configure TestFlight for iOS. Internal testing track for Android. Invite-only distribution.                    | S   | infra, launch       |
| 11.2  | Analytics setup                   | PostHog/Mixpanel. Track: signup, note sent, tip sent, seed planted, bloom opened, D1/D7/D30 retention.         | M   | backend, analytics  |
| 11.3  | Crash reporting                   | Sentry/Crashlytics. Real-time monitoring.                                                                      | S   | ios, android, infra |
| 11.4  | E2E test: full core loop          | Signup → add friend → send note + tip → plant seed → bloom → receive. Real money.                              | M   | qa, testing         |
| 11.5  | Cash App funding E2E              | Test with real Cash App + real sats. Multiple amounts.                                                         | S   | qa, wallet          |
| 11.6  | Coinbase Onramp E2E               | Test Apple Pay funding. KYC flow. Real transaction.                                                            | S   | qa, wallet          |
| 11.7  | Seed bloom timing test            | Plant seeds with 1-min, 1-hour, 1-day blooms. Verify notifications.                                            | S   | qa, testing         |
| 11.8  | Privacy test                      | Verify feed respects privacy. Private notes hidden. Public blooms visible.                                     | S   | qa, testing         |
| 11.9  | Recruit 30+ testers               | Friends & family across 3+ groups. Pre-fund wallets with $2 sats each.                                         | M   | growth, launch      |
| 11.10 | Demo mode flag                    | Backend feature flag: `demo_mode = true`. Disables paywall. Enables pre-funded wallets. All features unlocked. | S   | backend             |


---



## SLICE 1 SUMMARY


| Metric        | Value                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------- |
| Projects      | 11                                                                                          |
| Issues        | ~70                                                                                         |
| Timeline      | 4–6 weeks build + 2–4 weeks testing                                                         |
| Critical path | 3.1 (MDK SDK), 6.3 (Hexagon grid), 8.3 (Escrow), 8.8 (Bloom animation)                      |
| Distribution  | TestFlight + internal track (invite-only)                                                   |
| Monetization  | None. Pre-funded wallets. All features free.                                                |
| Success gate  | 30+ testers, 50%+ send notes weekly, 15%+ attach tips, 10+ seeds planted, 30%+ D7 retention |


---



## SLICE 2: FREE TRIAL → PAYWALL (Public Launch)

**Goal:** After demo testing validates the loop, ship to App Store / Play Store with a free trial, then paywall. Turn on monetization.

**Prerequisite:** Demo Mode success criteria met (see above).

**Duration:** 3–4 weeks of additional build, then public launch.

---



### Project 12: Free Trial & Paywall System


| #    | Issue                            | Description                                                                                                                | Est | Labels                |
| ---- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --- | --------------------- |
| 12.1 | Subscription engine              | In-app purchase (StoreKit 2 / Play Billing). Monthly + annual plans. Trial period (14 days).                               | M   | ios, android, backend |
| 12.2 | Paywall screen                   | Beautiful paywall: what you get, pricing, "Start free trial." Shown after trial expires or when hitting a gated action.    | M   | ios, android, design  |
| 12.3 | Free trial flow                  | New user gets 14-day free trial. Full access. No card required upfront (Apple/Google handle it).                           | M   | ios, android, backend |
| 12.4 | Trial expiration handling        | When trial ends: show paywall. If user doesn't subscribe: read-only mode (can receive but can't send).                     | M   | backend, ios, android |
| 12.5 | Feature gating logic             | Define what's free vs. paid: Free = receive notes/tips, view feed, open blooms. Paid = send notes, send tips, plant seeds. | S   | backend, ios, android |
| 12.6 | Demo mode → production migration | Flip `demo_mode = false`. Remove pre-funded wallet credits. Enable paywall.                                                | S   | backend               |
| 12.7 | Subscription management          | Settings: view plan, manage subscription, cancel, restore purchases.                                                       | S   | ios, android, backend |
| 12.8 | Revenue tracking                 | Track: trial starts, trial→paid conversions, churn, MRR, ARPU.                                                             | M   | backend, analytics    |


> **Monetization model decision needed:** 
>
> - **Option A: Subscription only** — $5–10/month. All features included. Simple.
> - **Option B: Freemium + transaction fees** — Free to receive. Small fee (1%) on tips sent. Optional subscription for power features.
> - **Option C: Tiered** — Free tier (receive + limited sends). Pro tier ($5/mo, unlimited sends + tips).
>
> **Recommendation for launch:** Option C. Lets the viral loop work (receiving is always free), creates upgrade pressure (senders hit limits), and transaction fees on tips add revenue on top.

---



### Project 13: Public Launch Prep


| #    | Issue                       | Description                                                                                        | Est | Labels                |
| ---- | --------------------------- | -------------------------------------------------------------------------------------------------- | --- | --------------------- |
| 13.1 | App Store listing           | Screenshots, description, privacy policy, App Review submission.                                   | M   | ios, launch           |
| 13.2 | Play Store listing          | Listing, screenshots, data safety form, submission.                                                | M   | android, launch       |
| 13.3 | Landing page                | pollinateapp.xyz marketing site. App download links, hero, features, FAQ.                          | M   | web, design           |
| 13.4 | Onboarding for public users | Polish onboarding for cold users (no friend group waiting). "Add your first friend" → invite flow. | M   | ios, android, design  |
| 13.5 | Bug bash                    | Final QA pass. Fix all P0/P1 bugs from demo testing.                                               | M   | qa, ios, android      |
| 13.6 | Privacy policy & terms      | Legal docs for public launch. Cover data handling, self-custody, crypto disclosures.               | S   | legal, launch         |
| 13.7 | Support channel             | In-app help / FAQ. Contact form. Bug reporting.                                                    | S   | ios, android, backend |


---



### Project 14: MoonPay Backup Integration (If deferred from Slice 1)


| #    | Issue                     | Description                                                                   | Est | Labels                |
| ---- | ------------------------- | ----------------------------------------------------------------------------- | --- | --------------------- |
| 14.1 | MoonPay SDK integration   | Hosted widget or headless SDK. Apple Pay + Google Pay + cards. 160 countries. | M   | ios, android, backend |
| 14.2 | MoonPay payment webhook   | Confirm payment → credit wallet. Handle failures.                             | S   | backend, wallet       |
| 14.3 | Funding options UI update | Add MoonPay as option in "Add Funds" flow.                                    | S   | ios, android          |


---



## SLICE 2 SUMMARY


| Metric        | Value                                                                     |
| ------------- | ------------------------------------------------------------------------- |
| Projects      | 3 (or 4 with MoonPay)                                                     |
| Issues        | ~20                                                                       |
| Timeline      | 3–4 weeks build, then public launch                                       |
| Critical path | 12.1 (Subscription engine), 12.2 (Paywall), 12.5 (Feature gating)         |
| Distribution  | App Store + Play Store (public)                                           |
| Monetization  | Free trial (14 days) → paywall (subscription + optional transaction fees) |
| Success gate  | 20%+ trial→paid conversion, $1K+ MRR within 60 days of launch             |


---



## WHAT COMES AFTER (Future Slices — Same as Before)

After public launch with paywall, the Phase 2/3/4 work from the original epic breakdown applies:

- **Slice 3 (Growth):** Collective seeds, pay-it-forward chains, advanced seed types, cash-out flow, feed comments
- **Slice 4 (Moat):** The Garden, Annual Harvest, seed rituals, hexagon state polish
- **Slice 5 (Scale):** Public API, badges, charity flow, Gratitude Pass subscription

---



## COMBINED TIMELINE

```
Week 1-6:   SLICE 1 BUILD
            ├── Foundation & infra (Projects 1-2)
            ├── MDK wallet (Project 3)
            ├── Funding flows (Projects 4-5)
            ├── Hive + hexagon UI (Project 6)
            ├── Gratitude notes (Project 7)
            ├── Seeds (Project 8)
            ├── Feed (Project 9)
            ├── App shell (Project 10)
            └── Demo prep (Project 11)

Week 6-10:  SLICE 1 TEST
            ├── 30+ friends & family testing
            ├── Real money, real seeds, real blooms
            ├── Analytics: engagement, retention, tip attach rate
            ├── Iterate on feedback
            └── Demo success gate check

Week 10-14: SLICE 2 BUILD
            ├── Subscription + paywall (Project 12)
            ├── Public launch prep (Project 13)
            ├── MoonPay backup (Project 14)
            └── Bug bash + polish

Week 14+:   SLICE 2 LAUNCH
            ├── App Store + Play Store submission
            ├── Public launch
            ├── Free trial → paywall active
            └── Begin Growth slice work
```

---



## CRITICAL PATH ACROSS BOTH SLICES


| Priority | Issue                      | Why it's critical                                              | Risk                                                      |
| -------- | -------------------------- | -------------------------------------------------------------- | --------------------------------------------------------- |
| 1        | 3.1 MDK SDK integration    | Blocks wallet, funding, tips, seeds — everything money-related | High — unfamiliar SDK, potential integration issues       |
| 2        | 6.3 Hexagon grid component | Most complex frontend component. Blocks Hive UI.               | High — custom layout, dynamic positioning, performance    |
| 3        | 8.3 Escrow for seed tips   | Most complex wallet feature. Blocks seeds with tips.           | High — hold invoices or time-locks, edge cases            |
| 4        | 8.8 Bloom reveal animation | Emotional payoff of the product. Can't ship seeds without it.  | Medium — animation complexity, but lower risk than wallet |
| 5        | 12.1 Subscription engine   | Blocks paywall. Can't launch publicly without it.              | Medium — StoreKit/Billing are well-documented             |


**Recommendation:** Start MDK integration (3.1) and hexagon grid (6.3) on day 1. These are the longest poles. Everything else can flow around them.

---



## TEAM STRUCTURE (Updated for Slicing)



### Slice 1 Team (Build + Test)


| Role                      | Owns                                              | Key Projects     |
| ------------------------- | ------------------------------------------------- | ---------------- |
| Backend Engineer #1       | MDK wallet, escrow, Lightning payments, funding   | 3, 4, 8 (escrow) |
| Backend Engineer #2       | Social layer: notes, seeds, feed, auth, API       | 1, 2, 7, 8, 9    |
| Mobile Engineer (iOS)     | iOS app: all UI, hexagon grid, animations         | 6, 7, 8, 9, 10   |
| Mobile Engineer (Android) | Android app: mirror iOS                           | 6, 7, 8, 9, 10   |
| Designer                  | Design system, all screens, bloom animation specs | All              |
| Growth/Community          | Recruit 30+ testers, analytics, onboarding        | 11               |




### Slice 2 Team (Paywall + Launch)


| Role             | Owns                                                        | Key Projects |
| ---------------- | ----------------------------------------------------------- | ------------ |
| Mobile Engineers | Subscription UI, paywall, feature gating                    | 12           |
| Backend Engineer | Subscription backend, demo→prod migration, revenue tracking | 12, 13       |
| Designer         | Paywall design, App Store screenshots, landing page         | 12, 13       |
| Growth/Community | App Store submission, landing page, public launch           | 13           |


>


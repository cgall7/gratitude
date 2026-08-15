# Pollinate — Delivery Slices & Re-sliced Epic Breakdown

**What changed:** Instead of a single Phase 1 MVP, we're slicing the work into two delivery milestones:

1. **Slice 1: Demo Mode** — Full product works end-to-end for friends & family testing. No paywall. Every feature is free. No money — wallet is a shell, no payments, no tips. Distributed via TestFlight / internal track. Goal: validate the core loop with real users.
2. **Slice 2: Public Launch** — After testing validates the loop, ship to App Store / Play Store with a freemium model. Free tier with limited features, paid tier "Pollinate Plus" ($2.99/month or $29.99/year). Nectar wallet via Spark protocol (self-custodial Bitcoin L2). Cash App deposits/withdrawals via Lightning. P2P nectar transfers (Spark-to-Spark, zero-fee). Monetization layers turn on.

---



## SLICE 1: DEMO MODE (Friends & Family Testing)

**Goal:** Get the full social-gratitude loop into the hands of 30–100 friends & family. Real gratitude, real journal entries, real seeds blooming, real private hives. No paywall, no subscription, no friction, no money. Validate that people actually use it.

**Distribution:** TestFlight (iOS) + Internal Testing track (Android). Invite-only.

**Duration:** 4–6 weeks of building, then 2–4 weeks of testing.

**Success criteria for graduating from Demo Mode:**

- [ ] 30+ active testers across 3+ groups
- [ ] Daily journal entries per tester/week: 3+ (validates journal sticks)
- [ ] Friends added per tester: 3+ (network formation begins)
- [ ] Entries shared to feed: 20%+ of entries (solo → social bridge works)
- [ ] Seeds planted: 10+ total (time capsule mechanic understood)
- [ ] Seeds bloomed during testing: 5+ (bloom experience lands emotionally)
- [ ] Private hives created: 10+ (validates hero feature)
- [ ] Reviews completed (Trip Down Memory Lane): 5+ (validates review cadence)
- [ ] Packages sent: 5+ (validates package & send flow)
- [ ] Package open rate: 80%+ (validates recipient experience)
- [ ] 7-day retention (unprompted): 30%+ (people come back without being nagged)
- [ ] Seed bloom open rate: 80%+ (bloom notifications drive re-engagement)
- [ ] Qualitative: "Would you send this to a friend?": 70%+ yes
- [ ] Qualitative: NPS: 30+
- [ ] No critical data loss (entries, friendships, seeds, hives): 0 incidents

> ⚠️ **Wallet & money deferred to Slice 2.** The Wallet tab exists as a shell in Slice 1 — showing a "Coming Soon" message. There is **no Spark integration, no wallet creation, no Cash App deposits, no nectar transfers** in Slice 1. This is intentional: Slice 1 validates the social-gratitude loop (journaling, friendships, seeds, private hives, blooms, feed) **without money**. The nectar wallet (Spark protocol), Cash App deposits/withdrawals, P2P nectar transfers, and all wallet functionality move to Slice 2.

---



### Project 1: Foundation & Infrastructure


| #   | Issue                    | Description                                                            | Est | Labels         |
| --- | ------------------------ | ---------------------------------------------------------------------- | --- | -------------- |
| 1.1 | iOS project setup        | Xcode, Swift/SwiftUI, SPM, navigation scaffold                         | S   | ios, infra     |
| 1.2 | Android project setup    | Android Studio, Kotlin/Compose, Gradle                                 | S   | android, infra |
| 1.3 | Backend repo & structure | Node/TypeScript or Go, env management                                   | S   | backend, infra |
| 1.4 | Database setup           | PostgreSQL: users, friendships, notes, seeds, private_hives, private_hive_entries, feed_events | M   | backend, db    |
| 1.5 | Authentication system    | Phone OTP or email/password. JWT sessions.                             | M   | backend, auth  |
| 1.6 | Push notifications       | APNs (iOS) + FCM (Android). Topic routing.                             | M   | backend, infra |
| 1.7 | CI/CD pipeline           | Build, test, lint. Staging + TestFlight/internal track.                | M   | infra, devops  |
| 1.8 | API design & docs        | REST or GraphQL. OpenAPI spec. Versioning.                             | M   | backend, api   |


---



### Project 2: Accounts & Onboarding


| #   | Issue                        | Description                                                       | Est | Labels                |
| --- | ---------------------------- | ----------------------------------------------------------------- | --- | --------------------- |
| 2.1 | Sign-up flow (UI)            | Phone/email entry, OTP, profile setup (name, avatar, username)    | M   | ios, android, design  |
| 2.2 | User model & API             | Backend CRUD for user accounts. Username uniqueness.              | S   | backend, db           |
| 2.3 | Avatar upload                | Image upload to S3/Cloudinary. Resize. CDN.                       | S   | backend, infra        |
| 2.4 | Contact sync                 | Import phone contacts (with permission). Match existing users.    | M   | ios, android, backend |
| 2.5 | Invite link system           | Unique invite links. Deep link into app. Auto-add friend.         | M   | ios, android, backend |
| 2.6 | Onboarding screens           | Welcome flow, first-time tooltips, "add your first friend" prompt | S   | ios, android, design  |


---



### Project 6: The Hive (Friend Network & Hexagon UI)

> *We have some of this built already. What else do we need?*

| #   | Issue                     | Description                                                            | Est | Labels                |
| --- | ------------------------- | ---------------------------------------------------------------------- | --- | --------------------- |
| 6.1 | Friendship model          | Friendships table. Request/accept/decline. Block.                      | S   | backend, db           |
| 6.2 | Add friend flow           | Search by username, contacts, or invite link.                          | M   | ios, android, backend |
| 6.3 | Hexagon grid component    | Custom honeycomb layout. 1–500+ hexagons. Dynamic positioning.         | L   | ios, android, design  |
| 6.4 | Hexagon visual states     | Blooming (gold glow), Seeded (sprout), Dormant (gray), Active (pulse). | M   | ios, android          |
| 6.5 | Hexagon tap → action menu | Bottom sheet: Send note, Plant seed, View history.                     | S   | ios, android          |
| 6.6 | Friend profile view       | Shared gratitude history, connection stats, pending seeds.             | M   | ios, android, backend |
| 6.7 | Hive state endpoint       | API: all hive members + current states + last interaction.             | S   | backend, api          |
| 6.8 | Real-time state updates   | Push state updates on events. WebSocket or polling.                    | M   | backend, ios, android |


---



### Project 7: Gratitude Notes (Send & Receive)


| #   | Issue                   | Description                                                                              | Est | Labels                |
| --- | ----------------------- | ---------------------------------------------------------------------------------------- | --- | --------------------- |
| 7.1 | Compose note screen     | Text (max 500 chars), optional image, recipient selector, privacy setting.              | M   | ios, android, design  |
| 7.2 | Note model & API        | Notes table: sender, recipient, text, image, privacy, status. CRUD.                     | S   | backend, db           |
| 7.3 | Send note               | Create note, notify recipient, fire feed event.                                          | S   | backend               |
| 7.4 | Receive notification    | Push notification: "Sarah sent you gratitude 🌸". Deep link to note.                     | S   | backend, ios, android |
| 7.5 | Note detail view        | Full-screen: sender, text, image, timestamp. Read receipt.                               | M   | ios, android          |
| 7.6 | Image attachment upload | Upload to S3/Cloudinary. Compress/resize.                                                | S   | backend, infra        |


---



### Project 8: Seeds (Solo Seeds — Time Capsules)


| #    | Issue                       | Description                                                                                 | Est | Labels                |
| ---- | --------------------------- | ------------------------------------------------------------------------------------------- | --- | --------------------- |
| 8.1  | Seed model & API            | Seeds table: sender, recipient, text, image, bloom_date, status.                            | S   | backend, db           |
| 8.2  | Plant seed flow (UI)        | Compose: text, optional image, date picker. Preview. Confirm.                               | M   | ios, android, design  |
| 8.3  | Seed teaser (pre-bloom)     | "Sarah planted a seed for you — blooms in 47 days." Countdown. Blurred visual.              | S   | ios, android          |
| 8.4  | Seed teaser in feed        | Teaser card in Honeycomb feed (respecting privacy).                                        | S   | backend, ios, android |
| 8.5  | Bloom scheduler             | Backend cron/queue: check for seeds due to bloom. Trigger bloom.                            | M   | backend               |
| 8.6  | Bloom notification          | Push notification on bloom date: "A seed from Sarah just bloomed."                          | S   | backend, ios, android |
| 8.7  | Bloom reveal animation      | Wax seal breaks → hexagon blooms → note appears → celebration. < 3 sec.                      | L   | ios, android, design  |
| 8.8  | Bloom event in feed         | Create feed event on bloom. Full revealed note. Appropriate audience.                       | S   | backend, ios, android |
| 8.9  | Reply prompt after bloom    | "Plant a seed back? Send a note? Create a private hive?"                                    | S   | ios, android, design  |
| 8.10 | Notify sender on bloom open | Push to sender: "Marcus opened your seed!"                                                  | S   | backend, ios, android |


> **Demo testing tip:** Let testers plant seeds with short bloom windows (1 hour, 1 day) so they experience the bloom during the testing period. Don't require them to wait weeks.

---



### Project 8b: Private Hives (Personal Gratitude Journal FOR Someone)

> **Concept (PRD v3.1):** Private Hives are personal gratitude journals written FOR a specific person. The author writes entries over time — they can ALWAYS see their own entries. Periodically, on a chosen review cadence (monthly, yearly, or manual), the author gets a "Trip Down Memory Lane" — a push notification prompting them to revisit their hive, with entries blooming one by one. The author can also curate entries into a package and send it to a connected friend in-app. The recipient then experiences the entries blooming one by one. Two bloom moments: the author's review and the recipient's package-open.
>
> **This is NOT the old "sealed until bloom date" concept.** The author always has access to their entries. There is no hidden/sealed state for the author.

| #    | Issue                           | Description                                                                                      | Est | Labels                |
| ---- | ------------------------------- | ------------------------------------------------------------------------------------------------ | --- | --------------------- |
| 8b.1 | Private hive model & API        | `private_hives` table: creator_id, recipient_name, review_cadence (monthly/yearly/manual), cover_theme, created_at. `private_hive_entries` table: hive_id, author_id, text, image_url, created_at. Author ALWAYS has read access. | S   | backend, db           |
| 8b.2 | Create private hive flow (UI)   | Name the person the hive is for. Choose a cover theme. Set review cadence (monthly/yearly/manual). First entry optional at creation. | M   | ios, android, design  |
| 8b.3 | Write entries over time         | Author can add entries to any hive at any time. Author can always see ALL their entries across all hives. No "sealed" state for the author. Entry list view with chronological ordering. | M   | ios, android, backend |
| 8b.4 | Trip Down Memory Lane           | On review cadence (monthly/yearly/manual trigger): push notification prompts author to revisit hive. Entries appear one by one with bloom animation — each entry "blooms" open sequentially. This is the author's bloom moment. | L   | ios, android, backend, design |
| 8b.5 | Package & Send                  | Author selects entries from a hive to package into a curated collection. Adds a personal note. Chooses a connected friend as recipient. Sends in-app. Package is stored and delivered. | M   | ios, android, backend |
| 8b.6 | Recipient opens package         | Recipient receives notification. Opens package → entries bloom one by one with animation (same bloom sequence as author's review). Recipient can react (emoji) and reply. | L   | ios, android, backend, design |
| 8b.7 | Feed event on package send      | Privacy-respecting feed event: "Colin sent gratitude to [Name]" — no contents revealed. Appears in honeycomb feed. | S   | backend, ios, android |
| 8b.8 | Reply after receiving a package | Recipient can: react with emoji, reply with a gratitude note, or start their own private hive (inspired by what they received). | S   | ios, android, design  |

> **Demo testing tip:** Let testers create private hives with short review cadences (manual trigger or 1-hour monthly simulation) so they experience the full write → review → package → send → open cycle during the testing period.

---



### Project 9: The Honeycomb (Social Feed)


| #    | Issue                   | Description                                                                   | Est | Labels                |
| ---- | ----------------------- | ----------------------------------------------------------------------------- | --- | --------------------- |
| 9.1  | Feed model & API        | Feed events table. Aggregation query for user's hive feed.                    | M   | backend, db           |
| 9.2  | Feed endpoint           | Paginated. Filters by type. Respects privacy.                                 | M   | backend, api          |
| 9.3  | Feed UI — note cards    | Render gratitude notes. Sender, recipient, text, timestamp.                   | M   | ios, android, design  |
| 9.4  | Feed UI — seed teasers  | Sealed cards with countdown. Blurred content.                                 | S   | ios, android          |
| 9.5  | Feed UI — bloom events  | Celebration cards with full revealed note.                                    | M   | ios, android, design  |
| 9.6  | Feed UI — package sends | Privacy-respecting cards: "Colin sent gratitude to [Name]" (no contents).    | S   | ios, android          |
| 9.7  | Feed reactions          | Emoji reactions on feed items. Store + display counts.                        | M   | backend, ios, android |
| 9.8  | Feed real-time updates  | New items without refresh. WebSocket or 15s polling.                          | M   | backend, ios, android |
| 9.9  | Feed empty state        | Illustration + prompt to send gratitude or add friends.                       | S   | ios, android, design  |
| 9.10 | Feed infinite scroll    | Pagination. 20 items per load.                                                | S   | ios, android          |


> **Note:** Comments on feed items can be deferred to Slice 2 if needed. Reactions are higher priority for demo engagement.

---



### Project 10: Home, Navigation & App Shell


| #    | Issue           | Description                                                                                     | Est | Labels                |
| ---- | --------------- | ----------------------------------------------------------------------------------------------- | --- | --------------------- |
| 10.1 | Tab bar         | Today, Hive, Wallet (shell only — "Coming Soon"), Garden. Badge counts.                         | S   | ios, android, design  |
| 10.2 | Home screen     | Quick stats (pending seeds, unread, hive activity). Quick actions (send note, plant seed, create private hive). | M   | ios, android, design  |
| 10.3 | Deep linking    | Push notification deep links + invite links. Route to correct screen.                           | M   | ios, android          |
| 10.4 | Settings screen | Account, privacy, notification preferences, logout.                                             | S   | ios, android          |
| 10.5 | Profile screen  | Avatar, username, stats (notes sent/received, seeds, hives). History preview.                   | M   | ios, android, backend |


---



### Project 11: Demo Mode Testing & Launch Prep


| #    | Issue                             | Description                                                                                                    | Est | Labels              |
| ---- | --------------------------------- | -------------------------------------------------------------------------------------------------------------- | --- | ------------------- |
| 11.1 | TestFlight / internal track setup | Configure TestFlight for iOS. Internal testing track for Android. Invite-only distribution.                    | S   | infra, launch       |
| 11.2 | Analytics setup                   | PostHog/Mixpanel. Track: signup, note sent, seed planted, bloom opened, private hive created, review completed, package sent, D1/D7/D30 retention. | M   | backend, analytics  |
| 11.3 | Crash reporting                   | Sentry/Crashlytics. Real-time monitoring.                                                                      | S   | ios, android, infra |
| 11.4 | E2E test: full core loop          | Signup → add friend → send note → plant seed → bloom → create private hive → review → package & send → recipient opens. No money. | M   | qa, testing         |
| 11.5 | Seed bloom timing test            | Plant seeds with 1-min, 1-hour, 1-day blooms. Verify notifications.                                            | S   | qa, testing         |
| 11.6 | Privacy test                      | Verify feed respects privacy. Private notes hidden. Public blooms visible. Package contents never in feed.     | S   | qa, testing         |
| 11.7 | Recruit 30+ testers               | Friends & family across 3+ groups. Recruit testers for the social-gratitude loop.                              | M   | growth, launch      |
| 11.8 | Demo mode flag                    | Backend feature flag: `demo_mode = true`. Disables paywall. All features unlocked. Wallet tab shows "Coming Soon." | S   | backend             |


---



## SLICE 1 SUMMARY


| Metric        | Value                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------- |
| Projects      | 9 (Projects 1, 2, 6, 7, 8, 8b, 9, 10, 11)                                                  |
| Issues        | ~68                                                                                         |
| Timeline      | 4–6 weeks build + 2–4 weeks testing                                                         |
| Critical path | 1.4 (Database setup), 10.1 (App shell/tab bar), 8b.1 (Private hive model), 6.3 (Hexagon grid), 8b.4/8b.6 (Bloom animations) |
| Distribution  | TestFlight + internal track (invite-only)                                                   |
| Monetization  | None. Wallet is a shell ("Coming Soon"). All features free. No money, no tips, no payments. |
| Success gate  | 30+ testers, 3+ journal entries/wk, 20%+ shared to feed, 10+ seeds planted, 5+ blooms, 10+ private hives created, 5+ reviews completed, 5+ packages sent, 30%+ D7 retention, 80%+ bloom open rate, NPS 30+ |


---



## SLICE 2: PUBLIC LAUNCH (Freemium + Nectar Wallet)

**Goal:** After demo testing validates the loop, ship to App Store / Play Store with a freemium model. Free tier with limited features; paid tier "Pollinate Plus" unlocks unlimited usage. Nectar wallet via Spark protocol enables self-custodial wallets, Cash App or Strike deposits/withdrawals via Lightning, and P2P nectar transfers (Spark-to-Spark, instant, zero-fee). Pollinate is NOT a money transmitter — Spark is self-custodial (users hold their own keys).

**Prerequisite:** Demo Mode success criteria met (see above).

**Duration:** 3–4 weeks of additional build, then public launch.

---



### Project 15: Nectar Wallet — Spark Protocol + Cash App / Strike Integration (REWRITTEN)

> **Concept (PRD v3.1):** Pollinate uses **Spark protocol** (Lightspark's Bitcoin L2) for the nectar wallet. Spark uses Statechains + FROST threshold signatures — self-custodial (users hold their own keys), not a money transmitter. **Privy** integration provides email/social login for MPC wallet creation (no seed phrases for users). Wallets are NOT created at signup — only when the user first taps "Send Nectar" or the Wallet tab, with explicit consent (Apple compliance). Deposits use Lightning invoices opened via Cash App deep link (`https://cash.app/launch/lightning/<invoice>`) or Strike. Withdrawals send to saved `cashtag@cash.app` or `username@strike.me` (one-tap). P2P nectar transfers are Spark-to-Spark (instant, zero-fee). All amounts shown in USD — users never see crypto terminology. NO Lightspark Grid — skipped.

| #    | Issue                          | Description                                                                                                | Est | Labels                |
| ---- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- | --- | --------------------- |
| ENG-35 | Spark SDK integration         | Integrate Spark SDK (Breez Rust SDK with Swift FFI or orklabs Swift SDK). Wallet initialization, balance queries, transfer functions. | L   | spark, wallet, ios, android, backend |
| ENG-36 | Privy MPC wallet creation    | Privy integration for email-based MPC wallet creation. Wallet creation flow with explicit consent screen (Apple compliance). User taps "Create My Wallet" → Privy creates MPC wallet → Spark wallet initialized. | M   | spark, privy, apple-compliance, ios, android |
| ENG-37 | Cash App / Strike deposit flow  | Generate Lightning invoice → open Cash App or Strike via deep link (`https://cash.app/launch/lightning/<invoice>` for Cash App) → receive payment → update balance. First-time: ask user to select payment app (Cash App or Strike) and enter $cashtag or Strike username (saved for withdrawals). | M   | cash-app, spark, ios, android |
| ENG-38 | Cash App / Strike withdrawal flow | Send Lightning payment to saved `cashtag@cash.app` or `username@strike.me`. One-tap after payment app saved. Fallback: QR scan flow for users without Lightning Address enabled. | M   | cash-app, spark, ios, android |
| ENG-39 | P2P nectar transfers          | Spark-to-Spark transfer between Pollinate users. Instant, zero-fee. Friend selection → amount → send → "Sent $5 of nectar to Sarah! 🌸" | M   | spark, ios, android |
| ENG-40 | Dollar-denominated display    | Real-time BTC/USD conversion. Users see USD amounts, never Bitcoin/sats. | S   | spark, ios, android |
| DES-12 | Wallet onboarding UX          | Consent screen design ("Pollinate uses Spark, a self-custodial Bitcoin wallet..."). Progressive disclosure. "Add Nectar" flow. "Withdraw" flow. Advanced settings (custom Lightning address). | M   | design, spark, apple-compliance |
| DES-13 | Nectar visual design          | Nectar balance display, transaction animations, honey-themed wallet UI. Make it fun and on-brand. | M   | design, spark |

**Dependencies:** Spark SDK v0.9.0+, Privy SDK, Cash App / Strike deep link integration. Apple Organization developer account required.

> **Strike API integration note:** While Cash App supports deep links only, Strike offers a comprehensive REST API with OAuth 2.0 authentication and webhooks. This is a potential advantage — Strike's API could enable automated payment tracking, webhook notifications when deposits complete, and programmatic withdrawal flows without requiring the user to manually confirm in the Strike app. This deeper integration path can be explored as a future enhancement. Strike is also available internationally (US/EU/UK/AU), providing broader coverage than Cash App (US/UK) for future expansion.

> **Apple compliance note:** Self-custodial wallet permitted (3.1.5(i)). P2P gifts exempt from IAP (3.2.1(vii)). Wallet creation requires explicit consent (2.3.1(a)). Lifestyle category. Organization account required. Cannot use crypto to unlock features. Cannot offer sats as rewards for journaling. NO Lightspark Grid — skipped.

> **SDK note:** Breez SDK is a founding Spark Operator — same protocol. Breez = Rust SDK with FFI bindings for Swift/Kotlin. Spark SDK = TypeScript-first with Privy integration. For iOS native, use Breez Rust FFI or orklabs Swift SDK.

---



### Project 12: Freemium Paywall System


| #    | Issue                            | Description                                                                                                                | Est | Labels                |
| ---- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --- | --------------------- |
| 12.1 | Subscription engine              | In-app purchase (StoreKit 2 / Play Billing). Monthly ($2.99) + annual ($29.99) plans.                                     | M   | ios, android, backend |
| 12.2 | Paywall screen                   | Beautiful paywall: what you get, pricing ($2.99/month or $29.99/year), "Upgrade to Pollinate Plus." Shown when user hits a free-tier limit. | M   | ios, android, design  |
| 12.3 | Freemium free tier               | New users automatically get free tier. No trial period, no card required. Free tier: 1 hive, 1 friend, 1 seed, daily journal (full), yearly review only, 1 package/hive/year, full feed access, receive unlimited. | M   | ios, android, backend |
| 12.4 | Upgrade prompts & limits         | When free user hits a limit (e.g., tries to create 2nd hive, add 2nd friend), show paywall. Free tier remains functional within limits. Soft gates, not hard walls. | M   | backend, ios, android |
| 12.5 | Feature gating logic             | Free = receive unlimited, 1 hive, 1 friend, 1 seed, daily journal (full), yearly review only, 1 package/hive/year, full feed access. Paid (Pollinate Plus) = unlimited hives, friends, seeds, monthly/yearly/manual reviews, unlimited packages, nectar wallet (send nectar to friends), premium themes. | S   | backend, ios, android |
| 12.6 | Demo mode → production migration | Flip `demo_mode = false`. Enable paywall. Enable nectar wallet (Spark). Remove demo flags.                                      | S   | backend               |
| 12.7 | Subscription management          | Settings: view plan, manage subscription, cancel, restore purchases.                                                       | S   | ios, android, backend |
| 12.8 | Revenue tracking                 | Track: free → paid conversions, churn, MRR, ARPU, gift attach rate.                                                        | M   | backend, analytics    |


> **Monetization model (decided per PRD v3.1):**
>
> - **Freemium subscription.** Free tier with limited features. Paid tier "Pollinate Plus" at $2.99/month or $29.99/year.
> - **Free tier:** Receive unlimited, 1 hive, 1 friend, 1 seed, daily journal (full), yearly review only, 1 package/hive/year, full feed access.
> - **Paid tier (Pollinate Plus):** Unlimited hives, friends, seeds, monthly/yearly/manual reviews, unlimited packages, nectar wallet (send nectar to friends), premium themes.
> - **Nectar wallet (Spark):** Self-custodial Bitcoin L2 wallet via Spark protocol. Cash App deposits/withdrawals via Lightning deep links. P2P nectar transfers (Spark-to-Spark, instant, zero-fee). Pollinate is NOT a money transmitter — Spark is self-custodial (users hold their own keys).
> - **No MDK/Lightning needed:** Spark replaces MDK. No Coinbase Onramp needed (Cash App handles deposits/withdrawals). No Lightspark Grid (explicitly skipped).

---



### Project 13: Public Launch Prep


| #    | Issue                       | Description                                                                                        | Est | Labels                |
| ---- | --------------------------- | -------------------------------------------------------------------------------------------------- | --- | --------------------- |
| 13.1 | App Store listing           | Screenshots, description, privacy policy, App Review submission.                                   | M   | ios, launch           |
| 13.2 | Play Store listing          | Listing, screenshots, data safety form, submission.                                                | M   | android, launch       |
| 13.3 | Landing page                | pollinateapp.xyz marketing site. App download links, hero, features, FAQ.                          | M   | web, design           |
| 13.4 | Onboarding for public users | Polish onboarding for cold users (no friend group waiting). "Add your first friend" → invite flow. | M   | ios, android, design  |
| 13.5 | Bug bash                    | Final QA pass. Fix all P0/P1 bugs from demo testing.                                               | M   | qa, ios, android      |
| 13.6 | Privacy policy & terms      | Legal docs for public launch. Cover data handling, Spark wallet disclosures (self-custodial, not a money transmitter). | S   | legal, launch         |
| 13.7 | Support channel             | In-app help / FAQ. Contact form. Bug reporting.                                                    | S   | ios, android, backend |


---



### Projects 3, 4, 5: Wallet & Funding Infrastructure (SUPERSEDED BY PROJECT 15)

> ⚠️ **These projects were originally in Slice 1 but have been superseded by Project 15 (Nectar Wallet — Spark Protocol).** The wallet is now built using **Spark protocol** — no separate MDK, Lightning funding, or Coinbase Onramp work is needed. Spark + Cash App covers deposits, withdrawals, and P2P transfers. These are documented here for historical reference only.

#### Project 3: MDK Wallet Integration (SUPERSEDED — see Project 15)

> **No longer needed.** Spark SDK IS the wallet integration (Project 15, ENG-35). No separate MDK integration required. Spark provides self-custodial wallets with Statechains + FROST threshold signatures, plus Privy for MPC key management (no seed phrases). All wallet functionality (init, balance, transfers) is handled by Spark.

#### Project 4: Cash App Lightning Funding Flow (SUPERSEDED — see Project 15)

> **Now part of Project 15 (ENG-37, ENG-38).** Cash App deposits use Lightning invoices opened via deep link (`https://cash.app/launch/lightning/<invoice>`). Cash App withdrawals send to saved `cashtag@cash.app` (one-tap after setup, with QR fallback). No separate funding flow project needed.

#### Project 5: Apple Pay / Card Fallback (Coinbase Onramp) (NOT NEEDED)

> **Cash App handles deposit/withdrawal.** No Coinbase Onramp needed. If we need additional funding methods in the future, evaluate then.

> **Note:** Lightspark Grid is NOT recommended. Cash App + Lightning is sufficient for deposits and withdrawals.


---



## SLICE 2 SUMMARY


| Metric        | Value                                                                     |
| ------------- | ------------------------------------------------------------------------- |
| Projects      | 3 active build (Projects 12, 13, 15). Projects 3, 4, 5 superseded by Project 15. |
| Issues        | ~22 active build (ENG-35–40, DES-12–13, plus paywall/launch issues)      |
| Timeline      | 3–4 weeks build, then public launch                                       |
| Critical path | ENG-35 (Spark SDK integration), ENG-36 (Privy MPC wallet), 12.1 (Subscription engine), 12.5 (Feature gating) |
| Distribution  | App Store + Play Store (public)                                           |
| Monetization  | Freemium: Free tier (limited) + Pollinate Plus ($2.99/mo or $29.99/yr). Nectar wallet via Spark (self-custodial, not a money transmitter). Cash App or Strike deposits/withdrawals via Lightning. P2P nectar transfers (Spark-to-Spark, zero-fee). |
| Success gate  | 20%+ free→paid conversion, $1K+ MRR within 60 days of launch, 10%+ of users send nectar to a friend |


---



## WHAT COMES AFTER (Future Slices)

After public launch with freemium paywall and nectar wallet:

- **Slice 3 (Wallet Enhancements):** Stablecoin support via BTKN token standard (if dollar peg needed). Spark SDK v1.0 migration (when released). Potential additional withdrawal methods (Strike, other Lightning wallets). NOT Lightspark Grid (explicitly skipped).
- **Slice 4 (Growth):** Collective seeds, pay-it-forward chains, advanced seed types, feed comments
- **Slice 5 (Moat):** The Garden, Annual Harvest, seed rituals, hexagon state polish
- **Slice 6 (Scale):** Public API, badges, charity flow, Gratitude Pass subscription

---



## COMBINED TIMELINE

```
Week 1-6:   SLICE 1 BUILD
            ├── Foundation & infra (Projects 1-2)
            ├── Hive + hexagon UI (Project 6)
            ├── Gratitude notes (Project 7)
            ├── Seeds (Project 8)
            ├── Private hives (Project 8b)
            ├── Feed (Project 9)
            ├── App shell (Project 10)
            └── Demo prep (Project 11)

Week 6-10:  SLICE 1 TEST
            ├── 30+ friends & family testing
            ├── Real gratitude, real seeds, real blooms, real private hives
            ├── Analytics: engagement, retention, hive creation, package sends
            ├── Iterate on feedback
            └── Demo success gate check

Week 10-14: SLICE 2 BUILD
            ├── Nectar wallet — Spark + Cash App (Project 15)
            ├── Freemium paywall (Project 12)
            ├── Public launch prep (Project 13)
            └── Bug bash + polish

Week 14+:   SLICE 2 LAUNCH
            ├── App Store + Play Store submission
            ├── Public launch
            ├── Freemium paywall active
            ├── Nectar wallet live (Spark, Cash App deposits/withdrawals, P2P transfers)
            └── Evaluate Spark SDK v1.0 + stablecoin support (Slice 3)
```

---



## CRITICAL PATH ACROSS BOTH SLICES


| Priority | Issue                      | Why it's critical                                              | Risk                                                      |
| -------- | -------------------------- | -------------------------------------------------------------- | --------------------------------------------------------- |
| 1        | 1.4 Database setup         | Storage foundation. Blocks all data models including private hives. | Medium — schema design for new private hive models        |
| 2        | 10.1 Tab bar & app shell   | Navigation scaffold. Blocks all UI work. Wallet shell must be in place. | Low — standard tab bar, well-understood             |
| 3        | 8b.1 Private hive model    | Core data model for hero feature. Blocks all private hive work (entries, reviews, packaging). | Medium — new concept, schema design            |
| 4        | 6.3 Hexagon grid component | Most complex frontend component. Blocks Hive UI.               | High — custom layout, dynamic positioning, performance    |
| 5        | 8b.4 / 8b.6 Bloom animations | Emotional payoff of private hives (author review + recipient package-open). Can't ship private hives without it. | Medium — animation complexity, but lower risk than wallet |
| 6        | 12.1 Subscription engine   | Blocks paywall. Can't launch publicly without it.              | Medium — StoreKit/Billing are well-documented             |
| 7        | ENG-35 Spark SDK integration | Blocks nectar wallet (Project 15). Most complex Slice 2 feature — Spark SDK, Privy MPC, Cash App deep links. | High — new protocol, FFI bindings, threshold signatures |

**Recommendation:** Start database setup (1.4), hexagon grid (6.3), and private hive model (8b.1) on day 1. These are the longest poles. Everything else can flow around them. Bloom animations (8b.4/8b.6) can begin once the private hive data model is in place. For Slice 2, start Spark SDK evaluation (ENG-35) early — it's the longest pole for the nectar wallet.

---



## TEAM STRUCTURE (Updated for Slicing)



### Slice 1 Team (Build + Test)


| Role                      | Owns                                              | Key Projects     |
| ------------------------- | ------------------------------------------------- | ---------------- |
| Backend Engineer #1       | Social layer: notes, seeds, private hives, feed, API | 1, 7, 8, 8b, 9 |
| Backend Engineer #2       | Auth, friendships, push notifications, real-time   | 1, 2, 6          |
| Mobile Engineer (iOS)     | iOS app: all UI, hexagon grid, bloom animations   | 6, 7, 8, 8b, 9, 10 |
| Mobile Engineer (Android) | Android app: mirror iOS                            | 6, 7, 8, 8b, 9, 10 |
| Designer                  | Design system, all screens, bloom animation specs  | All              |
| Growth/Community          | Recruit 30+ testers, analytics, onboarding         | 11               |




### Slice 2 Team (Paywall + Nectar Wallet + Launch)


| Role             | Owns                                                        | Key Projects |
| ---------------- | ----------------------------------------------------------- | ------------ |
| Mobile Engineers | Spark SDK integration, nectar wallet UI, Cash App deep links, paywall, feature gating | 12, 15   |
| Backend Engineer | Subscription backend, Spark wallet init, Privy MPC integration, revenue tracking, demo→prod migration | 12, 15, 13 |
| Designer         | Paywall design, wallet onboarding/consent screen, nectar visual design, App Store screenshots, landing page | 12, 15, 13 |
| Growth/Community | App Store submission, landing page, public launch           | 13           |


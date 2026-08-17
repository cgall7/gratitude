# Pollinate — Delivery Slices & Re-sliced Epic Breakdown

**What changed:** Instead of a single Phase 1 MVP, we're slicing the work into two delivery milestones:

1. **Slice 1: Demo Mode** — Full product works end-to-end for friends & family testing. No paywall. Every feature is free. No money — wallet is a shell, no payments, no tips. Distributed via TestFlight / internal track. Goal: validate the core loop with real users.
2. **Slice 2: Public Launch** — After testing validates the loop, ship to App Store / Play Store with a freemium model. Free tier with limited features, paid tier "Pollinate Plus" ($2.99/month or $29.99/year). Cash App gifting via iMessage links. Monetization layers turn on.

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
- [ ] Hives sealed with 5+ entries and **no send**: 3+ (validates letter-drawer value at zero deliveries — measured via `private_hives.sealed_at`; 2026-08-17 amendment)
- [ ] Packages sent: 5+ (validates package & send flow)
- [ ] Package open rate: 80%+ (validates recipient experience)
- [ ] 7-day retention (unprompted): 30%+ (people come back without being nagged)
- [ ] Seed bloom open rate: 80%+ (bloom notifications drive re-engagement)
- [ ] Qualitative: "Would you send this to a friend?": 70%+ yes
- [ ] Qualitative: NPS: 30+
- [ ] No critical data loss (entries, friendships, seeds, hives): 0 incidents

> ⚠️ **Wallet & money deferred to Slice 2.** The Wallet tab exists as a shell in Slice 1 — showing a "Coming Soon" message. There is **no MDK integration, no funding flows, no tips, no Cash App gifting** in Slice 1. This is intentional: Slice 1 validates the social-gratitude loop (journaling, friendships, seeds, private hives, blooms, feed) **without money**. Cash App gifting, Lightning, tipping, and escrow all move to Slice 2 or later.

---



### Project 1: Foundation & Infrastructure


| #   | Issue                    | Description                                                            | Est | Labels         |
| --- | ------------------------ | ---------------------------------------------------------------------- | --- | -------------- |
| 1.1 | iOS project setup        | Xcode, Swift/SwiftUI, SPM, navigation scaffold                         | S   | ios, infra     |
| 1.2 | Android project setup    | Android Studio, Kotlin/Compose, Gradle                                 | S   | android, infra |
| 1.3 | Backend repo & structure | Node/TypeScript or Go, env management                                   | S   | backend, infra |
| 1.4 | Database setup           | **The migrations govern, not this row** (amended 2026-08-17 — the planned names here drifted from what shipped). Shipped create-table set in supabase/migrations/: `profiles`, `honeycomb_connections`, `entries`, `shares`, `likes`, `comments`, `notes`, `seeds`, `seed_contents`, `private_hives`. Planned `users`/`friendships` shipped as `profiles`/`honeycomb_connections`; `feed_events` (never in schema — feed reads the shipped tables); `private_hive_entries` (never in schema) — hive entries live in `entries` via nullable `entries.hive_id`. | M   | backend, db    |
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
| 6.4 | Hexagon visual states     | Blooming (gold glow — ruled 2026-08-17: either-direction friendship recency, viewer-relative, per-direction windows (receive 48h / send 24h placeholder — band derivation in the PRD "Blooming" gloss); from `last_note_received_at` and `last_note_sent_at` (not yet in schema)), Seeded (sprout), Dormant (gray). Active (pulse) struck from MVP1 (per shipped comment, src/services/HoneycombStore.js). | M   | ios, android          |
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
| 8b.1 | Private hive model & API        | **The migrations govern, not this row** (amended 2026-08-17 — the columns previously restated here never shipped). Hive shape: `20260815000001` (`private_hives.owner_id`, `private_hives.subject_name`, nullable `private_hives.subject_profile_id`) + `20260815000003` (`private_hives.sealed_at`). Hive entries live in `entries` via nullable `entries.hive_id` — `private_hive_entries` (never in schema). Still to add via new migration (merge-gated per the rule below): `private_hives.review_cadence` (not yet in schema; monthly/yearly/manual), `private_hives.cover_theme` (not yet in schema; 4 values, design language §1). Author ALWAYS has read access. | S   | backend, db           |
| 8b.2 | Create private hive flow (UI)   | Name the person the hive is for. Choose a cover theme. Set review cadence (monthly/yearly/manual). First entry optional at creation. | M   | ios, android, design  |
| 8b.3 | Write entries over time         | Author can add entries to any hive at any time. Author can always see ALL their entries across all hives. No "sealed" state for the author. Entry list view with chronological ordering. | M   | ios, android, backend |
| 8b.4 | Trip Down Memory Lane           | On review cadence (monthly/yearly/manual trigger): push notification prompts author to revisit hive. Entries appear one by one with bloom animation — each entry "blooms" open sequentially. This is the author's bloom moment. | L   | ios, android, backend, design |
| 8b.5 | Seal, then (optionally) Send — **two acts, decoupled** (amended 2026-08-17, per Sage; schema `20260815000003`) | **Seal** is the author's completion act on the hive: select entries into a curated collection, add a personal note, seal the keepsake. Sets `private_hives.sealed_at`. **Requires no recipient** — the grandmother/child/lost-someone hives complete the arc here, and the seal drives WP-2's gold-vs-cream card. **Send** is optional and separate: choose a connected friend, deliver in-app; writes `entries.visibility` `packaged` → `sent`. Sealing must never be gated on picking a recipient. **Send availability is derived, not stored** (ruled 2026-08-17): `private_hives.subject_profile_id` (`20260815000001`, nullable) — null → the subject has no account and "Keep Safe" is the hive's only completion CTA; non-null and connected → Send is offered. `private_hives.sent_to` (never in schema) — hive-level recipient state would cap a hive at one recipient forever, which the per-entry `entries.visibility` model deliberately does not. Mechanism confirmed by Fizz 2026-08-17; recipient read access ruled the same day — see the read-access ruling block below (`private_hives.sent_at` (not yet in schema) + two subject-scoped SELECT policies + one send RPC). | M   | ios, android, backend |
| 8b.6 | Recipient opens package         | Recipient receives notification. Opens package → entries bloom one by one with animation (same bloom sequence as author's review). Recipient can react (emoji) and reply. | L   | ios, android, backend, design |
| 8b.7 | Feed event on package send      | Privacy-respecting feed event: "Colin sent gratitude to [Name]" — no contents revealed. Appears in honeycomb feed. | S   | backend, ios, android |
| 8b.8 | ~~Reply after receiving a package~~ **→ Slice 1.1** (ruled 2026-08-17) | Recipient can: react with emoji, reply with a gratitude note, or start their own private hive (inspired by what they received). Cut from Slice 1 — roundtrip mechanics, no new emotion; the inspired-recipient path reuses the 8b.2 creation flow. | S   | ios, android, design, slice-1.1 |

> **Slice 1 ruling (2026-08-17, ratified):** 8b.2–8b.7 ship in Slice 1 — the full arc write → review → **seal** → (send) → open. Build write-and-review first and put it in front of testers the moment it works; then seal → send → open. **Acceptance bar for 8b.4/8b.6: the reveal is pacing, not particle effects.** Entries surface one at a time, dates visible; one tap per memory; the recipient cannot skim. If a tester screenshots it or cries, it passes. If they scroll it like a feed, it fails.
>
> **Merge gate (Sage's standing rule, quoted so it doesn't soften):** *"a change carrying a migration and the client code depending on it does not merge until the migration is on production."* Seal work can be written now.
>
> **Enforcement is derived, not enumerated** (amended 2026-08-17, per Sage's correction the same day). This block previously enforced the rule as a list of four versions, `…000003`–`…000006`. The list went stale within hours of being written: the branch added `20260817000002` (unmerged, on `fizz/private-hives-rails` only) carrying `private_hives.cover_theme` — a column `HiveStore.js` already selects and the list never named — so the gate was satisfiable while the app still `400`'d. A merge gate stated as a list of names has to be re-enumerated every time the branch adds a migration; a gate derived from the branch's tip does not.
>
> **The gate:** the branch merges when a sentinel column from its **tip migration** is live on prod — probe it via PostgREST with the anon key; `200` = merge, anything else = hold. Migrations apply in version order, so the tip implies the tail. The sentinel is a column added by the newest file in `supabase/migrations/` on the merging branch, not a pinned commit — a SHA pin rots the moment the branch is rebased (caught 2026-08-17: the previous version of this line cited a commit that a rebase had already orphaned off every ref). Currently, on `fizz/private-hives-rails`, that file is `20260817000002_private_hives_cover_and_cadence.sql` and the sentinel is `private_hives.cover_theme`:
>
> ```sh
> curl -s -o /dev/null -w '%{http_code}\n' \
>   "$URL/rest/v1/private_hives?select=cover_theme&limit=1" \
>   -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
> ```
>
> Premise, stated so it can be attacked: version-order application is sufficient **only if the remote migration history is clean** — prod's earliest schema predates `deploy-migrations.sh` entirely (the script's own header records it). Until `supabase migration list` shows a clean remote history, probe `private_hives.sealed_at` as well and require both `200`s. Instrument: `scripts/prod-schema-check.mjs`, run as `npm run preflight:prod-schema` (Bumble, built 2026-08-17 — PR `9e3711fa…`, branch `bumble/prod-schema-preflight`). Named `prod-schema-check`, not the originally-cited `check-prod-schema`: `run-checks.mjs` enumerates `scripts/check-*.mjs` into `npm test` with no opt-out, and this command must stay out of the test chain. It is a calibrated pre-merge command, not a CI gate; it generalizes this block's single tip-probe to every migration on the branch's disk (an unmapped migration is itself a red), and probes both `cover_theme`-class tip sentinels and `sealed_at` under the same clean-history premise stated above. **Status: built, exit paths verified against prod 2026-08-17; unenforced-by-CI by design — run it by hand before every merge of a migration-carrying branch.** Until the PR merges, the curl above remains the fallback.

> **Recipient read-access ruling (2026-08-17, Lumen — closes the gap Fizz filed and Pixel's §31.6 constraint):** Flipping `entries.visibility` to `'sent'` delivers nothing today: the only SELECT policies on `entries` are `entries_select_own`, `entries_select_via_share` (`20260808000001`), and the restrictive `entries_select_respect_visibility` (`20260813000004`); `private_hives_select_own` is owner-only. The send path (8b.5) ships **one migration** carrying all of the following:
>
> 1. **No new addressing surface.** The audience of a private hive is its subject — singular by product definition — and `private_hives.subject_profile_id` (`20260815000001`) already names them. `'sent'` names a state; the hive it belongs to names the person. `shares` is not a delivery rail and is not reused (no addressee column, UNIQUE `shares.entry_id`, feed-coupled trigger `entries_mark_shared`).
> 2. **One new column: `private_hives.sent_at` (not yet in schema, `timestamptz`)** — the send act's timestamp, mirroring `private_hives.sealed_at`. Not the banned `sent_to`: it stores no address; the address stays derived from `subject_profile_id`. It exists because the recipient's hive-row grant needs a hive-level fact: a `private_hives` policy that subqueries `entries` — whose policies subquery `private_hives` — is the 42P17 recursion class `20260809000004` fixed, and `20260815000002`'s own comment warns of exactly this. Gets the same one-directional immutability guard as `20260815000004` gave `sealed_at`. Per-entry `entries.visibility` remains the only record of *which entries ride in the package*.
>    - Migration hazard: do **not** enforce "sent ⇒ has subject" as a row CHECK over `subject_profile_id` — that FK is `on delete set null`, so the CHECK would make the subject's account deletion fail on any sent hive. The RPC (point 4) enforces it.
> 3. **Two new permissive SELECT policies, both subject-scoped:** `private_hives_select_as_subject` (not yet in schema) — `auth.uid() = subject_profile_id and sent_at is not null`, no subquery; `entries_select_as_hive_subject` (not yet in schema) — `visibility = 'sent' and exists (select 1 from private_hives h where h.id = hive_id and h.subject_profile_id = auth.uid() and h.sent_at is not null)`. Both terms pinned on both sides; the restrictive policy passes because `'sent' <> 'private'`. The reference is one-directional (entries → private_hives, whose policies stay subquery-free), so no recursion.
> 4. **The send act is one SECURITY DEFINER RPC** (`send_hive(hive_id)` shape, not yet in schema; house revoke pattern per `20260813000005`): validates caller = owner, `sealed_at` set, `subject_profile_id` non-null, an accepted connection — then flips the hive's `packaged` entries to `'sent'` and sets `sent_at` in one transaction. Two client-side writes would allow `sent_at` without flipped entries: the recipient opens an empty reveal, the exact failure Slice 1 exists to avoid. The RPC is also the single choke point for pricing: **ruled by Colin 2026-08-17 — pricing gates the send, never the seal.** Sealing stays free and unconditional; any future paywall check lives inside `send_hive`, nowhere else.
> 5. **Connection is checked at the send act, never at read time.** A delivered keepsake is a gift — a later unfriend does not revoke it.
> 6. **Both directions of the feed/hive coupling close.** Direction one is already closed on `github/main`: `owns_entry()` as replaced by `20260815000001` requires `e.hive_id is null`, and it is `shares_insert_own`'s WITH CHECK (`20260809000004`) — no hive entry can acquire a `shares` row, so the borrow-`shares` delivery route is refused at insert, not merely disciplined. Direction two is still open: `entries_update_own` (live definition `20260815000006`) lets an author move an already-shared entry — live `shares` row — into an unsealed hive, after which `entries_select_via_share` exposes it to every accepted connection and `listFeed`/`listFeedSince` (no `hive_id` filter) render it in the week view. The migration adds the mirror guard: an entry with a `shares` row cannot acquire a `hive_id`. The definer-helper question is measured, not conditional (probe `.scratch/r118-send-path/probe-r118.mjs`, Pixel 2026-08-17, re-run by Lumen the same day against a migration set diffed byte-identical to `github/main`): the inline `not exists` clause on `entries_update_own`'s WITH CHECK refuses with 42501, not `owns_entry`'s 42P17 — no SECURITY DEFINER wrapper needed. Should-pass controls all green: unshared entry still moves into a hive, in-hive edits still work, shared journal edits still work. Gate row lands in `check-share-visibility` with this migration (Pixel writes it).
> 7. **Two shipped comments expire on this migration and must be amended in it** (`comment on` in the same file — teammates quote comments as fact): `20260815000001`'s "nothing here grants that profile any access" and `20260813000004`'s "visibility is a display/state label, not a new grant."
>
> Client note for 8b.6: the package-open header reads the owner's profile; a later unfriend may hide that profile while hive read access persists (point 5), so the mount point needs a fallback for the sender's name.

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
| 11.4 | E2E test: full core loop          | Signup → add friend → send note → plant seed → bloom → create private hive → review → seal → package & send → recipient opens. Plus the no-send path: seal a hive with no recipient, verify it completes as a keepsake. No money. | M   | qa, testing         |
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



## SLICE 2: PUBLIC LAUNCH (Freemium + Cash App Gifting)

**Goal:** After demo testing validates the loop, ship to App Store / Play Store with a freemium model. Free tier with limited features; paid tier "Pollinate Plus" unlocks unlimited usage. Cash App gifting via iMessage links enables gratitude-with-money without Pollinate being a money transmitter.

**Prerequisite:** Demo Mode success criteria met (see above).

**Duration:** 3–4 weeks of additional build, then public launch.

---



### Project 15: Cash App Gifting via iMessage (NEW)

> **Concept (PRD v3.1):** Users can attach a Cash App payment link to a gratitude note. Pollinate generates the link and stores the note — it does NOT touch the money. The recipient reads the gratitude note in Pollinate, then taps the Cash App link to claim the payment in Cash App. Pollinate is NOT a money transmitter.

| #    | Issue                          | Description                                                                                                | Est | Labels                |
| ---- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- | --- | --------------------- |
| 15.1 | Gift model & API               | `gifts` table: sender_id, recipient_identifier, note_text, cashapp_link, status, created_at. CRUD. Pollinate stores the link reference, NOT the money. | S   | backend, db           |
| 15.2 | Cash App link generation       | Generate Cash App payment links ($cashtag URL format). User specifies amount + recipient $cashtag. Returns a shareable link. | S   | backend               |
| 15.3 | Gift composition screen        | User writes gratitude note, enters Cash App amount + recipient $cashtag, generates link. Note + link stored in Pollinate. | M   | ios, android, design  |
| 15.4 | Share via iMessage / share sheet | Share gratitude note + Cash App link via iMessage extension (iOS) or system share sheet (cross-platform). Recipient receives a link. | L   | ios, android          |
| 15.5 | Recipient opens gift           | Recipient taps link → opens Pollinate → sees gratitude note with bloom animation → taps Cash App link to claim payment in Cash App. | M   | ios, android, design  |
| 15.6 | Wallet tab → Gifting hub       | Replace "Coming Soon" shell with gifting entry point. Show sent/received gifts history. Quick action: "Send a gift." | M   | ios, android, design  |
| 15.7 | Gift feed event                | Privacy-respecting feed event: "Colin sent gratitude to [Name]" (no amounts revealed). Appears in honeycomb feed. | S   | backend, ios, android |


> **Legal note:** Pollinate generates and shares Cash App payment links. It does not custody, transmit, or hold funds. The payment happens entirely within Cash App's infrastructure. This keeps Pollinate out of money transmitter regulations.

---



### Project 12: Freemium Paywall System


| #    | Issue                            | Description                                                                                                                | Est | Labels                |
| ---- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --- | --------------------- |
| 12.1 | Subscription engine              | In-app purchase (StoreKit 2 / Play Billing). Monthly ($2.99) + annual ($29.99) plans.                                     | M   | ios, android, backend |
| 12.2 | Paywall screen                   | Beautiful paywall: what you get, pricing ($2.99/month or $29.99/year), "Upgrade to Pollinate Plus." Shown when user hits a free-tier limit. | M   | ios, android, design  |
| 12.3 | Freemium free tier               | New users automatically get free tier. No trial period, no card required. Free tier: 1 hive, 1 friend, 1 seed, daily journal (full), yearly review only, 1 package/hive/year, full feed access, receive unlimited. | M   | ios, android, backend |
| 12.4 | Upgrade prompts & limits         | When free user hits a limit (e.g., tries to create 2nd hive, add 2nd friend), show paywall. Free tier remains functional within limits. Soft gates, not hard walls. | M   | backend, ios, android |
| 12.5 | Feature gating logic             | Free = receive unlimited, 1 hive, 1 friend, 1 seed, daily journal (full), yearly review only, 1 package/hive/year, full feed access. Paid (Pollinate Plus) = unlimited hives, friends, seeds, monthly/yearly/manual reviews, unlimited packages, Cash App gifting, premium themes. | S   | backend, ios, android |
| 12.6 | Demo mode → production migration | Flip `demo_mode = false`. Enable paywall. Enable Cash App gifting. Remove demo flags.                                      | S   | backend               |
| 12.7 | Subscription management          | Settings: view plan, manage subscription, cancel, restore purchases.                                                       | S   | ios, android, backend |
| 12.8 | Revenue tracking                 | Track: free → paid conversions, churn, MRR, ARPU, gift attach rate.                                                        | M   | backend, analytics    |


> **Monetization model (decided per PRD v3.1):**
>
> - **Freemium subscription.** Free tier with limited features. Paid tier "Pollinate Plus" at $2.99/month or $29.99/year.
> - **Free tier:** Receive unlimited, 1 hive, 1 friend, 1 seed, daily journal (full), yearly review only, 1 package/hive/year, full feed access.
> - **Paid tier (Pollinate Plus):** Unlimited hives, friends, seeds, monthly/yearly/manual reviews, unlimited packages, Cash App gifting, premium themes.
> - **Cash App gifting:** Users generate gratitude notes with Cash App payment links, shared via iMessage. Pollinate is NOT a money transmitter — it generates links, doesn't handle funds.
> - **Transaction fees (MDK/Lightning):** Deferred to Slice 3+ pending legal research. Not part of Slice 2 launch.

---



### Project 13: Public Launch Prep


| #    | Issue                       | Description                                                                                        | Est | Labels                |
| ---- | --------------------------- | -------------------------------------------------------------------------------------------------- | --- | --------------------- |
| 13.1 | App Store listing           | Screenshots, description, privacy policy, App Review submission.                                   | M   | ios, launch           |
| 13.2 | Play Store listing          | Listing, screenshots, data safety form, submission.                                                | M   | android, launch       |
| 13.3 | Landing page                | pollinateapp.xyz marketing site. App download links, hero, features, FAQ.                          | M   | web, design           |
| 13.4 | Onboarding for public users | Polish onboarding for cold users (no friend group waiting). "Add your first friend" → invite flow. | M   | ios, android, design  |
| 13.5 | Bug bash                    | Final QA pass. Fix all P0/P1 bugs from demo testing.                                               | M   | qa, ios, android      |
| 13.6 | Privacy policy & terms      | Legal docs for public launch. Cover data handling, Cash App gifting disclosures (not a money transmitter). | S   | legal, launch         |
| 13.7 | Support channel             | In-app help / FAQ. Contact form. Bug reporting.                                                    | S   | ios, android, backend |


---



### Projects 3, 4, 5: Wallet & Funding Infrastructure (MOVED FROM SLICE 1 — DEFERRED TO SLICE 3+)

> ⚠️ **These projects were originally in Slice 1 but have been moved out.** Per PRD v3.1, transaction fee infrastructure (MDK/Lightning wallets, Lightning funding flows, card onramps) is **deferred to Slice 3+ pending legal research**. They are documented here for reference and future planning. **Do not build these in Slice 2 unless legal counsel confirms viability.**

#### Project 3: MDK Wallet Integration (DEFERRED — Slice 3+)


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


#### Project 4: Cash App Lightning Funding Flow (DEFERRED — Slice 3+)


| #   | Issue                       | Description                                                                                                | Est | Labels                |
| --- | --------------------------- | ---------------------------------------------------------------------------------------------------------- | --- | --------------------- |
| 4.1 | "Add Funds" screen          | Cash App highlighted as recommended. Other options below.                                                  | S   | ios, android, design  |
| 4.2 | Invoice generation          | Generate Lightning invoice for user-specified dollar amount. Convert to sats.                              | S   | backend, wallet       |
| 4.3 | QR code rendering           | Render invoice as large scannable QR. Copyable invoice string.                                             | S   | ios, android          |
| 4.4 | Payment detection + success | On payment arrival: update balance, success animation, haptic.                                             | S   | ios, android, backend |
| 4.5 | Funding instructions        | Visual guide: "1. Open Cash App → 2. Money → 3. Bitcoin → 4. Scan QR"                                      | S   | ios, android, design  |


#### Project 5: Apple Pay / Card Fallback (Coinbase Onramp) (DEFERRED — Slice 3+)

> *This is still an idea. Do not build this yet.*

| #   | Issue                        | Description                                                 | Est | Labels                |
| --- | ---------------------------- | ----------------------------------------------------------- | --- | --------------------- |
| 5.1 | Coinbase Onramp SDK          | Embedded widget. Stays in-app. No browser redirect.         | M   | ios, android, backend |
| 5.2 | Apple Pay flow               | Apple Pay sheet → Face ID → confirm. Min $10.               | M   | ios, backend          |
| 5.3 | KYC handling                 | First-time KYC via Coinbase SDK. Track status.              | S   | backend               |
| 5.4 | Payment confirmation webhook | Coinbase webhook → confirm → credit wallet with sats.       | S   | backend, wallet       |
| 5.5 | Funding options UI           | Cash App (default) → Apple Pay/Card → Any Lightning wallet. | S   | ios, android, design  |


---



## SLICE 2 SUMMARY


| Metric        | Value                                                                     |
| ------------- | ------------------------------------------------------------------------- |
| Projects      | 3 active build (Projects 12, 13, 15) + 3 deferred to Slice 3+ (Projects 3, 4, 5) |
| Issues        | ~22 active build + ~25 deferred                                           |
| Timeline      | 3–4 weeks build, then public launch                                       |
| Critical path | 15.4 (iMessage/share integration), 12.1 (Subscription engine), 12.5 (Feature gating) |
| Distribution  | App Store + Play Store (public)                                           |
| Monetization  | Freemium: Free tier (limited) + Pollinate Plus ($2.99/mo or $29.99/yr). Cash App gifting via iMessage links (not a money transmitter). |
| Success gate  | 20%+ free→paid conversion, $1K+ MRR within 60 days of launch, 10%+ of gratitude notes include a Cash App gift |


---



## WHAT COMES AFTER (Future Slices)

After public launch with freemium paywall:

- **Slice 3 (Transaction Fees — IF viable):** MDK/Lightning wallet integration, Lightning funding flows, card onramps. Requires legal counsel to confirm money transmitter status and regulatory compliance. Only proceeds if legal research is favorable. (Projects 3, 4, 5 above.)
- **Slice 4 (Growth):** Collective seeds, pay-it-forward chains, advanced seed types, cash-out flow (if Slice 3 proceeds), feed comments
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
            ├── Cash App gifting via iMessage (Project 15)
            ├── Freemium paywall (Project 12)
            ├── Public launch prep (Project 13)
            └── Bug bash + polish

Week 14+:   SLICE 2 LAUNCH
            ├── App Store + Play Store submission
            ├── Public launch
            ├── Freemium paywall active
            ├── Cash App gifting live
            └── Begin transaction fee legal research (Slice 3)
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
| 7        | 15.4 iMessage / share integration | Blocks Cash App gifting. Most complex Slice 2 feature.   | Medium — iMessage extension complexity, cross-platform share sheet |

**Recommendation:** Start database setup (1.4), hexagon grid (6.3), and private hive model (8b.1) on day 1. These are the longest poles. Everything else can flow around them. Bloom animations (8b.4/8b.6) can begin once the private hive data model is in place.

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




### Slice 2 Team (Paywall + Gifting + Launch)


| Role             | Owns                                                        | Key Projects |
| ---------------- | ----------------------------------------------------------- | ------------ |
| Mobile Engineers | Cash App gifting UI, paywall, feature gating, iMessage integration | 12, 15   |
| Backend Engineer | Subscription backend, Cash App link generation, gifting API, revenue tracking, demo→prod migration | 12, 15, 13 |
| Designer         | Paywall design, gifting flow, App Store screenshots, landing page | 12, 15, 13 |
| Growth/Community | App Store submission, landing page, public launch           | 13           |


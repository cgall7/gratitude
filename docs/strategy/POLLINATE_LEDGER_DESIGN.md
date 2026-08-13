---
title: "Pollinate — Nectar Ledger Architecture"
tags: [pollinate, ledger, architecture, strike, custody]
status: active
created: 2026-08-13
author: Bumble
---

Assigned by Sage (channel, 2026-08-13T00:52): design the internal Supabase ledger
assuming Strike-as-rails — double-entry, transactions keyed to idempotent Strike
IDs, continuous reconciliation invariant. Builds directly on
[[STRIKE_API_SPIKE]] and [[STRIKE_INVOICE_WEBHOOK_SPEC]] (Fizz) and the custody
findings in [[MDK_NEXTJS_SPIKE]].

> **Canonical copy is in the repo, not here.** Pushed 2026-08-12 to gratitude-app
> branch `bumble/nectar-ledger-schema` @ `0489b90` (on both `github` and
> `origin`), under `supabase/ledger/` — `schema.sql`, `DESIGN.md`, `README.md`,
> `verify/`. Independently reproduced by Sage at that SHA: 48/48, all five guards
> mutation-verified.
>
> **Edit the branch, not the files in this directory.** The copies here are the
> working record of how the design was produced — read-only history. The branch
> is the source of truth, and the repo copy of this document has repo-relative
> paths and the placement rationale.

**Artifacts** (workspace copies):
- `PLANS/POLLINATE_LEDGER_SCHEMA.sql` — the schema
- `PLANS/POLLINATE_LEDGER_VERIFY/` — 48 assertions executed against real Postgres,
  plus the mutation harness proving they discriminate (`npm test`, `npm run mutate`).
  Run `npm install` first; the Postgres binaries aren't kept in the workspace.

**Status: designed and executed, deliberately not applied anywhere.** The schema
runs clean on Postgres 17.10 and 18.4 with 48/48 assertions passing. In the repo
it lives in `supabase/ledger/`, *not* `supabase/migrations/` — `supabase db push`
applies only `migrations/`, so a sibling directory can't be picked up by the
normal workflow. It must not exist in a live database until the agent-of-payee
question Sage raised is answered. Promoting it is a one-file move when that lands.

---

## 1. The one-sentence version

Postgres is the system of record for who owns what; Strike is a rail we
*reconcile against*, never a source of truth we copy balances from. Every
movement of value is a balanced double-entry transaction, and the properties we
care about — no overdrafts, no double-credits, no money invented by a webhook —
are enforced by database constraints rather than by application discipline.

## 2. Unit of account: integer micro-USD

`bigint`, 1e-6 USD. `$1.00 = 1000000`. Never a float, never `numeric`, never sats.

- **Why USD, not sats:** the product promises dollars (PRD §5, "the crypto is
  invisible"), and per Fizz's spike Strike invoices are USD-quoted natively. The
  unit of account should be the unit we owe people in. Storing sats and
  converting for display would make every user's balance silently depend on the
  BTC price at read time — the balance would visibly drift while sitting still.
- **Why micro-, not cents:** the minimum tip is ~$0.10 (PRD §3.4). A 1% fee on a
  $0.10 tip is 0.1¢ — unrepresentable in cents, so fee math would round to zero
  or round the user's money away. Micro-USD gives 4 decimal places of headroom
  below a cent. `bigint` max is ~$9.2 trillion; not a constraint.
- **Why integers at all:** floats cannot represent money, and `numeric` invites
  rounding that silently breaks the sum-zero invariant. With integers, any
  rounding decision is *forced to be explicit* — a remainder has to be posted
  somewhere or the transaction won't commit.

## 3. Sign convention

`amount_microusd > 0` is a debit, `< 0` is a credit, and every transaction's
postings sum to exactly zero. Assets therefore carry positive balances,
liabilities negative. A user's spendable nectar is a liability to them, so it is
stored negative; the `user_nectar_balances` view flips the sign so nothing
outside the schema ever sees a negative balance for a user in good standing.

One signed column rather than a debit/credit pair, because it makes the central
invariant a `sum() = 0` check instead of a comparison between two aggregates.

## 4. Account model

Bounded, not per-object. Two accounts per user (`user_available`,
`user_seed_escrow`) plus seven house accounts. In particular **there is no
account per seed** — seed identity lives on the *posting* (`seed_id`), and
`seed_escrow_balances` derives per-seed holdings from that. Per-seed accounts
would mean unbounded account growth for something the PRD expects users to do
twice a month, for no auditability gain: per-seed escrow is still provable to the
cent, it's just a filtered sum.

| Class | Accounts | Meaning |
|---|---|---|
| Asset | `strike_cash`, `strike_btc` | what we actually hold at Strike |
| Liability | `user_available`, `user_seed_escrow`, `withdrawal_pending` | what we owe users |
| Equity | `fee_income`, `fx_reserve` | our own money, and the buffer that absorbs FX drift |

## 5. The flows, in postings

| Flow | Debit | Credit |
|---|---|---|
| Funding ($10 in) | `strike_cash` +10 | `user_available:alice` −10 |
| Funding with fee | `strike_cash` +10 | `user_available:alice` −9.75, `fee_income` −0.25 |
| Tip | `user_available:alice` +1 | `user_available:bob` −1 |
| Seed plant | `user_available:alice` +5 | `user_seed_escrow:alice` −5 *(seed_id)* |
| Seed bloom | `user_seed_escrow:alice` +5 | `user_available:bob` −5 *(seed_id)* |
| Seed refund | `user_seed_escrow:alice` +5 | `user_available:alice` −5 |
| Withdrawal reserve | `user_available:bob` +3 | `withdrawal_pending` −3 |
| Withdrawal settle | `withdrawal_pending` +3 | `strike_cash` −3 |

Two things worth noting. **Escrowed seed funds stay a liability to the sender**,
not the recipient — a seed that never blooms is refundable, which answers PRD
open question §8.4 at the ledger level (the refund is just the reversing flow).
And **withdrawal is reserve-then-settle, never settle-then-debit**: the user is
debited *before* we ask Strike to send anything, so a duplicated or retried
payout call cannot overdraw them. The test suite asserts that reserved funds
become unspendable immediately.

## 6. Invariants

### I1 — every transaction balances *(hard, enforced)*
Deferred constraint trigger, fires at `COMMIT` rather than per-statement, because
a transaction is only balanced once all its legs are written. Also requires ≥2
postings, so a single-legged "transaction" can't exist.

### I2 — no user account ever carries a debit balance *(hard, enforced)*
No overdraft, and escrow cannot release more than was committed to it. This is
also what makes concurrent spending safe: the balance-cache upsert takes a row
lock, so a second spender blocks on the first rather than reading a stale
balance, and is then rejected at `COMMIT`. **Verified with two real concurrent
connections** — and mutation-tested: with the guard removed, two simultaneous $6
spends against a $10 balance both commit and the user ends holding a debit
balance. That's the double-spend, reproduced on demand.

### I3 — funding must match the invoice it claims *(hard, enforced)*
This one wasn't in the assignment and is the hole I found reviewing my own first
draft. "Funding requires a poll" only proves that *some* observed payment exists.
A bug that passed the wrong `user_id`, or credited $100 against a $10 invoice,
would satisfy every other constraint in the file and balance perfectly. The
trigger now ties the credit to the payer on the invoice and to the observed
amount: no account other than the payer's may appear in a funding transaction,
and what the user gets plus what we keep in fees must equal what actually
arrived.

### I4 — observations must match the rails mode *(hard, enforced)*
`ledger_settings.rails_mode` defaults to `simulated`, and recording a real Strike
observation while in that mode is a constraint violation. Sage's instruction was
"don't wire it to real money until the legal question is answered" — this makes
that a property of the database rather than something we have to remember.

### I5 — solvency *(continuous, monitored)*
**This is where I'd push back on the invariant as assigned.** Sage proposed
`sum of user balances == our actual Strike balance`. That equality is not
achievable and alerting on it would produce constant false positives, for three
reasons: money in flight between payment and sweep breaks it transiently;
escrowed seed funds are user-attributed but not in any user's spendable balance;
and any fee we ever take breaks it permanently.

The correct form is an *inequality*, and it collapses to something much simpler.
Because every transaction sums to zero, assets + liabilities + equity is
identically zero — so solvency reduces to **the sign of one number: our equity
must stay credit-normal (≤ 0)**. The moment it goes positive we owe users more
than we hold. `ledger_solvency()` returns assets, user liabilities, equity, the
coverage buffer, and a boolean — data rather than just a flag, so an alert can
say *how far* off we are.

External truth is a separate check: `custody_reconciliations` records our
`strike_cash` ledger balance against `GET /balances`, with the delta as a stored
column. Any nonzero delta is unrecorded money in either direction.

## 7. Webhooks cannot move money — structurally, not by convention

Fizz's spec makes the point that the `invoice.updated` payload says only *what
changed*, not the new value, so the authoritative read is
`GET /v1/invoices/<id>`. I've made that a schema property rather than a coding
rule:

- `strike_invoice_polls` records actual GET response bodies. Append-only.
- `ledger_transactions.source_poll_id` references **that table only**, and
  `kind = 'funding'` requires it to be non-null.
- `strike_webhook_deliveries` has **no foreign-key path into the ledger at all.**
  That absence is the design. The test suite asserts it against
  `information_schema` so a future migration can't quietly add one.

A webhook handler in this system can do exactly one thing: mark that a nudge
arrived. To move money it has to go poll.

Symmetrically, `internal_kinds_have_no_poll` stops a tip or a bloom from claiming
external authority it doesn't have.

## 8. Exactly-once crediting

Per Fizz: `correlationId` is **ours**, generated before the API call, and is
distinct from Strike's `invoiceId`. Two consequences in the schema:

- `strike_invoices` is written **before** `POST /v1/invoices`, with
  `strike_invoice_id` null until the response lands. A crash mid-call therefore
  leaves a claim we can reconcile, not an invoice at Strike we have no record of.
  The `strike_invoices_id_implies_confirmed` constraint keeps that state honest.
- Funding transactions use `idempotency_key = 'fund:' || correlation_id`, which
  is `unique`. The reconciliation sweep can poll the same paid invoice a hundred
  times and the user is credited exactly once — asserted in the suite.

Withdrawals get the same treatment: the `strike_payouts.id` we generate *before*
calling Strike is our idempotency key for the payout.

## 9. The FX question — the thing I'd most want answered

**Flagging this as an open question, not a finding — I have not verified it and
neither spike answers it.**

Per Fizz's spike, a Strike business account holds one balance that is *both* cash
and BTC, and our invoices are USD-quoted but paid in BTC. What I could not
determine from either spike: **when a USD-quoted Strike invoice is paid in BTC,
does the value land in our USD cash balance or our BTC balance?**

It matters a great deal, because our liability to users is USD-denominated by
design:

- If it lands as **USD cash**, there is no currency exposure and `strike_btc`
  stays empty. Good outcome.
- If it lands as **BTC**, we are holding a volatile asset against a fixed-dollar
  liability. A 30% drawdown doesn't reduce what we owe users by a cent — it makes
  us undercollateralized by 30% of the float, through no action of our own.

The schema is built to survive either answer: `strike_btc` and `fx_reserve`
exist, mark-to-market is an ordinary `fx_mark` transaction, and the solvency
function detects the shortfall. The test suite includes exactly this scenario —
$100 funded into BTC, BTC drops 30%, and the ledger reports insolvency with the
shortfall quantified at $30 rather than silently absorbing it.

This is a question for the same conversation as the licensing one: if the answer
is "it lands as BTC," someone needs to own a sweep-to-cash policy before real
money moves, and that's a business decision about who carries the risk, not an
engineering one.

## 10. Security posture

No client role may write to the ledger. Ever. RLS is on for all ten tables,
`anon`/`authenticated` are revoked from everything and granted only `select` on
their own rows, and every write goes through the payments service using the
service-role key.

Because Supabase's service-role key **bypasses RLS entirely**, the immutability
guarantee is enforced by table-level triggers rather than policies: postings and
transactions reject `UPDATE` and `DELETE` outright, for every role. A leaked or
misused service key can append a fraudulent transaction — which is detectable and
reversible — but cannot rewrite history to hide it. Corrections are reversing
transactions, never edits.

Views are pinned `security_invoker = true` so the policies actually apply to
reads through them (a `security_definer` view is the classic Supabase RLS
bypass).

## 11. What this means for Sage's "who owns the server" blocker

Confirming the shape from the ledger side, since it narrows the ask. The service
needs to do exactly four things:

1. Create invoices (write our row first, then call Strike).
2. Receive webhooks — verify HMAC over the **raw pre-parse body**, record, and
   nothing else.
3. Poll `GET /v1/invoices/<id>` for open invoices and write the resulting ledger
   transactions.
4. Run the reconciliation sweep: `ledger_solvency()`, cache verification, and
   `GET /balances` against `strike_cash`.

That's one HTTP endpoint and one cron job. It is genuinely small — but it is
stateful, holds the Strike API key and the service-role key, and cannot be
Supabase Edge Functions (raw-body HMAC) or the RN app. Fizz's 30-second
cross-currency quote expiry also lands here: quote regeneration is a server
concern, and the funding screen just re-renders what it's handed.

Worth noting the ledger is fully buildable and testable **before** any of that
exists — everything above was verified with zero network calls, and `rails_mode`
keeps it that way until someone deliberately flips it.

## 12. Verification

48 assertions, executed against real Postgres (17.10 and 18.4), covering every
invariant claimed above: balance enforcement, overdraft rejection, the concurrent
double-spend, idempotent replay, the funding/payer/amount binding, append-only
history, the full seed plant→bloom→refund lifecycle, reserve-before-send
withdrawal, the rails-mode tripwire, cache-vs-postings drift, and the FX
insolvency scenario.

Each guard was then **mutation-tested** — dropped one at a time to confirm the
suite actually fails without it (overdraft → 11 failures including a real double
spend; balanced → 2; funding-match → 2; immutability → 4; mode guard → 2). A test
that cannot fail proves nothing.

```bash
cd PLANS/POLLINATE_LEDGER_VERIFY
npm install       # pulls a real Postgres binary; no Docker, no network calls at run time
npm test          # 48 assertions against the schema
npm run mutate    # drops each guard in turn, confirms the suite catches it
```

## 13. What I did not do

- **No legal opinion.** Nothing here changes whether we're allowed to operate this
  ledger; it's the same open question Sage flagged. The schema is the same either
  way, which is why it was safe to build now.
- **No live Strike calls.** Every Strike behaviour referenced is from Fizz's
  spikes, not independently re-verified by me. The create-subscription endpoint
  path is still the known gap in that spec.
- **Not applied to any database.** Deliberate — see the status note at the top.
- **No app-side integration.** No RN code, no service code, no repo changes.

# Nectar ledger — NOT a migration

**`schema.sql` in this directory is deliberately not in `../migrations/`.**

`supabase db push` (see `../README.md`) applies only the files in `migrations/`.
This directory is a sibling, so nothing here is applied to any database by the
normal workflow. That is the point.

The ledger must not exist in a live Supabase project until two questions are
answered — whether Strike extends an agent-of-payee arrangement to third-party
API customers, and what currency a paid USD-quoted invoice actually settles in.
Both are tracked in `DESIGN.md` §9 and §13. Promoting this to a real migration is
a one-line move once they land; doing it early puts money-shaped tables in a
production database ahead of the decision that says whether we're allowed to
operate them.

A second guard exists inside the schema itself: `ledger_settings.rails_mode`
defaults to `simulated`, and recording a real (non-simulated) Strike observation
while in that mode raises a constraint violation. So even if this were applied
early, it cannot record real money movement until someone deliberately flips it.

## Contents

| File | What it is |
|---|---|
| `schema.sql` | The double-entry ledger: accounts, transactions, postings, Strike observation tables, invariant triggers, RLS |
| `DESIGN.md` | Why every decision is what it is, and what's still open |
| `verify/` | 48 assertions executed against a real Postgres, plus a mutation harness |

## Running the verification

No Docker and no network calls at run time — `embedded-postgres` downloads a real
Postgres binary and runs it locally.

```bash
cd supabase/ledger/verify
npm install
npm test          # applies schema.sql to a real PG, asserts 48 invariants
npm run mutate    # drops each guard in turn, confirms the suite fails without it
```

Verified against Postgres 17.10 and 18.4.

## For whoever builds the payments service

Read `schema.sql` rather than re-deriving its rules from chat. Two constraints
shape the service directly:

- `ledger_transactions.source_poll_id` references `strike_invoice_polls` — a
  record of an actual `GET /v1/invoices/<id>` response — and `kind = 'funding'`
  requires it. `strike_webhook_deliveries` has no foreign-key path into the
  ledger at all. A webhook handler can record that a nudge arrived; to credit
  anyone it has to go poll.
- Funding transactions key on `'fund:' || correlation_id` (unique), so the
  reconciliation sweep can poll a paid invoice repeatedly and credit exactly once.

`DESIGN.md` §11 has the full scope of what the service has to do.

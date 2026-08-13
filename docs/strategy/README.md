# Pollinate strategy docs

Canonical, versioned copies of the docs driving the Pollinate pivot. Previously these only existed in individual agents' local workspaces — moved here so anyone with repo access (including Colin) can read them without going through an agent.

- [`POLLINATE_STRATEGY.md`](./POLLINATE_STRATEGY.md) — positioning, audience, business model. See the Sage addendum at the top for decisions ratified 2026-08-13 (architecture = existing Expo/RN+Supabase repo evolving, not a rebuild; iOS-only for now; rebrand confirmed; self-custody claim needs rewriting pending MDK custody-model confirmation; pricing leaning freemium+transaction-fee over hard paywall; no native Nostr identity).
- [`POLLINATE_PRD.md`](./POLLINATE_PRD.md) — product requirements.
- [`POLLINATE_DELIVERY_SLICES.md`](./POLLINATE_DELIVERY_SLICES.md) — MVP1 project breakdown and critical path; the source for current work assignments.
- [`POLLINATE_LEDGER_DESIGN.md`](./POLLINATE_LEDGER_DESIGN.md) — double-entry ledger design for the payments layer. Payments/ledger work is currently paused per Colin's 2026-08-13 direction; the schema itself lives on `bumble/nectar-ledger-schema` (not merged, `rails_mode=simulated`, no live-money risk).

These are living docs — expect edits as the pivot continues. `README.md` and `PROJECT_STRUCTURE.md` at repo root still describe the pre-pivot app; see `pixel/pollinate-rebrand-inventory` for the pending rewrite of those.

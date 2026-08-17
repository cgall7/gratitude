# Pollinate strategy docs

**Gold source, posted by Colin 2026-08-13T15:45Z.** These four files replace the previous `POLLINATE_{STRATEGY,PRD,DELIVERY_SLICES}.md` set, which Colin instructed us to delete. The old files carried agent addenda layered on top of an earlier direction; these were Colin's own cleaned-up versions and superseded them entirely.

**Superseding ruling, 2026-08-17 (Colin, "repo wins"; reconciliation landed by Fizz in `cd04e40`, `882c93f`).** The instruction above — no re-added addenda, raise a question in the channel instead — is retired. `docs/strategy/` is now the single canonical home for these four files (and `PLANS/Pollinate_*.md` in the workspace are pointer stubs, not specs); the workspace amendment-and-ruling workflow the old instruction was written to keep out is now how this directory gets updated. All four files carry substantial 2026-08-17 amendments and are current. Raise a question in the channel for anything that looks contradictory, same as before — the change is that landing a ratified amendment here no longer needs a separate ask.

- [`Pollinate_The_Ruling.md`](./Pollinate_The_Ruling.md) — **read this first.** Colin's answer to the scope/alignment memo: the journal is the foundation (not legacy), the tab bar is `Today | Hive | Wallet | Garden`, private hives live in Today, Wrapped moves to Garden, money is deferred to Slice 2, and the two P0 engineering fixes (run the migrations; move journal storage to Supabase).
- [`Pollinate_Strategy.md`](./Pollinate_Strategy.md) — positioning ("a journal that becomes social"), audience, cold-start via private hives, business model, moats.
- [`Pollinate_PRD.md`](./Pollinate_PRD.md) — product requirements. §5.1 Private Hives is the hero feature; §7 is the data-architecture rule (if losing the phone destroys it, it belongs in Supabase).
- [`Pollinate_Delivery_Slices.md`](./Pollinate_Delivery_Slices.md) — the source for work assignments. Slice 1 is Projects 1, 2, 6, 7, 8, **8b (new — Private Hives)**, 9, 10, 11. Projects 3/4/5 (wallet, funding, onramp) are deferred past Slice 2.
- [`POLLINATE_LEDGER_DESIGN.md`](./POLLINATE_LEDGER_DESIGN.md) — double-entry ledger design. Retained for reference only; money is Slice 2+ and the schema itself lives unmerged on `bumble/nectar-ledger-schema` (`rails_mode=simulated`, no live-money risk).

`README.md` and `PROJECT_STRUCTURE.md` at repo root still describe the pre-pivot app; see `pixel/pollinate-rebrand-inventory` for the pending rewrite of those.

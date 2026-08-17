# Pollinate strategy docs

**Gold source, posted by Colin 2026-08-13T15:45Z.** These four files replace the previous `POLLINATE_{STRATEGY,PRD,DELIVERY_SLICES}.md` set, which Colin instructed us to delete. The old files carried agent addenda layered on top of an earlier direction; these were Colin's own cleaned-up versions and superseded them entirely.

**Superseding ruling, 2026-08-17 (Colin, "repo wins"; reconciliation landed by Fizz in `cd04e40`, `882c93f`).** The instruction above — no re-added addenda, raise a question in the channel instead — is retired. `docs/strategy/` is now the single canonical home for these four files (and `PLANS/Pollinate_*.md` in the workspace are pointer stubs, not specs); the workspace amendment-and-ruling workflow the old instruction was written to keep out is now how this directory gets updated. All four files carry substantial 2026-08-17 amendments and are current. Raise a question in the channel for anything that looks contradictory, same as before — the change is that landing a ratified amendment here no longer needs a separate ask.

**Ruling propagation (standing rule, 2026-08-17; owner: Lumen — encoding rulings is Lumen's step).** When a ruling changes vocabulary (seal vs. send, subject vs. recipient), the encoding pass sweeps the retired vocabulary across every file in this directory before the ruling is called encoded. This is a manual ritual, not a gate: a line-oriented grep cannot see a markdown table's free/paid axis when it sits in the header row one line above (the PRD's recipient row was found by eye, not by any sweep), so a green sweep never licenses the claim "the canonical set agrees with itself."

The ritual, in order:

1. **Re-read every cited row by eye.** The eye-read is the acceptance check; the sweeps below are regression nets for rows nobody cited.
2. **Sweep the retired token, not the replacement.** Searching the new noun can only re-confirm edits already made — an unrenamed row contains none of the new vocabulary. Only the retired token can return a row not yet touched.
3. **Hand-classify every hit.** The retired noun keeps legitimate uses (metric labels, schema-state prose like `packaged`→`sent`, open media-scope questions). Publish the sweep as one pipeline with both yields labelled — the bare grep and the filtered count are different numbers (2026-08-17 package→send pass at `e4269e9`: bare 81, filtered 9, all 9 classified legitimate):

   ```sh
   git grep -nEi 'package' -- docs/strategy/ ':!docs/strategy/README.md' \
     | grep -Ei 'upgrade|free tier|paid|plus|unlimited|limit|tier|more |per year|gate'
   ```

   (Substitute the retired token and its tier/gate context words for the ruling at hand.) **The instrument does not count its own documentation**: this README is excluded, because every ruling recorded here adds its retired token to the corpus — the sweep's example command literally contains the string it searches for. Without the exclusion the bare yield drifts upward with each entry (83 at `fda5f79` against the 81 documented above), and a future entry that writes a retired token beside a context word would inflate the *filtered* count, the number people act on.
4. **The verdict line reads "N hits, all classified legitimate" — never "zero hits."** Zero means the sweep is broken, not that the docs are clean.

- [`Pollinate_The_Ruling.md`](./Pollinate_The_Ruling.md) — **read this first.** Colin's answer to the scope/alignment memo: the journal is the foundation (not legacy), the tab bar is `Today | Hive | Wallet | Garden`, private hives live in Today, Wrapped moves to Garden, money is deferred to Slice 2, and the two P0 engineering fixes (run the migrations; move journal storage to Supabase).
- [`Pollinate_Strategy.md`](./Pollinate_Strategy.md) — positioning ("a journal that becomes social"), audience, cold-start via private hives, business model, moats.
- [`Pollinate_PRD.md`](./Pollinate_PRD.md) — product requirements. §5.1 Private Hives is the hero feature; §7 is the data-architecture rule (if losing the phone destroys it, it belongs in Supabase).
- [`Pollinate_Delivery_Slices.md`](./Pollinate_Delivery_Slices.md) — the source for work assignments. Slice 1 is Projects 1, 2, 6, 7, 8, **8b (new — Private Hives)**, 9, 10, 11. Projects 3/4/5 (wallet, funding, onramp) are deferred past Slice 2.
- [`POLLINATE_LEDGER_DESIGN.md`](./POLLINATE_LEDGER_DESIGN.md) — double-entry ledger design. Retained for reference only; money is Slice 2+ and the schema itself lives unmerged on `bumble/nectar-ledger-schema` (`rails_mode=simulated`, no live-money risk).

`README.md` and `PROJECT_STRUCTURE.md` at repo root still describe the pre-pivot app; see `pixel/pollinate-rebrand-inventory` for the pending rewrite of those.

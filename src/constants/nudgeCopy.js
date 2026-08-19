// §7, DAILY_NUDGE_SPEC.md: "The notification's own title and body — owed
// WITH half A, not after it... this is the most-seen sentence in the
// product — lock screen, every day, forever. A placeholder there is the
// EveningMirror defect on the highest-visibility surface we have. Half A
// does not ship without it."
//
// These are Deezine's strings — event `5fb43947`, 2026-08-17T06:08:25Z,
// Collab on projects. Ratified by Sage's ruling (same channel, 06:38:26Z)
// over a reviewer-authored round 5 that had been circularly cleared by its
// own author; round 5 is withdrawn, not a rejected revision of this pair.
//
// Register, §7: the app noticed the day and did not notice a line in it —
// a stance, not a vocabulary. Never an imperative, never "don't forget",
// never a streak threat, and never a want imported into the reader ("your
// day awaits" constructs an unfulfilled obligation; this pair does not).
export const NUDGE_TITLE = 'A day worth noticing';
export const NUDGE_BODY = 'What did it show you?';

// ---------------------------------------------------------------------------
// The Celebration beat's three strings. §2's placement corollary (Lumen,
// `1981e472`): the ask sits under "Tomorrow it's two." because the
// notification is the mechanism of that sentence. They live here rather than
// in `Onboarding.js` for the reason the pair above lives here — copy is
// Deezine's, and a string with an owner should be somewhere that owner can
// edit without touching a screen's state machine.
//
// THE ASK IS STILL OPEN and carries the sentinel deliberately. It has been
// withdrawn twice, both times by the same test and never by taste:
//
//   "Let me know tomorrow evening"        withdrawn — §3 rules that the ask
//                                         carries no time, and "evening"
//                                         calcifies a DEFAULT_HOUR that §3
//                                         labels a guess with a falsifier.
//   "Let me know on days I don't write"   withdrawn — `write` is occupied on
//                                         `fizz/private-hives-rails`
//                                         (`ComposeHiveEntry.js:56`,
//                                         `CreateHive.js:180`), and by
//                                         ratified guide copy, not by
//                                         accident. It would be false in the
//                                         product's own voice one merge later.
//
// The live constraint (Lumen, `0db0852c`) named THE LINE; that constraint was
// itself withdrawn by D5 (Lumen, `fedeaff5`, 2026-08-19) — `line` stays spent
// on the send flow (Onboarding.js:179, TodayTab.js:201) and the ask needed
// its own word. D5's RATIFIED replacement takes the destination block's own
// vocabulary instead of its noun:
//
//   TodayTab.js:200-202  "Today's page is blank." / "One line is enough…"
//
// "page" and "blank" name that render state directly — the exact state the
// nudge fires about — without re-spending `line`, without `write`/`entry`/
// `reminder`/`nudge`/`evening` (§3), and `notification` stays reserved to its
// two switch surfaces (`NUDGE_DECLINED_LINE` and the settings row). D5's own
// gate run (48 trees, Sage's shipped collector) found zero collisions: every
// `page` hit is the destination itself or a deictic self-reference in
// `legalCopy.js`, every `blank` hit is the destination. `page`/`blank` are
// now reserved rows in `check-copy-rules.mjs` for the same reason `line` was
// swept before this replaced it — the sweep is evidence about today's trees,
// not tomorrow's; the reserved row is the guard that survives a later branch.
//
// THE SENTINEL IS EXPORTED SEPARATELY so a gate can import the value rather
// than retype it, and so `NUDGE_ASK_READY` is derived here instead of at the
// call site. The first draft of this block declared a sentinel and wired
// nothing: `Onboarding.js` hardcoded the withdrawn string in two places, the
// constant had ZERO consumers, and this comment described a guard that did
// not exist (Sage, `8f4466df`). A sentinel with no reader is not a guard, it
// is a note.
export const NUDGE_ASK_PENDING = '__OWNED_BY_DEEZINE__';

// RATIFIED, Lumen `fedeaff5`, 2026-08-19 (D5). Truthful only if a morning
// save disarms that day's nudge — see App.js's re-arm-on-save handler, which
// this string's existence keeps load-bearing rather than optional.
export const NUDGE_ASK_LABEL = 'Let me know on days my page is still blank.';

// The ask renders ONLY when the label is a ratified string. While this is
// false the beat ships with no ask at all — which is the honest state, not a
// degraded one: half B's own ruling is that the ask and the App.js re-arm
// land together or the ask does not land.
export const NUDGE_ASK_READY = NUDGE_ASK_LABEL !== NUDGE_ASK_PENDING;

// RATIFIED, Lumen `8269a288`, and it SURVIVED the ask's second withdrawal
// (`0db0852c`) — which is the ratification's own stated reason working: it is
// ask-independent BY CONSTRUCTION. No nouns, no time, no behaviour restated,
// so there is nothing in it for an ask edit to void. The line before it
// carried the ask's "evening" and died with it.
export const NUDGE_GRANTED_LINE = "You're set.";

// RATIFIED, Lumen `8269a288`. A settled state, not a control: it renders only
// after the user has read an OS dialog titled "Would Like to Send You
// Notifications" and declined it, so it echoes the system's own noun back —
// the same echo mechanism as the pair above, with the OS as the speaker.
// §2's corollary nearly verbatim ("explains the switch is off"). No blame, no
// directions: pointing at Settings is §7's row, not this beat's job.
//
// This is the ONLY place `notification` is user-facing in the product, and
// that is the point rather than a leak — §7's stance holds everywhere else
// because the word is reserved to the two surfaces that describe the OS
// switch: this resting state and the settings row that will later replace it.
export const NUDGE_DECLINED_LINE = 'Notifications are off.';

// Daily Nudge §4.1's re-arm, pulled out of `App.js` so a second caller can
// reach it without a require cycle. `App.js` imports `AccountScreen`
// (`./src/screens/Account.js`), so `Account.js` importing `rearmDailyNudge`
// back out of `App.js` is the same shape `MainTabs`/`tabBarLayout.js` and
// `demoMode.js` already ruled out — a screen the root file imports cannot
// import the root file back. This module has no consumer that imports it
// upward, so it carries no cycle.
//
// Behaviour is unchanged from the function this replaces: read the live
// session's written days for the window ahead, reconcile, and swallow every
// failure — no session, Supabase unconfigured, or a transient error all mean
// "the next re-arm tries again," not "report this to the caller." The
// sentinel guard is redundant with `reconcile()`'s own required-content
// check today (nothing is enabled while `NUDGE_TITLE`/`NUDGE_BODY` are the
// sentinel — currently moot, they're ratified — see `nudgeCopy.js`), and
// cheap insurance against a future dev-only toggle that flips the enabled
// flag without going through Celebration or the settings row.
import { EntryStore } from './EntryStore';
import { reconcile as reconcileDailyNudge, WINDOW_DAYS as NUDGE_WINDOW_DAYS } from './dailyNudge';
import { NUDGE_TITLE, NUDGE_BODY } from '../constants/nudgeCopy';

export const rearmDailyNudge = async () => {
  if (NUDGE_TITLE.startsWith('__OWNED_BY_') || NUDGE_BODY.startsWith('__OWNED_BY_')) return;
  try {
    const now = new Date();
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + NUDGE_WINDOW_DAYS - 1);
    const entries = await EntryStore.getEntriesBetween(now, windowEnd);
    await reconcileDailyNudge({
      writtenDaysISO: entries.map((e) => e.date),
      now,
      content: { title: NUDGE_TITLE, body: NUDGE_BODY },
    });
  } catch {
    // Not signed in, Supabase unconfigured, or a transient failure — the
    // next foreground or settings-row toggle tries again. §4.1's re-arm has
    // no "must succeed now" requirement.
  }
};

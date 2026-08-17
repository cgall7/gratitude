// The Daily Nudge, half A — `PLANS/DAILY_NUDGE_SPEC.md`. One notification,
// once a day, for a day that has no entry yet. Every rule here is a rule
// about NOT firing (§1).
//
// SCOPE. This module is the whole of half A's logic. It does not render
// anything and does not decide when the app foregrounds or when an entry is
// saved — App.js calls `reconcile()` on both, per §4.1. It does not query
// Supabase for which days are written — the caller passes `writtenDaysISO`
// in, so this file stays free of a Supabase import and makes no network call
// of its own (Sage, C12's gate row: the settings surface promises
// `src/constants/legalCopy.js`'s "no analytics, crash-reporting or tracking
// code" stays true by construction, not by memory).
//
// THE RECONCILER IS AN ENUMERATOR, NOT A LEDGER (§4.5, RULED, C10). No
// identifier is ever written to storage. Re-arming means: read the OS's own
// pending set, cancel the ones that are ours, reschedule. That is the only
// call shape that (1) cannot drift from the truth because there is no copy
// of the truth to drift from, and (2) self-heals an earlier crash's orphaned
// request on the next foreground, because the next enumerate finds it. A
// persisted id list can leave a pending request nothing can ever cancel —
// see the spec's §4.5 for the failure this replaces.
//
// THE DISCRIMINATOR IS THE IDENTIFIER PREFIX, VERIFIED AT GROUND TRUTH, NOT
// GUESSED (§4.6/§0.1(11)/(12)). §0.1(12) flagged that Expo's docs contradict
// themselves on `getAllScheduledNotificationsAsync`'s return shape — the type
// signature says `NotificationRequest[]`, the prose says the array conforms
// to `Notification` (`{ date, request }`). Read from the installed package
// (expo-notifications 57.0.11, this repo's node_modules) rather than
// resolved by another simulator round trip:
//
//   - JS: `getAllScheduledNotificationsAsync.ts` maps each element with
//     `mapNotificationRequest`, which returns `{ ...request, content }` —
//     FLAT. `n.identifier` is correct; `n.request.identifier` is not. The
//     `{ date, request }` wrapper (`NotificationRecord`) is a different
//     surface — what a tapped notification's *response* carries
//     (`NotificationResponseRecord.notification`), never what the pending
//     list returns. That is the seam the docs' prose and signature disagree
//     across.
//   - Native (iOS): `SchedulerModule.swift` builds every request with
//     `UNNotificationRequest(identifier: identifier, ...)` — the caller's
//     string, verbatim, no UUID substitution, no prefixing
//     (`buildNotificationRequest`, called with the exact identifier
//     `scheduleNotificationAsync.ts` passed down). A namespaced identifier
//     is therefore a load-bearing, verified discriminator — not the
//     `content.data` round trip, which also works (`NotificationRequestRecord`
//     round-trips `content.userInfo` both directions,
//     `NotificationRecords.swift`) but adds a JSON-parse step the identifier
//     doesn't need. `content.title` / `body` is never the discriminator
//     either way (§4.5's rider) — Deezine's copy can change without
//     orphaning the live window.
//
// ONE OBSERVED CAVEAT, LABELLED AS AN OBSERVATION, NOT A DOC CLAIM. On
// iPhone 16 Fizz (iOS 18 sim), Expo Go 57.0.9, with permission status
// "undetermined": `scheduleNotificationAsync` resolved with an identifier
// and no error, but the immediately-following `getAllScheduledNotificationsAsync()`
// returned `[]` — the request never appeared in the OS's pending set pre
// -authorization. I could not complete the matching post-grant round trip:
// this machine has no Accessibility/Input Monitoring grant for simulator tap
// injection, and a synthetic click risks landing on Colin's live screen if
// his window is frontmost (`GUIDES/DEEP_LINK_SIM_DRIVING.md`), so I did not
// attempt one. `simctl privacy grant notifications <bundle>` and `grant all`
// were both tried first and neither changes the authorization status on this
// Xcode/runtime — `notifications` is not among simctl's grantable services.
// Net effect: the fuse (§2) already requires an in-app "yes" before
// `requestPermissionsAsync` is ever called, so a real install always
// authorizes before this module's `reconcile()` runs for the first time;
// nothing here computes from the pre-authorization behaviour.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { buildWindow } from './nudgeWindow';

// §6 row 5b — the persistence ban is enumerable, so it is enumerated: these
// are the ONLY two keys this module may pass to AsyncStorage. A third key is
// the ledger growing back.
export const HOUR_STORAGE_KEY = 'daily_nudge_hour_v1';
export const ENABLED_STORAGE_KEY = 'daily_nudge_enabled_v1';

// §3 — 20:00 device-local, a judgement with a stated falsifier
// (`entries.created_at`, once real usage exists), coupled to Dusk's evening
// threshold (`PLANS/DUSK_REGISTER_DESIGN.md` §4 carries the mirror of this
// note — moving one without the other silently desyncs them).
export const DEFAULT_HOUR = 20;

// §4.4 — ratified as a PRODUCT constant (how long a lapse do we keep nudging
// before going quiet), never derived from the pending-request cap below.
export const WINDOW_DAYS = 7;

// §4.6/§4.5 — the namespaced identifier prefix. Verified honoured verbatim
// by the native layer (see header). A day-keyed suffix makes every pending
// request's identifier reconstructable from `today` + `addDays` alone, which
// is what lets the reconciler recognise "ours" without reading `content` at
// all.
export const IDENTIFIER_PREFIX = 'pollinate-nudge-';

// §4.4/§0.1(7) — the guard rail §6 row 9 asserts against, never an input this
// module reads. iOS's per-app pending cap is REPORTED as 64 (an Apple
// engineer's accepted answer, developer forums thread 811171) but that
// thread 302s to a human-check wall for a non-browser client and could not be
// opened first-hand (Sage's reading, recorded as Sage's, §0.1(7)). Overflow
// at that ceiling is reported as non-graceful — scheduling past it can drop
// to zero notifications firing, not "soonest 64 survive" — so this is set
// well under it rather than tuned close to it. `WINDOW_DAYS` (7) is this
// module's actual worst-case pending count; this constant only exists so the
// gate has something stricter than 64 to fail against before anyone widens
// the window toward a cap this module does not own.
export const PENDING_HEADROOM = 20;

// A day-key is `YYYY-MM-DD`, device-local, matching `src/utils/dateRanges.js`'s
// `toISODate`. Not imported from there — this file is small enough that a
// local, DST-safe `Date`-based add is one function, and keeping it here means
// the reconciler's day arithmetic and `nudgeWindow.js`'s injected `addDays`
// are provably the same function used two ways, not two implementations that
// can drift.
export const toISODateLocal = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const addDaysISO = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return toISODateLocal(dt);
};

const isOurs = (request) => typeof request.identifier === 'string' && request.identifier.startsWith(IDENTIFIER_PREFIX);

// §5, foreground — "the defensible answer is no: the user is already here,
// and the window re-arms on foreground anyway" (§5). Module-level, not
// inside a component: `setNotificationHandler` is a one-time registration
// Expo's own docs pattern calls at import time, and it is a DIFFERENT call
// from `requestPermissionsAsync` — §6 row 3's "no mount-time / module-level
// call" is scoped to the permission ask, not to this.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Live read, never a prompt. The eventual settings row (not yet built — see
// §6 row 8's note in scripts/check-daily-nudge.mjs) renders its switch from
// this, not from `isEnabled()` alone, so a switch cannot show "on" once the
// user has flipped the OS permission off in Settings (§5).
export const getPermissionState = () => Notifications.getPermissionsAsync();

export const isEnabled = async () => (await AsyncStorage.getItem(ENABLED_STORAGE_KEY)) === 'true';

export const getHour = async () => {
  const stored = await AsyncStorage.getItem(HOUR_STORAGE_KEY);
  const hour = stored === null ? DEFAULT_HOUR : Number(stored);
  return Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : DEFAULT_HOUR;
};

export const setHour = async (hour) => {
  await AsyncStorage.setItem(HOUR_STORAGE_KEY, String(hour));
};

// §2, THE FUSE. This is the ONLY function in this module — and, by §6 row 2,
// the only function anywhere in `src/` — that calls `requestPermissionsAsync`.
// It is called from the Celebration "yes" handler (half B, `Onboarding.js`,
// blocked on `pixel/one-door`) and from nowhere at mount, so the OS dialog
// never fires before an in-app "yes". Declining in-app costs nothing — it can
// be asked again on a later day (§2 corollary). Declining at the OS level is
// terminal: this function does not retry, and does not clear
// `ENABLED_STORAGE_KEY` if it was already set from a previous grant, because
// an OS-level revoke is read live via `getPermissionState()`, never inferred
// from this call's outcome.
export const requestPermissionAndEnable = async () => {
  const result = await Notifications.requestPermissionsAsync();
  if (result.granted) {
    await AsyncStorage.setItem(ENABLED_STORAGE_KEY, 'true');
  }
  return result;
};

export const disable = async () => {
  await AsyncStorage.setItem(ENABLED_STORAGE_KEY, 'false');
  await reconcile({ writtenDaysISO: [], now: new Date() });
};

// §4.1/§4.5 — THE RECONCILER. Call on every app foreground and on every
// entry save (App.js wires both; see its header for the save-triggered call
// site's current gap). Enumerate -> cancel ours -> reschedule, always in
// that order (§4.5's rider: replace semantics for a repeated identifier are
// undocumented, so nothing may rest on schedule silently replacing a pending
// request).
//
// `content` is REQUIRED, not defaulted, and deliberately not read from a
// module constant here — see `src/constants/nudgeCopy.js`. §7: "half A does
// not ship without it." A caller that has no real copy yet has nothing
// correct to pass, and this function does not paper over that with a
// placeholder string.
export const reconcile = async ({ writtenDaysISO, now = new Date(), content }) => {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const ours = all.filter(isOurs);
  await Promise.all(ours.map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)));

  const enabled = await isEnabled();
  if (!enabled) {
    return { cancelled: ours.length, scheduled: [] };
  }
  if (!content || typeof content.title !== 'string' || typeof content.body !== 'string') {
    throw new Error('dailyNudge.reconcile: content.title/content.body are required (§7 — Deezine owns these strings)');
  }

  const hour = await getHour();
  const today = toISODateLocal(now);
  const days = buildWindow({
    today,
    writtenDays: new Set(writtenDaysISO),
    windowDays: WINDOW_DAYS,
    addDays: addDaysISO,
  });

  const scheduled = [];
  for (const day of days) {
    const [y, m, d] = day.split('-').map(Number);
    const fireDate = new Date(y, m - 1, d, hour, 0, 0, 0);
    // A `DATE` trigger is implemented natively as
    // `UNTimeIntervalNotificationTrigger(timeInterval: date.timeIntervalSinceNow, ...)`
    // (expo-notifications ios/.../TriggerRecords.swift, DateTriggerRecord).
    // A non-positive interval throws on construction and the request falls
    // back to `trigger: nil`, which `UNNotificationRequest` treats as
    // DELIVER IMMEDIATELY — the exact "fires on a day already written /
    // fires when it shouldn't" defect this whole spec exists to prevent,
    // just triggered by a re-arm running after today's hour instead of by
    // §4's DAILY-repeat. So today's slot is skipped once its hour has
    // already passed for this re-arm, rather than handed to the OS as a
    // past timestamp.
    if (fireDate.getTime() <= now.getTime()) continue;
    // eslint-disable-next-line no-await-in-loop
    await Notifications.scheduleNotificationAsync({
      identifier: `${IDENTIFIER_PREFIX}${day}`,
      content: { title: content.title, body: content.body, data: { pollinateNudge: true } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate },
    });
    scheduled.push(day);
  }
  return { cancelled: ours.length, scheduled };
};

// §C12 — navigation-only, never measurement (the same distinction §5's
// legal-copy row exists to keep true). App.js's response listener calls this
// to decide whether a tap was ours; it does not itself navigate, because
// only App.js holds `navigationRef`.
export const isNudgeResponse = (response) =>
  isOurs(response?.notification?.request ?? {}) &&
  response?.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER;

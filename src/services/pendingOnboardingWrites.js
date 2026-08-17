import AsyncStorage from '@react-native-async-storage/async-storage';
import { EntryStore } from './EntryStore';
import { HiveStore } from './HiveStore';

// The onboarding write buffer, made durable.
//
// WHY THIS EXISTS (C6, Sage 2026-08-17, thread 449cc822)
//
// Onboarding collects two things before an account exists — the first entry
// (Beat 1) and, if the user answers, who the year is for (Beat 3). Neither
// can be written when it is collected: `EntryStore.saveEntry` and
// `HiveStore.createHive` both require a session, and `private_hives.owner_id`
// is a real foreign key. So both buffer, and both flush once a session
// exists.
//
// That buffer used to be a React ref in Onboarding.js, and AccountStep has
// THREE exits while only two of them flushed:
//
//   signUp returns a session   -> flush, then finish        (flushed)
//   signIn, incl. quiet retry  -> flush, then finish        (flushed)
//   signUp returns NO session  -> confirm screen -> finish  (DROPPED)
//
// The third path navigates away with the buffer still in a ref that the
// screen is about to unmount, and the session-effect flush cannot rescue it
// because that effect is gated on still being ON the account step. It is
// dormant today only because production has `mailer_autoconfirm: true` — a
// dashboard toggle, outside this repository, that no gate here can read.
// Turning email confirmation on before a public TestFlight is the ordinary
// thing to do, has no diff, and arms that path silently.
//
// A ref cannot survive that exit, because the write has to happen after a
// session that does not exist yet — possibly after the app has been closed,
// an email opened, and a link followed. So the buffer goes to disk, and the
// flush is fired from wherever a session appears (AuthContext), not from the
// screen that happened to collect it.
//
// THE TWO FAILURES ARE NOT SYMMETRIC, AND THIS MODULE KEEPS THEM APART.
// A lost entry has a recovery path: the user writes one tomorrow, and Today
// shows "Write today's entry" so the loss arrives as an invitation to redo.
// A lost hive has none: the user named who the year is for, was told it was
// kept, and there is no surface anywhere that shows the absence. So
// `flush()` reports the two outcomes separately and its caller surfaces the
// hive failure. Do not collapse them into one boolean.
const KEY = 'pending_onboarding_writes_v1';

// A pre-auth buffer has no identity to bind to — by construction, there is
// no user yet. The window it stays claimable is therefore the whole
// mitigation for "a different account signs in on this device and inherits
// it." Seven days is a judgement, not a measurement: long enough that any
// realistic email confirmation (and a phone left on a charger over a
// weekend) still lands the write, short enough that a sign-in months later
// does not adopt a stranger's line. legacyJournalMigration solves the same
// class with a created_at sanity check; it has an account to check against
// and this does not.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// In-memory mirror. The disk write is fire-and-forget (nothing should block
// a tap on it), so this is what makes a stash correct *within* the session
// that made it: the flush two beats later reads the mirror, never a write
// that may not have landed. Disk is what makes it correct across the
// process death that the confirm-sent path can now include.
let mirror = null;

const emptyBuffer = () => ({ entry: null, hive: null, stashedAt: null });

const persist = (buffer) => {
  AsyncStorage.setItem(KEY, JSON.stringify(buffer)).catch((err) => {
    // Durability is the upgrade, not the baseline: losing the disk copy
    // leaves the in-memory mirror, which is exactly the behaviour that
    // shipped before this module. Warn, don't throw — a rejected setItem
    // must not take down the tap that caused it.
    console.warn('Failed to persist pending onboarding writes', err);
  });
};

const load = async () => {
  if (mirror) return mirror;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return emptyBuffer();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyBuffer();
    if (parsed.stashedAt && Date.now() - parsed.stashedAt > MAX_AGE_MS) {
      await AsyncStorage.removeItem(KEY);
      return emptyBuffer();
    }
    mirror = { ...emptyBuffer(), ...parsed };
    return mirror;
  } catch (err) {
    console.warn('Failed to read pending onboarding writes', err);
    return emptyBuffer();
  }
};

const write = (patch) => {
  mirror = { ...(mirror || emptyBuffer()), ...patch, stashedAt: Date.now() };
  persist(mirror);
};

// Single-flight, module-level. Two callers can be live for the same buffer —
// AccountStep's onBeforeFinish (after signUp/signIn resolves) and
// AuthContext's session listener (firing off the same auth change,
// independently). Memoising the in-flight promise means both await the SAME
// write rather than racing: the loser used to resolve instantly on an
// already-cleared buffer, letting `finish()` navigate while the winner's
// write was still in the air — "Today's page is blank" one screen after
// "Keep it." That race predates this module (Pixel, thread 19e90cf8); it is
// preserved here because moving the buffer out of the component would
// otherwise have deleted the fix along with the ref.
let flightPromise = null;

export const PendingOnboardingWrites = {
  stashEntry({ text, theme }) {
    const now = new Date();
    write({
      entry: {
        text,
        theme,
        // The write can now happen a day or more after the buffer was
        // filled (confirm the email in the morning). `new Date()` at flush
        // time would file the entry under the wrong day, silently, and the
        // user would find their first line missing from the day they wrote
        // it. Capture the day here, as local calendar parts — an ISO
        // instant re-parsed at flush time crosses midnight in every
        // negative UTC offset.
        year: now.getFullYear(),
        month: now.getMonth(),
        day: now.getDate(),
      },
    });
  },

  stashHive({ subjectName }) {
    write({ hive: { subjectName } });
  },

  // Reports the two outcomes separately: { entryFailed, hiveFailed }.
  // Each item is cleared from the buffer only when its own write succeeds,
  // so a failed hive write survives to be retried by the next session
  // appearance while a succeeded entry is not written twice.
  async flush() {
    if (flightPromise) return flightPromise;
    flightPromise = (async () => {
      const buffer = await load();
      if (!buffer.entry && !buffer.hive) return { entryFailed: false, hiveFailed: false };

      let entryFailed = false;
      let hiveFailed = false;
      const remaining = { ...buffer };

      if (buffer.entry) {
        try {
          const { year, month, day, text, theme } = buffer.entry;
          const date =
            Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day)
              ? new Date(year, month, day)
              : new Date();
          await EntryStore.saveEntry(date, text, theme);
          remaining.entry = null;
        } catch (err) {
          // Best-effort, and deliberately so: surfacing this would block the
          // finish beat on a screen that already said "That's one," and the
          // loss arrives at Today as "Write today's entry" — an invitation
          // to redo, one step. The buffer is kept, so the next session
          // appearance retries it anyway.
          console.warn('Failed to save the first entry after signup', err);
          entryFailed = true;
        }
      }

      if (buffer.hive) {
        try {
          await HiveStore.createHive(buffer.hive.subjectName);
          remaining.hive = null;
        } catch (err) {
          console.warn('Failed to create the private hive after signup', err);
          hiveFailed = true;
        }
      }

      if (!remaining.entry && !remaining.hive) {
        mirror = null;
        await AsyncStorage.removeItem(KEY).catch(() => {});
      } else {
        mirror = remaining;
        persist(remaining);
      }

      return { entryFailed, hiveFailed };
    })();
    try {
      return await flightPromise;
    } finally {
      // Cleared, not kept: unlike the original single-flight ref (whose one
      // job was to make two callers await one write during a single finish),
      // this promise outlives the screen. A retry on the next session
      // appearance must be a real attempt, not a replay of the last result.
      flightPromise = null;
    }
  },
};

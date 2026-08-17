import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { migrateLegacyJournal } from '../services/legacyJournalMigration';
import { PendingOnboardingWrites } from '../services/pendingOnboardingWrites';

const AuthContext = createContext({ session: null, loading: true });

// Single source of truth for the Supabase auth session so any screen can
// read it without re-subscribing to onAuthStateChange itself.
// Everything that has been waiting for a session to exist, fired from the
// one place that knows a session just started existing.
//
// PendingOnboardingWrites is here for a reason that is easy to lose: the
// confirm-your-email exit of onboarding navigates away with the buffer
// unwritten, and the session that can write it arrives LATER — after the
// user has opened an email client, followed a link, and come back, possibly
// into a fresh process. There is no screen still mounted to do it. So the
// flush belongs to the session's arrival, not to the screen that collected
// the buffer (C6, Sage 2026-08-17). The account screen calls it too, so the
// happy path still writes before "Keep it." finishes; this is the leg that
// catches every other way a session can appear.
//
// Failures are swallowed HERE and only here: this is the retry leg, it has
// no user standing in front of it, and the buffer survives a failed flush
// to be retried on the next session. The surfacing obligation for a failed
// hive write lives at the account screen, which does have one.
const onSessionAvailable = (nextSession) => {
  // The one-time orphaned-journal recovery (thread ba3783a7) needs a
  // signed-in user before EntryStore's reads/writes will do anything but
  // throw, so it's fired from here rather than unconditionally on boot.
  // Both the user id and the account's own created_at are passed
  // explicitly: the migration claims the legacy key to exactly this
  // identity (since nothing in that key records who it actually belongs
  // to), but only after `created_at` clears a one-sided sanity check —
  // an account created after the newest legacy entry's savedAt cannot
  // have written it, and is refused rather than handed the claim.
  // migrateLegacyJournal() cannot itself reject (its whole body is one
  // try/catch), but this call site is handled anyway rather than resting
  // on that internal guarantee — the same standard check-entry-writes
  // holds every other EntryStore-adjacent call site to.
  migrateLegacyJournal(nextSession.user.id, nextSession.user.created_at).catch(() => {});
  PendingOnboardingWrites.flush().catch(() => {});
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (data.session) onSessionAvailable(data.session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) onSessionAvailable(nextSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

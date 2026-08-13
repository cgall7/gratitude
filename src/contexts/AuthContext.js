import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { migrateLegacyJournal } from '../services/legacyJournalMigration';

const AuthContext = createContext({ session: null, loading: true });

// Single source of truth for the Supabase auth session so any screen can
// read it without re-subscribing to onAuthStateChange itself.
export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
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
      if (data.session) {
        migrateLegacyJournal(data.session.user.id, data.session.user.created_at).catch(() => {});
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        migrateLegacyJournal(nextSession.user.id, nextSession.user.created_at).catch(() => {});
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

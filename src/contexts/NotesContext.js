import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { NotesStore } from '../services/NotesStore';
import { useAuth } from './AuthContext';

const NotesContext = createContext({ unreadCount: 0, refresh: () => {} });

const POLL_INTERVAL_MS = 30000;

// Single source of truth for the unread-notes count, so the Honeycomb tab
// dot and the header mail icon (MainTabs.js, HoneycombTab.js) agree on one
// number instead of each running their own query. Notes has no push infra
// (see the Notes PR's 7.5 note), so "live" here means poll-on-an-interval
// plus refetch on the transitions that actually change the count: app
// foreground and a caller-triggered refresh (NotesInbox after markRead).
export const NotesProvider = ({ children }) => {
  const { session } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef(null);

  const refresh = useCallback(() => {
    if (!session) return;
    NotesStore.countUnread()
      .then(setUnreadCount)
      .catch((err) => console.warn('Failed to load unread notes count', err));
  }, [session]);

  useEffect(() => {
    if (!session) {
      setUnreadCount(0);
      return;
    }
    refresh();
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS);
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(intervalRef.current);
      appStateSub.remove();
    };
  }, [session, refresh]);

  return <NotesContext.Provider value={{ unreadCount, refresh }}>{children}</NotesContext.Provider>;
};

export const useNotes = () => useContext(NotesContext);

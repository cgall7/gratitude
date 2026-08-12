import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from '../components/Avatar';
import { PressableScale } from '../components/PressableScale';
import { GlassBackground, useReduceTransparency } from './GlassBackground';

// Option C's second half (Colin, 2026-08-11): a detached circle beside the
// tab capsule, not a fifth tab. Everything behind it — sign out, the
// privacy policy, terms — is opened about twice a year, and a fifth tab
// would spend permanent prime real estate on that. A corner avatar is the
// affordance people already know from every other app.
//
// Placement is MainTabs' job (it owns the capsule/door row geometry); this
// only knows how big the circle is and what's inside it.
export const DOOR_SIZE = 52;
const DOOR_AVATAR_SIZE = 34;

// Whether the door exists at all. Signed out there is no account to open —
// every row behind it would be disabled — so the door simply isn't there
// yet, and MainTabs must not reserve the space beside the capsule for it.
// The two have to agree or the bar goes lopsided, so the condition lives
// here once and both read it rather than each testing `session` themselves.
export const useHasAccountDoor = () => !!useAuth().session;

export const AccountDoor = () => {
  const navigation = useNavigation();
  const { session } = useAuth();
  const hasDoor = useHasAccountDoor();
  const reduceTransparency = useReduceTransparency();

  if (!hasDoor) return null;

  const name = session.user?.user_metadata?.display_name ?? session.user?.email ?? '?';

  return (
    <PressableScale
      onPress={() => navigation.navigate('Account')}
      accessibilityLabel="Account"
      style={[styles.door, reduceTransparency ? theme.shadows.card : theme.shadows.glass]}
    >
      <GlassBackground radius={DOOR_SIZE / 2} />
      <View style={styles.avatarWrap}>
        <Avatar name={name} avatarUrl={session.user?.user_metadata?.avatar_url} size={DOOR_AVATAR_SIZE} />
      </View>
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  door: {
    width: DOOR_SIZE,
    height: DOOR_SIZE,
    borderRadius: DOOR_SIZE / 2,
    // Transparent for the same reason the capsule is: the glass layer below
    // is what paints, and it lives in its own clipped child so this view's
    // shadow survives (see GlassBackground).
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    // Above the glass layer, which fills the circle behind it.
    zIndex: 1,
  },
});

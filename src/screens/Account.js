import React, { useCallback, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Alert, Switch } from 'react-native';
// react-native's own SafeAreaView is deprecated and warns on every render
// (confirmed on device — it's what raises the LogBox toast over Legal.js).
// react-native-safe-area-context is already a dependency, and React
// Navigation mounts its provider, so this is the drop-in.
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { HoneycombStore } from '../services/HoneycombStore';
import { Avatar } from '../components/Avatar';
import { PressableScale } from '../components/PressableScale';
import {
  getPermissionState,
  isEnabled as isNudgeEnabled,
  requestPermissionAndEnable,
  disable as disableDailyNudge,
} from '../services/dailyNudge';
import { rearmDailyNudge } from '../services/rearmDailyNudge';
import { NUDGE_DECLINED_LINE } from '../constants/nudgeCopy';
// The shipped version number, read from the one file that defines it.
// expo-constants would be the usual source, but it isn't a dependency of
// this app (it's only a transitive dep of `expo` and isn't installed at the
// top level), and adding a package to print one string isn't worth it.
import appConfig from '../../app.json';

// What the account door opens (Option C, Colin 2026-08-11). This screen
// exists because three things were unreachable without it, not because a
// settings screen is standard furniture:
//
//   1. `HoneycombStore.signOut()` had zero callers anywhere in src/ — there
//      was no way to leave an account on a device.
//   2. The Privacy Policy and Terms were only linked from the signup form,
//      so they became unreachable the moment anyone had an account.
//   3. Support needs to know which build someone is on.
//
// Deliberately NOT here yet: "contact us" and "delete my account". Both
// need a working support address and we still don't have one. The old
// brand's `gratitudeapp.com` had no MX record and redirected to a different
// company's app; the new brand's `pollinateapp.xyz` isn't registered yet
// (§19.4 — Colin is buying it, tracked as pending). A row that silently goes
// nowhere is worse than an absent row, so they land when the address does.
// D2 (Sage, 2026-08-19) — the daily nudge's settings row, ship-with-the-
// nudge per that ruling and §6 row 8 of the gate. Four states, not a plain
// boolean: the switch's own truth is `permission.granted && enabled`, never
// `enabled` alone — §5's failure mode is an OS-level revoke the app never
// hears about, and a stored "on" flag with no live read is exactly the "lie
// with a toggle on it" that section warns against.
const NUDGE_UNKNOWN = 'unknown'; // not yet read — switch stays inert so it never flashes a wrong position
const NUDGE_ON = 'on';
const NUDGE_OFF = 'off'; // undetermined or granted-but-disabled: tappable, turning it on runs the one fuse (`requestPermissionAndEnable`)
const NUDGE_DENIED = 'denied'; // OS-level decline — terminal (§2 corollary), switch is locked off
const NUDGE_BUSY = 'busy';

const Row = ({ icon, label, onPress, tone }) => (
  <PressableScale onPress={onPress} accessibilityLabel={label} style={styles.row}>
    <Ionicons name={icon} size={19} color={tone === 'danger' ? theme.colors.danger : theme.colors.inkSoft} />
    <Text style={[styles.rowLabel, tone === 'danger' && styles.rowLabelDanger]}>{label}</Text>
    {tone !== 'danger' && (
      <Ionicons name="chevron-forward" size={17} color={theme.colors.textSecondary} />
    )}
  </PressableScale>
);

export const AccountScreen = ({ navigation }) => {
  const { session } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [nudgeState, setNudgeState] = useState(NUDGE_UNKNOWN);

  const displayName = session?.user?.user_metadata?.display_name ?? 'Your account';
  const email = session?.user?.email;

  // §6 row 8 — the switch's rendered state derives from a LIVE permission
  // read (this call), not the stored preference alone. Re-run on every
  // focus, not just on mount: the only way this screen finds out about an
  // OS-level revoke is by asking again when the user comes back from
  // Settings, which is a navigate-away-and-return, not a re-render.
  const refreshNudgeState = useCallback(async () => {
    const [permission, enabled] = await Promise.all([getPermissionState(), isNudgeEnabled()]);
    if (permission.status === 'denied') {
      setNudgeState(NUDGE_DENIED);
    } else if (permission.granted && enabled) {
      setNudgeState(NUDGE_ON);
    } else {
      setNudgeState(NUDGE_OFF);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshNudgeState();
    }, [refreshNudgeState]),
  );

  // The ONLY caller of `requestPermissionAndEnable` outside the Celebration
  // ask (§6 row 2c's walk: an onPress/onValueChange prop, never an effect or
  // module scope — this is one, via the Switch below). An OS decline is
  // terminal and this handler never retries it: `disabled` on the Switch
  // stops the tap from reaching here at all once `nudgeState` is DENIED.
  const handleToggleNudge = async (wantsOn) => {
    if (nudgeState === NUDGE_BUSY || nudgeState === NUDGE_DENIED) return;
    setNudgeState(NUDGE_BUSY);
    try {
      if (wantsOn) {
        const result = await requestPermissionAndEnable();
        // `requestPermissionAndEnable` sets the flag and returns — it does
        // not reconcile (§4.1's asymmetry, same one Onboarding's Celebration
        // handler works around). A live session already exists on this
        // screen, so re-arm immediately rather than waiting for the next
        // foreground: someone who flips this on and backgrounds the app has
        // the same "night one" gap the Celebration ask exists to close.
        if (result.granted) {
          await rearmDailyNudge();
        }
      } else {
        await disableDailyNudge();
      }
    } catch (err) {
      console.warn('Failed to update daily reminder', err);
    } finally {
      await refreshNudgeState();
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', "You'll need to sign in again to see your entries and your hive.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          if (signingOut) return;
          setSigningOut(true);
          try {
            await HoneycombStore.signOut();
            // Back to the front door rather than to Main — Main's tabs would
            // otherwise sit there in their signed-out gate states.
            navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
          } catch (err) {
            setSigningOut(false);
            // Authored copy, not the raw rail message (Sage, thread
            // 14492cf2 §4).
            console.warn('Failed to sign out', err);
            Alert.alert("Couldn't sign out", 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <PressableScale
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Close"
        >
          <Ionicons name="chevron-down" size={26} color={theme.colors.ink} />
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <Avatar name={displayName} avatarUrl={session?.user?.user_metadata?.avatar_url} size={72} />
          <Text style={styles.name}>{displayName}</Text>
          {email ? <Text style={styles.email}>{email}</Text> : null}
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="notifications-outline" size={19} color={theme.colors.inkSoft} />
            <View style={styles.nudgeTextGroup}>
              <Text style={styles.nudgeLabel}>Daily reminder</Text>
              {nudgeState === NUDGE_DENIED && <Text style={styles.nudgeCaption}>{NUDGE_DECLINED_LINE}</Text>}
            </View>
            <Switch
              value={nudgeState === NUDGE_ON}
              onValueChange={handleToggleNudge}
              disabled={nudgeState === NUDGE_UNKNOWN || nudgeState === NUDGE_BUSY || nudgeState === NUDGE_DENIED}
              accessibilityLabel="Daily reminder"
              trackColor={{ false: theme.colors.surfaceBorderStrong, true: theme.colors.accent }}
              thumbColor={theme.colors.surface}
              ios_backgroundColor={theme.colors.surfaceBorderStrong}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Row
            icon="lock-closed-outline"
            label="Privacy Policy"
            onPress={() => navigation.navigate('Legal', { tab: 'privacy' })}
          />
          <View style={styles.divider} />
          <Row
            icon="document-text-outline"
            label="Terms of Service"
            onPress={() => navigation.navigate('Legal', { tab: 'terms' })}
          />
        </View>

        <View style={styles.card}>
          <Row icon="log-out-outline" label={signingOut ? 'Signing out…' : 'Sign out'} onPress={handleSignOut} tone="danger" />
        </View>

        <Text style={styles.version}>Version {appConfig.expo.version}</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  content: {
    padding: 24,
    paddingTop: 12,
    paddingBottom: 60,
  },
  identity: {
    alignItems: 'center',
    marginBottom: 32,
  },
  name: {
    ...theme.type.h2,
    color: theme.colors.ink,
    marginTop: 14,
  },
  email: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    marginTop: 4,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    paddingHorizontal: 18,
    marginBottom: 16,
    ...theme.shadows.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
  },
  rowLabel: {
    ...theme.type.bodySm,
    fontFamily: theme.fonts.bodySemiBold,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  rowLabelDanger: {
    color: theme.colors.danger,
  },
  nudgeTextGroup: {
    flex: 1,
    gap: 2,
  },
  nudgeLabel: {
    ...theme.type.bodySm,
    fontFamily: theme.fonts.bodySemiBold,
    color: theme.colors.textPrimary,
  },
  nudgeCaption: {
    ...theme.type.bodySm,
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.surfaceBorder,
  },
  version: {
    ...theme.type.bodySm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});

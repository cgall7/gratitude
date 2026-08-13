import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
// react-native's own SafeAreaView is deprecated and warns on every render
// (confirmed on device — it's what raises the LogBox toast over Legal.js).
// react-native-safe-area-context is already a dependency, and React
// Navigation mounts its provider, so this is the drop-in.
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { HoneycombStore } from '../services/HoneycombStore';
import { Avatar } from '../components/Avatar';
import { PressableScale } from '../components/PressableScale';
// The shipped version number, read from the one file that defines it.
// expo-constants would be the usual source, but it isn't a dependency of
// this app (it's only a transitive dep of `expo` and isn't installed at the
// top level), and adding a package to print one string isn't worth it.
import appConfig from '../../app.json';

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

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

  const displayName = session?.user?.user_metadata?.display_name ?? 'Your account';
  const email = session?.user?.email;

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
            Alert.alert("Couldn't sign out", err.message ?? 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={HIT_SLOP} accessibilityLabel="Close">
          <Ionicons name="chevron-down" size={26} color={theme.colors.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.identity}>
          <Avatar name={displayName} avatarUrl={session?.user?.user_metadata?.avatar_url} size={72} />
          <Text style={styles.name}>{displayName}</Text>
          {email ? <Text style={styles.email}>{email}</Text> : null}
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

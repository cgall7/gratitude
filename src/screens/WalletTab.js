import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { ScreenHeader } from '../components/ScreenHeader';
import { TAB_CLEARANCE } from '../navigation/tabBarLayout';

// Project 10, the one tab Colin ruled is a shell in MVP1: "Wallet tab is a
// shell showing 'Coming Soon.' No MDK SDK integration, no funding flows, no
// tips, no transaction history." It exists now so the bar never has to change
// shape when Slice 2 fills it — a tab appearing later moves every other tab's
// hit target under people who have already learned where they are.
//
// The copy states what is true today and promises nothing. A shell that
// describes the feature it does not have is a claim you have to un-write
// later, and testers read it as shipped.
export const WalletTab = () => (
  <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    {/* No eyebrow. The other seven ScreenHeaders use it to name the thing
        below it ("SEEDS", "GRATITUDE NOTES", today's date) — there is nothing
        below this one to name yet, and the two candidates were both wrong:
        "SLICE 2" is our word, not a tester's, and any phrasing with a date in
        it is a shipping promise written into the UI. */}
    <ScreenHeader title="Wallet" />

    {/* One VoiceOver stop, not four: the label, the numeral and the badge are
        a single fact ("nothing here yet"), and read separately they announce
        a balance as if it were live. */}
    <View
      style={styles.balanceCard}
      accessible
      accessibilityLabel="Balance, $0.00. Not available yet."
    >
      <Text style={styles.balanceLabel}>BALANCE</Text>
      {/* `ink` on `washYellow`, not the `accentDeep` RecapTab gives its stat
          numerals: a dim orange zero reads as a number that failed to load
          rather than one that is genuinely nil. Bigger than Recap's stat too
          — 44 against its 34 (`RecapTab.js:337-341`) — because that 34 is one
          of three numerals sharing a row and this is the only thing on the
          screen. */}
      <Text style={styles.balance}>$0.00</Text>
      <View style={styles.pill}>
        <Text style={styles.pillText}>COMING SOON</Text>
      </View>
    </View>

    <View style={styles.note}>
      <Ionicons name="wallet-outline" size={28} color={theme.colors.inkSoft} />
      <Text style={styles.noteTitle}>Nothing to do here yet</Text>
      <Text style={styles.noteBody}>
        Money is a later chapter. For now, gratitude is the only thing that moves
        through Pollinate.
      </Text>
    </View>
  </ScrollView>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: 24,
    paddingTop: 72,
    paddingBottom: TAB_CLEARANCE,
  },
  // Deliberately the same card as RecapTab's StatsCard — washYellow, large
  // radius, 22pt of vertical air. The shell should look like the app, not
  // like a page that has not been designed yet.
  balanceCard: {
    backgroundColor: theme.colors.washYellow,
    borderRadius: theme.borderRadius.large,
    paddingVertical: 28,
    alignItems: 'center',
  },
  balanceLabel: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
  },
  balance: {
    ...theme.type.h1,
    fontSize: 44,
    lineHeight: 52,
    color: theme.colors.ink,
    marginTop: 8,
  },
  pill: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorderStrong,
  },
  pillText: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
  },
  note: {
    marginTop: 24,
    padding: 32,
    borderRadius: theme.borderRadius.large,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    alignItems: 'center',
  },
  noteTitle: {
    ...theme.type.h3,
    color: theme.colors.ink,
    marginTop: 12,
    textAlign: 'center',
  },
  noteBody: {
    ...theme.type.body,
    color: theme.colors.inkSoft,
    marginTop: 8,
    textAlign: 'center',
  },
});

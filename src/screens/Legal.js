import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { LEGAL_LAST_UPDATED, PRIVACY_POLICY, TERMS_OF_SERVICE } from '../constants/legalCopy';

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

const DOCS = { privacy: PRIVACY_POLICY, terms: TERMS_OF_SERVICE };

// In-app reader for the Privacy Policy / ToS — reachable from the signup
// consent checkbox (Onboarding.js) so agreeing is never a blind tap.
// Content itself lives in constants/legalCopy.js. The draft there is real copy,
// but four values in it are unfilled, so this screen renders honest bracketed
// gaps rather than the finished document — see LEGAL_COPY_READY.
export const LegalScreen = ({ route, navigation }) => {
  const initialTab = route?.params?.tab === 'terms' ? 'terms' : 'privacy';
  const [tab, setTab] = useState(initialTab);
  const doc = DOCS[tab];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={HIT_SLOP}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.ink} />
        </TouchableOpacity>
        <View style={styles.tabRow}>
          {[
            { key: 'privacy', label: 'Privacy Policy' },
            { key: 'terms', label: 'Terms of Service' },
          ].map((option) => {
            const selected = option.key === tab;
            return (
              <TouchableOpacity
                key={option.key}
                onPress={() => setTab(option.key)}
                style={[styles.tabChip, selected && styles.tabChipSelected]}
              >
                <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.h1}>{doc.title}</Text>
        <Text style={styles.lastUpdated}>Last updated: {LEGAL_LAST_UPDATED}</Text>
        {doc.sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.h3}>{section.heading}</Text>
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 12,
    paddingBottom: 16,
  },
  tabRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  tabChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  tabChipSelected: {
    backgroundColor: theme.colors.washYellow,
    borderColor: theme.colors.accent,
  },
  tabText: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
  },
  tabTextSelected: {
    fontFamily: theme.fonts.bodySemiBold,
    color: theme.colors.ink,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 60,
  },
  h1: {
    ...theme.type.h1,
    color: theme.colors.ink,
    marginBottom: 4,
  },
  lastUpdated: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  h3: {
    ...theme.type.h3,
    color: theme.colors.ink,
    marginBottom: 8,
  },
  body: {
    ...theme.type.body,
    color: theme.colors.inkSoft,
  },
});

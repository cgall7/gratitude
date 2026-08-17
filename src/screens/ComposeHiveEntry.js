import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { HiveStore } from '../services/HiveStore';
import { tagEntry } from '../utils/themeTagger';
import { PrimaryButton } from '../components/PrimaryButton';
import { PressableScale } from '../components/PressableScale';

// 8b.3 — compose a new entry into an existing hive (Design Language §3's
// Compose Entry Screen). Date is always today, read-only, matching the spec
// and EntryStore's own `saveEntry(new Date(), ...)` convention.
export const ComposeHiveEntryScreen = ({ navigation, route }) => {
  const { hiveId, subjectName } = route.params;
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const handleSave = async () => {
    if (saving || !text.trim()) return;
    setSaving(true);
    setError(false);
    try {
      const body = text.trim();
      await HiveStore.addHiveEntry(hiveId, new Date(), body, tagEntry(body));
      navigation.goBack();
    } catch (err) {
      console.warn('ComposeHiveEntryScreen: failed to save entry', err);
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <PressableScale onPress={() => navigation.goBack()} style={styles.backButton} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={theme.colors.ink} />
        </PressableScale>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>What's something you're grateful for about {subjectName}?</Text>
        <Text style={styles.dateLabel}>Today</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Write it here..."
          placeholderTextColor={theme.colors.inkFaint}
          value={text}
          onChangeText={setText}
          multiline
          autoFocus
          maxLength={10000}
        />
        {error && (
          <Text style={styles.errorText}>Couldn't save this entry. Check your connection and try again.</Text>
        )}
        <PrimaryButton onPress={handleSave} disabled={!text.trim() || saving} style={styles.cta}>
          Save
        </PrimaryButton>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.card,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  title: {
    ...theme.type.h2,
    color: theme.colors.ink,
    marginTop: 12,
  },
  dateLabel: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    marginTop: 12,
    marginBottom: 12,
  },
  textArea: {
    ...theme.type.body,
    color: theme.colors.ink,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.medium,
    padding: 20,
    minHeight: 200,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    textAlignVertical: 'top',
  },
  errorText: {
    ...theme.type.bodySm,
    color: theme.colors.danger,
    marginTop: 12,
  },
  cta: {
    marginTop: 20,
  },
});

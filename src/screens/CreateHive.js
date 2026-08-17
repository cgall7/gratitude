import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { HiveStore } from '../services/HiveStore';
import { tagEntry } from '../utils/themeTagger';
import { HIVE_COVER_THEMES, REVIEW_CADENCE_OPTIONS } from '../constants/hiveThemes';
import { PrimaryButton } from '../components/PrimaryButton';
import { PressableScale } from '../components/PressableScale';

// 8b.2 — Create Private Hive flow, one root-stack screen with four internal
// beats (Design Language §2), the same shape Onboarding.js already uses for
// a multi-step flow. Not a nested navigator: scripts/check-nav-depth.mjs
// asserts exactly two navigators exist app-wide, so a `createStackNavigator`
// here would be a third and silently break every getParent() call below it.
const STEPS = ['who', 'cover', 'cadence', 'entry'];

export const CreateHiveFlow = ({ navigation }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [subjectName, setSubjectName] = useState('');
  const [coverTheme, setCoverTheme] = useState(HIVE_COVER_THEMES[0].id);
  const [reviewCadence, setReviewCadence] = useState('yearly');
  const [entryText, setEntryText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const step = STEPS[stepIndex];
  const goBack = () => {
    if (stepIndex === 0) {
      navigation.goBack();
      return;
    }
    setStepIndex((i) => i - 1);
  };
  const goNext = () => setStepIndex((i) => i + 1);

  const finish = async (withEntry) => {
    if (saving) return;
    setSaving(true);
    setSaveError(false);
    try {
      const hive = await HiveStore.createHive(subjectName, { coverTheme, reviewCadence });
      const body = withEntry ? entryText.trim() : '';
      if (body) {
        await HiveStore.addHiveEntry(hive.id, new Date(), body, tagEntry(body));
      }
      navigation.navigate('Main', { screen: 'Today' });
    } catch (err) {
      console.warn('CreateHiveFlow: failed to create hive', err);
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, step !== 'who' && styles.containerCream]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <PressableScale onPress={goBack} style={styles.backButton} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color={theme.colors.ink} />
        </PressableScale>
      </View>

      {step === 'who' && (
        <View style={styles.content}>
          <Text style={styles.title}>Who are you creating this hive for?</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Their name"
            placeholderTextColor={theme.colors.inkFaint}
            value={subjectName}
            onChangeText={setSubjectName}
            autoFocus
            maxLength={100}
          />
          <Text style={styles.helpText}>
            You'll be the only one who sees this hive unless you choose to send it later.
          </Text>
          <PrimaryButton onPress={goNext} disabled={!subjectName.trim()} style={styles.cta}>
            Next
          </PrimaryButton>
        </View>
      )}

      {step === 'cover' && (
        <View style={styles.content}>
          <Text style={styles.title}>Pick a cover that feels right for {subjectName.trim()}.</Text>
          <View style={styles.themeGrid}>
            {HIVE_COVER_THEMES.map((themeOption) => {
              const selected = themeOption.id === coverTheme;
              return (
                <PressableScale
                  key={themeOption.id}
                  onPress={() => setCoverTheme(themeOption.id)}
                  style={[
                    styles.themeCard,
                    { backgroundColor: themeOption.base },
                    selected && styles.themeCardSelected,
                  ]}
                  accessibilityLabel={`${themeOption.label} cover${selected ? ', selected' : ''}`}
                >
                  {selected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={theme.colors.ink}
                      style={styles.themeCheck}
                    />
                  )}
                  <Text style={[styles.themeLabel, { color: themeOption.textColor }]}>
                    {themeOption.label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
          <PrimaryButton onPress={goNext} style={styles.cta}>
            Next
          </PrimaryButton>
        </View>
      )}

      {step === 'cadence' && (
        <View style={styles.content}>
          <Text style={styles.title}>How often would you like to review this hive?</Text>
          {REVIEW_CADENCE_OPTIONS.map((option) => {
            const selected = option.id === reviewCadence;
            return (
              <PressableScale
                key={option.id}
                onPress={() => setReviewCadence(option.id)}
                style={[styles.cadenceCard, selected && styles.cadenceCardSelected]}
                accessibilityLabel={`${option.label}, ${option.subtitle}${selected ? ', selected' : ''}`}
              >
                <View style={[styles.radio, selected && styles.radioSelected]} />
                <View style={styles.cadenceText}>
                  <Text style={styles.cadenceTitle}>{option.label}</Text>
                  <Text style={styles.cadenceSubtitle}>{option.subtitle}</Text>
                </View>
              </PressableScale>
            );
          })}
          <PrimaryButton onPress={goNext} style={styles.cta}>
            Create Hive
          </PrimaryButton>
        </View>
      )}

      {step === 'entry' && (
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Add an entry now, or start later.</Text>
          <TextInput
            style={styles.textArea}
            placeholder={`What's something you're grateful for about ${subjectName.trim()}?`}
            placeholderTextColor={theme.colors.inkFaint}
            value={entryText}
            onChangeText={setEntryText}
            multiline
            maxLength={10000}
          />
          {saveError && (
            <Text style={styles.errorText}>Couldn't save the hive. Check your connection and try again.</Text>
          )}
          <PrimaryButton
            onPress={() => finish(true)}
            disabled={saving}
            style={styles.cta}
          >
            {entryText.trim() ? 'Save & Start Writing' : 'Save & Start Writing'}
          </PrimaryButton>
          <PressableScale
            onPress={() => finish(false)}
            disabled={saving}
            style={styles.skipLink}
            accessibilityLabel="Skip and go to Today"
          >
            <Text style={styles.skipLinkText}>Skip & Go to Today</Text>
          </PressableScale>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.washYellow,
  },
  containerCream: {
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
    ...theme.type.h1,
    color: theme.colors.ink,
    marginTop: 12,
    marginBottom: 20,
  },
  textInput: {
    ...theme.type.h2,
    color: theme.colors.ink,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.medium,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  helpText: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    marginTop: 16,
  },
  cta: {
    marginTop: 'auto',
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  themeCard: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: theme.borderRadius.medium,
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  themeCardSelected: {
    borderWidth: 3,
    borderColor: theme.colors.accent,
  },
  themeCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  themeLabel: {
    ...theme.type.bodySm,
    textAlign: 'center',
  },
  cadenceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.medium,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
  },
  cadenceCardSelected: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.washYellow,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: theme.borderRadius.full,
    borderWidth: 2,
    borderColor: theme.colors.surfaceBorderStrong,
    marginRight: 14,
  },
  radioSelected: {
    borderColor: theme.colors.ink,
    backgroundColor: theme.colors.ink,
  },
  cadenceText: {
    flexShrink: 1,
  },
  cadenceTitle: {
    ...theme.type.h3,
    color: theme.colors.ink,
  },
  cadenceSubtitle: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    marginTop: 2,
  },
  textArea: {
    ...theme.type.body,
    color: theme.colors.ink,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.medium,
    padding: 20,
    minHeight: 160,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    textAlignVertical: 'top',
  },
  errorText: {
    ...theme.type.bodySm,
    color: theme.colors.danger,
    marginTop: 12,
  },
  skipLink: {
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
  },
  skipLinkText: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
  },
});

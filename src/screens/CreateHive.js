import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { HiveStore } from '../services/HiveStore';
import { tagEntry } from '../utils/themeTagger';
import { HIVE_COVER_THEMES, REVIEW_CADENCE_OPTIONS } from '../constants/hiveThemes';
import { PrimaryButton } from '../components/PrimaryButton';
import { PressableScale } from '../components/PressableScale';
import { GradientCard } from '../components/GradientCard';
import { BackButton } from '../components/BackButton';
import { LinkButton } from '../components/LinkButton';
import { SPRINGS } from '../constants/motion';

// E6 — the checkmark used to pop in with no transition, simultaneous with
// the E5 border-width jump. Border width is now constant (see
// `themeCard`/`themeCardSelected`), so this is the only motion on select,
// and it gets to be the whole event: a spring pop, not a hard cut.
const SelectedCheck = () => {
  const scale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...SPRINGS.pop }).start();
  }, [scale]);
  return (
    <Animated.View style={[styles.themeCheck, { transform: [{ scale }] }]}>
      <Ionicons name="checkmark-circle" size={22} color={theme.colors.ink} />
    </Animated.View>
  );
};

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
  // E13 — leaving step 0 exits the flow entirely and every other state
  // (subjectName, entryText) resets with it. Stepping back within the flow
  // (stepIndex > 0) never loses anything, since this component's state
  // persists across steps, so only the exit itself needs a guard.
  const goBack = () => {
    if (stepIndex === 0) {
      if (subjectName.trim()) {
        Alert.alert('Discard this hive?', "You'll lose what you've entered so far.", [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        ]);
        return;
      }
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
      // E12 — land inside the hive you just made, not on Today. Deezine is
      // scoring the arrival ceremony separately; this is just the
      // navigation it will land on top of.
      navigation.navigate('HiveDetail', { hiveId: hive.id });
    } catch (err) {
      console.warn('CreateHiveFlow: failed to create hive', err);
      setSaveError(true);
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
        <BackButton onPress={goBack} />
      </View>

      {/* E9 — four steps, no way to see how much of this you've committed
          to. Dots, not a bar: the flow is a short fixed count of beats, not
          a continuous fraction. */}
      <View style={styles.progressRow} accessible={false} importantForAccessibility="no-hide-descendants">
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.progressDot, i <= stepIndex && styles.progressDotActive]} />
        ))}
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
                  style={[styles.themeCard, selected && styles.themeCardSelected]}
                  accessibilityLabel={`${themeOption.label} cover${selected ? ', selected' : ''}`}
                >
                  {/* E2/E3 — the cover never touches the page. It's an inset
                      fill inside this `surface` mat (the mat is what
                      `themeCard`'s own background renders), so separation is
                      always cover-vs-white regardless of which ground the
                      picker sits on, or which cover gets added next. The
                      hairline rim + sheen are the material; the mat is the
                      frame. */}
                  <GradientCard
                    style={styles.themeMaterial}
                    contentStyle={[styles.themeFill, { backgroundColor: themeOption.base }]}
                    colors={theme.gradients.sheen}
                  >
                    {selected && <SelectedCheck />}
                    <Text style={[styles.themeLabel, { color: themeOption.textColor }]}>
                      {themeOption.label}
                    </Text>
                  </GradientCard>
                </PressableScale>
              );
            })}
          </View>
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
        </ScrollView>
      )}

      {/* E10 — this footer sits outside every step's content container
          (a plain View for the first three steps, a ScrollView for
          'entry'), so it's the one CTA anchor point that's never asked to
          pin itself inside a ScrollView, where `marginTop: 'auto'` is a
          no-op. Every step renders through this same footer instead of
          carrying its own pinned button. */}
      <View style={styles.footer}>
        {step === 'entry' && saveError && (
          <Text style={styles.errorText}>Couldn't save the hive. Check your connection and try again.</Text>
        )}
        {step === 'who' && (
          <PrimaryButton onPress={goNext} disabled={!subjectName.trim()}>
            Next
          </PrimaryButton>
        )}
        {step === 'cover' && <PrimaryButton onPress={goNext}>Next</PrimaryButton>}
        {step === 'cadence' && <PrimaryButton onPress={goNext}>Create Hive</PrimaryButton>}
        {step === 'entry' && (
          <>
            <PrimaryButton onPress={() => finish(true)} loading={saving}>
              Save & Start Writing
            </PrimaryButton>
            <LinkButton
              onPress={() => finish(false)}
              disabled={saving}
              style={styles.skipLink}
              accessibilityLabel="Skip writing an entry and open the new hive"
            >
              Skip for Now
            </LinkButton>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // E8 — one ground for all four steps. `washYellow` is `theme.js`'s own
    // "activation staging included" wash; a creation flow is exactly that.
    // The old per-step swap (`background` on steps 2-4) was too small a
    // shift to read as intent and just large enough to read as a glitch.
    backgroundColor: theme.colors.washYellow,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 16,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.surfaceBorderStrong,
  },
  progressDotActive: {
    backgroundColor: theme.colors.ink,
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
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  themeCard: {
    // 48 + 48 = 96% < 100%: two per row can never overflow regardless of
    // container width, because the slack is distributed by
    // `justifyContent` instead of added by a `gap` on top of a fitted
    // percentage (E4 — the three-across grid silently reflowed to two on
    // narrower devices and always rendered an orphan 4th card either way).
    width: '48%',
    aspectRatio: 1,
    marginBottom: 12,
    borderRadius: theme.borderRadius.medium,
    // E2/E3 — this is the mat, not the cover. `surface` white is the frame
    // every cover material insets into, so cover-vs-ground separation is
    // always cover-vs-white and never depends on which page ground a cover
    // happens to share a value with.
    backgroundColor: theme.colors.surface,
    padding: 6,
    ...theme.shadows.card,
    // E5 — border width is constant at 3 whether selected or not, so
    // selecting a card never shifts its contents. Unselected sits at
    // transparent; the visible rim is a colour change, not a layout change.
    borderWidth: 3,
    borderColor: 'transparent',
  },
  themeCardSelected: {
    // E7 — §4's law is "yellow never fills it"; a border is a fill of the
    // edge. `ink` also reads at higher contrast against these near-white
    // covers than `accent` ever did.
    borderColor: theme.colors.ink,
  },
  themeMaterial: {
    flex: 1,
  },
  themeFill: {
    flex: 1,
    borderRadius: theme.borderRadius.medium - 6,
    // The hairline rim Lumen's ruling calls for on every cover surface —
    // separation is guaranteed by the rim regardless of the base value,
    // rather than depending on anyone re-checking ΔE00 by eye forever.
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorderStrong,
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 10,
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
    alignSelf: 'center',
    marginTop: 16,
  },
});

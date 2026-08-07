import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { theme } from '../constants/theme';

const { width } = Dimensions.get('window');

// Illustrative daily-check habits used to personalize the Impact step.
// Framed positively (time reclaimed for gratitude), not as screen-time shame.
const HABITS = [
  { key: 'social', label: 'Social media', checksPerDay: 96, hoursPerDay: 2.5 },
  { key: 'news', label: 'News & headlines', checksPerDay: 40, hoursPerDay: 1.2 },
  { key: 'video', label: 'Video / streaming', checksPerDay: 50, hoursPerDay: 2.0 },
  { key: 'games', label: 'Games', checksPerDay: 30, hoursPerDay: 1.5 },
  { key: 'other', label: 'Something else', checksPerDay: 60, hoursPerDay: 1.8 },
];

const RITUAL_TIMES = ['6:30 AM', '7:00 AM', '7:30 AM', '8:00 AM'];

// --- Shared shell: progress dots + animated step transitions + single CTA ---
const StepShell = ({ step, total, onBack, children }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  React.useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(16);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 60, useNativeDriver: true }),
    ]).start();
  }, [step]);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
        <View style={styles.progressRow}>
          {Array.from({ length: total }).map((_, i) => (
            <View
              key={i}
              style={[styles.progressDot, i <= step ? styles.progressDotActive : null]}
            />
          ))}
        </View>
        <View style={{ width: 24 }} />
      </View>

      <Animated.View style={[styles.stepBody, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {children}
      </Animated.View>
    </View>
  );
};

// --- Step 1: show the value before asking for any effort ---
const WelcomeStep = ({ onNext }) => (
  <StepShell step={0} total={6}>
    <View style={styles.centerFill}>
      <View style={styles.heroGlow} />
      <Text style={styles.logo}>gratitude</Text>
      <Text style={styles.heroHeadline}>Trade one scroll for one thought.</Text>
      <Text style={styles.heroSub}>
        Every morning, gratitude gently locks your most distracting apps until you pause
        and name one thing you're grateful for. Then your day unlocks.
      </Text>
    </View>
    <TouchableOpacity style={styles.primaryButton} onPress={onNext}>
      <Text style={styles.primaryButtonText}>Show Me How</Text>
    </TouchableOpacity>
  </StepShell>
);

// --- Step 2: ask only a useful question — it drives the next screen's stat ---
const HabitStep = ({ onNext, onBack, onPick }) => (
  <StepShell step={1} total={6} onBack={onBack}>
    <Text style={styles.question}>What pulls you in first every morning?</Text>
    <Text style={styles.questionSub}>We'll use this to show what you could reclaim.</Text>
    <View style={styles.choiceList}>
      {HABITS.map((habit) => (
        <TouchableOpacity
          key={habit.key}
          style={styles.choiceCard}
          onPress={() => {
            onPick(habit);
            onNext();
          }}
        >
          <Text style={styles.choiceText}>{habit.label}</Text>
          <Text style={styles.choiceChevron}>→</Text>
        </TouchableOpacity>
      ))}
    </View>
  </StepShell>
);

// --- Step 3: make it personal — mirror their answer back as a concrete, positive stat ---
const ImpactStep = ({ habit, onNext, onBack }) => {
  const hoursPerYear = Math.round(habit.hoursPerDay * 365);
  return (
    <StepShell step={2} total={6} onBack={onBack}>
      <View style={styles.centerFill}>
        <Text style={styles.statLabel}>{habit.label.toUpperCase()}</Text>
        <Text style={styles.statBig}>{habit.checksPerDay}x</Text>
        <Text style={styles.statCaption}>a day, on average</Text>
        <View style={styles.statDivider} />
        <Text style={styles.statBig}>{hoursPerYear} hrs</Text>
        <Text style={styles.statCaption}>you could give back to what matters this year</Text>
      </View>
      <TouchableOpacity style={styles.primaryButton} onPress={onNext}>
        <Text style={styles.primaryButtonText}>I Want That Back</Text>
      </TouchableOpacity>
    </StepShell>
  );
};

// --- Step 4: one clear action — pick when the ritual locks in each morning ---
const ScheduleStep = ({ onNext, onBack, onPick }) => (
  <StepShell step={3} total={6} onBack={onBack}>
    <Text style={styles.question}>When should gratitude start your day?</Text>
    <Text style={styles.questionSub}>Your chosen apps lock until you reflect.</Text>
    <View style={styles.chipGrid}>
      {RITUAL_TIMES.map((t) => (
        <TouchableOpacity
          key={t}
          style={styles.chip}
          onPress={() => {
            onPick(t);
            onNext();
          }}
        >
          <Text style={styles.chipText}>{t}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </StepShell>
);

// --- Step 5: the activation moment — let them actually do the core action now ---
const TryItStep = ({ onNext, onBack, onSave }) => {
  const [text, setText] = useState('');
  const unlockAnim = useRef(new Animated.Value(0)).current;

  const handleUnlock = () => {
    if (!text.trim()) return;
    Animated.timing(unlockAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start(() => {
      onSave(text.trim());
      onNext();
    });
  };

  return (
    <StepShell step={4} total={6} onBack={onBack}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.fillBetween}
      >
        <View>
          <Text style={styles.question}>Try it right now.</Text>
          <Text style={styles.questionSub}>What's one thing you're grateful for today?</Text>
          <View style={styles.inputCard}>
            <TextInput
              style={styles.textInput}
              placeholder="I am grateful for..."
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              value={text}
              onChangeText={setText}
              autoFocus
            />
          </View>
        </View>
        <Animated.View style={{ opacity: text.trim() ? 1 : 0.4 }}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.colors.pop }]}
            onPress={handleUnlock}
            disabled={!text.trim()}
          >
            <Text style={[styles.primaryButtonText, { color: theme.colors.textInverse }]}>
              Unlock My Day
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </StepShell>
  );
};

// --- Step 6: end with a meaningful result, not a blank "you're all set" screen ---
const CompleteStep = ({ entry, ritualTime, onDone }) => (
  <StepShell step={5} total={6}>
    <View style={styles.centerFill}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>DAY 1</Text>
      </View>
      <Text style={styles.completeHeadline}>Your first moment is locked in.</Text>
      <View style={styles.recapCard}>
        <Text style={styles.recapQuote}>"{entry}"</Text>
      </View>
      <Text style={styles.completeSub}>
        gratitude will greet you at {ritualTime} tomorrow. Show up, reflect, and the rest of your
        day unlocks.
      </Text>
    </View>
    <TouchableOpacity style={styles.primaryButton} onPress={onDone}>
      <Text style={styles.primaryButtonText}>Enter gratitude</Text>
    </TouchableOpacity>
  </StepShell>
);

// --- Controller: owns the answers, drives the six single-action steps ---
export const OnboardingFlow = ({ onDone }) => {
  const [step, setStep] = useState(0);
  const [habit, setHabit] = useState(HABITS[0]);
  const [ritualTime, setRitualTime] = useState(RITUAL_TIMES[1]);
  const [entry, setEntry] = useState('');

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => Math.max(0, s - 1));

  switch (step) {
    case 0:
      return <WelcomeStep onNext={next} />;
    case 1:
      return <HabitStep onNext={next} onBack={back} onPick={setHabit} />;
    case 2:
      return <ImpactStep habit={habit} onNext={next} onBack={back} />;
    case 3:
      return <ScheduleStep onNext={next} onBack={back} onPick={setRitualTime} />;
    case 4:
      return <TryItStep onNext={next} onBack={back} onSave={setEntry} />;
    default:
      return <CompleteStep entry={entry} ritualTime={ritualTime} onDone={onDone} />;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  backArrow: {
    fontSize: 22,
    color: theme.colors.textPrimary,
    width: 24,
  },
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.surfaceBorder,
  },
  progressDotActive: {
    backgroundColor: theme.colors.accent,
  },
  stepBody: {
    flex: 1,
    justifyContent: 'space-between',
  },
  fillBetween: {
    flex: 1,
    justifyContent: 'space-between',
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGlow: {
    position: 'absolute',
    width: width * 1.3,
    height: width * 1.3,
    borderRadius: width,
    backgroundColor: theme.colors.accent,
    opacity: 0.18,
    top: -width * 0.5,
  },
  logo: {
    fontFamily: theme.fonts.logo,
    fontSize: 48,
    color: theme.colors.textPrimary,
    marginBottom: 24,
  },
  heroHeadline: {
    fontFamily: theme.fonts.header,
    fontSize: 28,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  heroSub: {
    fontFamily: theme.fonts.body,
    fontSize: 17,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 12,
  },
  question: {
    fontFamily: theme.fonts.header,
    fontSize: 26,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  questionSub: {
    fontFamily: theme.fonts.body,
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 32,
  },
  choiceList: {
    gap: 12,
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.medium,
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  choiceText: {
    fontFamily: theme.fonts.body,
    fontSize: 18,
    color: theme.colors.textPrimary,
    fontWeight: '500',
  },
  choiceChevron: {
    fontSize: 18,
    color: theme.colors.accent,
  },
  statLabel: {
    fontFamily: theme.fonts.body,
    fontSize: 13,
    letterSpacing: 3,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  statBig: {
    fontFamily: theme.fonts.header,
    fontSize: 56,
    color: theme.colors.accent,
  },
  statCaption: {
    fontFamily: theme.fonts.body,
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  statDivider: {
    width: 40,
    height: 1,
    backgroundColor: theme.colors.surfaceBorder,
    marginVertical: 24,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chip: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.full,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  chipText: {
    fontFamily: theme.fonts.body,
    fontSize: 16,
    color: theme.colors.textPrimary,
    fontWeight: '500',
  },
  inputCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 24,
    minHeight: 160,
  },
  textInput: {
    fontFamily: theme.fonts.body,
    fontSize: 19,
    color: theme.colors.textPrimary,
    textAlignVertical: 'top',
  },
  badge: {
    backgroundColor: theme.colors.gold,
    borderRadius: theme.borderRadius.full,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  badgeText: {
    fontFamily: theme.fonts.header,
    fontSize: 13,
    letterSpacing: 2,
    color: theme.colors.textInverse,
  },
  completeHeadline: {
    fontFamily: theme.fonts.header,
    fontSize: 26,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 24,
  },
  recapCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 24,
    marginBottom: 24,
  },
  recapQuote: {
    fontFamily: theme.fonts.body,
    fontSize: 18,
    fontStyle: 'italic',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    lineHeight: 26,
  },
  completeSub: {
    fontFamily: theme.fonts.body,
    fontSize: 15,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  primaryButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 20,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 8,
  },
  primaryButtonText: {
    fontFamily: theme.fonts.header,
    fontSize: 17,
    color: theme.colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

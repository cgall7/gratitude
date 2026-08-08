import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { EntryStore } from '../services/EntryStore';
import { tagEntry } from '../utils/themeTagger';
import { PressableScale } from '../components/PressableScale';
import { StaggeredItem } from '../components/StaggeredItem';
import { PrimaryButton } from '../components/PrimaryButton';
import { SegmentedProgress } from '../components/SegmentedProgress';
import { CelebrationBadge } from '../components/CelebrationBadge';
import { CelebrationRays } from '../components/CelebrationRays';
import { IdeasAccordion } from '../components/IdeasAccordion';

const TOTAL_STEPS = 6;
const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

const WHY_OPTIONS = ['Sleep better', 'Less stress', 'Notice the good', 'Just curious'];

const RITUAL_TIMES = [
  { key: 'morning', icon: 'sunny', label: 'Morning', caption: 'Start the day grounded' },
  { key: 'midday', icon: 'partly-sunny', label: 'Midday', caption: 'A pause in the middle' },
  { key: 'evening', icon: 'moon', label: 'Evening', caption: 'Wind down and reflect' },
];

// --- Shared shell: wash background + segmented progress + animated step transitions ---
const StepShell = ({ step, wash, onBack, children }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(16);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 60, useNativeDriver: true }),
    ]).start();
  }, [step]);

  return (
    <View style={[styles.container, { backgroundColor: wash }]}>
      <View style={styles.topBar}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={HIT_SLOP}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.ink} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backSpacer} />
        )}
        <SegmentedProgress total={TOTAL_STEPS} current={step} />
      </View>

      <Animated.View style={[styles.stepBody, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {children}
      </Animated.View>
    </View>
  );
};

// --- Step 1: Welcome — show the value before asking for any effort ---
const WelcomeStep = ({ onNext }) => (
  <StepShell step={0} wash={theme.colors.washYellow}>
    <View style={styles.centerFill}>
      <Text style={styles.wordmark}>Gratitude</Text>
      <Text style={styles.h1Center}>A brighter way to end your day.</Text>
    </View>
    <PrimaryButton onPress={onNext}>Begin</PrimaryButton>
  </StepShell>
);

// --- Step 2: Name — one useful question, used to personalize later screens ---
const NameStep = ({ name, onChangeName, onNext, onBack }) => (
  <StepShell step={1} wash={theme.colors.washYellow} onBack={onBack}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.fillBetween}>
      <View style={styles.topContent}>
        <Text style={styles.h1}>What should we call you?</Text>
        <View style={styles.inputCard}>
          <TextInput
            style={styles.nameInput}
            placeholder="Your name"
            placeholderTextColor={theme.colors.inkSoft}
            value={name}
            onChangeText={onChangeName}
            autoFocus
            returnKeyType="done"
          />
        </View>
      </View>
      <PrimaryButton onPress={onNext} disabled={!name.trim()}>Next</PrimaryButton>
    </KeyboardAvoidingView>
  </StepShell>
);

// --- Step 3: Why — one-tap chips, personalizes the activation screen's copy ---
const WhyStep = ({ why, onPick, onNext, onBack }) => (
  <StepShell step={2} wash={theme.colors.washYellow} onBack={onBack}>
    <View style={styles.fillBetween}>
      <View style={styles.topContent}>
        <Text style={styles.h1}>What brought you here?</Text>
        <Text style={styles.bodySm}>This just helps us get to know you.</Text>
        <View style={styles.chipGrid}>
          {WHY_OPTIONS.map((option, index) => {
            const selected = option === why;
            return (
              <StaggeredItem key={option} index={index}>
                <PressableScale style={[styles.chip, selected && styles.chipSelected]} onPress={() => onPick(option)}>
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option}</Text>
                </PressableScale>
              </StaggeredItem>
            );
          })}
        </View>
      </View>
      <PrimaryButton onPress={onNext} disabled={!why}>Next</PrimaryButton>
    </View>
  </StepShell>
);

// --- Step 4: Ritual time — one clear action, sets the daily check-in ---
const RitualTimeStep = ({ ritualTime, onPick, onNext, onBack }) => (
  <StepShell step={3} wash={theme.colors.washYellow} onBack={onBack}>
    <View style={styles.fillBetween}>
      <View style={styles.topContent}>
        <Text style={styles.h1}>When's your moment?</Text>
        <Text style={styles.bodySm}>We'll check in once a day, gently.</Text>
        <View style={styles.ritualList}>
          {RITUAL_TIMES.map((option, index) => {
            const selected = option.key === ritualTime;
            return (
              <StaggeredItem key={option.key} index={index}>
                <PressableScale
                  style={[styles.ritualCard, selected && styles.ritualCardSelected]}
                  onPress={() => onPick(option.key)}
                >
                  <View style={[styles.iconCircle, selected && styles.iconCircleSelected]}>
                    <Ionicons name={option.icon} size={22} color={theme.colors.ink} />
                  </View>
                  <View style={styles.ritualText}>
                    <Text style={styles.h3}>{option.label}</Text>
                    <Text style={styles.bodySmMuted}>{option.caption}</Text>
                  </View>
                </PressableScale>
              </StaggeredItem>
            );
          })}
        </View>
      </View>
      <PrimaryButton onPress={onNext} disabled={!ritualTime}>Next</PrimaryButton>
    </View>
  </StepShell>
);

// --- Step 5: First entry — the activation moment. Everything funnels here. ---
const FirstEntryStep = ({ name, onNext, onBack, onSave }) => {
  const [text, setText] = useState('');
  const canSave = !!text.trim();

  const handleSave = () => {
    if (!canSave) return;
    onSave(text.trim());
    onNext();
  };

  return (
    <StepShell step={4} wash={theme.colors.washPeach} onBack={onBack}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.fillBetween}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.h1}>
            {name.trim() ? `${name.trim()}, what's one good thing from today?` : "What's one good thing from today?"}
          </Text>
          <View style={styles.inputCard}>
            <TextInput
              style={styles.entryInput}
              placeholder="I'm grateful for..."
              placeholderTextColor={theme.colors.inkSoft}
              multiline
              value={text}
              onChangeText={setText}
              autoFocus
            />
          </View>
          <IdeasAccordion onPick={(spark) => setText(`I'm grateful for ${spark}.`)} />
        </ScrollView>
        <PrimaryButton onPress={handleSave} disabled={!canSave} style={styles.floatingButton}>
          Save
        </PrimaryButton>
      </KeyboardAvoidingView>
    </StepShell>
  );
};

// --- Step 6: Celebration — always the first-ever-save treatment (screen 5's ---
// --- save IS the first-ever save), never the bare badge. ---
const CelebrationStep = ({ name, onDone }) => (
  <StepShell step={5} wash={theme.colors.washPeach}>
    <View style={styles.centerFill}>
      <View style={styles.badgeStage}>
        <CelebrationRays />
        <CelebrationBadge />
      </View>
      <Text style={styles.h1Center}>That's your first entry{name.trim() ? `, ${name.trim()}` : ''}.</Text>
      <Text style={styles.bodyLgCenter}>Come back tomorrow — this is how it starts to add up.</Text>
    </View>
    <PrimaryButton onPress={onDone}>See my Today</PrimaryButton>
  </StepShell>
);

// --- Controller: owns the answers, drives the six single-action steps ---
export const OnboardingFlow = ({ onDone }) => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [why, setWhy] = useState(null);
  const [ritualTime, setRitualTime] = useState(null);

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => Math.max(0, s - 1));

  const handleSaveEntry = (text) => {
    EntryStore.saveEntry(new Date(), text, tagEntry(text));
  };

  switch (step) {
    case 0:
      return <WelcomeStep onNext={next} />;
    case 1:
      return <NameStep name={name} onChangeName={setName} onNext={next} onBack={back} />;
    case 2:
      return <WhyStep why={why} onPick={setWhy} onNext={next} onBack={back} />;
    case 3:
      return <RitualTimeStep ritualTime={ritualTime} onPick={setRitualTime} onNext={next} onBack={back} />;
    case 4:
      return <FirstEntryStep name={name} onNext={next} onBack={back} onSave={handleSaveEntry} />;
    default:
      return <CelebrationStep name={name} onDone={onDone} />;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: theme.spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 32,
  },
  backSpacer: {
    width: 24,
  },
  stepBody: {
    flex: 1,
    justifyContent: 'space-between',
  },
  fillBetween: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topContent: {
    gap: 8,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    ...theme.type.logo,
    color: theme.colors.ink,
    marginBottom: 24,
  },
  h1: {
    ...theme.type.h1,
    color: theme.colors.ink,
    marginBottom: 8,
  },
  h1Center: {
    ...theme.type.h1,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  bodySm: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    marginBottom: 24,
  },
  bodySmMuted: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
  },
  bodyLgCenter: {
    ...theme.type.bodyLg,
    color: theme.colors.inkSoft,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
  },
  h3: {
    ...theme.type.h3,
    color: theme.colors.ink,
  },
  inputCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.medium,
    padding: theme.spacing.lg,
    marginTop: 16,
    marginBottom: 20,
    ...theme.shadows.card,
  },
  nameInput: {
    fontFamily: theme.fonts.body,
    fontSize: 19,
    color: theme.colors.ink,
  },
  entryInput: {
    fontFamily: theme.fonts.body,
    fontSize: 19,
    color: theme.colors.ink,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  chip: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.full,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  chipSelected: {
    backgroundColor: theme.colors.washYellow,
    borderColor: theme.colors.accent,
  },
  chipText: {
    fontFamily: theme.fonts.bodyMedium,
    fontSize: 15,
    color: theme.colors.ink,
  },
  chipTextSelected: {
    fontFamily: theme.fonts.bodySemiBold,
  },
  ritualList: {
    gap: 12,
    marginTop: 16,
  },
  ritualCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.medium,
    padding: 16,
    ...theme.shadows.card,
  },
  ritualCardSelected: {
    borderColor: theme.colors.accent,
    borderWidth: 2,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.washYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleSelected: {
    backgroundColor: theme.colors.accent,
  },
  ritualText: {
    gap: 2,
  },
  badgeStage: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  floatingButton: {
    marginTop: 16,
  },
});

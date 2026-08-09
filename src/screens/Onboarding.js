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
import { BeeTransition } from '../components/BeeTransition';
import { DevSettings } from '../services/devSettings';
import { HoneycombStore } from '../services/HoneycombStore';
import { useAuth } from '../contexts/AuthContext';

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

// Flow B claim screens (GUIDES/GRATITUDE_FLOW_B_COPY.md, Pixel gate R5) —
// frozen copy + frozen accentDeep phrase per screen. Slots between Welcome
// and Name; everything after Name is shared with Flow A.
const CLAIM_SCREENS = [
  {
    icon: 'moon',
    label: 'ONE REASON',
    h1: 'Your mind quiets down before it winds down.',
    accent: 'quiets down',
    bodyLg:
      "Naming one good thing tonight gives your thoughts somewhere to land — so they're not still circling when your head hits the pillow.",
    cta: 'Next',
  },
  {
    icon: 'cloud',
    label: 'ANOTHER REASON',
    h1: 'Worry takes up less room when good things get named.',
    accent: 'less room',
    bodyLg:
      "Naming one thing that went right doesn't erase a hard day. It just stops the hard part from being the whole story.",
    cta: 'Next',
  },
  {
    icon: 'leaf',
    label: 'ANOTHER REASON',
    h1: 'Bad days get easier to bounce back from.',
    accent: 'bounce back',
    bodyLg:
      "The more good you've noticed on ordinary days, the more you have to stand on when a rough one shows up.",
    cta: 'Next',
  },
  {
    icon: 'heart',
    label: 'LAST REASON',
    h1: 'The people you notice, you hold onto.',
    accent: 'hold onto',
    bodyLg: 'Naming who made today a little better is a small habit that quietly keeps you close to them.',
    cta: "Let's begin",
  },
];

// Splits an h1 on its frozen accent phrase and renders that span in
// accentDeep — ONE word/phrase may carry the color, per §9.
const renderAccentH1 = (text, accent) => {
  const i = text.indexOf(accent);
  if (i === -1) return text;
  return [
    text.slice(0, i),
    <Text key="accent" style={{ color: theme.colors.accentDeep }}>
      {accent}
    </Text>,
    text.slice(i + accent.length),
  ];
};

const WHY_OPTIONS = ['Sleep better', 'Less stress', 'Notice the good', 'Just curious'];

const RITUAL_TIMES = [
  { key: 'morning', icon: 'sunny', label: 'Morning', caption: 'Start the day grounded' },
  { key: 'midday', icon: 'partly-sunny', label: 'Midday', caption: 'A pause in the middle' },
  { key: 'evening', icon: 'moon', label: 'Evening', caption: 'Wind down and reflect' },
];

// --- Shared shell: wash background + segmented progress + animated step transitions ---
const StepShell = ({ step, total, wash, onBack, children }) => {
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
        <SegmentedProgress total={total} current={step} />
      </View>

      <Animated.View style={[styles.stepBody, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {children}
      </Animated.View>
    </View>
  );
};

// --- Step 1: Welcome — show the value before asking for any effort ---
// Demo-mode only: a visible A/B picker so anyone running the app can switch
// flows without knowing the hidden 5-tap gesture (DevVersionTag). Sits below
// the value prop so it never competes with the actual pitch.
const FlowToggle = ({ flow, onChange }) => (
  <View style={styles.flowToggleRow}>
    {['A', 'B'].map((option) => {
      const selected = option === flow;
      return (
        <PressableScale
          key={option}
          onPress={() => onChange(option)}
          style={[styles.flowToggleChip, selected && styles.flowToggleChipSelected]}
        >
          <Text style={[styles.flowToggleText, selected && styles.flowToggleTextSelected]}>
            Flow {option}
          </Text>
        </PressableScale>
      );
    })}
  </View>
);

// Demo-mode only: lets Colin jump straight to the logged-in experience
// without clicking through every step when he just wants to show that
// side of the app. Sits under the main CTA so "Begin" stays the obvious
// first choice.
const WelcomeStep = ({ step, total, onNext, flow, onChangeFlow, onSkipDemo }) => (
  <StepShell step={step} total={total} wash={theme.colors.washYellow}>
    <View style={styles.centerFill}>
      <Text style={styles.wordmark}>Gratitude</Text>
      <Text style={styles.h1Center}>A brighter way to end your day.</Text>
    </View>
    <FlowToggle flow={flow} onChange={onChangeFlow} />
    <PrimaryButton onPress={onNext}>Begin</PrimaryButton>
    <PressableScale onPress={onSkipDemo} style={styles.skipDemoLink}>
      <Text style={styles.skipDemoText}>Skip to the logged-in view (demo)</Text>
    </PressableScale>
  </StepShell>
);

// --- Flow B, screens B1–B4: the case for why gratitude matters, one claim ---
// --- per screen, before the Name ask (GUIDES/GRATITUDE_FLOW_B_COPY.md). ---
const ClaimStep = ({ step, total, data, onNext, onBack }) => (
  <StepShell step={step} total={total} wash={theme.colors.washYellow} onBack={onBack}>
    <View style={styles.fillBetween}>
      <View style={styles.topContent}>
        <View style={styles.claimIconCircle}>
          <Ionicons name={data.icon} size={22} color={theme.colors.ink} />
        </View>
        <Text style={styles.claimLabel}>{data.label}</Text>
        <Text style={styles.h1}>{renderAccentH1(data.h1, data.accent)}</Text>
        <Text style={styles.bodyLgClaim}>{data.bodyLg}</Text>
      </View>
      <PrimaryButton onPress={onNext}>{data.cta}</PrimaryButton>
    </View>
  </StepShell>
);

// --- Step 2: Sign up — name + email + password, creates the real Supabase
// --- account right here instead of gating it behind the Honeycomb tab
// --- (Colin, 2026-08-09). Mirrors HoneycombAuth's create/sign-in toggle so
// --- returning testers on the same device aren't stuck re-registering.
const SignUpStep = ({ step, total, name, email, password, onChangeName, onChangeEmail, onChangePassword, onNext, onBack }) => {
  const [mode, setMode] = useState('signup');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmSent, setConfirmSent] = useState(false);
  const isSignUp = mode === 'signup';
  const canSubmit = email.trim() && password.length >= 6 && (!isSignUp || name.trim()) && !busy;

  const attemptSignIn = async () => {
    await HoneycombStore.signIn(email.trim(), password);
    onNext();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (isSignUp) {
        const result = await HoneycombStore.signUp(email.trim(), password, name.trim());
        if (result.session) {
          onNext();
        } else {
          setConfirmSent(true);
        }
      } else {
        await attemptSignIn();
      }
    } catch (err) {
      // Repeat demo pass on the same device, same email — quietly try
      // signing in instead of dead-ending on "already registered."
      if (isSignUp && /registered|exists/i.test(err.message || '')) {
        try {
          await attemptSignIn();
          return;
        } catch (signInErr) {
          setError(signInErr.message || 'That email is already in use — try signing in.');
          setMode('signin');
          return;
        }
      }
      setError(err.message || 'Something went wrong — try again.');
    } finally {
      setBusy(false);
    }
  };

  if (confirmSent) {
    return (
      <StepShell step={step} total={total} wash={theme.colors.washYellow} onBack={onBack}>
        <View style={styles.centerFill}>
          <Text style={styles.h1Center}>Check your email</Text>
          <Text style={styles.bodyLgCenter}>
            We sent a confirmation link to {email.trim()}. You can keep going now — just confirm it before you try
            sharing to the hive.
          </Text>
        </View>
        <PrimaryButton onPress={onNext}>Continue</PrimaryButton>
      </StepShell>
    );
  }

  return (
    <StepShell step={step} total={total} wash={theme.colors.washYellow} onBack={onBack}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.fillBetween}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.h1}>{isSignUp ? 'Create your account' : 'Welcome back'}</Text>
          <Text style={styles.bodySm}>
            {isSignUp ? "So your hive knows who's sharing." : 'Sign in to pick up where you left off.'}
          </Text>
          <View style={styles.inputCard}>
            {isSignUp && (
              <TextInput
                style={styles.nameInput}
                placeholder="Your name"
                placeholderTextColor={theme.colors.inkSoft}
                value={name}
                onChangeText={onChangeName}
                autoCapitalize="words"
                returnKeyType="next"
                editable={!busy}
              />
            )}
            {isSignUp && <View style={styles.inputDivider} />}
            <TextInput
              style={styles.nameInput}
              placeholder="Email"
              placeholderTextColor={theme.colors.inkSoft}
              value={email}
              onChangeText={onChangeEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              editable={!busy}
            />
            <View style={styles.inputDivider} />
            <TextInput
              style={styles.nameInput}
              placeholder="Password (6+ characters)"
              placeholderTextColor={theme.colors.inkSoft}
              value={password}
              onChangeText={onChangePassword}
              secureTextEntry
              returnKeyType="done"
              editable={!busy}
            />
          </View>
          {error && <Text style={styles.signUpError}>{error}</Text>}
          <PressableScale onPress={() => setMode(isSignUp ? 'signin' : 'signup')} haptic={null}>
            <Text style={styles.switchModeText}>
              {isSignUp ? 'Already have an account? Sign in' : 'New here? Create an account'}
            </Text>
          </PressableScale>
        </ScrollView>
        <PrimaryButton onPress={handleSubmit} disabled={!canSubmit} style={styles.floatingButton}>
          {busy ? (isSignUp ? 'Creating account…' : 'Signing in…') : isSignUp ? 'Create account' : 'Sign in'}
        </PrimaryButton>
      </KeyboardAvoidingView>
    </StepShell>
  );
};

// --- Step 3: Why — one-tap chips, personalizes the activation screen's copy ---
const WhyStep = ({ step, total, why, onPick, onNext, onBack }) => (
  <StepShell step={step} total={total} wash={theme.colors.washYellow} onBack={onBack}>
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
const RitualTimeStep = ({ step, total, ritualTime, onPick, onNext, onBack }) => (
  <StepShell step={step} total={total} wash={theme.colors.washYellow} onBack={onBack}>
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
const FirstEntryStep = ({ step, total, name, onNext, onBack, onSave }) => {
  const [text, setText] = useState('');
  const canSave = !!text.trim();

  const handleSave = () => {
    if (!canSave) return;
    onSave(text.trim());
    onNext();
  };

  return (
    <StepShell step={step} total={total} wash={theme.colors.washPeach} onBack={onBack}>
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
const CelebrationStep = ({ step, total, name, onDone }) => (
  <StepShell step={step} total={total} wash={theme.colors.washPeach}>
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

// --- Controller: owns the answers, drives Flow A (6 steps) or Flow B (10 —
// --- adds the four claim screens before Name). Flow read once from the
// --- hidden dev toggle (DevSettings); Welcome is shared so there's no
// --- flicker if it resolves a beat after mount. ---
export const OnboardingFlow = ({ onDone, initialFlow = 'B' }) => {
  const { session } = useAuth();
  const [flow, setFlow] = useState(initialFlow);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [why, setWhy] = useState(null);
  const [ritualTime, setRitualTime] = useState(null);

  useEffect(() => {
    DevSettings.getOnboardingFlow().then(setFlow);
  }, []);

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => Math.max(0, s - 1));

  const handleChangeFlow = (nextFlow) => {
    setFlow(nextFlow);
    DevSettings.setOnboardingFlow(nextFlow);
  };

  const handleSaveEntry = (text) => {
    EntryStore.saveEntry(new Date(), text, tagEntry(text));
  };

  const total = flow === 'B' ? 10 : 6;
  const claimStart = 1; // first claim screen's index in Flow B
  const isClaimStep = flow === 'B' && step >= claimStart && step < claimStart + CLAIM_SCREENS.length;
  // Bee leads transitions BETWEEN claims only (B1→B2→B3→B4) — 3 flights,
  // never on the Welcome→B1 or B4→Name boundary (§4 scarcity).
  const beeKey = isClaimStep && step > claimStart ? step : null;

  const sharedOffset = flow === 'B' ? claimStart + CLAIM_SCREENS.length : claimStart;

  // Demo mode resets to onboarding on every foreground resume — if this
  // device already has a real session (signed up on a previous pass),
  // don't make them create an account again. Skip straight past the step.
  useEffect(() => {
    if (session && step === sharedOffset) {
      next();
    }
  }, [session, step, sharedOffset]);

  let body;
  if (step === 0) {
    body = (
      <WelcomeStep
        step={0}
        total={total}
        onNext={next}
        flow={flow}
        onChangeFlow={handleChangeFlow}
        onSkipDemo={onDone}
      />
    );
  } else if (isClaimStep) {
    body = (
      <ClaimStep
        step={step}
        total={total}
        data={CLAIM_SCREENS[step - claimStart]}
        onNext={next}
        onBack={back}
      />
    );
  } else {
    const sharedStep = step - sharedOffset; // 0=Name, 1=Why, 2=Ritual, 3=FirstEntry, 4+=Celebration
    switch (sharedStep) {
      case 0:
        // Already signed in (demo-mode resume) — the effect above skips
        // this step; render nothing rather than flash the sign-up form.
        body = session ? null : (
          <SignUpStep
            step={step}
            total={total}
            name={name}
            email={email}
            password={password}
            onChangeName={setName}
            onChangeEmail={setEmail}
            onChangePassword={setPassword}
            onNext={next}
            onBack={back}
          />
        );
        break;
      case 1:
        body = <WhyStep step={step} total={total} why={why} onPick={setWhy} onNext={next} onBack={back} />;
        break;
      case 2:
        body = (
          <RitualTimeStep
            step={step}
            total={total}
            ritualTime={ritualTime}
            onPick={setRitualTime}
            onNext={next}
            onBack={back}
          />
        );
        break;
      case 3:
        body = (
          <FirstEntryStep step={step} total={total} name={name} onNext={next} onBack={back} onSave={handleSaveEntry} />
        );
        break;
      default:
        body = <CelebrationStep step={step} total={total} name={name} onDone={onDone} />;
    }
  }

  return (
    <View style={styles.flowRoot}>
      {body}
      {flow === 'B' && <BeeTransition triggerKey={beeKey} />}
    </View>
  );
};

const styles = StyleSheet.create({
  flowRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: theme.spacing.lg,
  },
  claimIconCircle: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.full,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...theme.shadows.card,
  },
  claimLabel: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    marginBottom: 8,
  },
  bodyLgClaim: {
    ...theme.type.bodyLg,
    color: theme.colors.inkSoft,
    marginTop: 12,
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
    paddingVertical: 4,
  },
  inputDivider: {
    height: 1,
    backgroundColor: theme.colors.surfaceBorder,
    marginVertical: 14,
  },
  signUpError: {
    ...theme.type.bodySm,
    color: theme.colors.danger,
    marginTop: -8,
    marginBottom: 16,
  },
  switchModeText: {
    ...theme.type.bodySm,
    color: theme.colors.accentDeep,
    textAlign: 'center',
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
  flowToggleRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.full,
    padding: 4,
    marginBottom: 16,
  },
  flowToggleChip: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: theme.borderRadius.full,
  },
  flowToggleChipSelected: {
    backgroundColor: theme.colors.washYellow,
  },
  flowToggleText: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
  },
  flowToggleTextSelected: {
    fontFamily: theme.fonts.bodySemiBold,
    color: theme.colors.ink,
  },
  skipDemoLink: {
    alignSelf: 'center',
    marginTop: 14,
  },
  skipDemoText: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    textDecorationLine: 'underline',
  },
});

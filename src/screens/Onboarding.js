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
import { DURATIONS, useReducedMotion } from '../constants/motion';
import { EntryStore } from '../services/EntryStore';
import { tagEntry } from '../utils/themeTagger';
import { PressableScale } from '../components/PressableScale';
import { StaggeredItem } from '../components/StaggeredItem';
import { PrimaryButton } from '../components/PrimaryButton';
import { GlowOrb } from '../components/GlowOrb';
import { HoneycombJourneyMap } from '../components/HoneycombJourneyMap';
import { CelebrationBadge } from '../components/CelebrationBadge';
import { CelebrationRays } from '../components/CelebrationRays';
import { IdeasAccordion } from '../components/IdeasAccordion';
import { BeeTransition } from '../components/BeeTransition';
import { FlyingBee } from '../components/FlyingBee';
import { DevSettings } from '../services/devSettings';
import { OnboardingState } from '../services/onboardingState';
import { HoneycombStore } from '../services/HoneycombStore';
import { useAuth } from '../contexts/AuthContext';
import { LockScreen, InputScreen } from './CoreRitual';

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

// Flow B belief screens — frozen copy, see GUIDES/GRATITUDE_ONBOARDING_GIVEN_COPY.md.
//
// These replace the four clinical claim screens ("sleep better," "less
// stress," "bounce back"), which made the same transactional argument every
// habit app makes: do this, get that outcome. Colin (2026-08-11) asked for a
// draw toward a gratitude-first life instead — quietly Christian in posture
// without ever being outwardly so.
//
// The hinge: gratitude isn't a technique for feeling better, it's the
// recognition that most of your life is made of things you were given and
// didn't arrange. A secular reader hears humility and wonder; a Christian
// reader hears grace. We never name a giver — the user fills that in.
//
// Copy gate every line has to pass: could a devout Christian and a committed
// atheist each read this and feel it was written for them? Words in play:
// given, gift, arrived, receive, enough, light, notice, hold. Words never
// used: God, Jesus, Lord, pray, scripture, church, faith, blessed, worship,
// sin — and, per Colin 2026-08-11, hallelujah. That one stays a guiding
// principle for the register, not a word on screen.
const BELIEF_SCREENS = [
  {
    icon: 'sunny',
    label: 'TO BEGIN',
    h1: 'The morning showed up without you.',
    accent: 'without you',
    bodyLg:
      'So did the people who know your name. So did a body that woke up working. You arranged none of it — it arrived anyway.',
    cta: 'Next',
  },
  {
    icon: 'heart',
    label: 'THE TURN',
    h1: 'Noticing is one thing. Saying thanks is another.',
    accent: 'Saying thanks',
    bodyLg:
      'Anyone can make a list. Gratitude is what happens when you let it land — when you receive the day instead of just reviewing it.',
    cta: 'Next',
  },
  {
    // The mental-health promise, given honestly (§9.3: no invented stats) and
    // in the order that makes the whole flow land — thanks first, peace as a
    // byproduct. That ordering is the quietly Christian part, and nobody has
    // to notice it for it to work.
    icon: 'moon',
    label: 'WHAT HAPPENS',
    h1: "Peace tends to follow, but it's not the point.",
    accent: "but it's not the point",
    bodyLg:
      "People who name what they're thankful for sleep easier and carry less dread. That's real. It's just not why you'd do it — it's what happens when you do.",
    cta: "Let's begin",
  },
];

// First belief screen's index in Flow B (step 0 is always Welcome).
const BELIEF_START = 1;

// Shared-step indices, counted from the end of the flow-specific screens.
const STEP_NAME = 0;
const STEP_MOMENT = 1;
const STEP_ENTRY = 2;
const STEP_CELEBRATION = 3;
const STEP_ACCOUNT = 4;

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

const MOMENT_TIMES = [
  { key: 'morning', icon: 'sunny', label: 'Morning', caption: 'Before the day takes over' },
  { key: 'midday', icon: 'partly-sunny', label: 'Midday', caption: 'A pause in the middle' },
  { key: 'evening', icon: 'moon', label: 'Evening', caption: 'Before you put the day down' },
];

// --- Shared shell: wash background + honeycomb journey map + animated step transitions ---
const StepShell = ({ step, stage, wash, onBack, showMap = true, children }) => {
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
        {showMap && <HoneycombJourneyMap stage={stage} />}
      </View>

      <Animated.View style={[styles.stepBody, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {children}
      </Animated.View>
    </View>
  );
};

// The theme has one obvious move: things arriving. Light blooms behind the
// icon *before* the words land, so the screen performs its own argument —
// you receive it rather than read it. Reuses the Lock screen's GlowOrb (real
// radial gradient, no hard circular edge) and collapses to a flat fade under
// Reduce Motion.
const ArrivingLight = ({ size = 180 }) => {
  const reduced = useReducedMotion();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: reduced ? DURATIONS.reducedMotionFade : 900,
      useNativeDriver: true,
    }).start();
  }, [reduced]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : 0.55, 1] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.beliefGlow, { opacity: anim, transform: [{ scale }] }]}
    >
      <GlowOrb size={size} intensity={0.55} breathe />
    </Animated.View>
  );
};

// --- Step 1: Welcome — show the value before asking for any effort ---
// Demo-mode only: a visible A/B/C picker so anyone running the app can switch
// flows without knowing the hidden 5-tap gesture (DevVersionTag). Sits below
// the value prop so it never competes with the actual pitch.
const FlowToggle = ({ flow, onChange }) => (
  <View style={styles.flowToggleRow}>
    {['A', 'B', 'C'].map((option) => {
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

// §13.3: the bee flies an inward spiral arc and settles at the wordmark's
// center once per app open — a flight-path preset on the shared FlyingBee
// engine, not a second bee. `hasArcedThisLaunch` is a module-level flag
// (not React state) on purpose: DEMO_MODE's foreground-resume reset
// (App.js) repeatedly unmounts/remounts this screen back to Welcome, and
// §13.3 says "fires once per app open, never loops" — a per-component
// state flag would reset on every one of those remounts and re-fire the
// arc each time. This flag only resets on a genuine cold launch (new JS
// context), which is the boundary §13.3 actually means by "app open."
let hasArcedThisLaunch = false;

const WelcomeStep = ({ step, onNext, flow, onChangeFlow, onSkipDemo }) => {
  const [showArc, setShowArc] = useState(!hasArcedThisLaunch);

  useEffect(() => {
    if (showArc) hasArcedThisLaunch = true;
  }, [showArc]);

  return (
    <StepShell step={step} stage="welcome" wash={theme.colors.washYellow}>
      <View style={styles.centerFill}>
        <View style={styles.wordmarkArcAnchor}>
          <Text style={styles.wordmark}>Gratitude</Text>
          {showArc && (
            <FlyingBee
              preset="loginArc"
              size={22}
              style={styles.wordmarkArcBee}
              onSettle={() => setShowArc(false)}
            />
          )}
        </View>
        <Text style={styles.h1Center}>Start with what you were given.</Text>
        <Text style={styles.bodyLgCenter}>One line a day. That's the whole thing.</Text>
      </View>
      <FlowToggle flow={flow} onChange={onChangeFlow} />
      <PrimaryButton onPress={onNext}>Begin</PrimaryButton>
      <PressableScale onPress={onSkipDemo} style={styles.skipDemoLink}>
        <Text style={styles.skipDemoText}>Skip to the logged-in view (demo)</Text>
      </PressableScale>
    </StepShell>
  );
};

// --- Flow B, screens B1–B3: the argument, one beat per screen. Mounted with
// --- key={step} by the controller so the light + text arrival replays on
// --- every beat rather than only on first mount. ---
const BeliefStep = ({ step, data, onNext, onBack }) => (
  <StepShell step={step} stage="why" wash={theme.colors.washYellow} onBack={onBack}>
    <View style={styles.fillBetween}>
      <View style={styles.topContent}>
        <ArrivingLight />
        <View style={styles.claimIconCircle}>
          <Ionicons name={data.icon} size={22} color={theme.colors.ink} />
        </View>
        {/* Indices start at 2 so the words land after the light, not with it. */}
        <StaggeredItem index={2}>
          <Text style={styles.claimLabel}>{data.label}</Text>
        </StaggeredItem>
        <StaggeredItem index={3}>
          <Text style={styles.h1}>{renderAccentH1(data.h1, data.accent)}</Text>
        </StaggeredItem>
        <StaggeredItem index={4}>
          <Text style={styles.bodyLgClaim}>{data.bodyLg}</Text>
        </StaggeredItem>
      </View>
      <PrimaryButton onPress={onNext}>{data.cta}</PrimaryButton>
    </View>
  </StepShell>
);

// --- Name — just a name. The account ask used to sit here, in front of the
// --- activation moment; §5 says writing the first entry is the activation
// --- moment and "everything funnels there," so the signup wall was an
// --- activation leak. It now runs after the celebration. ---
const NameStep = ({ step, name, onChangeName, onNext, onBack }) => (
  <StepShell step={step} stage="you" wash={theme.colors.washYellow} onBack={onBack}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.fillBetween}>
      <View style={styles.topContent}>
        <Text style={styles.h1}>What should we call you?</Text>
        <Text style={styles.bodySm}>Just so it feels like yours.</Text>
        <View style={styles.inputCard}>
          <TextInput
            style={styles.nameInput}
            placeholder="Your name"
            placeholderTextColor={theme.colors.inkSoft}
            value={name}
            onChangeText={onChangeName}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={name.trim() ? onNext : undefined}
            autoFocus
          />
        </View>
      </View>
      <PrimaryButton onPress={onNext} disabled={!name.trim()} style={styles.floatingButton}>
        Next
      </PrimaryButton>
    </KeyboardAvoidingView>
  </StepShell>
);

// --- Moment — one clear action, sets the daily check-in ---
const MomentStep = ({ step, momentTime, onPick, onNext, onBack }) => (
  <StepShell step={step} stage="moment" wash={theme.colors.washYellow} onBack={onBack}>
    <View style={styles.fillBetween}>
      <View style={styles.topContent}>
        <Text style={styles.h1}>When will you stop and notice?</Text>
        <Text style={styles.bodySm}>We'll nudge you once. Gently.</Text>
        <View style={styles.momentList}>
          {MOMENT_TIMES.map((option, index) => {
            const selected = option.key === momentTime;
            return (
              <StaggeredItem key={option.key} index={index}>
                <PressableScale
                  style={[styles.momentCard, selected && styles.momentCardSelected]}
                  onPress={() => onPick(option.key)}
                >
                  <View style={[styles.iconCircle, selected && styles.iconCircleSelected]}>
                    <Ionicons name={option.icon} size={22} color={theme.colors.ink} />
                  </View>
                  <View style={styles.momentText}>
                    <Text style={styles.h3}>{option.label}</Text>
                    <Text style={styles.bodySmMuted}>{option.caption}</Text>
                  </View>
                </PressableScale>
              </StaggeredItem>
            );
          })}
        </View>
      </View>
      <PrimaryButton onPress={onNext} disabled={!momentTime}>Next</PrimaryButton>
    </View>
  </StepShell>
);

// --- First entry — the activation moment. Everything funnels here. ---
// The placeholder carries the whole thesis into the one field that matters
// most. The Ideas accordion keeps its own approved stem ("I'm grateful
// for…", GRATITUDE_IDEAS_ACCORDION_COPY.md) — its sparks are written as
// noun phrases for that stem and don't read grammatically under this one.
// The two never collide on screen: the placeholder is only visible while
// the field is empty.
const FirstEntryStep = ({ step, name, onNext, onBack, onSave }) => {
  const [text, setText] = useState('');
  const canSave = !!text.trim();

  const handleSave = () => {
    if (!canSave) return;
    onSave(text.trim());
    onNext();
  };

  return (
    <StepShell step={step} stage="entry" wash={theme.colors.washPeach} onBack={onBack}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.fillBetween}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.h1}>
            {name.trim() ? `${name.trim()}, what showed up for you today?` : 'What showed up for you today?'}
          </Text>
          <View style={styles.inputCard}>
            <TextInput
              style={styles.entryInput}
              placeholder="Today I was given…"
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

// --- Entry step, Flow C only: screen-lock demo — reuses the real Today-tab
// --- lock/unlock screens verbatim, so this is an honest preview of the
// --- actual daily loop, not a mockup of it (Colin, 2026-08-10). No
// --- StepShell: the demo owns the frame the same way it does in the app.
// --- InputScreen saves the entry itself, so the controller's onSave path
// --- isn't wired here — its save IS the first-ever save.
const LockDemoStep = ({ onNext }) => {
  const [phase, setPhase] = useState('lock');
  if (phase === 'entry') {
    return <InputScreen onUnlock={onNext} />;
  }
  return <LockScreen onOpen={() => setPhase('entry')} />;
};

// --- Celebration — always the first-ever-save treatment (the entry step's
// --- save IS the first-ever save), never the bare badge. "given" closes the
// --- loop back to the Welcome line. ---
const CelebrationStep = ({ step, onNext }) => (
  <StepShell step={step} stage="done" wash={theme.colors.washPeach}>
    <View style={styles.centerFill}>
      <View style={styles.badgeStage}>
        <CelebrationRays />
        <CelebrationBadge />
      </View>
      <Text style={styles.h1Center}>That's one.</Text>
      <Text style={styles.bodyLgCenter}>
        Tomorrow it's two. Do that for a while and you'll have a record of everything you were given.
      </Text>
    </View>
    <PrimaryButton onPress={onNext}>Keep it</PrimaryButton>
  </StepShell>
);

// --- Account — the ask, now after the payoff instead of in front of it.
// --- Mirrors HoneycombAuth's create/sign-in toggle so returning testers on
// --- the same device aren't stuck re-registering. "Not yet" is a real exit:
// --- entries already live locally, so nobody is held hostage for them. ---
const AccountStep = ({
  step,
  name,
  email,
  password,
  onChangeName,
  onChangeEmail,
  onChangePassword,
  onNext,
  onSkip,
  initialMode = 'signup',
  navigation,
}) => {
  const [mode, setMode] = useState(initialMode);
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
      <StepShell step={step} stage="done" wash={theme.colors.washPeach} showMap={false}>
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
    <StepShell step={step} stage="done" wash={theme.colors.washPeach} showMap={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.fillBetween}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.h1}>{isSignUp ? 'Keep it.' : 'Welcome back'}</Text>
          <Text style={styles.bodySm}>
            {isSignUp
              ? 'Make an account so your entries follow you — and so your hive can see the ones you choose to share.'
              : 'Sign in to pick up where you left off.'}
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
                maxLength={100}
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
          {isSignUp && (
            // No consent checkbox yet. The copy in legalCopy.js is now a real
            // draft, but four values in it are still unfilled, so it renders
            // "[the publisher of this app]" and is not publishable — and
            // requiring agreement to an unpublished document is worse than no
            // checkbox at all. Links stay reachable so the gap is visible.
            //
            // To re-add: import { LEGAL_COPY_READY } from '../constants/legalCopy'
            // and render the checkbox only when it is true. Gate on that symbol,
            // not on a judgement that the copy "looks done" — it is derived from
            // the unfilled values themselves, so it cannot drift out of sync.
            // `canSubmit` must not require `agreedToTerms` while it is false.
            <Text style={styles.consentText}>
              <Text style={styles.consentLink} onPress={() => navigation?.navigate('Legal', { tab: 'privacy' })}>
                Privacy Policy
              </Text>{' '}
              and{' '}
              <Text style={styles.consentLink} onPress={() => navigation?.navigate('Legal', { tab: 'terms' })}>
                Terms of Service
              </Text>
            </Text>
          )}
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
        <PressableScale onPress={onSkip} style={styles.skipDemoLink} haptic={null}>
          <Text style={styles.notYetText}>Not yet</Text>
        </PressableScale>
      </KeyboardAvoidingView>
    </StepShell>
  );
};

// --- Controller: owns the answers, drives Flow A (5 steps), Flow B (8 —
// --- adds the three belief screens before Name), or Flow C (5, same shape
// --- as A but the entry step demos the real lock/unlock loop instead of
// --- the plain form). Flow read once from the hidden dev toggle
// --- (DevSettings); Welcome is shared so there's no flicker if it
// --- resolves a beat after mount. ---
export const OnboardingFlow = ({ onDone, initialFlow = 'B', startAt, navigation }) => {
  const { session } = useAuth();
  const [flow, setFlow] = useState(initialFlow);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [momentTime, setMomentTime] = useState(null);

  // App.js's onDone is `navigation.replace('Main')`, which must not run
  // twice — the account step can reach it both by its own onNext and by the
  // already-signed-in effect below firing on the same session change.
  const finishedRef = useRef(false);
  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    // Fire-and-forget: the flag only matters on the NEXT cold launch, so
    // navigation doesn't wait on the write. Swallowing a failed write is
    // deliberate — "see the flow again" is already the designed fallback,
    // and an unhandled rejection here would LogBox over the finish beat.
    OnboardingState.markComplete().catch(() => {});
    onDone();
  };

  const sharedOffset = flow === 'B' ? BELIEF_START + BELIEF_SCREENS.length : BELIEF_START;

  // Honeycomb's empty state ("Finish signup" / "Sign in") lands here instead
  // of a second auth form on the tab — jump straight to the account step at
  // whichever flow is actually resolved, rather than assuming initialFlow.
  useEffect(() => {
    DevSettings.getOnboardingFlow().then((resolvedFlow) => {
      setFlow(resolvedFlow);
      if (startAt === 'signup' || startAt === 'signin') {
        const offset = resolvedFlow === 'B' ? BELIEF_START + BELIEF_SCREENS.length : BELIEF_START;
        setStep(offset + STEP_ACCOUNT);
      }
    });
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

  const isBeliefStep = flow === 'B' && step >= BELIEF_START && step < BELIEF_START + BELIEF_SCREENS.length;
  // Bee leads transitions BETWEEN belief beats only (B1→B2→B3) — 2 flights,
  // never on the Welcome→B1 or B3→Name boundary (§4 scarcity).
  const beeKey = isBeliefStep && step > BELIEF_START ? step : null;

  const sharedStep = step - sharedOffset;

  // Demo mode resets to onboarding on every foreground resume — if this
  // device already has a real session (signed up on a previous pass), the
  // account step has nothing left to ask for. Straight into the app.
  useEffect(() => {
    if (session && !isBeliefStep && sharedStep === STEP_ACCOUNT) {
      finish();
    }
  }, [session, isBeliefStep, sharedStep]);

  let body;
  if (step === 0) {
    body = (
      <WelcomeStep
        step={0}
        onNext={next}
        flow={flow}
        onChangeFlow={handleChangeFlow}
        onSkipDemo={finish}
      />
    );
  } else if (isBeliefStep) {
    body = (
      <BeliefStep
        key={step}
        step={step}
        data={BELIEF_SCREENS[step - BELIEF_START]}
        onNext={next}
        onBack={back}
      />
    );
  } else {
    switch (sharedStep) {
      case STEP_NAME:
        body = (
          <NameStep step={step} name={name} onChangeName={setName} onNext={next} onBack={back} />
        );
        break;
      case STEP_MOMENT:
        body = (
          <MomentStep
            step={step}
            momentTime={momentTime}
            onPick={setMomentTime}
            onNext={next}
            onBack={back}
          />
        );
        break;
      case STEP_ENTRY:
        body =
          flow === 'C' ? (
            <LockDemoStep onNext={next} />
          ) : (
            <FirstEntryStep step={step} name={name} onNext={next} onBack={back} onSave={handleSaveEntry} />
          );
        break;
      case STEP_CELEBRATION:
        body = <CelebrationStep step={step} onNext={next} />;
        break;
      default:
        // Already signed in (demo-mode resume) — the effect above finishes
        // the flow; render nothing rather than flash the account form.
        body = session ? null : (
          <AccountStep
            step={step}
            name={name}
            email={email}
            password={password}
            onChangeName={setName}
            onChangeEmail={setEmail}
            onChangePassword={setPassword}
            onNext={finish}
            onSkip={finish}
            initialMode={startAt === 'signin' ? 'signin' : 'signup'}
            navigation={navigation}
          />
        );
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
  // Centered on the 44pt icon circle that opens `topContent` (circle center
  // sits at 22,22 in that box, so a 180pt orb offsets by 22 - 90 = -68 on
  // both axes). Absolute + pointerEvents none: it never affects layout, and
  // the spill past the screen edge is intentional — light falling in, not a
  // shape sitting on the wash.
  beliefGlow: {
    position: 'absolute',
    left: -68,
    top: -68,
    width: 180,
    height: 180,
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
  // §13.3 anchor for the login bee arc — sized to roughly the wordmark's
  // footprint so the bee's fractional (0-1) flight path resolves against
  // the mark itself rather than the whole screen.
  wordmarkArcAnchor: {
    width: 220,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkArcBee: {
    // FlyingBee's `fill` style is absoluteFillObject by default — override
    // just enough here that "fill" means "fill the anchor," not the
    // Welcome screen's centerFill parent.
    position: 'absolute',
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
  consentText: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    flex: 1,
  },
  consentLink: {
    color: theme.colors.accentDeep,
    fontFamily: theme.fonts.bodySemiBold,
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
  momentList: {
    gap: 12,
    marginTop: 16,
  },
  momentCard: {
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
  momentCardSelected: {
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
  momentText: {
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
  notYetText: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
  },
});

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
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { PressableScale } from '../components/PressableScale';
import { StaggeredItem } from '../components/StaggeredItem';
import { PrimaryButton } from '../components/PrimaryButton';
import { GlowOrb } from '../components/GlowOrb';
import { HoneycombJourneyMap } from '../components/HoneycombJourneyMap';
import { CelebrationBadge } from '../components/CelebrationBadge';
import { CelebrationRays } from '../components/CelebrationRays';
import { IdeasAccordion } from '../components/IdeasAccordion';
import { FlyingBee } from '../components/FlyingBee';
import { DEMO_CONTENT } from '../constants/demoMode';
import { OnboardingState } from '../services/onboardingState';
import { HoneycombStore } from '../services/HoneycombStore';
import { PendingOnboardingWrites } from '../services/pendingOnboardingWrites';
import { getDailyPrompt } from '../constants/prompts';
import { tagEntry } from '../utils/themeTagger';
import { useAuth } from '../contexts/AuthContext';
import {
  requestPermissionAndEnable,
  reconcile as reconcileDailyNudge,
  toISODateLocal,
} from '../services/dailyNudge';
import { NUDGE_TITLE, NUDGE_BODY } from '../constants/nudgeCopy';

const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

// ONE DOOR — five beats, no forks (PLANS/ONBOARDING_ONE_DOOR_SPEC.md,
// Lumen 2026-08-17, amended the same day for the Who beat).
//
// What used to be here: a Welcome screen, a demo-only Flow B/C picker, three
// belief screens, a Name step, a Moment step, and two different entry steps
// depending on which fork you were on — nine screens on the default path.
// Flows B and C are deleted as forks. The Landing is now the same face as
// the daily gate, so day 0 teaches day 30.
//
// The cuts are transmutations, not deletions, and each one is written down
// where it went:
//   - the belief screens B1–B3 -> src/constants/prompts.js, as the first
//     three days' prompts (FIRST_DAYS_PROMPTS). The argument arrives one
//     line a day, which is the product's own thesis applied to its pitch.
//   - the Moment step -> waits for notifications to exist, then returns at
//     the Celebration beat as a real permission ask (§27.2: never describe
//     a capability that doesn't exist).
//   - the Lock demo -> promoted. The Landing IS the gate now, so the
//     preview became the thing it was previewing.
//   - the Name step -> AccountStep already collects a name at "Keep it."
const STEP_LANDING = 0;
const STEP_ENTRY = 1;
const STEP_CELEBRATION = 2;
const STEP_WHO = 3;
const STEP_ACCOUNT = 4;

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

// --- Beat 0: the Landing — the only door ---
//
// This screen is not an introduction to the app; it IS the app's front face,
// permanently. Sign-out lands here, every cold launch before completion
// opens here, and its composition is the daily gate's composition
// (CoreRitual's LockScreen: glow, wordmark, one line, one button). Day 0
// teaches day 30 — which is why the Lock demo could be deleted rather than
// replaced. There is nothing left to preview.
//
// Two affordances, no third: Begin (write), and a quiet way back in for
// someone who already has an account. The demo skip stays DEMO_CONTENT-gated
// and below both.
const LandingStep = ({ step, onNext, onSignIn, onSkipDemo, splashHidden }) => {
  const { width } = useWindowDimensions();
  // Starting the arc on mount used to spend its whole flight behind the
  // still-visible splash (§13.3 follow-up, Pixel/Sage 2026-08-12: "once per
  // app open" means once VISIBLY, and an arc spent behind the splash is
  // zero arcs). Gate on the splash-hide signal from App.js instead — by the
  // time a foreground-resume remount gets here, splash is long gone and
  // splashHidden is already true, so this fires immediately, same as today.
  const [showArc, setShowArc] = useState(false);

  useEffect(() => {
    if (splashHidden && !hasArcedThisLaunch) {
      hasArcedThisLaunch = true;
      setShowArc(true);
    }
  }, [splashHidden]);

  return (
    <StepShell step={step} stage="welcome" wash={theme.colors.washYellow}>
      {/* THE GATE'S OWN LIGHT, not a smaller cousin of it. First attempt
          reused the belief screens' ArrivingLight — a 180pt orb absolutely
          positioned at left:-68/top:-68 of whatever contained it. On the
          Landing that container is the centred content column, so it
          rendered as a yellow blob in the top-left corner: a style that
          only ever made sense inside the layout it was written for.
          CoreRitual's LockScreen runs `size={width * 1.6}` at `top:
          -width * 0.35`, which reads as light across the whole screen
          rather than as a pale shape; if this is the same face as the
          gate, it wears the gate's exact treatment. ArrivingLight had no
          other consumer once the belief screens went, and is deleted. */}
      <GlowOrb size={width * 1.6} breathe intensity={0.55} style={{ top: -width * 0.35 }} />
      <View style={styles.centerFill}>
        <View style={styles.wordmarkArcAnchor}>
          <Text style={styles.wordmark}>Pollinate</Text>
          {showArc && (
            <FlyingBee
              preset="loginArc"
              size={22}
              style={styles.wordmarkArcBee}
              onSettle={() => setShowArc(false)}
            />
          )}
        </View>
        {/* Cascade timing comes from the shared module, never a local
            literal. Deezine's composition asked for absolute delays of
            300/500/700/900/1100/1300ms — a 1.3s entrance. §14.1's cascade
            is STAGGER_MS=50 per item (and a 700ms total budget above ~14
            items), so these four land in 150ms, not 1300. A named cascade
            fixes the shape; it is not a timing system to type numbers
            into (§12.5.1b). */}
        <StaggeredItem index={0}>
          <Text style={styles.h1Center}>Start with what you were given.</Text>
        </StaggeredItem>
        {/* Was "That's the whole thing." R15 wrote it to promise low friction
            and it did that well, but it also asserted the product ends at the
            journal — which is the exact claim The Ruling reverses ("the
            journal is the foundation the social network grows on"). It is the
            standalone-journal promise, on our first screen, in our own voice.
            "That's how it starts" keeps the one-line-a-day promise verbatim
            and flips terminal to foundational. Nothing unbuilt is named. */}
        <StaggeredItem index={1}>
          <Text style={styles.bodyLgCenter}>One line a day. That's how it starts.</Text>
        </StaggeredItem>
      </View>
      <StaggeredItem index={2}>
        <PrimaryButton onPress={onNext}>Begin</PrimaryButton>
      </StaggeredItem>
      {/* The returning half of the door. Onboarding was reachable at the
          account step by deep link (`startAt`) and from Honeycomb's empty
          state, but never from the app's own first screen — a returning user
          on a new phone had to walk the whole flow to reach a sign-in form.
          Quiet, not competing: a text link under the primary. */}
      <StaggeredItem index={3}>
        <PressableScale onPress={onSignIn} style={styles.signInLink} haptic={null}>
          <Text style={styles.signInLinkText}>Already have a hive? Sign in</Text>
        </PressableScale>
      </StaggeredItem>
      {/* Pixel's WP-10(c) finding (thread 37fb8ef6): this rendered
          unconditionally, shipping to every tester's first screen.
          DEMO_CONTENT, not __DEV__ — a pitch build Colin demos from has
          __DEV__ false but DEMO_MODE still true. */}
      {DEMO_CONTENT && (
        <PressableScale onPress={onSkipDemo} style={styles.skipDemoLink}>
          <Text style={styles.skipDemoText}>Skip to the logged-in view (demo)</Text>
        </PressableScale>
      )}
    </StepShell>
  );
};

// --- Beat 1: the first entry — the activation moment. Everything funnels
// --- here, and it is now ONE TAP from the door. ---
//
// The headline is the day-0 prompt from the shared deck, not a string of its
// own. That is what makes B1's transmutation real rather than notional: the
// first belief screen ("The morning showed up without you.") became day 0 of
// FIRST_DAYS_PROMPTS, and day 0 is this screen — the entry that starts the
// count is written here, so if this screen kept its own private copy of the
// question, day 0 of the deck would be a prompt nobody could ever be shown.
// One source, one question.
//
// The greeting-by-name is gone with the Name step: the name is collected two
// beats later at "Keep it.", so there is nothing to greet with here.
//
// The placeholder carries the whole thesis into the one field that matters
// most. The Ideas accordion keeps its own approved stem ("I'm grateful
// for…", GRATITUDE_IDEAS_ACCORDION_COPY.md) — its sparks are written as
// noun phrases for that stem and don't read grammatically under this one.
// The two never collide on screen: the placeholder is only visible while
// the field is empty.
const FirstEntryStep = ({ step, onNext, onBack, onSave }) => {
  const [text, setText] = useState('');
  const canSave = !!text.trim();

  const handleSave = () => {
    if (!canSave) return;
    onSave(text.trim());
    onNext();
  };

  return (
    <StepShell step={step} stage="entry" wash={theme.colors.washYellow} onBack={onBack}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.fillBetween}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.h1}>{getDailyPrompt(new Date(), 0).question}</Text>
          <View style={styles.inputCard}>
            <TextInput
              style={styles.entryInput}
              placeholder="Today I was given…"
              placeholderTextColor={theme.colors.inkSoft}
              multiline
              value={text}
              onChangeText={setText}
              // Matches CoreRitual's entry input and entries_content_length.
              // Local-only when written, so the failure would surface much
              // later at Share rather than here.
              maxLength={10000}
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

// --- Celebration — always the first-ever-save treatment (the entry step's
// --- save IS the first-ever save), never the bare badge. "given" closes the
// --- loop back to the Welcome line. ---
//
// THE DAILY NUDGE ASK LIVES IN THIS BEAT, UNDER "Tomorrow it's two."
// (`PLANS/DAILY_NUDGE_SPEC.md` §2's placement corollary, Lumen). The body
// already makes the promise; the notification is the MECHANISM of that
// sentence, so the ask reads as the payoff of a line just read rather than
// as an interruption. Reading order protects the celebration: badge ->
// "That's one." -> body all land before the ask exists.
//
// AFFIRMATIVE-ONLY — there is no "No thanks". The in-app decline is walking
// past it: tapping "Keep it" without touching the ask. Nothing is recorded,
// so §2's corollary keeps its full value and a later re-ask stays open.
// The Who beat carries a decline link because it owns its screen and has no
// other exit; this beat's "Keep it" is already an unblocked exit, which is
// why a second control here would be a guilt button. (That is Sage's reason,
// taken over the §30.10.4 citation I first reached for — §30.10.4 rules on
// the WEIGHT of a decline control, not on whether one exists, so it cannot
// be cited for having none.)
//
// "Keep it" is never gated on the ask, in any state.
const NUDGE_ASK = 'ask';
const NUDGE_BUSY = 'busy';
const NUDGE_GRANTED = 'granted';
const NUDGE_GONE = 'gone';

const CelebrationStep = ({ step, onNext }) => {
  const [nudge, setNudge] = useState(NUDGE_ASK);

  // §2, THE FUSE — this is the "yes" handler, and the only caller of
  // `requestPermissionAndEnable` anywhere in the app. It is reached from a
  // JSX press prop and from nowhere else: not a mount effect, not module
  // scope, so the OS dialog cannot fire before an in-app yes.
  // `scripts/check-daily-nudge.mjs` row 2c asserts that shape by walking
  // from the call site out to the prop, rather than by finding the name.
  const handleAskForNudge = async () => {
    setNudge(NUDGE_BUSY);
    let result;
    try {
      result = await requestPermissionAndEnable();
    } catch {
      // A throw is not an OS decline. Nothing was granted and nothing was
      // armed, so the label still describes exactly what the control would
      // do — returning it to the ask is the honest state, and the only one
      // that does not strand the user with a promise nobody made.
      setNudge(NUDGE_ASK);
      return;
    }
    if (!result.granted) {
      // An OS decline is terminal (§2: this function does not retry). The
      // control LEAVES the beat rather than persisting as a promise it can
      // no longer keep — a button still reading "Let me know tomorrow
      // evening" after the OS said no is a lie in button form. Reversal
      // lives in Settings (§5).
      setNudge(NUDGE_GONE);
      return;
    }
    setNudge(NUDGE_GRANTED);

    // ARM THE PROMISE HERE, and deliberately NOT via App.js's
    // `rearmDailyNudge`. Two independent reasons, either one sufficient:
    //
    //   1. `requestPermissionAndEnable` sets the enabled flag and returns —
    //      it never reconciles (`disable()` does; the enable path does not,
    //      an asymmetry that sat unnamed in the module until Sage measured
    //      it). App.js's foreground reconcile already ran at launch, BEFORE
    //      that flag existed, and the next background->active transition may
    //      not arrive before tomorrow 20:00. A user who taps yes, finishes
    //      onboarding and pockets the phone would get no nudge on night one
    //      — exactly the cohort the feature exists for.
    //   2. `rearmDailyNudge` sources its written days from `EntryStore`,
    //      whose `requireUserId` throws "Not signed in", and there IS no
    //      session at this beat — STEP_ACCOUNT is two beats away, which is
    //      the same reason the entry itself is buffered through
    //      `PendingOnboardingWrites`. App.js's catch would swallow that
    //      silently and night one would break with nothing reported.
    //
    // No read is needed anyway: at this beat the user has written exactly
    // today and nothing else, so that one day-key IS `writtenDaysISO`.
    // `buildWindow` drops today and schedules from tomorrow — which is what
    // the label promised.
    try {
      const now = new Date();
      await reconcileDailyNudge({
        writtenDaysISO: [toISODateLocal(now)],
        now,
        content: { title: NUDGE_TITLE, body: NUDGE_BODY },
      });
    } catch {
      // Permission is granted and the flag is set, so App.js's next
      // foreground re-arm covers this. The settled line stays honest.
    }
  };

  return (
    <StepShell step={step} stage="saved" wash={theme.colors.washYellow}>
      <View style={styles.centerFill}>
        <View style={styles.badgeStage}>
          <CelebrationRays />
          <CelebrationBadge />
        </View>
        <Text style={styles.h1Center}>That's one.</Text>
        <Text style={styles.bodyLgCenter}>
          Tomorrow it's two. Do that for a while and you'll have a record of everything you were given.
        </Text>
        {(nudge === NUDGE_ASK || nudge === NUDGE_BUSY) && (
          <PressableScale
            onPress={handleAskForNudge}
            disabled={nudge === NUDGE_BUSY}
            containerStyle={styles.nudgeSlot}
            style={styles.nudgeChip}
            accessibilityLabel="Let me know tomorrow evening"
          >
            <Ionicons name="notifications-outline" size={15} color={theme.colors.ink} />
            <Text style={styles.nudgeChipText}>Let me know tomorrow evening</Text>
          </PressableScale>
        )}
        {nudge === NUDGE_GRANTED && (
          // The settled state drops the chip's edge and fill on purpose: the
          // ask has been answered, so it is a status now, not a tap target,
          // and nothing about it should still read as pressable.
          <View style={[styles.nudgeSlot, styles.nudgeSettled]}>
            <Ionicons name="checkmark" size={15} color={theme.colors.inkSoft} />
            <Text style={styles.nudgeSettledText}>Tomorrow evening, then.</Text>
          </View>
        )}
      </View>
      <PrimaryButton onPress={onNext}>Keep it</PrimaryButton>
    </StepShell>
  );
};

// --- Beat 3: Who — the hero's first client code ---
//
// Private Hives is the product's hero and had a complete server side (six
// migrations, live in production) with zero client code. This beat is the
// first writer: against today's schema a hive IS `owner_id + subject_name`,
// so one answered question is the complete creation act (§30.9.3).
//
// It sits between Celebration's "Keep it" CTA and the account screen's
// "Keep it." h1 — the slot the flow already left empty (§30.8.3). It runs
// UNCONDITIONALLY rather than firing on a "this entry was about a person"
// classifier: asking wrongly costs one tap on a decline link, not asking
// costs the activation event invisibly, and the classifier that exists
// (themeTagger) fires on the WORD for a relationship, not the presence of a
// person — 53.8% recall over the app's own 81 suggested first lines, and
// blind to "Mateo" (R100). A beat that unconditional may not ASSERT what a
// conditional one could ("That was about someone" is false for rain on the
// roof), so it asks, and the tap is the answer.
//
// COPY. Every string on this beat is ratified (Deezine, 2026-08-17). Three of
// them started as deviations from the posted design and were ratified as
// written; the reasons stay here, because a ratified string with a lost reason
// is the one a later pass reverts by accident:
//
//   placeholder  "A name" — the design said "A name, a thought, or leave it
//     blank". `subject_name` is a label for a person; a hive named after a
//     thought renders as one everywhere it is ever shown, and "leave it
//     blank" invites an empty write on a `not null` column when the decline
//     link already covers exactly that.
//
//   CTA  "That's who" — the design said "Keep it", which is the Celebration
//     CTA one screen back AND the account h1 one screen forward, both frozen
//     R15 copy. Three "keep it"s in a row makes the middle one look like the
//     same act repeated; the account IS the act of keeping, and this beat is
//     inside it, not another copy of it.
//
//   helper line  CUT — it read "Optional — write for someone, or keep it for
//     yourself", which both spends "keep it" a fourth time and describes
//     keeping-for-yourself as a mode the app does not have. The decline link
//     is the optionality signal; a sentence explaining that a visible skip
//     link is a skip link is explanation, and §30.5 says onboarding's job is
//     activation.
//
// The beat does NOT say or imply the entry goes into the hive, because it
// does not (R102, §30.7): the entry stays in the personal journal, the hive
// is created empty, and filing entries into it is C7.
const WhoStep = ({ step, subjectName, onChangeSubjectName, onNext, onDecline }) => (
  <StepShell step={step} stage="who" wash={theme.colors.washYellow}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.fillBetween}>
      <View style={styles.topContent}>
        <Text style={styles.h1}>Who's this year for?</Text>
        <View style={styles.inputCard}>
          <TextInput
            style={styles.nameInput}
            placeholder="A name"
            placeholderTextColor={theme.colors.inkSoft}
            value={subjectName}
            onChangeText={onChangeSubjectName}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={subjectName.trim() ? onNext : undefined}
            // `subject_name` is plain `text` with no length constraint, so
            // unlike the 100 on the account name this mirrors no database
            // limit — it is hygiene on a field that will be rendered inside
            // sentences ("<name>'s hive") on surfaces that don't exist yet.
            maxLength={100}
            autoFocus
          />
        </View>
      </View>
      <View style={styles.whoActions}>
        <PrimaryButton onPress={onNext} disabled={!subjectName.trim()} style={styles.floatingButton}>
          That's who
        </PrimaryButton>
        {/* Always live, never disabled: this is what keeps the beat
            non-blocking. There is no state of this screen in which the only
            way forward is to answer. */}
        <PressableScale onPress={onDecline} style={styles.declineLink} haptic={null}>
          <Text style={styles.declineLinkText}>Not this time</Text>
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  </StepShell>
);

// --- Account — the ask, now after the payoff instead of in front of it.
// --- Mirrors HoneycombAuth's create/sign-in toggle so returning testers on
// --- the same device aren't stuck re-registering. No skip: since P0-2
// --- (thread 19e90cf8) every EntryStore read/write requires a session, so
// --- exiting here used to cost one entry and now costs the whole app —
// --- TodayTab has no catch around its awaits, so a signed-out Main spins
// --- forever (Pixel, thread 19e90cf8). "Keep it" one screen back is the
// --- persistence promise; this step has to be the one that makes it true. ---
const AccountStep = ({
  step,
  name,
  email,
  password,
  onChangeName,
  onChangeEmail,
  onChangePassword,
  onNext,
  onBeforeFinish,
  initialMode = 'signup',
  navigation,
}) => {
  const [mode, setMode] = useState(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmSent, setConfirmSent] = useState(false);
  const [hiveFailed, setHiveFailed] = useState(false);
  const isSignUp = mode === 'signup';
  const canSubmit = email.trim() && password.length >= 6 && (!isSignUp || name.trim()) && !busy;

  // Both authenticated exits run through here, so the buffered writes and
  // their outcome are handled in exactly one place.
  //
  // A FAILED HIVE WRITE MUST SURFACE, and this is the only screen with a
  // user standing in front of it (C6, Lumen 2026-08-17). The two buffered
  // writes are NOT symmetric: a lost entry can be rewritten tomorrow and
  // Today's "Write today's entry" is that invitation, so its failure is
  // swallowed by design. A user who named who the year is for and was told
  // it was kept has no recovery and no surface that would ever show the
  // absence — Private Hives has no reader in the app yet. So the hive's
  // failure gets a beat of its own rather than a console.warn.
  const completeAfterAuth = async () => {
    const outcome = await onBeforeFinish?.();
    if (outcome?.hiveFailed) {
      setHiveFailed(true);
      return;
    }
    onNext();
  };

  const attemptSignIn = async () => {
    await HoneycombStore.signIn(email.trim(), password);
    await completeAfterAuth();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (isSignUp) {
        const result = await HoneycombStore.signUp(email.trim(), password, name.trim());
        if (result.session) {
          await completeAfterAuth();
        } else {
          // The third exit. It does NOT flush — there is no session, which
          // is the entire reason it exists — and it no longer needs to: the
          // buffer is on disk (PendingOnboardingWrites), and the session
          // that arrives after the user follows the confirmation link fires
          // the flush from AuthContext, in whatever process happens to be
          // running by then. The invariant this satisfies is "no exit may
          // DROP the buffer", not "every exit must write it" (C6).
          setConfirmSent(true);
        }
      } else {
        await attemptSignIn();
      }
    } catch (err) {
      // Repeat demo pass on the same device, same email — quietly try
      // signing in instead of dead-ending on "already registered." Keyed on
      // GoTrue's stable error codes (Sage, thread 14492cf2) rather than a
      // regex over `err.message` — prose isn't a contract, a copy edit on
      // the rail silently kills a string match and the quiet retry stops
      // firing with no signal.
      if (isSignUp && (err.code === 'email_exists' || err.code === 'user_already_exists')) {
        try {
          await attemptSignIn();
          return;
        } catch (signInErr) {
          // Authored copy, not the raw rail message (Sage, thread 14492cf2
          // §4) — the raw error only reaches console.warn.
          console.warn('Quiet sign-in retry failed', signInErr);
          setError('That email is already in use — try signing in.');
          setMode('signin');
          return;
        }
      }
      console.warn('Onboarding submit failed', err);
      // Sage's correction to §4 (thread 14492cf2): a flat "Something went
      // wrong" here deletes the one piece of information — wrong password —
      // that makes this screen fixable. `err.code` is GoTrue's stable
      // contract (checked against the installed @supabase/auth-js — the
      // wire body's `error_code` is normalized to `.code` on the thrown
      // error), same shape as the `err?.code === '23505'` classification in
      // HoneycombTab.js:354. Unmatched codes still fall through to the
      // authored generic line — the rail's prose never reaches the user.
      if (err.code === 'invalid_credentials') {
        setError("That email and password don't match.");
      } else if (err.code === 'over_request_rate_limit' || err.code === 'over_email_send_rate_limit') {
        setError('Too many tries — wait a moment and try again.');
      } else {
        setError('Something went wrong — try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  if (hiveFailed) {
    return (
      <StepShell step={step} stage="account" wash={theme.colors.washYellow} showMap={false}>
        <View style={styles.centerFill}>
          <Text style={styles.h1Center}>Your account is ready.</Text>
          {/* Says only what is true. It does not claim the entry is safe
              (that write has its own outcome and its own recovery), and the
              retry it promises is a real mechanism, not a reassurance: the
              answer is still buffered on disk and AuthContext flushes it
              on every session that appears, including the next cold
              launch. */}
          <Text style={styles.bodyLgCenter}>
            We couldn't save who this year is for — we'll try again next time you open Pollinate.
          </Text>
        </View>
        <PrimaryButton onPress={onNext}>Continue</PrimaryButton>
      </StepShell>
    );
  }

  if (confirmSent) {
    return (
      <StepShell step={step} stage="account" wash={theme.colors.washYellow} showMap={false}>
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
    <StepShell step={step} stage="account" wash={theme.colors.washYellow} showMap={false}>
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
      </KeyboardAvoidingView>
    </StepShell>
  );
};

// --- Controller: one flow, five beats, no forks ---
//
// Landing -> Write -> Celebration -> Who -> Keep it. There is no flow state,
// no offset arithmetic and no async resolve before the first render — the
// step index IS the beat, and `startAt` seeds it synchronously rather than
// jumping the user forward one frame after mount.
export const OnboardingFlow = ({ onDone, startAt, navigation, splashHidden }) => {
  const { session } = useAuth();
  // Seeded, not corrected by an effect: Honeycomb's empty state ("Finish
  // signup" / "Sign in") and the auth deep links land directly on the
  // account beat, and doing that in the initialiser means the Landing never
  // renders for a frame first.
  const jumpToAccount = startAt === 'signup' || startAt === 'signin';
  const [step, setStep] = useState(jumpToAccount ? STEP_ACCOUNT : STEP_LANDING);
  const [accountMode, setAccountMode] = useState(startAt === 'signin' ? 'signin' : 'signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [subjectName, setSubjectName] = useState('');

  // Both pre-auth answers buffer, because neither can be written when it is
  // collected: STEP_ENTRY and STEP_WHO both happen before STEP_ACCOUNT, and
  // EntryStore.saveEntry (P0-2) and private_hives.owner_id both require a
  // session (Sage, thread 19e90cf8: unawaited and uncaught, the entry every
  // fresh install writes was being silently discarded under the celebration
  // screen).
  //
  // The buffer moved OUT of this component and onto disk
  // (services/pendingOnboardingWrites.js). It had to: the confirm-your-email
  // exit of AccountStep navigates away and unmounts this screen while the
  // session that can perform the write is still an email link away — a ref
  // cannot survive that, and neither can a memoised promise held in one
  // (C6, Sage 2026-08-17). The single-flight property that fixed the
  // original flush race moved with it, into that module.
  const handleSaveEntry = (text) => {
    PendingOnboardingWrites.stashEntry({ text, theme: tagEntry(text) });
  };
  // The decline writes nothing and buffers nothing — an unanswered question
  // is not an empty answer.
  const handleAnswerWho = () => {
    const answer = subjectName.trim();
    if (answer) PendingOnboardingWrites.stashHive({ subjectName: answer });
    next();
  };
  const flushPendingWrites = () => PendingOnboardingWrites.flush();

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

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => Math.max(0, s - 1));

  // Demo mode resets to onboarding on every foreground resume — if this
  // device already has a real session (signed up on a previous pass), the
  // account step has nothing left to ask for. Straight into the app.
  // Still routes through the flush: a resume that revisits STEP_ENTRY with
  // a session already present buffers into the same store, and this path
  // skips AccountStep entirely — the only flush site it would otherwise
  // have gone through.
  useEffect(() => {
    if (session && step === STEP_ACCOUNT) {
      flushPendingWrites().then(finish);
    }
  }, [session, step]);

  let body;
  switch (step) {
    case STEP_LANDING:
      body = (
        <LandingStep
          step={step}
          onNext={next}
          onSignIn={() => {
            setAccountMode('signin');
            setStep(STEP_ACCOUNT);
          }}
          onSkipDemo={finish}
          splashHidden={splashHidden}
        />
      );
      break;
    case STEP_ENTRY:
      body = <FirstEntryStep step={step} onNext={next} onBack={back} onSave={handleSaveEntry} />;
      break;
    case STEP_CELEBRATION:
      body = <CelebrationStep step={step} onNext={next} />;
      break;
    case STEP_WHO:
      body = (
        <WhoStep
          step={step}
          subjectName={subjectName}
          onChangeSubjectName={setSubjectName}
          onNext={handleAnswerWho}
          onDecline={next}
        />
      );
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
          onBeforeFinish={flushPendingWrites}
          initialMode={accountMode}
          navigation={navigation}
        />
      );
  }

  return <View style={styles.flowRoot}>{body}</View>;
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
  // Centered on the 44pt icon circle that opens `topContent` (circle center
  // sits at 22,22 in that box, so a 180pt orb offsets by 22 - 90 = -68 on
  // both axes). Absolute + pointerEvents none: it never affects layout, and
  // the spill past the screen edge is intentional — light falling in, not a
  // shape sitting on the wash.
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
    // Belt-and-braces only. FlyingBee's own `fill` style is
    // `StyleSheet.absoluteFill`, which already carries `position:
    // 'absolute'`, so this sets a property to the value it already has.
    //
    // Kept, but corrected, because the old wording here was wrong about
    // exactly the thing that matters: it said the style prop is what makes
    // "fill" mean "fill the anchor." It isn't. An absolutely-positioned
    // view fills its *parent*, so the box the bee's fractional path
    // resolves against is set by `wordmarkArcAnchor` above — 220×100 — and
    // nothing a caller writes here changes it. (It also named
    // `absoluteFillObject`, the API that does not exist in RN 0.86.2 and
    // made this bee invisible until d0def1c.)
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
  bodyLgCenter: {
    ...theme.type.bodyLg,
    color: theme.colors.inkSoft,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
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
  // The Landing's returning-user link and the Who beat's decline are the
  // same object: a quiet text affordance sitting under a primary button,
  // carrying the alternative to the loud path. Same metrics, same ink.
  //
  // inkSoft, and MEASURED rather than reasoned. The obvious choice was
  // accentDeep — it is the app's link colour and reads as tappable — but on
  // washYellow (#FFF3C4) accentDeep #FF7A00 is 2.35:1, which fails 4.5:1
  // and fails the 3:1 large-text path too; these are bodySm 14px = 10.5pt,
  // so that path was never available. inkSoft #6B5F3D is 5.67:1 on the same
  // ground. A link colour is not a licence: the pair decides, never the
  // token. (The same measurement flags `switchModeText` and `consentLink`,
  // both live on main at 2.35:1 — reported separately, not changed here.)
  signInLink: {
    alignSelf: 'center',
    marginTop: 18,
  },
  signInLinkText: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    textAlign: 'center',
  },
  whoActions: {
    marginTop: 8,
  },
  // The nudge ask (§2's placement corollary). Quieter than the ink pill,
  // louder than a decline link — it is the affirmative, and a control that
  // looked like `declineLinkText` would read as the opposite of what it
  // does. The chip geometry is `SparkChips`' existing quiet-affirmative
  // control, not a new shape. Colour is forced: this beat's wash is
  // `washYellow`, where `accentDeep` measures 2.35:1 and fails 4.5:1 at
  // every size this text can be — `ink` (15.39:1) and `inkSoft` (5.67:1)
  // are the legal pair.
  nudgeSlot: {
    alignSelf: 'center',
    marginTop: 22,
  },
  nudgeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.full,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  nudgeChipText: {
    ...theme.type.bodySm,
    color: theme.colors.ink,
  },
  nudgeSettled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 11,
  },
  nudgeSettledText: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
  },
  declineLink: {
    alignSelf: 'center',
    marginTop: 18,
  },
  declineLinkText: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
    textAlign: 'center',
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

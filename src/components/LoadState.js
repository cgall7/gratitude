import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, AccessibilityInfo } from 'react-native';
import { theme } from '../constants/theme';
import { DURATIONS, useReducedMotion } from '../constants/motion';
import { PrimaryButton } from './PrimaryButton';
import { PressableScale } from './PressableScale';

// §23 — the state the app cannot express.
//
// Sage found that `finally { setLoading(false) }` renders every screen at its
// initial state, and Pixel measured what that means: for a user with no
// connections, a FAILED load and a SUCCESSFUL one render identically. Not
// similar — identical. The app owns `empty` and `loading` and has been using
// `empty` to mean `failed`.
//
// This is §23.8's one component. Four consumers: HoneycombTab, NotesInbox,
// ComposeNote, and PlantSeed (8.2, the first one built against it). The
// screens keep the §23.2 tier judgement — whether a given call's absence
// changes what the screen asserts about the user is a per-call decision and
// cannot live in here.
//
// WHAT THIS DELIBERATELY DOES NOT RENDER: `loading`, `ready` and `empty`.
// §23.4 says retry transitions to `loading` and reuses the screen's existing
// ActivityIndicator — "do not invent a third indicator" — and `empty`'s copy
// is per-screen content, not a shared slot. So those three return null and the
// screen renders its own. This component's whole subject is the two states
// that did not exist before it.
//
// COPY IS DEEZINE'S AND THERE ARE NO DEFAULTS IN HERE, on purpose. §23.3's
// draft wording is marked "to be replaced, not shipped"; a default is how a
// placeholder ships. Callers pass the slots, `check-load-state.mjs` asserts
// they did, and replacing the wording is a prop change on four call sites
// rather than an edit to this file.

// The §23.1 decision itself lives in `utils/loadState.js` — plain JS, no JSX,
// so `check-load-state.mjs` can execute it instead of reading it. Re-exported
// here so a consumer still has one import for the rule and the pixels.
//
// Imported (not just re-exported) because this file uses LOAD_STATES itself
// below — `export { X } from 'y'` forwards X to importers but creates no
// local binding, so every reference to LOAD_STATES in this module threw
// `ReferenceError` at render time until this import existed.
import { LOAD_STATES, resolveListView } from '../utils/loadState';
export { LOAD_STATES, resolveListView };

export const LoadState = ({
  state,
  onRetry,
  // §23.3 slots. title: names what could not be reached, not what the user did
  // wrong. body: one sentence, a connection problem, promising nothing about
  // data it cannot see. actionLabel: a verb, present tense.
  title,
  body,
  actionLabel,
  // §23.7 — "Try loading your hive again", not a bare "Try again". The visible
  // label is short because it sits under a sentence that already said what
  // failed; a screen reader user reaching the control has no such context.
  retryAccessibilityLabel,
  // §23.3 — `stale` is one line, not a card.
  staleLabel,
  staleActionLabel,
  style,
}) => {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state !== LOAD_STATES.UNKNOWN) return undefined;

    // §23.5 — "Reduce Motion: render at rest, no fade."
    //
    // `useReducedMotion` seeds `false` and resolves asynchronously, so a
    // Reduce Motion user can in principle see the fade start before the read
    // lands. That race is harmless HERE and it is worth saying why rather than
    // reaching for `useReducedMotionState`'s blocking `resolved` hold: the
    // worst case is a 200ms flat opacity fade with no rise and no spring —
    // which is exactly `DURATIONS.reducedMotionFade`, the value §14.1 mandates
    // as the reduced-motion collapse for every transition in the app. The
    // failure mode of the non-blocking read lands on the prescribed answer.
    // A `resolved` hold would trade that for R20's real hazard: a stuck
    // accessibility bridge delaying a failure message the user is waiting on.
    if (reduced) {
      opacity.setValue(1);
    } else {
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: DURATIONS.quick,
        useNativeDriver: true,
      }).start();
    }

    // §23.7 — the visual difference between `empty` and `unknown` carries zero
    // signal to a screen reader, so the distinction has to be spoken. Title
    // and body together: the title alone names the subject without saying
    // anything happened to it.
    if (title || body) {
      AccessibilityInfo.announceForAccessibility?.([title, body].filter(Boolean).join('. '));
    }
    return undefined;
  }, [state, reduced, opacity, title, body]);

  if (state === LOAD_STATES.STALE) {
    // §23.1a — there is content worth keeping, so the failure is a quiet line
    // above it rather than a takeover. §23.7 puts this line BEFORE the kept
    // content in reading order; that is the consumer's placement to get right,
    // and it is what the gate's §4 checks.
    return (
      <View style={[styles.staleRow, style]}>
        <Text style={styles.staleText} accessibilityRole="text">
          {staleLabel}
        </Text>
        {/* §23.4 — real content and its real CTA are still on screen, so a
            second ink pill would break §4's scarcity rule. Inline text action. */}
        <PressableScale
          onPress={onRetry}
          haptic={null}
          accessibilityRole="button"
          accessibilityLabel={retryAccessibilityLabel}
        >
          <Text style={styles.staleAction}>{staleActionLabel}</Text>
        </PressableScale>
      </View>
    );
  }

  if (state !== LOAD_STATES.UNKNOWN) return null;

  return (
    <Animated.View style={[styles.card, { opacity }, style]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {/* §23.4 — the retry is the only action on screen, so it IS the period at
          the end of the sentence. The card is inset, so a full-width-of-card
          PrimaryButton is naturally lighter than a screen CTA. */}
      <PrimaryButton
        onPress={onRetry}
        style={styles.retry}
        containerStyle={styles.retryContainer}
        accessibilityLabel={retryAccessibilityLabel}
      >
        {actionLabel}
      </PrimaryButton>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  // §23.3 — no wash. `surface` + a hairline, the same box as `addCard` and
  // `requestsCard`. Every empty state in the app wears a warm wash, so the
  // absence of one is the tell: this reads as different in kind, not merely
  // differently worded. Zero new tokens.
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.large,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    padding: 32,
    alignItems: 'center',
  },
  title: {
    ...theme.type.h2,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    // inkSoft on surface = 6.31:1, clears 4.5:1 (§23.3).
    ...theme.type.bodyLg,
    color: theme.colors.inkSoft,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  retryContainer: {
    alignSelf: 'stretch',
  },
  retry: {
    width: '100%',
  },
  staleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  staleText: {
    ...theme.type.bodySm,
    color: theme.colors.inkSoft,
  },
  staleAction: {
    ...theme.type.bodySm,
    color: theme.colors.ink,
    textDecorationLine: 'underline',
  },
});

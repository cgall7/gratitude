import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// Sunbeam §12.5 Motion QA Standard — single source of truth for every
// spring/timing curve in the app. Screens/components consume these
// constants instead of inlining friction/tension/duration literals, so
// "lots of motion" (§14.1 R9) reads as premium/cohesive rather than
// chaotic. Rule (Sage, §12.5 Section 1): "if a new animation can't be
// expressed via the shared module, that's a module problem, not a reason
// for a one-off." Extend here, not on the call site.
//
// This first pass centralizes the curves already ratified and in live use
// (BeeTransition's R7 glide spring, CelebrationBadge/AnimatedStat's §11.3
// pop spring, PressableScale's press spring, CelebrationRays/AnimatedStat's
// burst timings) with zero behavior change — same numbers, one home. The
// remaining per-screen literals (SparkChips, HoneycombGrid, Onboarding,
// EveningMirror, CoreRitual breathing loops) are follow-up work for the
// §14.1 cohesion sweep, which by design (§12.5 build-order gate) runs
// against the *settled* tree rather than re-touching files mid-flight.

export const SPRINGS = {
  // Traversal — the bee moving through space (R7 §9.4 ratified glide;
  // §12.2 ambient cruise uses the same spring). Never used for feedback/
  // reaction, only for motion along a path.
  glide: { friction: 9, tension: 60 },
  // Feedback — celebration/arrival pop. CelebrationBadge, hero numeral
  // pop (§11.4), tapestry/Wrapped beat pops.
  pop: { friction: 4, tension: 140 },
  // Press feedback — every tappable's scale-down/spring-back (PressableScale).
  press: { friction: 6, tension: 200 },
  // Burst ray spring — CelebrationRays' staggered ray reveal (§11.3).
  ray: { friction: 6, tension: 100 },
  // Reveal spring — non-numeric AnimatedStat entrances (theme words, quotes).
  reveal: { friction: 7, tension: 120 },
  // Tab icon landing spring (MainTabs TabIcon) — bigger, snappier arrival.
  land: { friction: 5, tension: 220 },
  // Tick — fast sequential pops for streak hexes / tapestry cells igniting
  // one-by-one (§14.2 Beat 2 "Streak," Beat 5 "Tapestry").
  tick: { friction: 6, tension: 180 },
};

export const DURATIONS = {
  // Click/burst treatments — §12.5 Rule 2: must stay sub-200ms so they
  // never queue or feel laggy.
  instant: 120,
  quick: 200,
  // Celebration burst particle scatter (§11.3 CelebrationRays).
  celebrate: 500,
  // Hero numeral glow-ring pop-in (§11.4 AnimatedStat "arrival").
  arrival: 400,
  // Hero numeral count-up duration (AnimatedStat numeric path).
  reveal: 700,
  // Bee glow-trail particle drift + fade (§12.2: "drift and fade out over
  // ~600-900ms" — midpoint).
  trailFade: 750,
  // §14.1 mandate: reduced motion collapses every spring/transition to a
  // flat fade at this duration — "no exceptions." (This is the more recent,
  // explicit ruling; §12.5's own text says "~150ms" for the same case —
  // flagged here for Pixel's gate read, both land as "fast, no bounce.")
  reducedMotionFade: 200,
};

// Cascade delay between staggered children (list items, tapestry cells,
// theme card reveals) — §14.1 "40-60ms cascade."
export const STAGGER_MS = 50;

// Hard cap for any particle-based effect (bee glow trail, celebration
// burst). §12.5 Rule 3: FlyingBee trail is the #1 low-end perf risk.
export const MAX_TRAIL_PARTICLES = 12;

// Reduced-motion, first-class (§12.5 Rule 4) — one hook, subscribed to
// live OS changes (not just read-once-at-mount), so a mid-session
// accessibility toggle takes effect immediately.
//
// R18 (Pixel): the initial read is async (a promise), so every consumer's
// first render sees a value that hasn't been confirmed yet. This hook
// resolves that to `null` rather than `false` specifically so it stays
// backward compatible: `if (reduced)` reads null as falsy, identical to
// the old default-false behavior, so nothing already written against this
// hook needs to change. Only a component that fires a one-time side effect
// on mount (a haptic, a spring that must not run under Reduce Motion)
// needs to add `if (reduced === null) return;` and wait one render for the
// real answer instead of assuming full-motion and racing the promise
// (StreakHexTrail was the worst case — see R18).
export const useReducedMotion = () => {
  const [reduced, setReduced] = useState(null);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((value) => mounted && setReduced(!!value))
      .catch(() => mounted && setReduced(false));
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (value) => {
      if (mounted) setReduced(!!value);
    });
    return () => {
      mounted = false;
      subscription?.remove?.();
    };
  }, []);

  return reduced;
};

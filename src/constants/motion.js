import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing } from 'react-native';

// Sunbeam §12.5 Motion QA Standard — single source of truth for every
// spring/timing curve in the app. Screens/components consume these
// constants instead of inlining friction/tension/duration literals, so
// "lots of motion" (§14.1 R9) reads as premium/cohesive rather than
// chaotic. Rule (Sage, §12.5 Section 1): "if a new animation can't be
// expressed via the shared module, that's a module problem, not a reason
// for a one-off." Extend here, not on the call site.
//
// Luxury pass (Lumen, 2026-08-20): this module's own docstring used to
// claim it had already collected BeeTransition, CelebrationRays,
// AnimatedStat, CelebrationBadge and PressableScale onto SPRINGS/DURATIONS
// — it hadn't; all five still ran inline literals byte-identical to the
// values declared here. That was a spec defect, not drift. Every call site
// named above (plus MainTabs' TabIcon landing spring and HoneycombGrid's
// reveal-card duration) now actually imports and uses these constants.
// Remaining per-screen literals (SparkChips, Onboarding, EveningMirror,
// CoreRitual breathing loops) are still follow-up work for the §14.1
// cohesion sweep, which by design (§12.5 build-order gate) runs against
// the *settled* tree rather than re-touching files mid-flight.

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

// Press-depth law (Lumen, luxury pass 2026-08-20): three depths shipped
// with no rule — 0.88 (TabBarButton), 0.96 (PressableScale), 0.97
// (PrimaryButton). Inverse of what shipped: the *larger* the surface, the
// *smaller* the travel, because a big slab moving 4% reads as collapsing
// rather than depressing. Two values, no third.
export const PRESS = {
  // Everything — the tab icon's 0.88 was a toy-grade squash and is retired.
  standard: 0.96,
  // Full-width elements (>=200pt wide) — PrimaryButton's 0.97 rounds up so
  // the app's one CTA doesn't collapse.
  slab: 0.98,
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
  // Reflective-surface reveal — a card fading up under the thing you just
  // tapped. §17.5's motion register: taps on Recap resolve with glide, not
  // celebration, so this is deliberately longer than `quick` and carries no
  // spring. HoneycombGrid's reveal card already runs this exact number as a
  // literal; collecting that call site belongs to the §14.1 cohesion sweep
  // against the settled tree, not to a branch in flight.
  revealGlide: 260,
  // §14.1 mandate: reduced motion collapses every spring/transition to a
  // flat fade at this duration — "no exceptions." Supersedes §12.5's
  // approximate "~150ms" for the same case (settled at Pixel's gate, logged
  // in the Review Log — don't re-open it).
  reducedMotionFade: 200,
};

// Cascade delay between staggered children (list items, tapestry cells,
// theme card reveals) — §14.1 "40-60ms cascade."
// Honey drip register (Lumen, luxury pass 2026-08-20) — the hex-tap
// centerpiece's timing, and its own law: honey never springs. A spring is
// elastic; honey is viscous and inelastic — it swells, it necks, it
// pinches, it falls under gravity, it pools. Eased timings and an
// accelerating gravity curve only. Banned from `SPRINGS` on purpose: if
// you're reaching for a spring here, what you're building is water.
//
// Total ~3.1s played straight through — deliberately long. Honey is
// allowed to outlast the tap that triggered it.
export const HONEY = {
  swell: 700, // bead gathers at origin — HONEY_EASING.swell
  neck: 380, // the column thins. THE signature moment — Deezine's storyboard
  // scores its shape (bead position, minimum neck width, drip count); this
  // module owns only the duration until that lands.
  fall: 900, // release — HONEY_EASING.fall. Accelerating. No overshoot, no settle.
  pool: 1100, // spread + fade at rest — HONEY_EASING.pool
};

// Per-phase easings for `HONEY`, kept alongside the durations so a caller
// never has to guess which curve goes with which number.
export const HONEY_EASING = {
  swell: Easing.out(Easing.quad),
  // `neck` has no ratified easing yet — same reason its geometry is
  // TBD above. Do not default this to something that looks finished;
  // an unscored phase should read as unscored.
  fall: Easing.in(Easing.quad),
  pool: Easing.out(Easing.cubic),
};

export const STAGGER_MS = 50;

// §14.1 amendment (R24, Pixel). §14.1's per-item step is calibrated for a
// 5-10 row list; what's actually ratified is how a cascade *feels*, and
// that's its total length, not its step. Multiplying a fixed step by a
// dense collection breaks the thing the rule exists to protect — 30
// calendar cells at `STAGGER_MS` is a 1.5s wait for the grid to settle.
// So dense collections divide a budget instead.
export const CASCADE_BUDGET_MS = 700;

// Per-item delay for a cascade of `count` items. Below ~14 items the
// budget isn't binding and this returns `STAGGER_MS` exactly, so every
// existing call site is byte-identical — a change to the shared module
// must not move a single merged consumer (R19).
export const staggerDelay = (index, count = 1) =>
  index * Math.min(STAGGER_MS, Math.ceil(CASCADE_BUDGET_MS / Math.max(count, 1)));

// Hard cap for any particle-based effect (bee glow trail, celebration
// burst). §12.5 Rule 3: FlyingBee trail is the #1 low-end perf risk.
export const MAX_TRAIL_PARTICLES = 12;

// Reduced-motion, first-class (§12.5 Rule 4) — one hook, subscribed to
// live OS changes (not just read-once-at-mount), so a mid-session
// accessibility toggle takes effect immediately.
//
// Deliberately `useState(false)`, not `useState(null)` — R19 (Pixel):
// resolving `false` onto an already-`false` state is a no-op write, so
// React bails out and skips the re-render for the (large majority)
// Reduce-Motion-off case, meaning every `[reduced]`-dep effect across the
// 7 existing consumers (FlyingBee, GlowOrb, HoneycombGrid, StaggeredItem,
// StreakBadge, EveningMirror, PollinateWrapped) runs exactly once. Seeding
// `null` breaks that bail-out for everyone, not just Reduce-Motion users —
// `null -> false` is a real state change, so it was a universal double-run
// regression traded for fixing a race in three new components. Don't
// change this hook's contract; see `useReducedMotionState` below instead.
export const useReducedMotion = () => {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((value) => mounted && setReduced(!!value))
      .catch(() => {});
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

// R19 (Pixel): opt-in sibling for a component that fires a one-time side
// effect on mount (a haptic, a spring that must not run at all under
// Reduce Motion) and needs to hold its first frame until the OS
// preference is actually known, instead of assuming full-motion and
// racing the async read. `resolved` starts `false` and flips exactly once
// per mount, regardless of which way `reduced` lands, so effect deps on
// `resolved` cost the same single extra run for every user — not just the
// asymmetric hit `useReducedMotion` seeding `null` would have caused.
// `useReducedMotion` itself keeps its exact original contract and its
// bail-out; this is additive, not a replacement, so the 7 merged
// consumers need no changes and no re-audit.
// R20 (Pixel): a `resolved` hold turns a failed accessibility read from
// cosmetic (assume full motion, animate anyway) into blocking (nothing
// runs, the ceremony stalls). `.catch` covers the realistic case
// (rejection); this covers the read never settling at all — cheap
// insurance so a stuck native bridge can't hang the app's emotional peak.
const RESOLVE_TIMEOUT_MS = 750;

export const useReducedMotionState = () => {
  const [state, setState] = useState({ reduced: false, resolved: false });

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((value) => mounted && setState({ reduced: !!value, resolved: true }))
      .catch(() => mounted && setState({ reduced: false, resolved: true }));
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (value) => {
      if (mounted) setState({ reduced: !!value, resolved: true });
    });
    const timeout = setTimeout(() => {
      if (mounted) setState((prev) => (prev.resolved ? prev : { ...prev, resolved: true }));
    }, RESOLVE_TIMEOUT_MS);
    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription?.remove?.();
    };
  }, []);

  return state;
};

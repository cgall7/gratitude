import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet, Pressable, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Polygon, Path, Line, G, Defs, ClipPath, Image as SvgImage } from 'react-native-svg';
import { theme } from '../constants/theme';
import { hexTintFor } from './Avatar';
import { hexPoints, hexEdgeMarks, hexSealPath } from './HexShape';
import { useSvgId } from '../utils/svgId';
import { DURATIONS, HONEY, HONEY_EASING, PRESS, STAGGER_MS, useReducedMotion } from '../constants/motion';
import { drip as dripHaptics } from '../constants/haptics';
import { HexTapOverlay } from './HexTapOverlay';
import {
  buildCombLayout,
  cellCentre,
  hexSpiral,
  personKey,
  ringStepFor,
  shouldAbortPollination,
} from './combLattice';

// Lane D — the hex-tap honey drip's beat boundaries in ms from contact.
// `HONEY` only names swell/neck/fall/pool (Beats 3-6); contact and ignition
// (Beats 1-2) aren't bead motion, so they're not in that module — named here
// instead of left as bare literals scattered through the timeline below.
const CONTACT_MS = 180;
const IGNITION_MS = 80;

// Re-exported because the comb's identity rule is one expression and this is
// where the rest of the app already reaches for it. `combLattice` owns it —
// it has to be importable by a gate, and a component file is not.
export { personKey };

const AnimatedG = Animated.createAnimatedComponent(G);

// ONE ring around one centre. A hex spiral only closes at 1, 7, 19 — at any
// other count the outer ring is part-built and the whole cluster hangs off
// to one side, which is what the old cap of 12 did: it left ring 2 five
// twelfths filled, so the shape's centre of area sat 29.4pt below "You".
// Seven is the first count that closes, and it is also an honest size for a
// gratitude circle.
//
// It stays declared HERE, not in `combLattice`, and deliberately:
// `check-demo-hive.mjs:74` reads this file by path and unwraps a regex match
// for it with no null guard, so moving the declaration fails that gate as a
// TypeError rather than as a diagnosis. The geometry moved; the number
// another gate reads off this file did not.
export const HIVE_SLOTS = 7;
const SPIRAL = hexSpiral(1);

const initialsFor = (name) => {
  const parts = (name || '?').trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase();
};

// The cell IS the portrait. Before this the grid drew a hexagon and then
// dropped a fully opaque circle on top of it, so the honeycomb read as
// circles with corners peeking out — two shapes fighting, at two different
// densities, for one person. The photo (or the initials wash) is clipped to
// the hexagon, so a face is simply a cell in a comb.
// Demo members sit a register back from real ones — present enough that the
// comb reads as populated, quiet enough that they never pass for someone you
// actually know.
// Was 0.45 dimming the initials glyph too, at 2.84:1 — but that's the
// large-text bar (18pt/14pt-bold; RN `fontSize` is dp not pt, so the real
// thresholds are 24px/18.66px) and this glyph is 18.48px regular, which
// needs 4.5:1. Bumping opacity to clear that bar lands at register 0.605 —
// no longer "a register back," most of the way to a real member (Sage,
// msg 3182e438). Fix instead: initials no longer ride `register` at all
// (see the Text below) — the glyph is legible at full opacity regardless
// of demo/real, and 0.45 is restored as R55's device-measured fill value.
const DEMO_OPACITY = 0.45;

// §21/6.4 (Pixel-ruled 2026-08-13, mock 2dcdce11): the blooming ring's two
// load-bearing numbers, measured against selection's solid 2.5pt stroke so
// the two states differ in form (dashed vs. continuous) rather than only in
// weight, which read as the same mark at a glance.
const BLOOM_RING_INSET = 4.5;
const BLOOM_MARK_EDGE_FRACTION = 0.3;

// Breathing cadence: no `DURATIONS.breathe` constant exists yet (motion.js
// still lists honeycomb breathing loops as unextracted §14.1 follow-up), so
// this reuses GlowOrb's ratified 2400ms half-cycle rather than inventing a
// new number — same anchor the rest of the app's "breathe" treatments use.
//
// §12.5.1b (R61, Pixel's catch): the anchor only covers CADENCE. The floor
// (below) is a separate number and was NOT borrowed from GlowOrb — its
// 25% swing is not this ring's 55%. Citing the anchor for the whole
// animation is what let an invented depth pass as ratified. The floor is
// now measured against the contrast bar it has to clear, not against
// GlowOrb's.
const BLOOM_BREATHE_MS = 2400;
// Ring floor. inkSoft on a wash is ink-on-ground, so this is a luminance
// question (WCAG 1.4.11 non-text, 3:1) — 0.45 measured 1.93:1/1.94:1 on
// the two real-member grounds (washSky/washYellow), 47% of every cycle
// below the bar. 0.75 clears both at 3.30:1/3.34:1 with margin; the
// crossing point is 0.700. Peak (1.0) and cadence are untouched.
const BLOOM_FLOOR_OPACITY = 0.75;

// The blooming state: a segmented ring, not a wash, because fill is spent
// on identity (`hexTintFor`) and its range is capped by whichever tint a
// member's name hashed to — a washSky member's full fill range measured at
// less than half of washYellow's, so state can't live there without some
// friends permanently reading quieter than others. Marks are tint-
// independent and stack with `seeded` for free (a cell can be both).
// Static under Reduce Motion — the ring itself never disappears (R46); only
// the breathe does.
const BloomRing = ({ size, reduced }) => {
  const pulse = useRef(new Animated.Value(1)).current;
  const marks = useMemo(() => hexEdgeMarks(size, BLOOM_RING_INSET, BLOOM_MARK_EDGE_FRACTION), [size]);

  useEffect(() => {
    if (reduced) {
      pulse.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: BLOOM_FLOOR_OPACITY, duration: BLOOM_BREATHE_MS, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: BLOOM_BREATHE_MS, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, pulse]);

  return (
    <AnimatedG opacity={pulse}>
      {marks.map(([x1, y1, x2, y2], i) => (
        <Line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={theme.colors.inkSoft}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      ))}
    </AnimatedG>
  );
};

const FilledCell = ({ member, size, selected, reduced }) => {
  const clipId = useSvgId('hivecell');
  const points = useMemo(() => hexPoints(size), [size]);
  const sealPath = useMemo(() => hexSealPath(size), [size]);
  const tint = hexTintFor(member.name);
  const register = member.isDemo && !selected ? DEMO_OPACITY : 1;

  return (
    <View>
      <Svg width={size * 2} height={size * 2}>
        <Defs>
          <ClipPath id={clipId}>
            <Polygon points={points} />
          </ClipPath>
        </Defs>
        {/* The cell is dimmed against `surface`, never against the screen.
            Fading the whole cell down onto Sunlit Honey (`background`,
            #FFF7CC — this container is transparent, so that is the ground)
            composites a cool wash over a warm ground and lands somewhere
            neither token names:
            washSky at this register measured (243,245,225) on device —
            green as the max channel, a sage cell in a honey comb. Backing
            the tint with white first keeps blue the max channel (243,249,253)
            and keeps the dimming a matter of strength, not of hue. */}
        <Polygon points={points} fill={theme.colors.surface} />
        {member.avatarUrl ? (
          <SvgImage
            href={{ uri: member.avatarUrl }}
            x="0"
            y="0"
            width={size * 2}
            height={size * 2}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${clipId})`}
            opacity={register}
          />
        ) : (
          <Polygon points={points} fill={tint} fillOpacity={register} />
        )}
        {/* Seeded: knocked out to whatever's already painted above (the
            avatar/tint), not a second colour — R51's register rule. Drawn
            in this same Svg so the hole shows that fill, not a blank gap. */}
        {member.seeded && <Path d={sealPath} fill={theme.colors.ink} fillRule="evenodd" />}
        {member.blooming && <BloomRing size={size} reduced={reduced} />}
        {/* Beat 1 (Lane D): surface -> ink on tap, width held constant at
            2.5pt — "no width change, the luxury is restraint here." Width
            used to jump 2 -> 2.5 with the colour; that's the one part of
            this line the spec explicitly rules out. */}
        <Polygon
          points={points}
          fill="none"
          stroke={selected ? theme.colors.ink : theme.colors.surface}
          strokeWidth={2.5}
        />
      </Svg>
      {!member.avatarUrl && (
        <View style={styles.cellOverlay} pointerEvents="none">
          <Text style={[styles.initials, { fontSize: size * 0.42 }]}>
            {member.isOwn ? 'You' : initialsFor(member.name)}
          </Text>
        </View>
      )}
    </View>
  );
};

// An empty seat, and an honest one: a quiet outline with a `+`. The grid
// used to fabricate strangers to fill these, which made a hive of one look
// like a hive of twelve. An empty cell is also the invite target — the
// gap in the comb is the thing you tap to close it.
const EmptyCell = ({ size }) => {
  const points = useMemo(() => hexPoints(size), [size]);

  return (
    <View accessibilityLabel="a seat for someone">
      <Svg width={size * 2} height={size * 2}>
        <Polygon
          points={points}
          fill={theme.colors.surface}
          fillOpacity={0.45}
          stroke={theme.colors.surfaceBorderStrong}
          strokeWidth={1.5}
        />
      </Svg>
      <View style={styles.cellOverlay} pointerEvents="none">
        <Text style={[styles.plus, { fontSize: size * 0.5 }]}>+</Text>
      </View>
    </View>
  );
};

const HexCell = ({ member, size, x, y, delay, selected, reduced, pressDepth }) => {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: reduced ? DURATIONS.reducedMotionFade : 420,
      delay: reduced ? 0 : delay,
      easing: reduced ? Easing.linear : Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  }, [progress, delay, reduced]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : 0.15, 1] });
  // Beat 1's press depression rides on top of the entrance scale, and only
  // on the cell that's actually selected — `pressDepth` is one shared value
  // (only one cell can be selected at a time), so every other cell's
  // transform is untouched.
  const cellScale = selected && !reduced ? Animated.multiply(scale, pressDepth) : scale;

  return (
    <Animated.View
      style={[
        styles.cellWrap,
        {
          left: x,
          top: y,
          width: size * 2,
          height: size * 2,
          transform: [{ scale: cellScale }],
          opacity: progress,
        },
      ]}
    >
      {member ? (
        <FilledCell member={member} size={size} selected={selected} reduced={reduced} />
      ) : (
        <EmptyCell size={size} />
      )}
    </Animated.View>
  );
};

// The hive's Today view: who in your circle has shared today. Seven seats,
// you in the middle, one ring around you. Tap a face to read what they
// wrote; tap a gap to invite someone into it.
export const HoneycombGrid = ({
  members,
  cellSize = 44,
  onInvitePress,
  // §28.9 — the two triggers, and the shape they come in is the ruling.
  // `scrollYRef` is read BY VALUE (the aim point moved); `scrollTick` carries
  // no information at all and exists only to re-run the check. **Put
  // completeness in the trigger and correctness in the predicate: an
  // over-firing trigger with a by-value predicate is safe; an exact trigger
  // with a reference predicate is not.**
  scrollYRef,
  scrollTick = 0,
  onPollinate,
  onPollinateCancel,
  activePollinationKey = null,
}) => {
  // HOLD THE KEY, DERIVE THE MEMBER (§28.9 correction 3, Sage's find). The
  // old shape put the whole member object in state at tap time and never
  // refreshed it, so the ring compared a captured share id against a live one
  // while the card rendered the captured name and quote. Two readings of the
  // same selection, one live and one frozen, kept in step by nothing.
  //
  // Deriving makes their agreement structural: ring and card read the same
  // member out of the same list on the same render. It also closes the case
  // that is reachable in today's build — the demo set fills all seven seats,
  // so the first real share of the day evicts the seventh member; if that is
  // who you tapped, `selected` goes null and the card closes instead of
  // hanging there quoting someone with no cell.
  const [selectedId, setSelectedId] = useState(null);
  const selected = selectedId === null ? null : members.find((m) => personKey(m) === selectedId) ?? null;
  const reduced = useReducedMotion();
  const cameraProgress = useRef(new Animated.Value(0)).current;
  const revealProgress = useRef(new Animated.Value(0)).current;

  // Lane D — the honey drip's own animated values. `revealProgress` and
  // `cameraProgress` already exist and are reused (ruling 3(b)); everything
  // below is new, one value per beat that needs its own progress or opacity.
  const pressDepth = useRef(new Animated.Value(1)).current;
  const glowBloomOpacity = useRef(new Animated.Value(0)).current;
  const glowRestOpacity = useRef(new Animated.Value(0)).current;
  const honeyDecay = useRef(new Animated.Value(1)).current;
  const beadProgress = useRef(new Animated.Value(0)).current;
  const neckProgress = useRef(new Animated.Value(0)).current;
  const fallProgress = useRef(new Animated.Value(0)).current;
  const poolProgress = useRef(new Animated.Value(0)).current;
  const pinchTimeoutRef = useRef(null);
  // Ruling 3(a): the scrim's centre is cluster-space + the cluster's own
  // origin in container space, measured once via `onLayout` rather than
  // assumed — `stage` has no padding and is `container`'s first child, so
  // this `onLayout` (relative to `stage`) already IS the container-space
  // origin (Lumen's ruling; don't re-derive it).
  const [clusterOrigin, setClusterOrigin] = useState(null);
  const [tapCentre, setTapCentre] = useState(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => () => {
    if (pinchTimeoutRef.current) clearTimeout(pinchTimeoutRef.current);
  }, []);

  useEffect(() => {
    Animated.timing(cameraProgress, {
      toValue: 1,
      duration: reduced ? DURATIONS.reducedMotionFade : 600,
      easing: reduced ? Easing.linear : Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [cameraProgress, reduced]);

  // Seating and the hit-test are `combLattice`'s (one implementation, and an
  // importable one — §28.9 gate row 8). This memo is only the binding.
  const layout = useMemo(
    () => buildCombLayout(members.slice(0, HIVE_SLOTS), cellSize, SPIRAL),
    [members, cellSize]
  );

  // A selection that stops resolving is dropped, not kept. Without this the
  // key survives the member: tap someone, a refresh evicts them (card closes,
  // correctly), a later refresh brings them back — and the card would reopen
  // on its own, asserting a selection the user never made twice.
  useEffect(() => {
    if (selectedId !== null && selected === null) setSelectedId(null);
  }, [selectedId, selected]);

  // §28.9 — the flight in the air, from the comb's side: which person it was
  // aimed at, and where the aim point sat in cluster space when the tap
  // happened. Held in a ref because nothing renders from it.
  const aimRef = useRef(null);
  const pollinationKeyRef = useRef(0);
  const readScrollY = () => scrollYRef?.current ?? 0;

  const handleSelect = (member, tap) => {
    revealProgress.setValue(0);
    setSelectedId(personKey(member));
    // §28.1 — the CELL answers at t=0. The stroke was already here; the
    // haptic is new, and it is what makes the acknowledgement independent of
    // the bee. Everything the beat asserts is carried by the stroke, the
    // haptic and the card, which is why §28.6 owes accessibility nothing
    // extra: a user who never perceives the flight loses nothing.
    if (reduced) {
      // Reduced Motion collapses the whole honey score to the cell + card
      // (§28.6's rule, extended here) — no scrim, no glow, no bead. The
      // acceptance bar's "instant pool" variant is still open; this is the
      // conservative reading (skip the drip rather than fake an instant one)
      // until that's reviewed on-device.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } else {
      const cell = layout.cells.find((c) => c.member && personKey(c.member) === personKey(member));
      setTapCentre(cell ? cellCentre(cell, cellSize) : null);
      startHoneyDrip();
    }
    Animated.timing(revealProgress, {
      toValue: 1,
      duration: reduced ? DURATIONS.reducedMotionFade : DURATIONS.revealGlide,
      easing: reduced ? Easing.linear : Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    requestPollination(member, tap);
  };

  // Lane D — the honey drip's own haptic + motion score, run fresh on every
  // tap. Beat 1's stroke/press-depth are on the cell itself (`HexCell`
  // below); this schedules everything the SVG overlay reads.
  const startHoneyDrip = () => {
    if (pinchTimeoutRef.current) clearTimeout(pinchTimeoutRef.current);

    dripHaptics.swell();
    pinchTimeoutRef.current = setTimeout(() => {
      dripHaptics.pinch();
    }, CONTACT_MS + IGNITION_MS + HONEY.swell + HONEY.neck);

    pressDepth.setValue(1);
    honeyDecay.setValue(1);
    glowBloomOpacity.setValue(0);
    glowRestOpacity.setValue(0);
    beadProgress.setValue(0);
    neckProgress.setValue(0);
    fallProgress.setValue(0);
    poolProgress.setValue(0);

    // Beat 1 — press depression, ease-in-out across the contact window.
    Animated.sequence([
      Animated.timing(pressDepth, {
        toValue: PRESS.standard,
        duration: CONTACT_MS / 2,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(pressDepth, {
        toValue: 1,
        duration: CONTACT_MS / 2,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    // Beat 2 — glow ignites, then crossfades bloom -> rest across Beat 3.
    Animated.sequence([
      Animated.delay(CONTACT_MS),
      Animated.timing(glowBloomOpacity, {
        toValue: 1,
        duration: IGNITION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(glowBloomOpacity, {
        toValue: 0,
        duration: HONEY.swell,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    Animated.sequence([
      Animated.delay(CONTACT_MS + IGNITION_MS),
      Animated.timing(glowRestOpacity, {
        toValue: 1,
        duration: HONEY.swell,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Beat 3 — swell.
    Animated.sequence([
      Animated.delay(CONTACT_MS + IGNITION_MS),
      Animated.timing(beadProgress, {
        toValue: 1,
        duration: HONEY.swell,
        easing: HONEY_EASING.swell,
        useNativeDriver: false,
      }),
    ]).start();

    // Beat 4 — neck.
    Animated.sequence([
      Animated.delay(CONTACT_MS + IGNITION_MS + HONEY.swell),
      Animated.timing(neckProgress, {
        toValue: 1,
        duration: HONEY.neck,
        easing: Easing.in(Easing.quad),
        useNativeDriver: false,
      }),
    ]).start();

    // Beat 5 — fall.
    Animated.sequence([
      Animated.delay(CONTACT_MS + IGNITION_MS + HONEY.swell + HONEY.neck),
      Animated.timing(fallProgress, {
        toValue: 1,
        duration: HONEY.fall,
        easing: HONEY_EASING.fall,
        useNativeDriver: false,
      }),
    ]).start();

    // Beat 6 — pool, with the room's dim/glow releasing on the same window
    // (§5's open decay question — ruled here: the room goes dark exactly as
    // the light that was dimming it goes out, one envelope not two).
    Animated.sequence([
      Animated.delay(CONTACT_MS + IGNITION_MS + HONEY.swell + HONEY.neck + HONEY.fall),
      Animated.timing(poolProgress, {
        toValue: 1,
        duration: HONEY.pool,
        easing: HONEY_EASING.pool,
        useNativeDriver: false,
      }),
    ]).start();
    Animated.sequence([
      Animated.delay(CONTACT_MS + IGNITION_MS + HONEY.swell + HONEY.neck + HONEY.fall),
      Animated.timing(honeyDecay, {
        toValue: 0,
        duration: HONEY.pool,
        easing: HONEY_EASING.pool,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const requestPollination = (member, tap) => {
    // Under Reduce Motion there is no bee to break from — `FlyingBee` renders
    // the parked breathing pose — so the beat collapses to what the cell does
    // (§28.6). Not a special case: a property of the rig.
    if (!onPollinate || reduced) return;
    const cell = layout.cells.find((c) => c.member && personKey(c.member) === personKey(member));
    if (!cell) return;
    // Cell centres sit at (x + cellSize, y + cellSize) in cluster space — the
    // same offset `hitTest` undoes before inverting, one expression shared
    // with the scrim's centre calc in `handleSelect` (`combLattice.cellCentre`).
    const centre = cellCentre(cell, cellSize);
    // The tap hands us BOTH coordinate systems for one physical point:
    // `locationX/Y` in cluster space (what `hitTest` reads) and `pageX/Y` in
    // window space (what the flight needs). Subtracting gives the cluster's
    // window origin with no `measureInWindow` and no extra frame.
    //
    // Exact once the camera dive has settled. During its first 600ms the
    // cluster is scaled, so a translation derived at the tap point drifts by
    // (scale − 1) × (centre − tapPoint) elsewhere — bounded by one cell, and
    // the flight is ~1s long, so the camera has settled well before touchdown
    // either way. Named rather than assumed, per §28.2.
    const origin = { x: tap.pageX - tap.locationX, y: tap.pageY - tap.locationY };
    pollinationKeyRef.current += 1;
    const key = pollinationKeyRef.current;
    aimRef.current = {
      key,
      personId: personKey(member),
      localX: centre.x,
      localY: centre.y,
      scrollY: readScrollY(),
    };
    onPollinate({
      key,
      x: origin.x + centre.x,
      y: origin.y + centre.y,
      ringStep: ringStepFor(cellSize),
    });
  };

  // §28.9 correction 1 + 2 — **abort when the point the bee is aimed at would
  // no longer resolve, under the comb's OWN hit-test, to the PERSON the user
  // tapped.** The predicate itself lives in `combLattice` beside the
  // hit-test, because gate row 8 asserts they are one thing and not two.
  //
  // `hitTest` has two inputs, so the trigger set is the union of what can
  // change either — the aim point (scroll) and the seating (`layout`
  // identity, memoized on the definition of what can re-seat). Both are here.
  // `layout`'s identity changes on every parent render, which is fine: it is
  // the trigger, and the decision is the by-value person check.
  useEffect(() => {
    const aim = aimRef.current;
    if (!aim || aim.key !== activePollinationKey) return;
    if (shouldAbortPollination(layout, aim, readScrollY())) {
      aimRef.current = null;
      onPollinateCancel?.();
    }
  }, [layout, scrollTick, activePollinationKey]);

  // The camera dive-in is the screen's signature move, but it's also pure
  // travel — under Reduce Motion the cluster simply fades up in place.
  const cameraScale = cameraProgress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : 1.8, 1] });

  // Ruling 3(a): container's own box, for the SVG overlay's `width`/`height`
  // — `StyleSheet.absoluteFill` covers a View for free, but an `<Svg>` needs
  // its canvas size stated, and this is the only container-space size the
  // component doesn't already have from `layout`.
  const centreForOverlay =
    clusterOrigin && tapCentre ? { x: clusterOrigin.x + tapCentre.x, y: clusterOrigin.y + tapCentre.y } : null;

  return (
    <View style={styles.container} onLayout={(e) => setContainerSize(e.nativeEvent.layout)}>
      <View style={[styles.stage, { height: layout.height + 24 }]}>
        <Animated.View
          onLayout={(e) => setClusterOrigin({ x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y })}
          style={{
            width: layout.width,
            height: layout.height,
            alignSelf: 'center',
            transform: [{ scale: cameraScale }],
            opacity: cameraProgress,
          }}
        >
          {layout.cells.map(({ key, member, x, y, index }) => (
            <HexCell
              key={key}
              member={member}
              size={cellSize}
              x={x}
              y={y}
              delay={index * STAGGER_MS}
              selected={!!member && selectedId !== null && personKey(member) === selectedId}
              reduced={reduced}
              pressDepth={pressDepth}
            />
          ))}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={(e) => {
              const { locationX, locationY, pageX, pageY } = e.nativeEvent;
              const hit = layout.hitTest(locationX, locationY);
              if (!hit) return;
              if (hit.member) handleSelect(hit.member, { locationX, locationY, pageX, pageY });
              else onInvitePress?.();
            }}
            accessible={false}
          />
        </Animated.View>
      </View>

      {/* Ruling 4 — container-level, between stage and the reveal card, so
          the card lands inside the dimmed region (Option A's continuity). */}
      <HexTapOverlay
        width={containerSize.width}
        height={containerSize.height}
        center={centreForOverlay}
        cellSize={cellSize}
        cameraProgress={cameraProgress}
        revealProgress={revealProgress}
        honeyDecay={honeyDecay}
        glowBloomOpacity={glowBloomOpacity}
        glowRestOpacity={glowRestOpacity}
        beadProgress={beadProgress}
        neckProgress={neckProgress}
        fallProgress={fallProgress}
        poolProgress={poolProgress}
      />

      {selected && (
        <Animated.View
          style={[
            styles.revealCard,
            {
              opacity: revealProgress,
              transform: [
                {
                  translateY: revealProgress.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : 10, 0] }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.revealName}>{selected.isOwn ? 'You' : selected.name}</Text>
          <Text style={styles.revealQuote}>"{selected.gratitude}"</Text>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellWrap: {
    position: 'absolute',
  },
  cellOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: theme.fonts.bodySemiBold,
    color: theme.colors.ink,
  },
  plus: {
    fontFamily: theme.fonts.body,
    color: theme.colors.inkSoft,
    opacity: 0.55,
  },
  revealCard: {
    marginTop: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.surfaceBorder,
    borderRadius: theme.borderRadius.large,
    padding: 16,
    ...theme.shadows.card,
  },
  revealName: {
    ...theme.type.label,
    color: theme.colors.inkSoft,
    marginBottom: 8,
  },
  revealQuote: {
    fontFamily: theme.fonts.bodyItalic,
    fontSize: 16,
    lineHeight: 22,
    color: theme.colors.textPrimary,
  },
});

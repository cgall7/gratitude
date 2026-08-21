import * as Haptics from 'expo-haptics';

// Haptic *sequences*, not another single impact (Lumen, luxury pass
// 2026-08-20). Five one-off `Haptics.impactAsync(...)` call shapes already
// exist across the app and none of them are a pattern — Colin's word was
// "vibrates," and a lone Medium impact is a click. A sequence must mirror
// the visual it rides with or it reads as a separate event bolted on, so
// each pattern here is named for the `HONEY` phase it accompanies rather
// than for the taps it fires.
//
// `.catch(() => {})` on every call: a missing haptic is silent, a thrown
// promise rejection crashing an animation sequence is not.
export const drip = {
  // Light -> Light -> Medium over ~180ms. It rises — the bead gathering at
  // the cell before it starts to swell. Fires at contact, ahead of
  // `HONEY.swell`'s visual start.
  swell: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}), 90);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}), 180);
  },
  // One sharp Heavy — fired on the neck's separation frame, once Deezine's
  // storyboard names when that frame is. THE signature haptic, same as
  // `HONEY.neck` is the signature visual beat.
  pinch: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  },
  // No `fall()`. Deliberate: `HONEY.fall` is silent on purpose — the drop
  // is visual only. Resisting the urge to buzz through it is what keeps
  // this a material instead of a game. Don't add one.
};

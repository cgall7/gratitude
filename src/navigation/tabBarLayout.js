import { theme } from '../constants/theme';

// The floating tab bar's geometry, in one place.
//
// This module holds no components on purpose. `MainTabs` imports the four
// tab screens, so a screen that reached back into `MainTabs` for these
// numbers would close a require cycle — the constants have to live below
// both of them.
//
// Option C's split (Colin, 2026-08-11): the capsule hugs its four tabs and
// the account door sits detached beside it. Both halves are stated here so
// they can't drift — the door is centred on the capsule, and the capsule
// ends exactly one gap short of it.
export const SIDE_INSET = 20;
export const DOOR_GAP = 12;
export const BAR_HEIGHT = 60; // was 86: the old bar carried 49.5pt of dead space below its glyphs.
export const BAR_BOTTOM = 28;

// What a scrolling screen must clear at the bottom so its last row isn't
// parked under the bar.
//
// The bar is `position: absolute` and nothing consumes
// `useBottomTabBarHeight` — `BottomTabView` only publishes the height, it
// applies no padding — so this value is the sole bottom clearance in the
// app. It is the bar's box plus a deliberate `spacing.lg` of air, rather
// than a hand-summed literal: the previous `140` was written against an
// 86pt bar, and when the bar shrank to 60 the air silently grew from 26pt
// to 52pt because nobody owned the arithmetic.
export const TAB_CLEARANCE = BAR_BOTTOM + BAR_HEIGHT + theme.spacing.lg;

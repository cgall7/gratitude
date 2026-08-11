import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { theme } from '../constants/theme';
import { TodayTab } from '../screens/TodayTab';
import { RecapTab } from '../screens/RecapTab';
import { GratitudeWrapped } from '../screens/GratitudeWrapped';
import { HoneycombTab } from '../screens/HoneycombTab';
import { TabBarButton } from './TabBarButton';
import { AccountDoor, DOOR_SIZE } from './AccountDoor';
import { GlassBackground, useReduceTransparency } from './GlassBackground';

const Tab = createBottomTabNavigator();

// Option C, picked by Colin on 2026-08-11. The bar stops being a full-width
// slab: the capsule hugs its four tabs and the account door sits detached
// beside it. Both halves of the split are stated here so they can't drift —
// the door is centred on the capsule, and the capsule ends exactly one gap
// short of it.
const SIDE_INSET = 20;
const DOOR_GAP = 12;
const BAR_HEIGHT = 60; // was 86: the old bar carried 49.5pt of dead space below its glyphs.
const BAR_BOTTOM = 28;

const TAB_ICONS = {
  Today: { active: 'sunny', inactive: 'sunny-outline' },
  Honeycomb: { active: 'hexagon-multiple', inactive: 'hexagon-multiple-outline', set: MaterialCommunityIcons },
  Recap: { active: 'book', inactive: 'book-outline' },
  Wrapped: { active: 'gift', inactive: 'gift-outline' },
};

// The active marker is a soft tonal field one step off the bar, not a
// saturated marigold badge sitting on top of it. Marigold survives as the
// 1pt ring around the field — present, but no longer the loudest object on
// the whole screen. The glyph still springs in on the switch: landing on a
// tab should feel alive even when the marker is quiet. It no longer lifts —
// a tonal field that floats reads as a mistake; a filled badge could.
const TabIcon = ({ routeName, focused }) => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!focused) return;
    scale.setValue(0.6);
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 220, useNativeDriver: true }).start();
  }, [focused]);

  const IconComponent = TAB_ICONS[routeName].set ?? Ionicons;

  return (
    <View style={[styles.iconPill, focused && styles.iconPillActive]}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <IconComponent
          name={focused ? TAB_ICONS[routeName].active : TAB_ICONS[routeName].inactive}
          size={24}
          color={focused ? theme.colors.ink : theme.colors.textSecondary}
        />
      </Animated.View>
    </View>
  );
};

// The capsule and the door are siblings, so the door has to be rendered
// outside the bar: React Native clips touches to a view's bounds, so a
// circle drawn past the capsule's edge would be visible and dead. This
// wrapper spans the screen (`box-none`, so it never eats a tap meant for
// content) and lets both halves position themselves against it.
const TabDock = (props) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
    <BottomTabBar {...props} />
    <View style={styles.doorAnchor} pointerEvents="box-none">
      <AccountDoor />
    </View>
  </View>
);

export const MainTabs = () => {
  // Glass floats on translucency; Reduce Transparency goes back to the old
  // solid pill's own shadow weight (spec §10) — read once here so the bar
  // and its background layer agree on which look is active.
  const reduceTransparency = useReduceTransparency();

  return (
    <Tab.Navigator
      tabBar={(props) => <TabDock {...props} />}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: theme.colors.textPrimary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: [styles.tabBar, reduceTransparency ? theme.shadows.card : theme.shadows.glass],
        tabBarItemStyle: styles.tabBarItem,
        tabBarBackground: () => <GlassBackground radius={theme.borderRadius.large} />,
        tabBarButton: (props) => <TabBarButton {...props} />,
        tabBarIcon: ({ focused }) => <TabIcon routeName={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Today" component={TodayTab} />
      <Tab.Screen name="Honeycomb" component={HoneycombTab} />
      <Tab.Screen name="Recap" component={RecapTab} />
      <Tab.Screen name="Wrapped" component={GratitudeWrapped} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    // `start`/`end`, NOT `left`/`right`. BottomTabBar's own base style
    // (`styles.bottom`) sets `start: 0, end: 0`, and Yoga gives the logical
    // properties precedence over the physical ones no matter which style
    // object lands later — so a `left`/`right` inset here is silently
    // dropped and the bar renders edge to edge. Measured on device before
    // the fix: the capsule spanned 0-393pt on a 393pt screen. The pair is
    // also what makes the split behave in RTL, where the door belongs on
    // the other side.
    start: SIDE_INSET,
    // Stops one gap short of the door instead of running the full width.
    end: SIDE_INSET + DOOR_SIZE + DOOR_GAP,
    bottom: BAR_BOTTOM,
    height: BAR_HEIGHT,
    // BottomTabBar reserves `insets.bottom` (34pt here) inside its own
    // height for a bar flush to the screen edge. This one floats 28pt above
    // it, so that reservation is pure dead band — it's what pushed the old
    // bar's glyph row 17.4pt above centre, and at 60pt tall it squeezed the
    // content box to 26pt and pushed the active marker out through the top.
    paddingBottom: 0,
    borderRadius: theme.borderRadius.large,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
  },
  doorAnchor: {
    position: 'absolute',
    end: SIDE_INSET,
    // Centred on the capsule, so the two read as one row.
    bottom: BAR_BOTTOM + (BAR_HEIGHT - DOOR_SIZE) / 2,
  },
  tabBarItem: {
    paddingTop: 0,
  },
  iconPill: {
    width: 56,
    height: 44,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: theme.colors.washYellow,
    borderWidth: 1,
    // Marigold at 60% — the accent is still the thing marking the tab, just
    // as an edge rather than a fill.
    borderColor: 'rgba(255, 210, 0, 0.6)',
  },
});

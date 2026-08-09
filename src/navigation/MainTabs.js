import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Platform, AccessibilityInfo } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { theme } from '../constants/theme';
import { TodayTab } from '../screens/TodayTab';
import { RecapTab } from '../screens/RecapTab';
import { GratitudeWrapped } from '../screens/GratitudeWrapped';
import { HoneycombTab } from '../screens/HoneycombTab';
import { TabBarButton } from './TabBarButton';

const Tab = createBottomTabNavigator();

// Reduce Transparency is non-negotiable (spec §10): when it's on, the bar
// falls back to today's exact solid look instead of blurring.
const useReduceTransparency = () => {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceTransparencyEnabled?.().then(setEnabled).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceTransparencyChanged', setEnabled);
    return () => sub?.remove?.();
  }, []);

  return enabled;
};

// The bar itself stays transparent and casts the shadow (see `tabBar`
// style); this renders behind it in its own clipped layer — blur + cream
// veil + specular rim on iOS, opacity fallback on Android, solid surface
// under Reduce Transparency. It's a separate view from the shadow-casting
// container on purpose: `overflow: hidden` clips a shadow on the same
// view as the rounded corners, so the rounding+clipping has to live here
// instead of on `tabBar`.
const TabBarBackground = () => {
  const reduceTransparency = useReduceTransparency();

  if (reduceTransparency) {
    return <View style={[StyleSheet.absoluteFill, styles.backgroundClip, styles.solidFallback]} />;
  }

  if (Platform.OS === 'android') {
    // Sanctioned Android fallback (spec §10): no BlurView, just a lighter
    // opacity wash — cheaper and avoids readability issues on Android's blur.
    return <View style={[StyleSheet.absoluteFill, styles.backgroundClip, styles.androidFallback]} />;
  }

  return (
    <BlurView
      intensity={60}
      tint="systemUltraThinMaterialLight"
      style={[StyleSheet.absoluteFill, styles.backgroundClip]}
    >
      <View style={[StyleSheet.absoluteFill, styles.creamVeil]} />
      <View style={styles.rim} pointerEvents="none" />
    </BlurView>
  );
};

// Outline glyph at rest, filled glyph when active — the same weight shift
// real iOS tab bars use to make the current tab unmistakable.
const TAB_ICONS = {
  Today: { active: 'sunny', inactive: 'sunny-outline' },
  Honeycomb: { active: 'hexagon-multiple', inactive: 'hexagon-multiple-outline', set: MaterialCommunityIcons },
  Recap: { active: 'book', inactive: 'book-outline' },
  Wrapped: { active: 'gift', inactive: 'gift-outline' },
};

// A pill of accent color slides in behind the active icon instead of just
// tinting it — makes the current tab unmistakable at a glance. The icon
// itself pops with a spring on the switch so landing on a tab feels alive.
const TabIcon = ({ routeName, focused }) => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!focused) return;
    scale.setValue(0.7);
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 240, useNativeDriver: true }).start();
  }, [focused]);

  const IconComponent = TAB_ICONS[routeName].set ?? Ionicons;

  return (
    <View style={[styles.iconPill, focused && styles.iconPillActive]}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <IconComponent
          name={focused ? TAB_ICONS[routeName].active : TAB_ICONS[routeName].inactive}
          size={23}
          color={focused ? theme.colors.textPrimary : theme.colors.textSecondary}
        />
      </Animated.View>
    </View>
  );
};

export const MainTabs = () => {
  // Glass floats on translucency; Reduce Transparency goes back to the old
  // solid pill's own shadow weight (spec §10) — read once here so the bar
  // and its background layer agree on which look is active.
  const reduceTransparency = useReduceTransparency();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: theme.colors.textPrimary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: [styles.tabBar, reduceTransparency ? theme.shadows.card : theme.shadows.glass],
        tabBarItemStyle: styles.tabBarItem,
        tabBarBackground: () => <TabBarBackground />,
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
    left: 20,
    right: 20,
    bottom: 28,
    height: 72,
    borderRadius: theme.borderRadius.large,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
  },
  // Rounds + clips the background layer only — kept off `tabBar` itself so
  // its shadow isn't clipped along with the corners (see TabBarBackground).
  backgroundClip: {
    borderRadius: theme.borderRadius.large,
    overflow: 'hidden',
  },
  // Reduce Transparency fallback — today's exact solid look, no blur.
  solidFallback: {
    backgroundColor: theme.colors.surface,
  },
  // Android sanctioned fallback (spec §10): opacity wash, no BlurView.
  androidFallback: {
    backgroundColor: theme.colors.surface + 'D9', // 85%
  },
  // Blur alone reads cold iOS-grey; this keeps the bar inside the Sunbeam
  // palette regardless of what's scrolling underneath.
  creamVeil: {
    backgroundColor: theme.colors.surface + '8C', // 55%
  },
  // ONE 1pt specular edge — the detail that reads as glass, not chrome.
  rim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.borderRadius.large,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.65)',
  },
  tabBarItem: {
    paddingTop: 0,
  },
  iconPill: {
    width: 48,
    height: 40,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: theme.colors.accent + '33',
  },
});

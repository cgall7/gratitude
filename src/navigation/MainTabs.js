import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { theme } from '../constants/theme';
import { TodayTab } from '../screens/TodayTab';
import { RecapTab } from '../screens/RecapTab';
import { GratitudeWrapped } from '../screens/GratitudeWrapped';
import { HoneycombTab } from '../screens/HoneycombTab';
import { TabBarButton } from './TabBarButton';

const Tab = createBottomTabNavigator();

// Outline glyph at rest, filled glyph when active — the same weight shift
// real iOS tab bars use to make the current tab unmistakable.
const TAB_ICONS = {
  Today: { active: 'sunny', inactive: 'sunny-outline' },
  Honeycomb: { active: 'hexagon-multiple', inactive: 'hexagon-multiple-outline', set: MaterialCommunityIcons },
  Recap: { active: 'book', inactive: 'book-outline' },
  Wrapped: { active: 'gift', inactive: 'gift-outline' },
};

// A full-color pill lands behind the active icon and lifts it slightly —
// makes the current tab unmistakable at a glance, not just a tint change.
// The icon itself pops with a spring on the switch so landing on a tab
// feels alive. Sized up (Colin, 2026-08-09 — tabs felt "messy," wanted
// bigger and more delightful).
const TabIcon = ({ routeName, focused }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!focused) {
      lift.setValue(0);
      return;
    }
    scale.setValue(0.6);
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 220, useNativeDriver: true }).start();
    Animated.spring(lift, { toValue: 1, friction: 7, tension: 160, useNativeDriver: true }).start();
  }, [focused]);

  const IconComponent = TAB_ICONS[routeName].set ?? Ionicons;
  const translateY = lift.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });

  return (
    <Animated.View style={[styles.iconPill, focused && styles.iconPillActive, { transform: [{ translateY }] }]}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <IconComponent
          name={focused ? TAB_ICONS[routeName].active : TAB_ICONS[routeName].inactive}
          size={27}
          color={focused ? theme.colors.ink : theme.colors.textSecondary}
        />
      </Animated.View>
    </Animated.View>
  );
};

export const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarShowLabel: false,
      tabBarActiveTintColor: theme.colors.textPrimary,
      tabBarInactiveTintColor: theme.colors.textSecondary,
      tabBarStyle: styles.tabBar,
      tabBarItemStyle: styles.tabBarItem,
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

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 28,
    height: 86,
    borderRadius: theme.borderRadius.large,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 0,
    ...theme.shadows.floating,
  },
  tabBarItem: {
    paddingTop: 0,
  },
  iconPill: {
    width: 60,
    height: 52,
    borderRadius: theme.borderRadius.large,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: theme.colors.accent,
    ...theme.shadows.card,
  },
});

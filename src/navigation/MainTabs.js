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
  Honeycomb: { active: 'hexagon', inactive: 'hexagon-outline', set: MaterialCommunityIcons },
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
          size={20}
          color={focused ? theme.colors.textPrimary : theme.colors.textSecondary}
        />
      </Animated.View>
    </View>
  );
};

export const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarShowLabel: true,
      tabBarActiveTintColor: theme.colors.textPrimary,
      tabBarInactiveTintColor: theme.colors.textSecondary,
      tabBarStyle: styles.tabBar,
      tabBarItemStyle: styles.tabBarItem,
      tabBarLabelStyle: styles.tabBarLabel,
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
    height: 72,
    borderRadius: theme.borderRadius.large,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 0,
    paddingTop: 10,
    ...theme.shadows.floating,
  },
  tabBarItem: {
    paddingTop: 2,
  },
  tabBarLabel: {
    fontFamily: theme.fonts.bodySemiBold,
    fontSize: 11,
    marginTop: 2,
  },
  iconPill: {
    width: 40,
    height: 28,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: theme.colors.accent + '33',
  },
});

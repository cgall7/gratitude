import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { theme } from '../constants/theme';
import { TodayTab } from '../screens/TodayTab';
import { RecapTab } from '../screens/RecapTab';
import { GratitudeWrapped } from '../screens/GratitudeWrapped';
import { TabBarButton } from './TabBarButton';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Today: '☀️',
  Recap: '📖',
  Wrapped: '🎁',
};

// A pill of accent color slides in behind the active icon instead of just
// tinting it — makes the current tab unmistakable at a glance.
const TabIcon = ({ routeName, focused }) => (
  <View style={[styles.iconPill, focused && styles.iconPillActive]}>
    <Text style={{ fontSize: 18 }}>{TAB_ICONS[routeName]}</Text>
  </View>
);

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
    shadowColor: theme.colors.textPrimary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 12,
  },
  tabBarItem: {
    paddingTop: 2,
  },
  tabBarLabel: {
    fontFamily: theme.fonts.body,
    fontSize: 11,
    fontWeight: '600',
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

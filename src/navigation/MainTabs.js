import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { theme } from '../constants/theme';
import { TodayTab } from '../screens/TodayTab';
import { RecapTab } from '../screens/RecapTab';
import { GratitudeWrapped } from '../screens/GratitudeWrapped';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Today: '☀️',
  Recap: '📖',
  Wrapped: '🎁',
};

export const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: theme.colors.textPrimary,
      tabBarInactiveTintColor: theme.colors.textSecondary,
      tabBarStyle: {
        backgroundColor: theme.colors.surface,
        borderTopColor: theme.colors.surfaceBorder,
      },
      tabBarLabelStyle: {
        fontFamily: theme.fonts.body,
        fontSize: 12,
      },
      tabBarIcon: () => <Text style={{ fontSize: 20 }}>{TAB_ICONS[route.name]}</Text>,
    })}
  >
    <Tab.Screen name="Today" component={TodayTab} />
    <Tab.Screen name="Recap" component={RecapTab} />
    <Tab.Screen name="Wrapped" component={GratitudeWrapped} />
  </Tab.Navigator>
);

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { theme } from './src/constants/theme';
import { OnboardingFlow } from './src/screens/Onboarding';
import { LockScreen, InputScreen } from './src/screens/CoreRitual';
import { EveningMirror } from './src/screens/EveningMirror';
import { MonthlyRecap } from './src/screens/MonthlyRecap';
import { GratitudeWrapped } from './src/screens/GratitudeWrapped';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Onboarding"
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: theme.colors.background }
        }}
      >
        <Stack.Screen name="Onboarding">
          {(props) => (
            <OnboardingFlow
              {...props}
              onDone={() => props.navigation.replace('Lock')}
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="Lock">
          {(props) => (
            <LockScreen
              {...props}
              onEnterRitual={() => props.navigation.navigate('Input')}
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="Input">
          {(props) => (
            <InputScreen 
              {...props} 
              onUnlock={(text) => {
                console.log('Unlocked with:', text);
                props.navigation.navigate('Recap');
              }} 
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="Recap">
          {(props) => (
            <MonthlyRecap 
              {...props} 
              monthName="July" 
              entries={[{date: '2026-07-01', text: 'Coffee', category: 'Joy'}]} 
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="Evening">
          {(props) => (
            <EveningMirror 
              {...props} 
              gratitudeText="I am grateful for this beautiful day." 
              onClose={() => props.navigation.navigate('Lock')} 
            />
          )}
        </Stack.Screen>
        
        <Stack.Screen name="Wrapped">
          {(props) => (
            <GratitudeWrapped 
              {...props} 
              onComplete={() => props.navigation.navigate('Lock')} 
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

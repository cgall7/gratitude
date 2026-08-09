import React, { useCallback, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { theme } from './src/constants/theme';
import { fontAssets } from './src/constants/fontAssets';
import { OnboardingFlow } from './src/screens/Onboarding';
import { LockScreen, InputScreen } from './src/screens/CoreRitual';
import { EveningMirror } from './src/screens/EveningMirror';
import { MainTabs } from './src/navigation/MainTabs';
import { AuthProvider } from './src/contexts/AuthContext';

const Stack = createStackNavigator();

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    Font.loadAsync(fontAssets).then(() => setFontsLoaded(true));
  }, []);

  const onLayoutRootView = useCallback(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <NavigationContainer onReady={onLayoutRootView}>
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
                onDone={() => props.navigation.replace('Main')}
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
                onUnlock={() => props.navigation.replace('Main')}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="Main" component={MainTabs} />

          <Stack.Screen name="Evening">
            {(props) => (
              <EveningMirror
                {...props}
                gratitudeText="I am grateful for this beautiful day."
                onClose={() => props.navigation.navigate('Main')}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </AuthProvider>
  );
}

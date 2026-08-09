import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
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

// Demo-mode only (Colin, 2026-08-09): every time the app comes back to the
// foreground it should reopen at onboarding, even if someone finished it
// or was sitting on Main a minute ago — the pitch should always be fresh
// for whoever's about to see it. Flip this off once the app is past the
// demo phase. Cold launches are already covered by initialRouteName below;
// this covers backgrounding/resuming, which a cold launch alone misses.
const DEMO_MODE = true;

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const navigationRef = useRef(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    Font.loadAsync(fontAssets).then(() => setFontsLoaded(true));
  }, []);

  useEffect(() => {
    if (!DEMO_MODE) return undefined;
    const subscription = AppState.addEventListener('change', (nextState) => {
      const resuming = appState.current.match(/inactive|background/) && nextState === 'active';
      if (resuming) {
        navigationRef.current?.resetRoot({ index: 0, routes: [{ name: 'Onboarding' }] });
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
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
      <NavigationContainer ref={navigationRef} onReady={onLayoutRootView}>
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

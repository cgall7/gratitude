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
import { LegalScreen } from './src/screens/Legal';
import { AccountScreen } from './src/screens/Account';
import { MainTabs } from './src/navigation/MainTabs';
import { AuthProvider } from './src/contexts/AuthContext';
import { OnboardingState } from './src/services/onboardingState';
import { supabase, isSupabaseConfigured } from './src/services/supabase';

const Stack = createStackNavigator();

SplashScreen.preventAutoHideAsync();

// Demo-mode only (Colin, 2026-08-09): every time the app comes back to the
// foreground it should reopen at onboarding, even if someone finished it
// or was sitting on Main a minute ago — the pitch should always be fresh
// for whoever's about to see it. Flip this off once the app is past the
// demo phase. This flag now gates BOTH demo behaviours: the
// foreground-resume reset below, and forcing every cold launch to start at
// Onboarding. With it off, cold launches route on the persisted completion
// flag / live session instead (resolveInitialRoute), so flipping this one
// constant really is the whole switch.
const DEMO_MODE = true;

// Cold-launch routing, only consulted when DEMO_MODE is off. Completed
// onboarding on this device, or an existing signed-in session (fresh
// install by a returning user), both land on Main. Any storage failure
// falls back to Onboarding — the worst case is seeing the flow again,
// never being locked out of it.
const resolveInitialRoute = async () => {
  try {
    if (await OnboardingState.isComplete()) return 'Main';
    if (isSupabaseConfigured && supabase) {
      // getSession() can hit the network (token refresh past the 90s expiry
      // margin), so this branch is the slow path. Writing the flag here makes
      // it self-healing: users who predate the flag — everyone who completed
      // onboarding before it shipped — pay this path once, then read the
      // local key on every launch after.
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        OnboardingState.markComplete().catch(() => {});
        return 'Main';
      }
    }
  } catch (e) {
    // fall through
  }
  return 'Onboarding';
};

// getSession's refresh has no app-level timeout, and while the resolve is
// pending the splash can never hide (NavigationContainer isn't mounted, so
// onReady can't fire). On a dead or captive-portal network that's a frozen
// splash — the one state a user can't back out of. Racing a short timeout
// keeps the worst case at "see onboarding again," which is the designed
// fallback. With the self-healing write above, a user hits this window at
// most once — after that the route resolves from local storage.
const ROUTE_RESOLVE_TIMEOUT_MS = 3000;
const resolveInitialRouteWithTimeout = () =>
  Promise.race([
    resolveInitialRoute(),
    new Promise((resolve) => {
      setTimeout(() => resolve('Onboarding'), ROUTE_RESOLVE_TIMEOUT_MS);
    }),
  ]);

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [initialRoute, setInitialRoute] = useState(DEMO_MODE ? 'Onboarding' : null);
  const navigationRef = useRef(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    Font.loadAsync(fontAssets).then(() => setFontsLoaded(true));
  }, []);

  useEffect(() => {
    if (DEMO_MODE) return;
    resolveInitialRouteWithTimeout().then(setInitialRoute);
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

  // The splash stays up (preventAutoHideAsync above) until both fonts and
  // the initial route are ready, so the route decision never flashes.
  if (!fontsLoaded || !initialRoute) {
    return null;
  }

  return (
    <AuthProvider>
      <NavigationContainer ref={navigationRef} onReady={onLayoutRootView}>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: theme.colors.background }
          }}
        >
          <Stack.Screen name="Onboarding">
            {(props) => (
              <OnboardingFlow
                {...props}
                startAt={props.route.params?.startAt}
                onDone={() => props.navigation.replace('Main')}
              />
            )}
          </Stack.Screen>

          <Stack.Screen name="Lock">
            {(props) => (
              <LockScreen
                {...props}
                onOpen={() => props.navigation.navigate('Input')}
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

          <Stack.Screen name="Legal" component={LegalScreen} options={{ presentation: 'modal' }} />

          {/* Opened by the account door beside the tab capsule (MainTabs
              Option C). A modal, not a tab: it's the app's only route to
              sign-out and the legal documents, and it's opened about twice
              a year. */}
          <Stack.Screen name="Account" component={AccountScreen} options={{ presentation: 'modal' }} />

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

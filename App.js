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
import { NotesInbox } from './src/screens/NotesInbox';
import { ComposeNote } from './src/screens/ComposeNote';
import { PlantSeed } from './src/screens/PlantSeed';
import { SeedsInbox } from './src/screens/SeedsInbox';
import { PollinateWrapped } from './src/screens/PollinateWrapped';
import { MainTabs } from './src/navigation/MainTabs';
import { AuthProvider } from './src/contexts/AuthContext';
import { OnboardingState } from './src/services/onboardingState';
import { supabase, isSupabaseConfigured } from './src/services/supabase';
import { EntryStore } from './src/services/EntryStore';
import { tagEntry } from './src/utils/themeTagger';

const Stack = createStackNavigator();

SplashScreen.preventAutoHideAsync();

// Demo-mode only (Colin, 2026-08-09): every time the app comes back to the
// foreground it should reopen at onboarding, even if someone finished it
// or was sitting on Main a minute ago — the pitch should always be fresh
// for whoever's about to see it. This flag now gates BOTH demo behaviours: the
// foreground-resume reset below, and forcing every cold launch to start at
// Onboarding. With it off, cold launches route on the persisted completion
// flag / live session instead (resolveInitialRoute), so flipping this one
// constant really is the whole switch.
//
// Driven by `eas.json`'s per-profile `EXPO_PUBLIC_DEMO_MODE` (Sage, thread
// 14492cf2), not a literal — a hardcoded `true` shipped demo mode to every
// TestFlight build regardless of profile. Two traps this derivation avoids:
// Expo's inline-env-vars babel plugin only rewrites a direct
// `process.env.X` member read, so destructuring `{ EXPO_PUBLIC_DEMO_MODE }`
// from `process.env` resolves to `undefined` at runtime and silently kills
// the flag; and the inlined value is always a string, so a bare truthiness
// check makes the explicit `"false"` production profile sets truthy. The
// `=== 'true'` comparison is what makes an absent var (development profile,
// no env block) resolve safely to `false`.
const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

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
  // §13.3: the Welcome loginArc bee must not start flying until the splash
  // is actually gone — it used to start on mount, spending its whole flight
  // behind the still-visible splash. SplashScreen.hideAsync() only fires the
  // native hide (no visible fade is configured anywhere in this app, so the
  // hide is effectively instant), so the moment that promise resolves is the
  // real "screen just became visible" signal to gate the arc on.
  const [splashHidden, setSplashHidden] = useState(false);
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

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
      setSplashHidden(true);
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
                splashHidden={splashHidden}
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
                onUnlock={async (text) => {
                  // InputScreen stopped saving itself when the pre-auth
                  // onboarding paths started buffering its text instead
                  // (P0-2 fix, thread 19e90cf8). This is the one caller with
                  // a real session already — it owns the write now.
                  await EntryStore.saveEntry(new Date(), text, tagEntry(text));
                  props.navigation.replace('Main');
                }}
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

          {/* Project 7 (Gratitude Notes, no-tip variant). Both modal: Notes
              opens from the Honeycomb tab's header, Compose opens from
              Notes' header, neither is a tab of its own yet — that's a
              design placement call, not an engineering one. */}
          <Stack.Screen name="Notes" component={NotesInbox} options={{ presentation: 'modal' }} />
          <Stack.Screen name="ComposeNote" component={ComposeNote} options={{ presentation: 'modal' }} />

          {/* Project 8 (Seeds). 8.2 plants, 8.4 lists — a planted seed is no
              longer invisible. 8.8's reveal choreography is still @Pixel's:
              the sealed -> bloomed transition happens on SeedsInbox today
              (§22.2's refetch), it just does not yet have a beat. Modal for
              the same reason Compose is: where Seeds finally lives in the IA
              is Project 10's call. */}
          <Stack.Screen name="PlantSeed" component={PlantSeed} options={{ presentation: 'modal' }} />
          <Stack.Screen name="Seeds" component={SeedsInbox} options={{ presentation: 'modal' }} />

          {/* Project 10: Wrapped is no longer a tab (Colin's ruling — it
              lives in the Garden). It has to be registered somewhere or the
              screen ships unreachable, and a root-stack modal is the same
              treatment Notes/Seeds/Compose get for the same reason.

              `onComplete` is what makes it a screen rather than a trap: with
              the prop undefined, `PollinateWrapped.js:147` sends the last
              slide back to slide 0 forever — survivable when a tab bar sat
              underneath it, not now that a modal covers the bar. Tapping past
              the last beat returns you to the Garden. */}
          <Stack.Screen name="Wrapped" options={{ presentation: 'modal' }}>
            {(props) => (
              <PollinateWrapped {...props} onComplete={() => props.navigation.goBack()} />
            )}
          </Stack.Screen>

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

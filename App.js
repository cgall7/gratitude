import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import * as Notifications from 'expo-notifications';
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
import { CreateHiveFlow } from './src/screens/CreateHive';
import { HiveDetailScreen } from './src/screens/HiveDetail';
import { ComposeHiveEntryScreen } from './src/screens/ComposeHiveEntry';
import { PollinateWrapped } from './src/screens/PollinateWrapped';
import { MainTabs } from './src/navigation/MainTabs';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { AuthProvider } from './src/contexts/AuthContext';
import { OnboardingState } from './src/services/onboardingState';
import { supabase, isSupabaseConfigured } from './src/services/supabase';
import { EntryStore } from './src/services/EntryStore';
import { tagEntry } from './src/utils/themeTagger';
import { DEMO_MODE } from './src/constants/demoMode';
import { resolveInitialRouteWithTimeout } from './src/utils/resolveInitialRoute';
import { reconcile as reconcileDailyNudge, isNudgeResponse, WINDOW_DAYS as NUDGE_WINDOW_DAYS } from './src/services/dailyNudge';
import { NUDGE_TITLE, NUDGE_BODY } from './src/constants/nudgeCopy';

const Stack = createStackNavigator();

// Daily Nudge half A (`PLANS/DAILY_NUDGE_SPEC.md` §4.1) — re-arm the window
// on every foreground. `reconcile()` itself no-ops until half B's Celebration
// "yes" ever sets the enabled flag (`requestPermissionAndEnable`, not called
// from anywhere in half A on purpose — §2's fuse), so this is inert today;
// it exists so half B only has to add the ask, not the re-arm plumbing too.
//
// GAP, flagged rather than silently partial: §4.1 also says "re-arm ... on
// every entry save." That save happens in `src/screens/CoreRitual.js`
// (`InputScreen`'s real write path) and `src/screens/Onboarding.js`'s
// pre-auth buffer, neither of which is in half A's touched-file list
// (`app.json`, this file, the service module, one response listener,
// Deezine's copy — Sage, thread 1a0821d5). The foreground re-arm below
// covers the common case (opening the app after writing backgrounds and
// foregrounds it in practice), but the save-triggered re-arm needs a
// follow-up call to `reconcileDailyNudge` at CoreRitual's `saveEntry` call
// site.
//
// The sentinel guard is redundant with `reconcile()`'s own required-content
// check today (nothing is enabled yet), and cheap insurance against a future
// dev-only toggle that flips the enabled flag without going through
// Celebration.
const rearmDailyNudge = async () => {
  if (NUDGE_TITLE.startsWith('__OWNED_BY_') || NUDGE_BODY.startsWith('__OWNED_BY_')) return;
  try {
    const now = new Date();
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + NUDGE_WINDOW_DAYS - 1);
    const entries = await EntryStore.getEntriesBetween(now, windowEnd);
    await reconcileDailyNudge({
      writtenDaysISO: entries.map((e) => e.date),
      now,
      content: { title: NUDGE_TITLE, body: NUDGE_BODY },
    });
  } catch {
    // Not signed in, Supabase unconfigured, or a transient failure — the
    // next foreground tries again. §4.1's re-arm has no "must succeed now"
    // requirement; it is called unconditionally on a cadence.
  }
};

SplashScreen.preventAutoHideAsync();

// DEMO_MODE gates both demo behaviours below: the foreground-resume reset,
// and forcing every cold launch to start at Onboarding. With it off, cold
// launches route on the persisted completion flag / live session instead
// (resolveInitialRouteWithTimeout, src/utils/resolveInitialRoute.js — pulled
// out of this file so check-resolve-initial-route.mjs can exercise it
// without a renderer). Defined in src/constants/demoMode.js, not here —
// CoreRitual.js/HoneycombTab.js/Onboarding.js's demo-only affordances need
// the derived DEMO_CONTENT constant next to it, and importing from App.js
// would be circular (App.js imports all three screens).

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
  // Independent of `appState` above — that ref is only maintained while the
  // DEMO_MODE listener is registered (it early-returns and never subscribes
  // otherwise), so the nudge re-arm needs its own foreground-transition
  // tracking to run in every build.
  const nudgeAppState = useRef(AppState.currentState);
  // Bumped by ErrorBoundary's reset. Changing a subtree's `key` is what
  // forces React to unmount and remount it fresh, rather than reconcile
  // onto the same instances that just threw — a plain setState re-render
  // wouldn't touch component state a crash left in a bad shape.
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    Font.loadAsync(fontAssets).then(() => setFontsLoaded(true));
  }, []);

  useEffect(() => {
    if (DEMO_MODE) return;
    resolveInitialRouteWithTimeout({ OnboardingState, isSupabaseConfigured, supabase }).then(setInitialRoute);
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

  // Daily Nudge §4.1 — re-arm on every foreground, in every build. Runs once
  // on mount (the app is "foregrounding" from cold start too) and again on
  // every background -> active transition.
  useEffect(() => {
    rearmDailyNudge();
    const subscription = AppState.addEventListener('change', (nextState) => {
      const resuming = nudgeAppState.current.match(/inactive|background/) && nextState === 'active';
      if (resuming) rearmDailyNudge();
      nudgeAppState.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  // §C12 — tap routing, navigation only. Registered unconditionally: no
  // notification is ever scheduled while `NUDGE_TITLE`/`NUDGE_BODY` are
  // still the sentinel (`reconcile()`'s content guard, and the sentinel
  // check above), so this listener has nothing to catch yet, but it costs
  // nothing to have wired ahead of half B.
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (isNudgeResponse(response)) {
        navigationRef.current?.navigate('Main', { screen: 'Today' });
      }
    });
    return () => subscription.remove();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
      setSplashHidden(true);
      // §C12 cold-start read — a tap that launched the app from terminated
      // can fire before `addNotificationResponseReceivedListener` above is
      // attached, so it needs the paired one-shot read. Composed into this
      // callback rather than a second `onReady` prop (`NotificationContainer`
      // only takes one) and read after the splash hides so `navigationRef`
      // is already mounted.
      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      if (isNudgeResponse(lastResponse)) {
        navigationRef.current?.navigate('Main', { screen: 'Today' });
      }
    }
  }, [fontsLoaded]);

  // The splash stays up (preventAutoHideAsync above) until both fonts and
  // the initial route are ready, so the route decision never flashes.
  if (!fontsLoaded || !initialRoute) {
    return null;
  }

  return (
    <ErrorBoundary onReset={() => setResetKey((k) => k + 1)}>
      <AuthProvider key={resetKey}>
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

            {/* Private Hives (8b.2/8b.3, hero — PLANS/Pollinate_Delivery_Slices.md
                Project 8b). Pushed from Today's hive shelf via getParent(),
                same as Lock/Input above: a flow you go deeper into, not a
                utility sheet, so no `presentation: 'modal'`. */}
            <Stack.Screen name="CreateHive" component={CreateHiveFlow} />
            <Stack.Screen name="HiveDetail" component={HiveDetailScreen} />
            <Stack.Screen name="ComposeHiveEntry" component={ComposeHiveEntryScreen} />

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
    </ErrorBoundary>
  );
}

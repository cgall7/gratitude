// Cold-launch routing, only consulted when DEMO_MODE is off. Pulled out of
// App.js (same move as loadState.js/seedDraft.js: JSX cannot be imported
// without a renderer, and this repo has none, so the decision has to live
// in plain JS to be gated at all — check-resolve-initial-route.mjs is what
// that buys). Dependencies are passed in rather than imported directly so a
// gate can exercise every branch — complete flag, live session, storage
// throw, timeout — without a real AsyncStorage or Supabase client.

// Completed onboarding on this device, or an existing signed-in session
// (fresh install by a returning user), both land on Main. Any storage
// failure falls back to Onboarding — the worst case is seeing the flow
// again, never being locked out of it.
export const resolveInitialRoute = async ({ OnboardingState, isSupabaseConfigured, supabase }) => {
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
export const ROUTE_RESOLVE_TIMEOUT_MS = 3000;

export const resolveInitialRouteWithTimeout = (deps, timeoutMs = ROUTE_RESOLVE_TIMEOUT_MS) =>
  Promise.race([
    resolveInitialRoute(deps),
    new Promise((resolve) => {
      setTimeout(() => resolve('Onboarding'), timeoutMs);
    }),
  ]);

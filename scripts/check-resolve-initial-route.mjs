// Gate for App.js's cold-launch routing race (issue: client layer has zero
// runtime tests). `resolveInitialRoute`/`resolveInitialRouteWithTimeout`
// live in src/utils/resolveInitialRoute.js, pulled out of App.js so this
// file can drive them with fake OnboardingState/Supabase dependencies
// instead of a real device or network.
//
//   npm run check:resolve-initial-route
//
// Four scenarios, matching the issue's acceptance criteria exactly:
//   1. Completion flag already set -> Main, without ever touching Supabase.
//   2. No flag, but a live session -> Main, and the flag gets written
//      (the self-healing markComplete() write for pre-flag users).
//   3. Neither flag nor session resolves before the timeout -> Onboarding,
//      and the real resolution losing the race doesn't throw or hang.
//   4. Storage throws -> Onboarding, not a crash — App.js's own comment on
//      this function: "the worst case is seeing the flow again, never
//      being locked out of it."
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { resolveInitialRoute, resolveInitialRouteWithTimeout } = await import(
  path.join(ROOT, 'src/utils/resolveInitialRoute.js')
);

let pass = 0;
const failures = [];
const ok = (label) => {
  pass += 1;
  console.log(`  ok   ${label}`);
};
const bad = (label, detail) => {
  failures.push(`${label} — ${detail}`);
  console.log(`  FAIL ${label} — ${detail}`);
};

const neverConfigured = { isSupabaseConfigured: false, supabase: null };

// --- 1. Completion flag set -------------------------------------------
{
  let getSessionCalled = false;
  const deps = {
    OnboardingState: { isComplete: async () => true, markComplete: async () => {} },
    isSupabaseConfigured: true,
    supabase: { auth: { getSession: async () => { getSessionCalled = true; return { data: {} }; } } },
  };
  const route = await resolveInitialRoute(deps);
  if (route !== 'Main') {
    bad('completion flag set -> Main', `got ${JSON.stringify(route)}`);
  } else if (getSessionCalled) {
    bad('completion flag set -> Main', 'getSession() was called even though the flag alone should short-circuit');
  } else {
    ok('completion flag set -> Main, without touching Supabase');
  }
}

// --- 2. No flag, live session -------------------------------------------
{
  let markCompleteCalled = false;
  const deps = {
    OnboardingState: {
      isComplete: async () => false,
      markComplete: async () => { markCompleteCalled = true; },
    },
    isSupabaseConfigured: true,
    supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'x' } } }) } },
  };
  const route = await resolveInitialRoute(deps);
  // The self-healing write is fire-and-forget (`.catch(() => {})`, not
  // awaited) — give its microtask a tick before asserting on it.
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (route !== 'Main') {
    bad('no flag + live session -> Main', `got ${JSON.stringify(route)}`);
  } else if (!markCompleteCalled) {
    bad('no flag + live session -> Main', 'markComplete() was not called — the self-heal for pre-flag users is gone');
  } else {
    ok('no flag + live session -> Main, self-healing markComplete() fires');
  }
}

// --- 2b. No flag, no session ----------------------------------------------
{
  const deps = {
    OnboardingState: { isComplete: async () => false, markComplete: async () => {} },
    isSupabaseConfigured: true,
    supabase: { auth: { getSession: async () => ({ data: {} }) } },
  };
  const route = await resolveInitialRoute(deps);
  if (route !== 'Onboarding') {
    bad('no flag + no session -> Onboarding', `got ${JSON.stringify(route)}`);
  } else {
    ok('no flag + no session -> Onboarding');
  }
}

// --- 2c. Supabase not configured (matches App.js's own guard) ------------
{
  const deps = {
    OnboardingState: { isComplete: async () => false, markComplete: async () => {} },
    ...neverConfigured,
  };
  const route = await resolveInitialRoute(deps);
  if (route !== 'Onboarding') {
    bad('supabase not configured -> Onboarding', `got ${JSON.stringify(route)}`);
  } else {
    ok('supabase not configured, no flag -> Onboarding');
  }
}

// --- 3. Timeout wins -------------------------------------------------
{
  const deps = {
    // Never resolves — simulates a dead/captive-portal network. The real
    // resolution is still pending when the timeout wins; it must not throw
    // unhandled once it does eventually settle later in the process.
    OnboardingState: { isComplete: () => new Promise(() => {}), markComplete: async () => {} },
    isSupabaseConfigured: false,
    supabase: null,
  };
  const started = Date.now();
  const route = await resolveInitialRouteWithTimeout(deps, 25);
  const elapsedMs = Date.now() - started;
  if (route !== 'Onboarding') {
    bad('slow network: timeout wins -> Onboarding', `got ${JSON.stringify(route)}`);
  } else if (elapsedMs > 200) {
    bad('slow network: timeout wins -> Onboarding', `resolved in ${elapsedMs}ms — timeout race did not bound the wait`);
  } else {
    ok(`slow network: timeout wins -> Onboarding (${elapsedMs}ms, real resolution never lands)`);
  }
}

// --- 3b. Real resolution beats a generous timeout -------------------------
{
  const deps = {
    OnboardingState: { isComplete: async () => true, markComplete: async () => {} },
    ...neverConfigured,
  };
  const route = await resolveInitialRouteWithTimeout(deps, 5000);
  if (route !== 'Main') {
    bad('fast resolution beats timeout -> Main', `got ${JSON.stringify(route)} — timeout fired even though the real read was instant`);
  } else {
    ok('fast resolution beats a generous timeout -> Main');
  }
}

// --- 4. Storage throws -------------------------------------------------
{
  const deps = {
    OnboardingState: {
      isComplete: async () => { throw new Error('AsyncStorage unavailable'); },
      markComplete: async () => {},
    },
    isSupabaseConfigured: true,
    supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'x' } } }) } },
  };
  const route = await resolveInitialRoute(deps);
  if (route !== 'Onboarding') {
    bad('storage throws -> Onboarding', `got ${JSON.stringify(route)} instead of the safe fallback`);
  } else {
    ok('storage throws on isComplete() -> Onboarding, not a crash');
  }
}

// --- 4b. getSession() itself throws (network error mid-flight) -----------
{
  const deps = {
    OnboardingState: { isComplete: async () => false, markComplete: async () => {} },
    isSupabaseConfigured: true,
    supabase: { auth: { getSession: async () => { throw new Error('network error'); } } },
  };
  const route = await resolveInitialRoute(deps);
  if (route !== 'Onboarding') {
    bad('getSession() throws -> Onboarding', `got ${JSON.stringify(route)}`);
  } else {
    ok('getSession() throws -> Onboarding, not a crash');
  }
}

console.log(`\ncheck-resolve-initial-route: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}

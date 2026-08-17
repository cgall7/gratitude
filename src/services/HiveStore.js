import { supabase } from './supabase';

// Private Hives — the client half. Until this file, `private_hives` had a
// full server side (six migrations, live in production) and ZERO readers or
// writers anywhere in `src/`: the hero was a room with no door.
//
// A separate module from EntryStore on purpose. EntryStore's header says it
// only ever touches the personal journal — every one of its five accessors
// carries `.is('hive_id', null)` — and that a hive's rows "will add
// hive-scoped rows later through different call sites". This is that call
// site, not a widening of that one.
//
// A separate module from HoneycombStore for the same reason its RLS is
// different: every other table in this schema models a relationship between
// two accounts and its policies are mutual. A private hive is the schema's
// first OWNED entity — owner only, on every action
// (20260815000001_private_hives.sql). Putting it beside the connection graph
// would file it as a social object, which is exactly what it is not.
const requireSupabase = () => {
  if (!supabase) throw new Error('Supabase is not configured — check .env');
  return supabase;
};

const requireUserId = async (client) => {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return user.id;
};

export const HiveStore = {
  // The complete creation act against today's schema (§30.9.3): a hive IS
  // its subject's name plus its owner. `subject_profile_id` stays null —
  // it is only ever set when the subject is themselves a registered user,
  // and the Who beat's subject (a child, a parent, a friend) usually has no
  // account and no row anywhere in this schema.
  //
  // No entry is filed into the hive here, and that is the ruling, not an
  // omission (R102, spec §30.7): every EntryStore accessor is scoped to
  // `hive_id is null`, so an entry written with a hive_id would be
  // invisible on Today, Recap, Wrapped and the Hive tab alike. The Who
  // beat creates the hive; the entry stays in the journal where the user
  // can see it. Filing entries into a hive is C7 — the next unit of
  // Private Hives, and the one that makes the payoff real.
  async createHive(subjectName) {
    const client = requireSupabase();
    const ownerId = await requireUserId(client);
    const name = subjectName.trim();
    // `subject_name text not null` — an empty label is not a hive with a
    // blank name, it is the decline, and the decline writes nothing.
    if (!name) throw new Error('A hive needs a subject name');

    const { data, error } = await client
      .from('private_hives')
      .insert({ owner_id: ownerId, subject_name: name })
      .select('id, subject_name, created_at')
      .single();
    if (error) throw error;
    return data;
  },
};

-- Honeycombs core schema: profiles, entries, connections, shares, likes, comments.
-- Privacy model: entries are private by default. A row only becomes visible to
-- anyone besides its owner when the owner explicitly creates a `shares` row for
-- it, and even then only to that owner's *accepted* honeycomb connections.
-- Enforced at the database via RLS so a client bug can never leak a private entry.

-- ============================================================================
-- profiles
-- One row per auth.users row, created automatically on signup (trigger below).
-- Phone numbers are never stored in plaintext here — only a SHA-256 hash, so
-- contact-discovery ("find people from my phone contacts") can match against
-- hashed numbers without this table itself being a plaintext phone directory.
-- ============================================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  phone_hash text unique, -- sha256(e164 phone number), set by the client at signup
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Every authenticated user can look themselves up and update their own profile.
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create a profile row when a new auth user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', 'New user'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- honeycomb_connections
-- A mutual-follow-style connection between two users, found via phone number.
-- `requester_id` sends the request; `addressee_id` accepts it. A connection is
-- only "in someone's honeycomb" once status = 'accepted'.
-- ============================================================================
create type public.connection_status as enum ('pending', 'accepted', 'blocked');

create table public.honeycomb_connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.connection_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint no_self_connection check (requester_id <> addressee_id),
  constraint unique_pair unique (requester_id, addressee_id)
);

alter table public.honeycomb_connections enable row level security;

create policy "connections_select_own"
  on public.honeycomb_connections for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "connections_insert_own"
  on public.honeycomb_connections for insert
  with check (auth.uid() = requester_id);

-- Only the addressee can change status (accept/block); requester can't self-accept.
create policy "connections_update_addressee"
  on public.honeycomb_connections for update
  using (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id);

create policy "connections_delete_own"
  on public.honeycomb_connections for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Accepted honeycomb connections can see each other's profile too (display name,
-- avatar) — needed to render the feed and connection list. Added now that
-- honeycomb_connections exists for this policy to reference.
create policy "profiles_select_connections"
  on public.profiles for select
  using (
    exists (
      select 1 from public.honeycomb_connections c
      where c.status = 'accepted'
        and (
          (c.requester_id = auth.uid() and c.addressee_id = profiles.id)
          or (c.addressee_id = auth.uid() and c.requester_id = profiles.id)
        )
    )
  );

-- ============================================================================
-- entries
-- The private gratitude journal. No policy ever grants select to anyone but
-- the owner — visibility to others only ever flows through the `shares` table.
-- ============================================================================
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  entry_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.entries enable row level security;

create policy "entries_select_own"
  on public.entries for select
  using (auth.uid() = user_id);

create policy "entries_insert_own"
  on public.entries for insert
  with check (auth.uid() = user_id);

create policy "entries_update_own"
  on public.entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "entries_delete_own"
  on public.entries for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- shares
-- Explicit, opt-in publication of one entry to the owner's honeycomb. Creating
-- a share is the only thing that ever exposes an entry's content to another user.
-- ============================================================================
create table public.shares (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null unique references public.entries (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.shares enable row level security;

create policy "shares_select_own_or_connections"
  on public.shares for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.honeycomb_connections c
      where c.status = 'accepted'
        and (
          (c.requester_id = auth.uid() and c.addressee_id = shares.user_id)
          or (c.addressee_id = auth.uid() and c.requester_id = shares.user_id)
        )
    )
  );

create policy "shares_insert_own"
  on public.shares for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.entries e where e.id = entry_id and e.user_id = auth.uid())
  );

create policy "shares_delete_own"
  on public.shares for delete
  using (auth.uid() = user_id);

-- Piggyback on the shares policy above: an entry becomes readable to honeycomb
-- connections once (and only while) it has a share row.
create policy "entries_select_via_share"
  on public.entries for select
  using (
    exists (
      select 1 from public.shares s
      where s.entry_id = entries.id
        and (
          s.user_id = auth.uid()
          or exists (
            select 1 from public.honeycomb_connections c
            where c.status = 'accepted'
              and (
                (c.requester_id = auth.uid() and c.addressee_id = s.user_id)
                or (c.addressee_id = auth.uid() and c.requester_id = s.user_id)
              )
          )
        )
    )
  );

-- ============================================================================
-- likes
-- ============================================================================
create table public.likes (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.shares (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint unique_like unique (share_id, user_id)
);

alter table public.likes enable row level security;

create policy "likes_select_if_share_visible"
  on public.likes for select
  using (
    exists (select 1 from public.shares s where s.id = share_id)
  );

create policy "likes_insert_if_share_visible"
  on public.likes for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.shares s where s.id = share_id)
  );

create policy "likes_delete_own"
  on public.likes for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- comments
-- ============================================================================
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.shares (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

create policy "comments_select_if_share_visible"
  on public.comments for select
  using (
    exists (select 1 from public.shares s where s.id = share_id)
  );

create policy "comments_insert_if_share_visible"
  on public.comments for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.shares s where s.id = share_id)
  );

create policy "comments_delete_own"
  on public.comments for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- indexes
-- ============================================================================
create index entries_user_id_idx on public.entries (user_id, entry_date desc);
create index connections_addressee_idx on public.honeycomb_connections (addressee_id, status);
create index connections_requester_idx on public.honeycomb_connections (requester_id, status);
create index shares_user_id_idx on public.shares (user_id, created_at desc);
create index likes_share_id_idx on public.likes (share_id);
create index comments_share_id_idx on public.comments (share_id, created_at);

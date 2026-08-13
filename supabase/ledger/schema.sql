-- ============================================================================
-- Pollinate — nectar ledger core schema
--
-- STATUS: designed and executed against Postgres 17, NOT YET APPLIED anywhere.
-- Deliberately not committed as a migration in the app repo: the app's Supabase
-- project runs its migrations, and this schema must not exist in a live database
-- until the Strike/agent-of-payee licensing question is answered. See
-- PLANS/POLLINATE_LEDGER_DESIGN.md for the rationale behind every choice here.
--
-- Model: strict double-entry. Postgres is the system of record for who owns what;
-- Strike is a payment rail we reconcile *against*, never a source of truth we
-- copy balances from.
--
-- Sign convention (the one thing to internalise before reading further):
--   amount_microusd > 0  ==  DEBIT
--   amount_microusd < 0  ==  CREDIT
--   Every transaction's postings sum to exactly 0.
--   Therefore the sum of ALL account balances is always exactly 0.
--   Assets (money we hold) carry positive balances.
--   Liabilities (money we owe users) carry negative balances.
-- A user's spendable balance is a liability, so it is stored negative. The
-- `user_nectar_balances` view at the bottom flips the sign for app consumption —
-- nothing outside this file should ever see the raw signed value.
--
-- Unit: integer micro-USD (1e-6 USD). $1.00 = 1000000. Never a float, never a
-- decimal type, never sats. Rationale in the design doc §2.
-- ============================================================================

-- ============================================================================
-- Operating mode — the tripwire that keeps this schema off real money
--
-- Every observation of the outside world is tagged simulated/live, and a trigger
-- refuses any observation whose tag disagrees with the current mode. Until
-- someone deliberately flips this row to 'live', a real Strike poll is a
-- constraint violation, not a code review question.
-- ============================================================================
create type public.ledger_rails_mode as enum ('simulated', 'live');

create table public.ledger_settings (
  id boolean primary key default true constraint ledger_settings_singleton check (id),
  rails_mode public.ledger_rails_mode not null default 'simulated',
  updated_at timestamptz not null default now()
);

insert into public.ledger_settings (id) values (true);

create function public.ledger_current_mode()
returns public.ledger_rails_mode
language sql stable
as $$ select rails_mode from public.ledger_settings where id $$;

-- ============================================================================
-- Accounts
--
-- Bounded set: two per user (available + their own seed escrow) plus a handful
-- of house accounts. Per-seed escrow is NOT a per-seed account — seed identity
-- lives on the posting, so escrow stays auditable per seed without unbounded
-- account growth. See design doc §4.
-- ============================================================================
create type public.ledger_account_kind as enum (
  -- assets: money we actually hold
  'strike_cash',          -- our pooled USD claim on Strike
  'strike_btc',           -- our pooled BTC claim on Strike, marked to USD
  -- liabilities: money we owe someone
  'user_available',       -- a user's spendable nectar
  'user_seed_escrow',     -- a user's funds committed to unbloomed seeds
  'withdrawal_pending',   -- reserved for an in-flight payout, no longer spendable
  -- equity / income: our own money, and the buffer that absorbs FX drift
  'fee_income',
  'fx_reserve'
);

create table public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  kind public.ledger_account_kind not null,
  owner_user_id uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),

  -- User-scoped kinds require an owner; house kinds must not have one.
  constraint ledger_accounts_owner_matches_kind check (
    (kind in ('user_available', 'user_seed_escrow') and owner_user_id is not null)
    or (kind not in ('user_available', 'user_seed_escrow') and owner_user_id is null)
  )
);

-- Exactly one account per (user, kind), and exactly one of each house account.
create unique index ledger_accounts_user_kind_uniq
  on public.ledger_accounts (owner_user_id, kind)
  where owner_user_id is not null;

create unique index ledger_accounts_house_kind_uniq
  on public.ledger_accounts (kind)
  where owner_user_id is null;

-- Classification is a property of the kind, not a column anyone can get wrong.
create function public.ledger_account_class(k public.ledger_account_kind)
returns text
language sql immutable
as $$
  select case
    when k in ('strike_cash', 'strike_btc') then 'asset'
    when k in ('user_available', 'user_seed_escrow', 'withdrawal_pending') then 'liability'
    else 'equity'
  end
$$;

-- ONE user-owed account never gets a debit balance: a user cannot spend money
-- they do not have, and escrow cannot release more than was committed.
create function public.ledger_kind_must_not_be_debit(k public.ledger_account_kind)
returns boolean
language sql immutable
as $$ select k in ('user_available', 'user_seed_escrow', 'withdrawal_pending') $$;

-- ============================================================================
-- Strike rails — observation tables
--
-- The load-bearing structural rule, per Fizz's spike: a webhook is a *nudge*,
-- never a value carrier. `strike_webhook_deliveries` has no foreign-key path
-- into the ledger at all. Money can only be credited from a
-- `strike_invoice_polls` row, which records an actual GET response body.
-- This is enforced by the schema, not by remembering to do it in code.
-- ============================================================================

-- Intent-first: this row is written BEFORE the POST /v1/invoices call, so a
-- crash mid-call leaves a claim we can reconcile rather than an orphan invoice
-- at Strike that we have no record of.
create table public.strike_invoices (
  correlation_id uuid primary key default gen_random_uuid(), -- OURS. sent as correlationId.
  user_id uuid not null references public.profiles (id) on delete restrict,
  requested_amount_microusd bigint not null check (requested_amount_microusd > 0),
  created_at timestamptz not null default now(),

  -- Filled in only once Strike's response comes back. Null == we do not yet know
  -- whether the invoice exists at Strike; that is a reconciliation job, not an error.
  strike_invoice_id uuid unique,
  api_confirmed_at timestamptz,

  constraint strike_invoices_id_implies_confirmed check (
    (strike_invoice_id is null) = (api_confirmed_at is null)
  )
);

-- Append-only record of what GET /v1/invoices/<id> actually returned. The only
-- thing in this database permitted to justify crediting a user.
create table public.strike_invoice_polls (
  id uuid primary key default gen_random_uuid(),
  correlation_id uuid not null references public.strike_invoices (correlation_id) on delete restrict,
  polled_at timestamptz not null default now(),
  observed_state text not null,
  observed_amount_microusd bigint not null check (observed_amount_microusd >= 0),
  is_simulated boolean not null,
  raw_response jsonb not null
);

-- Webhook deliveries: recorded for observability and replay-debugging only.
-- Note the absence of any column referencing the ledger. That absence is the design.
create table public.strike_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  signature_verified boolean not null,
  event_type text,
  entity_id text,
  changes text[],
  raw_body text not null,
  handled_at timestamptz
);

-- Withdrawals. `id` doubles as our idempotency key for Strike's payout call —
-- generated and persisted before we ask Strike to move anything.
create type public.strike_payout_state as enum ('reserved', 'submitted', 'settled', 'failed');

create table public.strike_payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  amount_microusd bigint not null check (amount_microusd > 0),
  destination_kind text not null,
  destination text not null,
  state public.strike_payout_state not null default 'reserved',
  strike_payment_id text unique,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

-- External truth check: our `strike_cash` ledger balance vs GET /balances.
create table public.custody_reconciliations (
  id uuid primary key default gen_random_uuid(),
  checked_at timestamptz not null default now(),
  ledger_cash_microusd bigint not null,
  strike_reported_cash_microusd bigint not null,
  delta_microusd bigint generated always as
    (strike_reported_cash_microusd - ledger_cash_microusd) stored,
  is_simulated boolean not null,
  raw_response jsonb
);

-- ============================================================================
-- Transactions and postings
-- ============================================================================
create type public.ledger_transaction_kind as enum (
  'funding',              -- external money in
  'tip',                  -- user -> user, instant
  'seed_plant',           -- user available -> that user's escrow
  'seed_bloom',           -- escrow -> recipient available
  'seed_refund',          -- escrow -> back to sender available
  'withdrawal_reserve',   -- available -> withdrawal_pending
  'withdrawal_settle',    -- withdrawal_pending -> assets out
  'fee',
  'fx_mark',              -- mark BTC holdings to USD
  'adjustment'            -- manual correction, always paired with a reversal
);

create table public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  kind public.ledger_transaction_kind not null,

  -- Exactly-once, application-side. For funding this is 'fund:' || correlation_id,
  -- so polling the same paid invoice a hundred times credits the user exactly once.
  idempotency_key text not null unique,

  -- Money may only enter the ledger on the authority of an observed GET response.
  source_poll_id uuid references public.strike_invoice_polls (id) on delete restrict,
  payout_id uuid references public.strike_payouts (id) on delete restrict,

  reverses_transaction_id uuid unique references public.ledger_transactions (id) on delete restrict,
  memo text,
  created_at timestamptz not null default now(),

  constraint funding_requires_poll check (
    kind <> 'funding' or source_poll_id is not null
  ),
  constraint withdrawal_requires_payout check (
    kind not in ('withdrawal_reserve', 'withdrawal_settle') or payout_id is not null
  ),
  -- Purely internal movements must not claim external authority.
  constraint internal_kinds_have_no_poll check (
    kind not in ('tip', 'seed_plant', 'seed_bloom', 'seed_refund') or source_poll_id is null
  )
);

create table public.ledger_postings (
  id bigint generated always as identity primary key,
  transaction_id uuid not null references public.ledger_transactions (id) on delete restrict,
  account_id uuid not null references public.ledger_accounts (id) on delete restrict,
  amount_microusd bigint not null check (amount_microusd <> 0),

  -- Seed attribution lives here rather than in a per-seed account, so escrow is
  -- provable per seed without unbounded account creation.
  seed_id uuid,
  created_at timestamptz not null default now()
);

create index ledger_postings_account_idx on public.ledger_postings (account_id, id);
create index ledger_postings_transaction_idx on public.ledger_postings (transaction_id);
create index ledger_postings_seed_idx on public.ledger_postings (seed_id) where seed_id is not null;

-- ============================================================================
-- Immutability
--
-- Postings and transactions are append-only. A mistake is corrected by writing a
-- reversing transaction, never by editing history. Enforced in the database so
-- that a service-role key — which bypasses RLS entirely — still cannot rewrite
-- the past.
-- ============================================================================
create function public.ledger_forbid_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'ledger rows are append-only: attempted % on %. Write a reversing transaction instead.',
    tg_op, tg_table_name
    using errcode = 'restrict_violation';
end;
$$;

create trigger ledger_postings_immutable
  before update or delete on public.ledger_postings
  for each row execute function public.ledger_forbid_mutation();

create trigger ledger_transactions_immutable
  before update or delete on public.ledger_transactions
  for each row execute function public.ledger_forbid_mutation();

-- ============================================================================
-- Balance cache
--
-- Postings are truth; this table is an index. `ledger_verify_balance_cache()`
-- recomputes from postings and reports drift, so the optimisation is checkable
-- rather than trusted.
-- ============================================================================
create table public.ledger_account_balances (
  account_id uuid primary key references public.ledger_accounts (id) on delete restrict,
  balance_microusd bigint not null default 0,
  updated_at timestamptz not null default now()
);

create function public.ledger_apply_posting_to_balance()
returns trigger
language plpgsql
as $$
begin
  insert into public.ledger_account_balances (account_id, balance_microusd)
  values (new.account_id, new.amount_microusd)
  on conflict (account_id) do update
    set balance_microusd = public.ledger_account_balances.balance_microusd + excluded.balance_microusd,
        updated_at = now();
  return null;
end;
$$;

create trigger ledger_postings_maintain_balance
  after insert on public.ledger_postings
  for each row execute function public.ledger_apply_posting_to_balance();

-- Give every account a zero row up front so a balance query never returns no rows.
create function public.ledger_seed_balance_row()
returns trigger
language plpgsql
as $$
begin
  insert into public.ledger_account_balances (account_id, balance_microusd)
  values (new.id, 0)
  on conflict (account_id) do nothing;
  return null;
end;
$$;

create trigger ledger_accounts_seed_balance
  after insert on public.ledger_accounts
  for each row execute function public.ledger_seed_balance_row();

-- ============================================================================
-- The two hard invariants
--
-- Both are DEFERRED constraint triggers: they fire at COMMIT, not per statement,
-- because a balanced transaction is only balanced once all of its postings are
-- written. This is what makes "every transaction balances" a database guarantee
-- rather than a convention the application is trusted to honour.
-- ============================================================================

-- I1: postings of a transaction sum to zero.
create function public.ledger_assert_balanced()
returns trigger
language plpgsql
as $$
declare
  total bigint;
  n int;
begin
  select coalesce(sum(amount_microusd), 0), count(*)
    into total, n
    from public.ledger_postings
   where transaction_id = new.transaction_id;

  if n < 2 then
    raise exception 'ledger transaction % has % posting(s); double-entry requires at least 2',
      new.transaction_id, n
      using errcode = 'check_violation';
  end if;

  if total <> 0 then
    raise exception 'ledger transaction % is unbalanced by % microUSD',
      new.transaction_id, total
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

create constraint trigger ledger_postings_balanced
  after insert on public.ledger_postings
  deferrable initially deferred
  for each row execute function public.ledger_assert_balanced();

-- I2: user-owed accounts never carry a debit balance — no overdraft, ever.
create function public.ledger_assert_no_overdraft()
returns trigger
language plpgsql
as $$
declare
  acct_kind public.ledger_account_kind;
  bal bigint;
begin
  select a.kind, b.balance_microusd
    into acct_kind, bal
    from public.ledger_accounts a
    join public.ledger_account_balances b on b.account_id = a.id
   where a.id = new.account_id;

  if public.ledger_kind_must_not_be_debit(acct_kind) and bal > 0 then
    raise exception 'overdraft: account % (%) would hold a debit balance of % microUSD',
      new.account_id, acct_kind, bal
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

create constraint trigger ledger_postings_no_overdraft
  after insert on public.ledger_postings
  deferrable initially deferred
  for each row execute function public.ledger_assert_no_overdraft();

-- I3: a funding transaction must credit the user who actually paid the invoice,
-- for exactly the amount the invoice was observed to have been paid.
--
-- Without this, `funding_requires_poll` only proves that *some* observed payment
-- exists — a bug that passes the wrong user_id, or credits $100 against a $10
-- invoice, would satisfy every other constraint in this file and balance
-- perfectly. This ties the credit to the payer and the amount, in the database.
create function public.ledger_assert_funding_matches_invoice()
returns trigger
language plpgsql
as $$
declare
  txn record;
  invoice_user uuid;
  observed bigint;
  credited_user bigint;
  credited_fees bigint;
  foreign_accounts int;
begin
  select kind, source_poll_id into txn
    from public.ledger_transactions where id = new.transaction_id;

  if txn.kind <> 'funding' then
    return null;
  end if;

  select i.user_id, p.observed_amount_microusd
    into invoice_user, observed
    from public.strike_invoice_polls p
    join public.strike_invoices i on i.correlation_id = p.correlation_id
   where p.id = txn.source_poll_id;

  -- No user-owned account other than the payer's may appear in a funding txn.
  select count(*) into foreign_accounts
    from public.ledger_postings lp
    join public.ledger_accounts a on a.id = lp.account_id
   where lp.transaction_id = new.transaction_id
     and a.owner_user_id is not null
     and a.owner_user_id is distinct from invoice_user;

  if foreign_accounts > 0 then
    raise exception
      'funding transaction % touches an account not owned by the invoice payer %',
      new.transaction_id, invoice_user
      using errcode = 'check_violation';
  end if;

  select coalesce(-sum(lp.amount_microusd), 0) into credited_user
    from public.ledger_postings lp
    join public.ledger_accounts a on a.id = lp.account_id
   where lp.transaction_id = new.transaction_id and a.kind = 'user_available';

  select coalesce(-sum(lp.amount_microusd), 0) into credited_fees
    from public.ledger_postings lp
    join public.ledger_accounts a on a.id = lp.account_id
   where lp.transaction_id = new.transaction_id and a.kind = 'fee_income';

  -- What the user gets plus what we keep must equal what actually arrived.
  if credited_user + credited_fees <> observed then
    raise exception
      'funding transaction % distributes % microUSD but the observed payment was %',
      new.transaction_id, credited_user + credited_fees, observed
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

create constraint trigger ledger_postings_funding_matches_invoice
  after insert on public.ledger_postings
  deferrable initially deferred
  for each row execute function public.ledger_assert_funding_matches_invoice();

-- I4: an observation of the outside world must match the configured rails mode.
create function public.ledger_assert_mode_matches()
returns trigger
language plpgsql
as $$
begin
  if new.is_simulated <> (public.ledger_current_mode() = 'simulated') then
    raise exception
      'rails mode is %, refusing to record an observation marked is_simulated=%',
      public.ledger_current_mode(), new.is_simulated
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger strike_invoice_polls_mode_guard
  before insert on public.strike_invoice_polls
  for each row execute function public.ledger_assert_mode_matches();

create trigger custody_reconciliations_mode_guard
  before insert on public.custody_reconciliations
  for each row execute function public.ledger_assert_mode_matches();

-- ============================================================================
-- Verification surface
--
-- These are what the reconciliation sweep calls. Each returns data, not a
-- boolean, so an alert can say *how far* off we are, not just that we are off.
-- ============================================================================

-- Recompute every balance from postings and report any drift in the cache.
create function public.ledger_verify_balance_cache()
returns table (account_id uuid, cached_microusd bigint, computed_microusd bigint, drift_microusd bigint)
language sql stable
as $$
  select b.account_id,
         b.balance_microusd,
         coalesce(p.total, 0),
         b.balance_microusd - coalesce(p.total, 0)
    from public.ledger_account_balances b
    left join (
      select ledger_postings.account_id, sum(amount_microusd) as total
        from public.ledger_postings
       group by ledger_postings.account_id
    ) p on p.account_id = b.account_id
   where b.balance_microusd <> coalesce(p.total, 0)
$$;

-- Solvency. Because every transaction sums to zero, assets + liabilities + equity
-- is identically zero — so solvency reduces to the sign of one number:
-- our own equity must be credit-normal (<= 0). The moment it goes positive we owe
-- users more than we hold. This is the continuous invariant to alert on.
create function public.ledger_solvency()
returns table (
  assets_microusd bigint,
  user_liabilities_microusd bigint,
  equity_microusd bigint,
  coverage_microusd bigint,
  is_solvent boolean
)
language sql stable
as $$
  with classified as (
    select public.ledger_account_class(a.kind) as class, b.balance_microusd as bal
      from public.ledger_accounts a
      join public.ledger_account_balances b on b.account_id = a.id
  ),
  totals as (
    select
      coalesce(sum(bal) filter (where class = 'asset'), 0)     as assets,
      coalesce(sum(bal) filter (where class = 'liability'), 0) as liabilities,
      coalesce(sum(bal) filter (where class = 'equity'), 0)    as equity
    from classified
  )
  select assets,
         -liabilities,          -- report what we owe as a positive number
         equity,
         assets + liabilities,  -- liabilities are negative, so this is the buffer
         equity <= 0
    from totals
$$;

-- Per-seed escrow, derived from posting attribution rather than a per-seed account.
create view public.seed_escrow_balances as
  select p.seed_id,
         a.owner_user_id as sender_id,
         -sum(p.amount_microusd) as escrowed_microusd
    from public.ledger_postings p
    join public.ledger_accounts a on a.id = p.account_id
   where p.seed_id is not null
     and a.kind = 'user_seed_escrow'
   group by p.seed_id, a.owner_user_id;

-- The app-facing balance surface: sign flipped, one row per user.
create view public.user_nectar_balances as
  select a.owner_user_id as user_id,
         -coalesce(sum(b.balance_microusd) filter (where a.kind = 'user_available'), 0)
           as available_microusd,
         -coalesce(sum(b.balance_microusd) filter (where a.kind = 'user_seed_escrow'), 0)
           as escrowed_microusd
    from public.ledger_accounts a
    join public.ledger_account_balances b on b.account_id = a.id
   where a.owner_user_id is not null
   group by a.owner_user_id;

-- ============================================================================
-- Row level security
--
-- No client role may ever write to the ledger. Every write goes through the
-- payments service using the service-role key. Clients get read access to their
-- own rows and nothing else. Supabase's service_role bypasses RLS, which is why
-- the immutability triggers above exist at the table level rather than as policies.
-- ============================================================================
alter table public.ledger_accounts          enable row level security;
alter table public.ledger_account_balances  enable row level security;
alter table public.ledger_transactions      enable row level security;
alter table public.ledger_postings          enable row level security;
alter table public.ledger_settings          enable row level security;
alter table public.strike_invoices          enable row level security;
alter table public.strike_invoice_polls     enable row level security;
alter table public.strike_webhook_deliveries enable row level security;
alter table public.strike_payouts           enable row level security;
alter table public.custody_reconciliations  enable row level security;

revoke all on public.ledger_accounts, public.ledger_account_balances,
  public.ledger_transactions, public.ledger_postings, public.ledger_settings,
  public.strike_invoices, public.strike_invoice_polls,
  public.strike_webhook_deliveries, public.strike_payouts,
  public.custody_reconciliations
  from anon, authenticated;

grant select on public.ledger_accounts, public.ledger_account_balances,
  public.ledger_postings, public.ledger_transactions, public.strike_invoices,
  public.strike_payouts
  to authenticated;

grant select on public.user_nectar_balances, public.seed_escrow_balances to authenticated;

create policy "ledger_accounts_select_own"
  on public.ledger_accounts for select
  to authenticated
  using (owner_user_id = auth.uid());

create policy "ledger_balances_select_own"
  on public.ledger_account_balances for select
  to authenticated
  using (exists (
    select 1 from public.ledger_accounts a
     where a.id = account_id and a.owner_user_id = auth.uid()
  ));

create policy "ledger_postings_select_own"
  on public.ledger_postings for select
  to authenticated
  using (exists (
    select 1 from public.ledger_accounts a
     where a.id = account_id and a.owner_user_id = auth.uid()
  ));

create policy "ledger_transactions_select_touching_own"
  on public.ledger_transactions for select
  to authenticated
  using (exists (
    select 1 from public.ledger_postings p
      join public.ledger_accounts a on a.id = p.account_id
     where p.transaction_id = ledger_transactions.id
       and a.owner_user_id = auth.uid()
  ));

create policy "strike_invoices_select_own"
  on public.strike_invoices for select
  to authenticated
  using (user_id = auth.uid());

create policy "strike_payouts_select_own"
  on public.strike_payouts for select
  to authenticated
  using (user_id = auth.uid());

-- Views run with the definer's rights by default; pin them to the invoker so the
-- policies above actually apply to reads through them.
alter view public.user_nectar_balances set (security_invoker = true);
alter view public.seed_escrow_balances set (security_invoker = true);

-- ==============================================================================
-- DUITKU - FULL SUPABASE DATABASE & STORAGE SCHEMA
-- Salin dan jalankan seluruh kode SQL ini di:
-- Supabase Dashboard -> Project Anda -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABEL PROFIL PENGGUNA (PROFILES) & FOTO PROFIL
-- ------------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text,
  avatar_url text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Otomatis buat profil saat pengguna baru mendaftar di Supabase Auth
create or replace function public.handle_new_user()
returns trigger 
language plpgsql 
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), 
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ------------------------------------------------------------------------------
-- 2. STORAGE BUCKET UNTUK FOTO PROFIL (AVATARS)
-- ------------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Authenticated users can upload avatar" on storage.objects;
create policy "Authenticated users can upload avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update their avatar" on storage.objects;
create policy "Authenticated users can update their avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.role() = 'authenticated');

drop policy if exists "Authenticated users can delete their avatar" on storage.objects;
create policy "Authenticated users can delete their avatar"
  on storage.objects for delete
  using (bucket_id = 'avatars' and auth.role() = 'authenticated');


-- ------------------------------------------------------------------------------
-- 3. TABEL REKENING & DOMPET (ACCOUNTS)
-- ------------------------------------------------------------------------------
create table if not exists public.accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade default auth.uid(),
  name text not null,
  balance numeric not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.accounts enable row level security;

drop policy if exists "Users manage own accounts" on public.accounts;
create policy "Users manage own accounts"
  on public.accounts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ------------------------------------------------------------------------------
-- 4. TABEL TRANSAKSI (TRANSACTIONS)
-- ------------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade default auth.uid(),
  account_id uuid references public.accounts(id) on delete cascade not null,
  type text not null check (type in ('expense', 'income')),
  amount numeric not null,
  category text,
  note text,
  date date not null default current_date,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.transactions enable row level security;

drop policy if exists "Users manage own transactions" on public.transactions;
create policy "Users manage own transactions"
  on public.transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ------------------------------------------------------------------------------
-- 5. TABEL CICILAN & PINJAMAN (INSTALLMENTS)
-- ------------------------------------------------------------------------------
create table if not exists public.installments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade default auth.uid(),
  account_id uuid references public.accounts(id) on delete set null,
  name text not null,
  monthly_amount numeric not null,
  total_months integer not null,
  paid_months integer not null default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.installments enable row level security;

drop policy if exists "Users manage own installments" on public.installments;
create policy "Users manage own installments"
  on public.installments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ------------------------------------------------------------------------------
-- 6. TABEL TABUNGAN IMPIAN (SAVINGS)
-- ------------------------------------------------------------------------------
create table if not exists public.savings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade default auth.uid(),
  name text not null,
  target numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.savings enable row level security;

drop policy if exists "Users manage own savings" on public.savings;
create policy "Users manage own savings"
  on public.savings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ------------------------------------------------------------------------------
-- 7. TABEL MUTASI TABUNGAN (SAVING_MOVES)
-- ------------------------------------------------------------------------------
create table if not exists public.saving_moves (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade default auth.uid(),
  saving_id uuid references public.savings(id) on delete cascade not null,
  account_id uuid references public.accounts(id) on delete set null,
  type text not null check (type in ('in', 'out')),
  amount numeric not null,
  note text,
  date date not null default current_date,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.saving_moves enable row level security;

drop policy if exists "Users manage own saving_moves" on public.saving_moves;
create policy "Users manage own saving_moves"
  on public.saving_moves for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ------------------------------------------------------------------------------
-- 8. TABEL ANGGARAN BULANAN (BUDGETS)
-- ------------------------------------------------------------------------------
create table if not exists public.budgets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade default auth.uid(),
  category text not null,
  monthly_limit numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.budgets enable row level security;

drop policy if exists "Users manage own budgets" on public.budgets;
create policy "Users manage own budgets"
  on public.budgets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ------------------------------------------------------------------------------
-- 9. TABEL TRANSAKSI RUTIN TERJADWAL (RECURRING)
-- ------------------------------------------------------------------------------
create table if not exists public.recurring (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade default auth.uid(),
  account_id uuid references public.accounts(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('expense', 'income')),
  amount numeric not null,
  category text,
  day_of_month integer not null check (day_of_month between 1 and 28),
  last_run text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.recurring enable row level security;

drop policy if exists "Users manage own recurring" on public.recurring;
create policy "Users manage own recurring"
  on public.recurring for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ==============================================================================
-- SELESAI! Seluruh tabel, keamanan RLS, storage avatar, & trigger telah siap.
-- ==============================================================================

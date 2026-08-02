-- Inbox voor recepten die via de Edge Function ig-import binnenkomen.
-- De app leest hem uit bij elke sync en zet consumed op true.
create table if not exists public.recipe_inbox (
  id bigint generated always as identity primary key,
  household_id text not null,
  recipe jsonb not null,
  source_url text,
  consumed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists recipe_inbox_pending_idx
  on public.recipe_inbox (household_id, consumed);

alter table public.recipe_inbox enable row level security;

-- Zelfde policy als weekmenu_sync: het household_id is de sleutel tot de data.
drop policy if exists "allow_all" on public.recipe_inbox;
create policy "allow_all" on public.recipe_inbox
  for all using (true) with check (true);

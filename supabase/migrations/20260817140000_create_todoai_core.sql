create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.workspaces (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  color text not null default '#6366f1',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint workspaces_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint workspaces_color_hex check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint workspaces_position_nonnegative check (position >= 0)
);

create table public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workspace_id text not null,
  title text not null,
  notes text not null default '',
  status text not null default 'todo',
  priority text not null default 'none',
  due_date date,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint todos_workspace_owner_fkey foreign key (user_id, workspace_id)
    references public.workspaces(user_id, id) on delete cascade,
  constraint todos_title_length check (char_length(btrim(title)) between 1 and 240),
  constraint todos_notes_length check (char_length(notes) <= 10000),
  constraint todos_status_valid check (status in ('todo', 'doing', 'done')),
  constraint todos_priority_valid check (priority in ('none', 'low', 'medium', 'high')),
  constraint todos_position_nonnegative check (position >= 0)
);

create index workspaces_user_position_idx on public.workspaces (user_id, position, created_at);
create index todos_user_workspace_status_position_idx on public.todos (user_id, workspace_id, status, position);
create index todos_user_status_due_idx on public.todos (user_id, status, due_date);

create or replace function private.set_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$ begin new.updated_at = now(); return new; end; $$;
revoke all on function private.set_updated_at() from public, anon, authenticated;

create trigger workspaces_set_updated_at before update on public.workspaces
for each row execute function private.set_updated_at();
create trigger todos_set_updated_at before update on public.todos
for each row execute function private.set_updated_at();

alter table public.workspaces enable row level security;
alter table public.todos enable row level security;

create policy workspaces_select_own on public.workspaces for select to authenticated using ((select auth.uid()) = user_id);
create policy workspaces_insert_own on public.workspaces for insert to authenticated with check ((select auth.uid()) = user_id);
create policy workspaces_update_own on public.workspaces for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy workspaces_delete_own on public.workspaces for delete to authenticated using ((select auth.uid()) = user_id);
create policy todos_select_own on public.todos for select to authenticated using ((select auth.uid()) = user_id);
create policy todos_insert_own on public.todos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy todos_update_own on public.todos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy todos_delete_own on public.todos for delete to authenticated using ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.workspaces, public.todos to authenticated;
revoke all on public.workspaces, public.todos from anon;

create table private.legacy_import_batches (
  id uuid primary key default gen_random_uuid(),
  token_hash bytea not null unique,
  workspaces jsonb not null,
  todos jsonb not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  claimed_by uuid references auth.users(id) on delete set null
);
create index legacy_import_batches_claimed_by_idx on private.legacy_import_batches (claimed_by);
revoke all on private.legacy_import_batches from public, anon, authenticated;

create or replace function public.claim_todoai_legacy_import(migration_token text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  batch_id uuid;
  batch_workspaces jsonb;
  batch_todos jsonb;
  workspace_count integer;
  todo_count integer;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  select id, workspaces, todos into batch_id, batch_workspaces, batch_todos
  from private.legacy_import_batches
  where token_hash = extensions.digest(migration_token, 'sha256') and consumed_at is null
  for update;
  if batch_id is null then raise exception 'invalid or already used migration token'; end if;

  insert into public.workspaces (user_id, id, name, color, position, created_at, updated_at)
  select current_user_id, row_data.id, btrim(row_data.name), row_data.color,
    row_number() over (order by row_data.created_at, row_data.id) - 1,
    row_data.created_at, row_data.created_at
  from jsonb_to_recordset(batch_workspaces) as row_data(id text, name text, color text, created_at timestamptz)
  on conflict (user_id, id) do update set
    name = excluded.name, color = excluded.color, position = excluded.position, updated_at = excluded.updated_at;
  get diagnostics workspace_count = row_count;

  insert into public.todos (id, user_id, workspace_id, title, notes, status, priority, due_date, position, created_at, updated_at)
  select row_data.id, current_user_id, row_data.workspace_id, btrim(row_data.title), coalesce(row_data.notes, ''),
    row_data.status, row_data.priority, row_data.due_date, greatest(row_data.position, 0),
    row_data.created_at, row_data.updated_at
  from jsonb_to_recordset(batch_todos) as row_data(
    id uuid, workspace_id text, title text, notes text, status text, priority text,
    due_date date, position integer, created_at timestamptz, updated_at timestamptz
  )
  on conflict (id) do update set
    user_id = excluded.user_id, workspace_id = excluded.workspace_id, title = excluded.title,
    notes = excluded.notes, status = excluded.status, priority = excluded.priority,
    due_date = excluded.due_date, position = excluded.position, updated_at = excluded.updated_at;
  get diagnostics todo_count = row_count;

  update private.legacy_import_batches set consumed_at = now(), claimed_by = current_user_id where id = batch_id;
  return jsonb_build_object('workspaces', workspace_count, 'todos', todo_count, 'claimed_by', current_user_id);
end;
$$;
revoke all on function public.claim_todoai_legacy_import(text) from public, anon;
grant execute on function public.claim_todoai_legacy_import(text) to authenticated;

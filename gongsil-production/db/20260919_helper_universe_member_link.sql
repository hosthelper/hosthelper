alter table gongsil.profiles
  add column if not exists universe_member_id text,
  add column if not exists universe_linked_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'gongsil_profiles_universe_member_id_format'
      and conrelid = 'gongsil.profiles'::regclass
  ) then
    alter table gongsil.profiles
      add constraint gongsil_profiles_universe_member_id_format
      check (
        universe_member_id is null
        or universe_member_id ~ '^hu_[a-f0-9]{32}$'
      );
  end if;
end $$;

create unique index if not exists gongsil_profiles_universe_member_id_uidx
  on gongsil.profiles (universe_member_id)
  where universe_member_id is not null;

create or replace function public.gongsil_link_universe_member(p_member_id text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_member_id text := lower(trim(coalesce(p_member_id, '')));
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;

  if v_member_id !~ '^hu_[a-f0-9]{32}$' then
    raise exception 'invalid_universe_member_id';
  end if;

  update gongsil.profiles
     set universe_member_id = v_member_id,
         universe_linked_at = now(),
         updated_at = now()
   where id = v_uid;

  if not found then
    raise exception 'profile_required';
  end if;

  return jsonb_build_object(
    'ok', true,
    'user_id', v_uid,
    'universe_member_id', v_member_id
  );
end;
$$;

revoke all on function public.gongsil_link_universe_member(text) from public, anon;
grant execute on function public.gongsil_link_universe_member(text) to authenticated;

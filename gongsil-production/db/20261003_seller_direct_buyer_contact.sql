-- 2026-10-03
-- Direct-deal seller visibility: expose approved/completed buyer contact only to the owner of the matched property.

create or replace function public.gongsil_my_direct_buyer_contacts()
returns table(
  match_id uuid,
  property_id uuid,
  property_title text,
  property_area text,
  match_status text,
  buyer_user_id uuid,
  buyer_name text,
  buyer_email text,
  buyer_phone text,
  buyer_note text,
  created_at timestamptz
)
language sql
security definer
set search_path=''
as $$
  select
    m.id,
    m.property_id,
    p.title,
    p.area,
    m.status,
    m.buyer_user_id,
    coalesce(pr.display_name,'공실헬퍼 회원'),
    u.email::text,
    u.phone::text,
    m.note,
    m.created_at
  from gongsil.match_requests m
  join gongsil.properties p on p.id=m.property_id
  join auth.users u on u.id=m.buyer_user_id
  left join gongsil.profiles pr on pr.id=m.buyer_user_id
  where p.owner_id=(select auth.uid())
    and m.mode='direct'
    and m.status in ('approved','completed')
  order by m.created_at desc
$$;

revoke all on function public.gongsil_my_direct_buyer_contacts() from public,anon;
grant execute on function public.gongsil_my_direct_buyer_contacts() to authenticated;

create or replace function gongsil_private.notify_seller_direct_match()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_owner uuid;
  v_title text;
  v_buyer_name text;
begin
  if new.mode<>'direct' or new.status not in ('approved','completed') then return new; end if;

  select p.owner_id,p.title into v_owner,v_title
  from gongsil.properties p
  where p.id=new.property_id;

  if v_owner is null then return new; end if;

  select coalesce(pr.display_name,'공실헬퍼 회원') into v_buyer_name
  from gongsil.profiles pr
  where pr.id=new.buyer_user_id;

  perform gongsil_private.notify_once(
    v_owner,
    'direct-match-seller:'||new.id::text,
    'direct_buyer_contact_ready',
    '새 직거래 요청이 들어왔습니다.',
    coalesce(v_title,'등록 매물')||' · '||coalesce(v_buyer_name,'공실헬퍼 회원')||'님의 연락처를 내 공실헬퍼에서 확인할 수 있습니다.',
    'match',
    new.id,
    2::smallint,
    jsonb_build_object('property_id',new.property_id,'buyer_user_id',new.buyer_user_id,'mode','direct')
  );
  return new;
end;
$$;

drop trigger if exists gongsil_notify_seller_direct_match on gongsil.match_requests;
create trigger gongsil_notify_seller_direct_match
after insert or update of status on gongsil.match_requests
for each row execute function gongsil_private.notify_seller_direct_match();

revoke all on function gongsil_private.notify_seller_direct_match() from public,anon,authenticated;

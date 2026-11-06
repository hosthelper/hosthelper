-- 2026-10-03
-- 공실헬퍼 거래 매칭 무결성 보강
-- 1) UUID broker 선택 시 min(uuid) 오류 제거
-- 2) 직거래/지정중개사 모드 전환 시 이전 비활성 문의를 안전하게 종료
-- 3) broker_assignments CHECK 제약에 맞게 inquiry assignment는 inquiry_id만 저장

create or replace function public.gongsil_request_match(
  p_property_id uuid,
  p_mode text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_match_id uuid;
  v_inquiry_id uuid;
  v_broker uuid;
  v_broker_count int;
  v_contact_until timestamptz;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if not gongsil_private.is_kakao_user() then raise exception 'kakao_login_required'; end if;
  if not gongsil_private.has_role('user') then raise exception 'buyer_role_required'; end if;
  if p_mode not in ('direct','broker') then raise exception 'invalid_match_mode'; end if;
  if not gongsil_private.has_property_entitlement(p_property_id) then
    raise exception 'detail_access_required';
  end if;
  if not exists(
    select 1 from gongsil.properties p
    where p.id=p_property_id and p.publication_status='published'
  ) then
    raise exception 'property_not_published';
  end if;

  if exists(
    select 1 from gongsil.match_requests m
    where m.property_id=p_property_id
      and m.buyer_user_id=v_uid
      and m.status in ('requested','approved','broker_assigned')
  ) then
    raise exception 'active_match_exists';
  end if;

  if p_mode='broker' then
    select count(*),min(a.broker_user_id::text)::uuid
      into v_broker_count,v_broker
    from gongsil.broker_assignments a
    where a.property_id=p_property_id
      and a.inquiry_id is null
      and a.active;

    if v_broker_count=0 then raise exception 'designated_broker_required'; end if;
    if v_broker_count>1 then raise exception 'designated_broker_ambiguous'; end if;
    if not exists(
      select 1 from gongsil.user_roles
      where user_id=v_broker and role='broker' and status='active'
    ) then
      raise exception 'active_broker_role_required';
    end if;
  end if;

  update gongsil.inquiries
     set stage='cancelled'
   where property_id=p_property_id
     and buyer_user_id=v_uid
     and stage not in ('completed','cancelled','rejected')
     and plan is distinct from p_mode;

  select i.id into v_inquiry_id
  from gongsil.inquiries i
  where i.property_id=p_property_id
    and i.buyer_user_id=v_uid
    and i.plan=p_mode
    and i.stage not in ('completed','cancelled','rejected')
  order by i.submitted_at desc
  limit 1;

  if v_inquiry_id is null then
    insert into gongsil.inquiries(
      property_id,buyer_user_id,broker_user_id,stage,purpose,plan,question,
      consent_version,consented_at,accepted_at,updated_at
    )
    values(
      p_property_id,v_uid,v_broker,'accepted','matching',p_mode,
      nullif(trim(coalesce(p_note,'')),''),
      'privacy-v1-2026-08-31',now(),now(),now()
    )
    returning id into v_inquiry_id;
  else
    update gongsil.inquiries
       set broker_user_id=case when p_mode='broker' then v_broker else null end,
           stage=case when stage='submitted' then 'accepted' else stage end,
           purpose='matching',
           plan=p_mode,
           accepted_at=coalesce(accepted_at,now()),
           updated_at=now()
     where id=v_inquiry_id;
  end if;

  insert into gongsil.match_requests(
    property_id,buyer_user_id,mode,status,note,broker_user_id,
    inquiry_id,approved_at,updated_at
  )
  values(
    p_property_id,v_uid,p_mode,
    case when p_mode='broker' then 'broker_assigned' else 'approved' end,
    nullif(trim(coalesce(p_note,'')),''),
    v_broker,v_inquiry_id,now(),now()
  )
  returning id into v_match_id;

  if p_mode='broker' then
    insert into gongsil.broker_assignments(
      inquiry_id,broker_user_id,assigned_by,active
    )
    values(v_inquiry_id,v_broker,v_uid,true);
  end if;

  select case
           when bool_or(x.valid_until is null) then null
           else max(x.valid_until)
         end
    into v_contact_until
  from (
    select e.valid_until
    from gongsil.access_entitlements e
    where e.user_id=v_uid
      and e.property_id=p_property_id
      and e.entitlement_type='detail_access'
      and e.status='active'
      and e.valid_from<=now()
      and (e.valid_until is null or e.valid_until>now())
    union all
    select o.valid_until
    from gongsil.access_pass_orders o
    join gongsil.access_pass_plans ap on ap.plan_code=o.plan_code
    where o.user_id=v_uid
      and o.status='paid'
      and ap.plan_kind='time'
      and o.valid_from is not null
      and o.valid_from<=now()
      and (o.valid_until is null or o.valid_until>now())
  ) x;

  insert into gongsil.access_entitlements(
    user_id,property_id,entitlement_type,status,valid_from,valid_until
  )
  values(v_uid,p_property_id,'contact_access','active',now(),v_contact_until)
  on conflict(user_id,property_id,entitlement_type)
  do update set
    status='active',
    valid_from=excluded.valid_from,
    valid_until=excluded.valid_until;

  perform gongsil_private.notify_once(
    v_uid,
    'match-buyer:'||v_match_id::text,
    'match_contact_ready',
    '거래 연결 연락처가 열렸습니다.',
    case when p_mode='broker'
      then '지정중개사 연락처를 내 공실헬퍼에서 확인할 수 있습니다.'
      else '매도인/호스트 연락처를 내 공실헬퍼에서 확인할 수 있습니다.'
    end,
    'match',
    v_match_id,
    2::smallint,
    jsonb_build_object('property_id',p_property_id,'mode',p_mode)
  );

  return v_match_id;
end;
$function$;

create or replace function public.gongsil_admin_approve_match(
  p_match_id uuid,
  p_broker_user_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  r record;
  v_admin uuid := (select auth.uid());
  v_broker uuid;
begin
  if not gongsil_private.is_admin() then raise exception 'admin_required'; end if;
  select * into r from gongsil.match_requests where id=p_match_id and status='requested' for update;
  if not found then return false; end if;

  if r.mode='broker' then
    v_broker:=p_broker_user_id;
    if v_broker is null then
      select a.broker_user_id into v_broker
      from gongsil.broker_assignments a
      where a.property_id=r.property_id and a.inquiry_id is null and a.active
      limit 1;
    end if;
    if v_broker is null then raise exception 'designated_broker_required'; end if;
    if not exists(
      select 1 from gongsil.user_roles
      where user_id=v_broker and role='broker' and status='active'
    ) then
      raise exception 'active_broker_role_required';
    end if;
  end if;

  update gongsil.match_requests
     set status=case when r.mode='broker' then 'broker_assigned' else 'approved' end,
         broker_user_id=case when r.mode='broker' then v_broker else null end,
         approved_at=now(),updated_at=now()
   where id=p_match_id;

  if r.mode='broker' and r.inquiry_id is not null then
    update gongsil.broker_assignments set active=false where inquiry_id=r.inquiry_id and active;
    insert into gongsil.broker_assignments(inquiry_id,broker_user_id,assigned_by,active)
    values(r.inquiry_id,v_broker,v_admin,true);
    update gongsil.inquiries
       set broker_user_id=v_broker,
           stage=case when stage='submitted' then 'accepted' else stage end,
           updated_at=now()
     where id=r.inquiry_id;
  end if;

  return true;
end;
$function$;

create or replace function public.gongsil_admin_reassign_match_broker(
  p_match_id uuid,
  p_broker_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_admin uuid := (select auth.uid());
  r record;
begin
  if not gongsil_private.is_admin() then raise exception 'admin_required'; end if;
  if not exists(
    select 1 from gongsil.user_roles
    where user_id=p_broker_user_id and role='broker' and status='active'
  ) then raise exception 'active_broker_role_required'; end if;

  select id,property_id,inquiry_id,mode,status into r
  from gongsil.match_requests
  where id=p_match_id
  for update;
  if r.id is null then raise exception 'match_not_found'; end if;
  if r.mode<>'broker' then raise exception 'broker_match_required'; end if;
  if r.status not in ('requested','broker_assigned','approved') then raise exception 'match_not_reassignable'; end if;
  if r.inquiry_id is null then raise exception 'match_inquiry_required'; end if;

  update gongsil.broker_assignments
     set active=false
   where inquiry_id=r.inquiry_id and active;

  insert into gongsil.broker_assignments(inquiry_id,broker_user_id,assigned_by,active)
  values(r.inquiry_id,p_broker_user_id,v_admin,true);

  update gongsil.inquiries
     set broker_user_id=p_broker_user_id, updated_at=now()
   where id=r.inquiry_id;

  update gongsil.match_requests
     set broker_user_id=p_broker_user_id,
         status='broker_assigned',
         approved_at=coalesce(approved_at,now()),
         updated_at=now()
   where id=p_match_id;

  return true;
end;
$function$;


-- API privilege hardening: these SECURITY DEFINER RPCs are authenticated-only.
revoke all on function public.gongsil_request_match(uuid,text,text) from public,anon;
grant execute on function public.gongsil_request_match(uuid,text,text) to authenticated;

revoke all on function public.gongsil_admin_approve_match(uuid,uuid) from public,anon;
grant execute on function public.gongsil_admin_approve_match(uuid,uuid) to authenticated;

revoke all on function public.gongsil_admin_reassign_match_broker(uuid,uuid) from public,anon;
grant execute on function public.gongsil_admin_reassign_match_broker(uuid,uuid) to authenticated;

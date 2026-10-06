-- 2026-10-03
-- Fix broker reassignment visibility and add operator reassignment queue.

create or replace function gongsil_private.is_assigned_broker_inquiry(p_inquiry_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select
    case
      when exists(
        select 1
        from gongsil.broker_assignments a0
        where a0.inquiry_id=p_inquiry_id and a0.active
      ) then exists(
        select 1
        from gongsil.broker_assignments a
        where a.inquiry_id=p_inquiry_id
          and a.active
          and a.broker_user_id=(select auth.uid())
      )
      else exists(
        select 1
        from gongsil.inquiries i
        where i.id=p_inquiry_id
          and i.broker_user_id=(select auth.uid())
      ) or exists(
        select 1
        from gongsil.inquiries i
        join gongsil.broker_assignments a
          on a.inquiry_id is null
         and a.property_id=i.property_id
         and a.active
         and a.broker_user_id=(select auth.uid())
        where i.id=p_inquiry_id
      )
    end;
$$;

create or replace function public.gongsil_admin_reassign_match_broker(
  p_match_id uuid,
  p_broker_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_admin uuid := (select auth.uid());
  r record;
  v_old_broker uuid;
begin
  if not gongsil_private.is_admin() then raise exception 'admin_required'; end if;
  if not exists(
    select 1 from gongsil.user_roles
    where user_id=p_broker_user_id and role='broker' and status='active'
  ) then raise exception 'active_broker_role_required'; end if;

  select id,property_id,inquiry_id,mode,status,broker_user_id
    into r
  from gongsil.match_requests
  where id=p_match_id
  for update;

  if r.id is null then raise exception 'match_not_found'; end if;
  if r.mode<>'broker' then raise exception 'broker_match_required'; end if;
  if r.status not in ('requested','broker_assigned','approved') then raise exception 'match_not_reassignable'; end if;
  if r.inquiry_id is null then raise exception 'match_inquiry_required'; end if;

  select coalesce(i.broker_user_id,r.broker_user_id)
    into v_old_broker
  from gongsil.inquiries i
  where i.id=r.inquiry_id
  for update;

  update gongsil.broker_assignments
     set active=false
   where inquiry_id=r.inquiry_id and active;

  insert into gongsil.broker_assignments(
    inquiry_id,broker_user_id,assigned_by,active
  )
  values(r.inquiry_id,p_broker_user_id,v_admin,true);

  update gongsil.inquiries
     set broker_user_id=p_broker_user_id,updated_at=now()
   where id=r.inquiry_id;

  update gongsil.match_requests
     set broker_user_id=p_broker_user_id,
         status='broker_assigned',
         approved_at=coalesce(approved_at,now()),
         updated_at=now()
   where inquiry_id=r.inquiry_id
     and mode='broker'
     and status in ('requested','broker_assigned','approved');

  insert into gongsil.admin_audit_log(
    actor_user_id,action,target_type,target_id,metadata
  )
  values(
    v_admin,'broker_reassigned','inquiry',r.inquiry_id,
    jsonb_build_object(
      'match_id',p_match_id,
      'property_id',r.property_id,
      'old_broker_user_id',v_old_broker,
      'new_broker_user_id',p_broker_user_id
    )
  );

  perform gongsil_private.notify_once(
    p_broker_user_id,
    'broker-reassigned-new:'||r.inquiry_id::text||':'||p_broker_user_id::text,
    'broker_assignment',
    '새 매수인 문의가 배정되었습니다.',
    '공실헬퍼 중개사 모드에서 문의와 거래방을 확인해 주세요.',
    'inquiry',r.inquiry_id,2::smallint,
    jsonb_build_object('property_id',r.property_id,'match_id',p_match_id)
  );

  if v_old_broker is not null and v_old_broker<>p_broker_user_id then
    perform gongsil_private.notify_once(
      v_old_broker,
      'broker-reassigned-old:'||r.inquiry_id::text||':'||v_old_broker::text,
      'broker_assignment_changed',
      '담당 문의가 재배정되었습니다.',
      '해당 문의의 담당 공인중개사가 변경되어 기존 접근 권한이 종료되었습니다.',
      'inquiry',r.inquiry_id,1::smallint,
      jsonb_build_object('property_id',r.property_id,'match_id',p_match_id)
    );
  end if;

  return true;
end;
$$;

revoke all on function public.gongsil_admin_reassign_match_broker(uuid,uuid) from public,anon;
grant execute on function public.gongsil_admin_reassign_match_broker(uuid,uuid) to authenticated;

create or replace function public.gongsil_admin_broker_reassignment_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if not gongsil_private.is_admin() then raise exception 'admin_required'; end if;

  return jsonb_build_object(
    'brokers',coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id',r.user_id,'email',u.email,
        'office_name',ba.office_name,
        'registration_number',ba.registration_number
      ) order by coalesce(ba.office_name,u.email))
      from gongsil.user_roles r
      join auth.users u on u.id=r.user_id
      left join lateral (
        select b.office_name,b.registration_number
        from gongsil.broker_applications b
        where b.user_id=r.user_id and b.status='approved'
        order by b.reviewed_at desc nulls last,b.created_at desc
        limit 1
      ) ba on true
      where r.role='broker' and r.status='active'
    ),'[]'::jsonb),
    'matches',coalesce((
      select jsonb_agg(jsonb_build_object(
        'match_id',m.id,'inquiry_id',m.inquiry_id,'property_id',m.property_id,
        'property_title',p.title,'property_area',p.area,
        'buyer_email',u.email,'broker_user_id',m.broker_user_id,
        'broker_email',bu.email,'status',m.status,'updated_at',m.updated_at
      ) order by m.updated_at desc)
      from gongsil.match_requests m
      join gongsil.properties p on p.id=m.property_id
      left join auth.users u on u.id=m.buyer_user_id
      left join auth.users bu on bu.id=m.broker_user_id
      where m.mode='broker'
        and m.inquiry_id is not null
        and m.status in ('requested','broker_assigned','approved')
    ),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.gongsil_admin_broker_reassignment_queue() from public,anon;
grant execute on function public.gongsil_admin_broker_reassignment_queue() to authenticated;

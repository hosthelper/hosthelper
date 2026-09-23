-- 2026-09-23
-- Patent stages 6-7: paid detail disclosure and direct/designated-broker contact delivery.

create or replace function public.gongsil_get_property_detail(p_property_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_access boolean:=false;
  v_owner boolean:=false;
  v_admin boolean:=false;
  v_base jsonb;
  v_locked jsonb;
  v_premium jsonb;
  v_owner_private jsonb;
begin
  if not exists(
    select 1 from gongsil.properties
    where id=p_property_id
      and (publication_status='published' or owner_id=v_uid or gongsil_private.is_admin())
  ) then raise exception 'property_not_found'; end if;

  v_owner:=case when v_uid is null then false else gongsil_private.owns_property(p_property_id) end;
  v_admin:=case when v_uid is null then false else gongsil_private.is_admin() end;
  v_access:=v_owner or v_admin or (v_uid is not null and gongsil_private.has_property_entitlement(p_property_id));

  select jsonb_build_object(
    'id',p.id,'journey',p.journey,'title',p.title,'area',p.area,
    'accommodation_type',p.accommodation_type,'verification_summary',p.verification_summary,
    'risk_summary',p.risk_summary,'published_at',p.published_at,'images',p.public_image_paths,
    'deposit_amount',coalesce(t.deposit_amount,o.deposit_amount),
    'monthly_rent',coalesce(t.monthly_rent,o.monthly_rent),
    'asking_premium',t.transfer_fee,
    'verification_items',coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_key',vi.item_key,'label',vi.label,'status',vi.status,'source',vi.source,
        'note',vi.note,'checked_at',vi.checked_at
      ) order by vi.created_at)
      from gongsil.verification_items vi
      where vi.property_id=p.id and vi.public_visible
    ),'[]'::jsonb)
  ) into v_base
  from gongsil.properties p
  left join gongsil.property_takeover_data t on t.property_id=p.id
  left join gongsil.property_opening_data o on o.property_id=p.id
  where p.id=p_property_id;

  if v_access then
    select jsonb_build_object(
      'exact_address',pr.exact_address,
      'operating_months',t.operating_months,
      'avg_monthly_revenue',t.avg_monthly_revenue,
      'avg_daily_rate',t.avg_daily_rate,
      'monthly_fixed_cost',coalesce(t.monthly_fixed_cost,t.avg_monthly_operating_cost),
      'management_fee',t.management_fee,
      'occupancy_rate',t.occupancy_rate,
      'review_score',t.review_score,
      'reservation_forward_rate',t.reservation_forward_rate,
      'accessibility_score',t.accessibility_score,
      'tourism_proximity_score',t.tourism_proximity_score,
      'facility_investment',t.facility_investment,
      'included_assets',t.included_assets,
      'transfer_reason',t.transfer_reason
    ) into v_locked
    from gongsil.properties p
    left join gongsil.property_takeover_data t on t.property_id=p.id
    left join gongsil.property_private pr on pr.property_id=p.id
    where p.id=p_property_id;

    select jsonb_build_object(
      'model_version',a.model_version,'premium_min',a.premium_min,'premium_max',a.premium_max,
      'premium_recommended',a.premium_recommended,'confidence',a.confidence,
      'components',a.components,'assessed_at',a.assessed_at
    ) into v_premium
    from gongsil.premium_assessments a
    where a.property_id=p_property_id
    order by a.assessed_at desc limit 1;
  end if;

  if v_owner or v_admin then
    select jsonb_build_object('exact_address',pr.exact_address)
    into v_owner_private
    from gongsil.property_private pr
    where pr.property_id=p_property_id;
  end if;

  return jsonb_build_object(
    'has_access',v_access,
    'is_owner',v_owner,
    'is_admin',v_admin,
    'public',v_base,
    'detail',case when v_access then coalesce(v_locked,'{}'::jsonb) else null end,
    'premium',case when v_access then v_premium else null end,
    'owner_private',case when (v_owner or v_admin) then coalesce(v_owner_private,'{}'::jsonb) else null end
  );
end;
$function$;

create or replace function public.gongsil_request_match(
  p_property_id uuid,
  p_mode text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
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
  ) then raise exception 'property_not_published'; end if;

  if exists(
    select 1 from gongsil.match_requests m
    where m.property_id=p_property_id
      and m.buyer_user_id=v_uid
      and m.status in ('requested','approved','broker_assigned')
  ) then raise exception 'active_match_exists'; end if;

  if p_mode='broker' then
    select count(*),min(a.broker_user_id)
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
    ) then raise exception 'active_broker_role_required'; end if;
  end if;

  select i.id into v_inquiry_id
  from gongsil.inquiries i
  where i.property_id=p_property_id
    and i.buyer_user_id=v_uid
    and i.stage not in ('completed','cancelled','rejected')
  order by i.submitted_at desc limit 1;

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
      property_id,inquiry_id,broker_user_id,assigned_by,active
    )
    values(p_property_id,v_inquiry_id,v_broker,v_uid,true);
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

revoke execute on function public.gongsil_get_property_detail(uuid) from public, anon;
grant execute on function public.gongsil_get_property_detail(uuid) to authenticated;

revoke execute on function public.gongsil_request_match(uuid,text,text) from public, anon;
grant execute on function public.gongsil_request_match(uuid,text,text) to authenticated;

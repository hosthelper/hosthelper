-- 2026-10-03
-- Activate deal-room chat for actual linked sellers on broker-mandated listings.

create or replace function gongsil_private.is_inquiry_participant(p_inquiry_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1
    from gongsil.inquiries i
    join gongsil.properties p on p.id=i.property_id
    left join gongsil.property_listing_mandates lm on lm.property_id=p.id
    where i.id=p_inquiry_id
      and (
        i.buyer_user_id=(select auth.uid())
        or p.owner_id=(select auth.uid())
        or lm.seller_user_id=(select auth.uid())
        or i.broker_user_id=(select auth.uid())
        or gongsil_private.is_assigned_broker_inquiry(i.id)
        or gongsil_private.is_admin()
      )
  )
$$;

revoke all on function gongsil_private.is_inquiry_participant(uuid) from public,anon,authenticated;

create or replace function public.gongsil_get_inquiry_thread(p_inquiry_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_messages jsonb;
  v_progress jsonb;
  v_visit jsonb;
  v_deposit jsonb;
  v_dispute jsonb;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if not (gongsil_private.is_kakao_user() or gongsil_private.is_admin()) then
    raise exception 'kakao_required';
  end if;
  if not gongsil_private.is_inquiry_participant(p_inquiry_id) then
    raise exception 'forbidden';
  end if;

  select case
    when i.buyer_user_id=v_uid then 'buyer'
    when lm.seller_user_id=v_uid then 'seller'
    when p.owner_id=v_uid then 'owner'
    when i.broker_user_id=v_uid or gongsil_private.is_assigned_broker_inquiry(i.id) then 'broker'
    when gongsil_private.is_admin() then 'admin'
    else 'participant'
  end
  into v_role
  from gongsil.inquiries i
  join gongsil.properties p on p.id=i.property_id
  left join gongsil.property_listing_mandates lm on lm.property_id=p.id
  where i.id=p_inquiry_id;

  if v_role is null then raise exception 'inquiry_not_found'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id',m.id,'sender_user_id',m.sender_user_id,'body',m.body,
      'message_type',m.message_type,'metadata',coalesce(m.metadata,'{}'::jsonb),
      'created_at',m.created_at,'is_mine',(m.sender_user_id=v_uid)
    ) order by m.created_at),'[]'::jsonb)
  into v_messages
  from gongsil.inquiry_messages m
  where m.inquiry_id=p_inquiry_id;

  select to_jsonb(x) into v_progress
  from public.gongsil_my_transaction_progress_v1 x
  where x.inquiry_id=p_inquiry_id
  limit 1;

  select to_jsonb(v) into v_visit
  from (
    select id,status,start_at,end_at,timezone,location_note,buyer_confirmed_at,counterpart_confirmed_at,no_show_reported_at
    from gongsil.visits
    where inquiry_id=p_inquiry_id
    order by created_at desc
    limit 1
  ) v;

  select to_jsonb(d) into v_deposit
  from (
    select id,visit_id,amount_krw,status,provider,payment_id,paid_at,refunded_at,settled_at,created_at,updated_at
    from gongsil.visit_deposits
    where inquiry_id=p_inquiry_id
    order by created_at desc
    limit 1
  ) d;

  select to_jsonb(d) into v_dispute
  from (
    select id,visit_id,dispute_type,status,report_note,
           coalesce(response_note,buyer_response_note) as response_note,
           reported_at,disputed_at,resolved_at,resolution_note
    from gongsil.visit_disputes
    where inquiry_id=p_inquiry_id
    order by reported_at desc
    limit 1
  ) d;

  return jsonb_build_object(
    'viewer_role',v_role,
    'inquiry_id',p_inquiry_id,
    'progress',coalesce(v_progress,'{}'::jsonb),
    'visit',coalesce(v_visit,'{}'::jsonb),
    'deposit',coalesce(v_deposit,'{}'::jsonb),
    'dispute',coalesce(v_dispute,'{}'::jsonb),
    'messages',v_messages
  );
end;
$$;

revoke all on function public.gongsil_get_inquiry_thread(uuid) from public,anon;
grant execute on function public.gongsil_get_inquiry_thread(uuid) to authenticated;

revoke all on function public.gongsil_send_inquiry_message(uuid,text) from public,anon;
grant execute on function public.gongsil_send_inquiry_message(uuid,text) to authenticated;

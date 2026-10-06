-- 2026-10-03
-- Broker inbox + consultation acceptance for assigned broker inquiries.

create or replace function public.gongsil_broker_inbox()
returns table(
  inquiry_id uuid,
  property_id uuid,
  property_title text,
  property_area text,
  inquiry_stage text,
  match_id uuid,
  match_status text,
  buyer_user_id uuid,
  buyer_name text,
  buyer_email text,
  buyer_phone text,
  question text,
  broker_note text,
  submitted_at timestamptz,
  accepted_at timestamptz,
  message_count bigint,
  last_message text,
  last_message_at timestamptz
)
language sql
stable
security definer
set search_path=''
as $$
  select
    i.id,
    i.property_id,
    p.title,
    p.area,
    i.stage,
    m.id,
    m.status,
    i.buyer_user_id,
    coalesce(pr.display_name,'공실헬퍼 회원'),
    u.email::text,
    u.phone::text,
    i.question,
    i.broker_note,
    i.submitted_at,
    i.accepted_at,
    coalesce(msg.message_count,0),
    msg.last_message,
    msg.last_message_at
  from gongsil.inquiries i
  join gongsil.properties p on p.id=i.property_id
  join auth.users u on u.id=i.buyer_user_id
  left join gongsil.profiles pr on pr.id=i.buyer_user_id
  left join lateral (
    select mm.id,mm.status
    from gongsil.match_requests mm
    where mm.inquiry_id=i.id
      and mm.mode='broker'
    order by mm.created_at desc
    limit 1
  ) m on true
  left join lateral (
    select
      count(*) as message_count,
      (array_agg(im.body order by im.created_at desc))[1] as last_message,
      max(im.created_at) as last_message_at
    from gongsil.inquiry_messages im
    where im.inquiry_id=i.id
  ) msg on true
  where gongsil_private.has_role('broker')
    and i.plan='broker'
    and (
      i.broker_user_id=(select auth.uid())
      or gongsil_private.is_assigned_broker_inquiry(i.id)
    )
    and i.stage not in ('cancelled','rejected')
  order by coalesce(msg.last_message_at,i.updated_at,i.submitted_at) desc
$$;

revoke all on function public.gongsil_broker_inbox() from public,anon;
grant execute on function public.gongsil_broker_inbox() to authenticated;

create or replace function public.gongsil_broker_accept(p_inquiry_id uuid,p_note text)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_buyer uuid;
  v_property uuid;
  v_title text;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if not gongsil_private.has_role('broker') then raise exception 'broker_role_required'; end if;
  if not (gongsil_private.is_assigned_broker_inquiry(p_inquiry_id) or gongsil_private.is_admin()) then
    raise exception 'assigned_broker_required';
  end if;
  if length(trim(coalesce(p_note,'')))<1 then raise exception 'note_required'; end if;

  select i.buyer_user_id,i.property_id,p.title
    into v_buyer,v_property,v_title
  from gongsil.inquiries i
  join gongsil.properties p on p.id=i.property_id
  where i.id=p_inquiry_id
    and i.plan='broker'
  for update of i;

  if v_buyer is null then raise exception 'broker_inquiry_not_found'; end if;

  update gongsil.inquiries
     set broker_user_id=coalesce(broker_user_id,v_uid),
         broker_note=trim(p_note),
         stage=case when stage='submitted' then 'accepted' else stage end,
         accepted_at=coalesce(accepted_at,now()),
         updated_at=now()
   where id=p_inquiry_id
     and stage in ('submitted','accepted','visit_scheduled','reviewing');

  if not found then raise exception 'inquiry_not_acceptible'; end if;

  perform gongsil_private.notify_once(
    v_buyer,
    'broker-accepted:'||p_inquiry_id::text,
    'broker_consultation_accepted',
    '공인중개사가 상담을 수락했습니다.',
    coalesce(v_title,'매물')||' 문의가 연결되었습니다. 거래방에서 대화할 수 있습니다.',
    'inquiry',
    p_inquiry_id,
    2::smallint,
    jsonb_build_object('property_id',v_property,'broker_user_id',v_uid)
  );

  return true;
end;
$$;

revoke all on function public.gongsil_broker_accept(uuid,text) from public,anon;
grant execute on function public.gongsil_broker_accept(uuid,text) to authenticated;

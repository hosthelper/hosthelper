-- 2026-09-23
-- Fix notification trigger calls to gongsil_private.notify_once(... p_priority smallint ...).
-- Explicit casts prevent runtime function-resolution failures in match/payment/chat/visit flows.

create or replace function gongsil_private.trg_notify_access_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
  if new.status='paid' then
    perform gongsil_private.notify_once(
      new.user_id,'access-order:'||new.id::text||':paid','access_pass_paid',
      '열람권 결제 완료',new.valid_days||'일 열람권이 활성화되었습니다.',
      'access_order',new.id,2::smallint,
      jsonb_build_object('plan_code',new.plan_code,'valid_until',new.valid_until,'amount_krw',new.amount_krw)
    );
  elsif new.status in ('failed','cancelled') then
    perform gongsil_private.notify_once(
      new.user_id,'access-order:'||new.id::text||':'||new.status,
      'access_pass_'||new.status,'열람권 결제 상태',
      '열람권 결제가 '||case when new.status='failed' then '실패' else '취소' end||' 처리되었습니다.',
      'access_order',new.id,2::smallint,
      jsonb_build_object('plan_code',new.plan_code,'amount_krw',new.amount_krw)
    );
  end if;
  return new;
end;
$function$;

create or replace function gongsil_private.trg_notify_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare v_owner uuid; v_title text;
begin
  select owner_id,title into v_owner,v_title
  from gongsil.properties where id=new.property_id;

  if tg_op='INSERT' then
    perform gongsil_private.notify_once(
      v_owner,'match-owner:'||new.id::text,'match_requested','새 매칭 요청',
      coalesce(v_title,'매물')||'에 '||
        case when new.mode='broker' then '공인중개사 거래' else '직거래' end||
        ' 매칭요청이 들어왔습니다.',
      'match',new.id,2::smallint,
      jsonb_build_object('property_id',new.property_id,'mode',new.mode)
    );
    if new.broker_user_id is not null then
      perform gongsil_private.notify_once(
        new.broker_user_id,
        'match-broker:'||new.id::text||':'||new.broker_user_id::text,
        'broker_assigned','새 중개 매칭 배정',
        coalesce(v_title,'매물')||' 상담이 배정되었습니다.',
        'match',new.id,2::smallint,
        jsonb_build_object('property_id',new.property_id)
      );
    end if;
  elsif new.broker_user_id is distinct from old.broker_user_id
        and new.broker_user_id is not null then
    perform gongsil_private.notify_once(
      new.broker_user_id,
      'match-broker-reassign:'||new.id::text||':'||new.broker_user_id::text,
      'broker_assigned','중개 매칭 재배정',
      coalesce(v_title,'매물')||' 상담이 새로 배정되었습니다.',
      'match',new.id,2::smallint,
      jsonb_build_object('property_id',new.property_id)
    );
  end if;
  return new;
end;
$function$;

create or replace function gongsil_private.trg_notify_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare r record; v_uid uuid;
begin
  select i.buyer_user_id,p.owner_id,i.broker_user_id,p.title into r
  from gongsil.inquiries i
  join gongsil.properties p on p.id=i.property_id
  where i.id=new.inquiry_id;

  foreach v_uid in array array[r.buyer_user_id,r.owner_id,r.broker_user_id] loop
    if v_uid is not null and v_uid<>new.sender_user_id then
      perform gongsil_private.notify_once(
        v_uid,'message:'||new.id::text||':'||v_uid::text,
        'chat_message','새 채팅 메시지',
        coalesce(r.title,'매물')||' 매칭 채팅에 새 메시지가 도착했습니다.',
        'inquiry',new.inquiry_id,1::smallint,
        jsonb_build_object('message_id',new.id,'message_type',new.message_type)
      );
    end if;
  end loop;
  return new;
end;
$function$;

create or replace function gongsil_private.trg_notify_visit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare r record; v_uid uuid; v_event text; v_body text;
begin
  if tg_op='UPDATE'
     and new.status is not distinct from old.status
     and new.start_at is not distinct from old.start_at then
    return new;
  end if;

  select i.buyer_user_id,p.owner_id,i.broker_user_id,p.title into r
  from gongsil.inquiries i
  join gongsil.properties p on p.id=i.property_id
  where i.id=new.inquiry_id;

  v_event := case
    when tg_op='INSERT' then 'scheduled'
    when new.status is distinct from old.status then new.status
    else 'rescheduled'
  end;

  v_body := case
    when v_event in ('scheduled','rescheduled','confirmed') then '임장 일정이 확정/변경되었습니다.'
    when v_event='completed' then '임장 방문 확인이 완료되었습니다.'
    when v_event='no_show' then '임장이 노쇼 상태로 처리되었습니다.'
    when v_event='cancelled' then '임장 일정이 취소되었습니다.'
    else '임장 상태가 변경되었습니다.'
  end;

  foreach v_uid in array array[r.buyer_user_id,r.owner_id,r.broker_user_id] loop
    if v_uid is not null then
      perform gongsil_private.notify_once(
        v_uid,
        'visit:'||new.id::text||':'||v_event||':'||
          coalesce(extract(epoch from new.start_at)::bigint::text,'0')||':'||v_uid::text,
        'visit_'||v_event,'임장 일정 알림',
        coalesce(r.title,'매물')||' · '||v_body,
        'visit',new.id,
        (case when v_event='no_show' then 4 else 2 end)::smallint,
        jsonb_build_object('start_at',new.start_at,'status',new.status)
      );
    end if;
  end loop;
  return new;
end;
$function$;

create or replace function gongsil_private.trg_notify_visit_dispute()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare r record; v_uid uuid; v_pri smallint:=4; v_title text;
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;

  select i.buyer_user_id,p.owner_id,i.broker_user_id,p.title into r
  from gongsil.inquiries i
  join gongsil.properties p on p.id=i.property_id
  where i.id=new.inquiry_id;

  v_title := case
    when new.status in ('reported','disputed') then '임장 분쟁 접수'
    else '임장 분쟁 처리 결과'
  end;

  foreach v_uid in array array[r.buyer_user_id,r.owner_id,r.broker_user_id] loop
    if v_uid is not null then
      perform gongsil_private.notify_once(
        v_uid,
        'visit-dispute:'||new.id::text||':'||new.status||':'||v_uid::text,
        'visit_dispute_'||new.status,v_title,
        coalesce(r.title,'매물')||' 임장 분쟁 상태가 '||new.status||'로 변경되었습니다.',
        'visit_dispute',new.id,v_pri,
        jsonb_build_object('visit_id',new.visit_id,'dispute_type',new.dispute_type,'status',new.status)
      );
    end if;
  end loop;

  if new.status in ('reported','disputed') then
    for v_uid in
      select user_id from gongsil.user_roles where role='admin' and status='active'
    loop
      perform gongsil_private.notify_once(
        v_uid,
        'visit-dispute-admin:'||new.id::text||':'||new.status||':'||v_uid::text,
        'admin_visit_dispute','임장 분쟁 검토 필요',
        coalesce(r.title,'매물')||' 임장 분쟁이 접수되었습니다.',
        'visit_dispute',new.id,5::smallint,
        jsonb_build_object('visit_id',new.visit_id,'dispute_type',new.dispute_type)
      );
    end loop;
  end if;
  return new;
end;
$function$;

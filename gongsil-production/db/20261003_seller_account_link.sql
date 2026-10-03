-- 2026-10-03
-- Link the actual seller account to a broker-mandated listing using a one-time code.

alter table gongsil.property_listing_mandates
  add column if not exists seller_user_id uuid references auth.users(id) on delete set null,
  add column if not exists seller_link_code_hash text,
  add column if not exists seller_link_expires_at timestamptz,
  add column if not exists seller_linked_at timestamptz;

create index if not exists property_listing_mandates_seller_user_idx
  on gongsil.property_listing_mandates(seller_user_id)
  where seller_user_id is not null;

create or replace function public.gongsil_issue_seller_link_code(p_property_id uuid)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_code text;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if not exists(
    select 1 from gongsil.property_listing_mandates m
    where m.property_id=p_property_id
      and (m.broker_user_id=v_uid or gongsil_private.is_admin())
  ) then raise exception 'mandate_not_found_or_forbidden'; end if;

  v_code:=upper(encode(extensions.gen_random_bytes(6),'hex'));

  update gongsil.property_listing_mandates
  set seller_link_code_hash=encode(extensions.digest(v_code,'sha256'),'hex'),
      seller_link_expires_at=now()+interval '7 days',
      seller_linked_at=null,
      updated_at=now()
  where property_id=p_property_id;

  return v_code;
end;
$$;

revoke all on function public.gongsil_issue_seller_link_code(uuid) from public,anon;
grant execute on function public.gongsil_issue_seller_link_code(uuid) to authenticated;

create or replace function public.gongsil_claim_seller_link_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_property_id uuid;
  v_code text := upper(regexp_replace(coalesce(p_code,''),'[^0-9A-F]','','g'));
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  perform gongsil_private.enforce_rate_limit('seller_mandate_claim',10,interval '1 hour');
  if length(v_code)<>12 then raise exception 'invalid_seller_link_code'; end if;

  select m.property_id into v_property_id
  from gongsil.property_listing_mandates m
  where m.seller_link_code_hash=encode(extensions.digest(v_code,'sha256'),'hex')
    and m.seller_link_expires_at>now()
    and m.seller_user_id is null
  for update;

  if v_property_id is null then raise exception 'seller_link_code_invalid_or_expired'; end if;

  update gongsil.property_listing_mandates
  set seller_user_id=v_uid,
      seller_linked_at=now(),
      seller_link_code_hash=null,
      seller_link_expires_at=null,
      updated_at=now()
  where property_id=v_property_id;

  perform gongsil_private.notify_once(
    v_uid,
    'seller-mandate-linked:'||v_property_id::text,
    'seller_mandate_linked',
    '양도 매물이 연결되었습니다.',
    '공인중개사가 등록한 의뢰매물이 내 공실헬퍼 계정에 연결되었습니다.',
    'property',
    v_property_id,
    2::smallint,
    jsonb_build_object('property_id',v_property_id)
  );

  return v_property_id;
end;
$$;

revoke all on function public.gongsil_claim_seller_link_code(text) from public,anon;
grant execute on function public.gongsil_claim_seller_link_code(text) to authenticated;

create or replace function public.gongsil_my_linked_seller_properties()
returns table(
  property_id uuid,
  title text,
  area text,
  accommodation_type text,
  publication_status text,
  verification_public_status text,
  broker_user_id uuid,
  broker_office_name text,
  broker_registration_number text,
  seller_name text,
  seller_phone text,
  seller_linked_at timestamptz
)
language sql
security definer
set search_path=''
as $$
  select
    p.id,p.title,p.area,p.accommodation_type,p.publication_status,p.verification_public_status,
    m.broker_user_id,b.office_name,b.registration_number,m.seller_name,m.seller_phone,m.seller_linked_at
  from gongsil.property_listing_mandates m
  join gongsil.properties p on p.id=m.property_id
  left join gongsil.broker_applications b on b.id=m.broker_application_id
  where m.seller_user_id=(select auth.uid())
  order by p.created_at desc
$$;

revoke all on function public.gongsil_my_linked_seller_properties() from public,anon;
grant execute on function public.gongsil_my_linked_seller_properties() to authenticated;

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
    m.id,m.property_id,p.title,p.area,m.status,m.buyer_user_id,
    coalesce(pr.display_name,'공실헬퍼 회원'),
    u.email::text,u.phone::text,m.note,m.created_at
  from gongsil.match_requests m
  join gongsil.properties p on p.id=m.property_id
  join auth.users u on u.id=m.buyer_user_id
  left join gongsil.profiles pr on pr.id=m.buyer_user_id
  left join gongsil.property_listing_mandates lm on lm.property_id=p.id
  where (
      p.owner_id=(select auth.uid())
      or lm.seller_user_id=(select auth.uid())
    )
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
  v_linked_seller uuid;
  v_title text;
  v_buyer_name text;
begin
  if new.mode<>'direct' or new.status not in ('approved','completed') then return new; end if;

  select p.owner_id,p.title,lm.seller_user_id
    into v_owner,v_title,v_linked_seller
  from gongsil.properties p
  left join gongsil.property_listing_mandates lm on lm.property_id=p.id
  where p.id=new.property_id;

  select coalesce(pr.display_name,'공실헬퍼 회원') into v_buyer_name
  from gongsil.profiles pr
  where pr.id=new.buyer_user_id;

  if v_owner is not null then
    perform gongsil_private.notify_once(
      v_owner,'direct-match-owner:'||new.id::text,'direct_buyer_contact_ready',
      '새 직거래 요청이 들어왔습니다.',
      coalesce(v_title,'등록 매물')||' · '||coalesce(v_buyer_name,'공실헬퍼 회원')||'님의 연락처를 확인할 수 있습니다.',
      'match',new.id,2::smallint,
      jsonb_build_object('property_id',new.property_id,'buyer_user_id',new.buyer_user_id,'mode','direct')
    );
  end if;

  if v_linked_seller is not null and v_linked_seller is distinct from v_owner then
    perform gongsil_private.notify_once(
      v_linked_seller,'direct-match-linked-seller:'||new.id::text,'direct_buyer_contact_ready',
      '내 양도 매물에 직거래 요청이 들어왔습니다.',
      coalesce(v_title,'양도 매물')||' · '||coalesce(v_buyer_name,'공실헬퍼 회원')||'님의 연락처를 내 공실헬퍼에서 확인할 수 있습니다.',
      'match',new.id,2::smallint,
      jsonb_build_object('property_id',new.property_id,'buyer_user_id',new.buyer_user_id,'mode','direct')
    );
  end if;

  return new;
end;
$$;

revoke all on function gongsil_private.notify_seller_direct_match() from public,anon,authenticated;

-- 2026-10-03
-- Direct-deal routing for broker-mandated listings.

create or replace function public.gongsil_get_match_contact(p_property_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  r record;
  v_mandate record;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;

  if not exists(
    select 1
    from gongsil.access_entitlements e
    where e.user_id=v_uid
      and e.property_id=p_property_id
      and e.entitlement_type='contact_access'
      and e.status='active'
      and e.valid_from<=now()
      and (e.valid_until is null or e.valid_until>now())
  ) then raise exception 'contact_access_required'; end if;

  select * into r
  from gongsil.match_requests
  where property_id=p_property_id
    and buyer_user_id=v_uid
    and status in ('approved','broker_assigned','completed')
  order by approved_at desc nulls last,created_at desc
  limit 1;

  if not found then raise exception 'approved_match_required'; end if;

  if r.mode='direct' then
    select m.*,u.email::text as linked_email,u.phone::text as linked_phone
      into v_mandate
    from gongsil.property_listing_mandates m
    left join auth.users u on u.id=m.seller_user_id
    where m.property_id=p_property_id;

    if found then
      if v_mandate.seller_user_id is null then
        raise exception 'seller_account_link_required';
      end if;

      return jsonb_build_object(
        'mode','direct',
        'contact_name',v_mandate.seller_name,
        'contact_phone',coalesce(nullif(v_mandate.seller_phone,''),nullif(v_mandate.linked_phone,'')),
        'contact_email',v_mandate.linked_email,
        'seller_linked',true,
        'label','실제 양도인 연락처'
      );
    end if;

    return (
      select jsonb_build_object(
        'mode','direct',
        'contact_name',pr.contact_name,
        'contact_phone',pr.host_phone,
        'contact_email',null,
        'seller_linked',false,
        'label','매도인/호스트 연락처'
      )
      from gongsil.property_private pr
      where pr.property_id=p_property_id
    );
  end if;

  return (
    select jsonb_build_object(
      'mode','broker',
      'contact_name',coalesce(p.display_name,b.office_name),
      'contact_phone',b.contact_phone,
      'office_name',b.office_name,
      'registration_number',b.registration_number,
      'service_area',b.service_area,
      'label','공인중개사 연락처'
    )
    from gongsil.broker_applications b
    left join gongsil.profiles p on p.id=b.user_id
    where b.user_id=r.broker_user_id
      and b.status='approved'
    order by b.updated_at desc
    limit 1
  );
end;
$$;

revoke all on function public.gongsil_get_match_contact(uuid) from public,anon;
grant execute on function public.gongsil_get_match_contact(uuid) to authenticated;

-- Guard direct requests on mandated listings until the actual seller has linked an account.
do $$
declare
  v_ddl text;
begin
  select pg_get_functiondef(p.oid)
    into v_ddl
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='gongsil_request_match'
    and pg_get_function_identity_arguments(p.oid)='p_property_id uuid, p_mode text, p_note text';

  if position('seller_account_link_required' in v_ddl)=0 then
    v_ddl:=replace(
      v_ddl,
      $old$  if p_mode='broker' then
$old$,
      $new$  if p_mode='direct' and exists(
    select 1 from gongsil.property_listing_mandates lm
    where lm.property_id=p_property_id
      and lm.seller_user_id is null
  ) then
    raise exception 'seller_account_link_required';
  end if;

  if p_mode='broker' then
$new$
    );
    execute v_ddl;
  end if;
end $$;

revoke all on function public.gongsil_request_match(uuid,text,text) from public,anon;
grant execute on function public.gongsil_request_match(uuid,text,text) to authenticated;

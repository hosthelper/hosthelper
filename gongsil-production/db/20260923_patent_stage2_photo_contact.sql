-- 2026-09-23
-- Patent stage 2: required seller contact and 3-10 public-photo server invariants.

create or replace function public.gongsil_submit_property(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
 v_uid uuid:=(select auth.uid());
 v_id uuid;
 v_journey text:=p_payload->>'journey';
 v_private_notes text;
 v_type text:=trim(coalesce(p_payload->>'accommodation_type',''));
 v_track text;
 v_contact_name text:=trim(coalesce(p_payload->>'contact_name',''));
 v_contact_phone text:=trim(coalesce(p_payload->>'contact_phone',''));
begin
 if v_uid is null then raise exception 'authentication_required'; end if;
 if not gongsil_private.is_kakao_user() then raise exception 'kakao_login_required'; end if;

 insert into gongsil.user_roles(user_id,role,status,granted_by)
 values(v_uid,'user','active',null)
 on conflict(user_id,role) do nothing;

 insert into gongsil.user_roles(user_id,role,status,granted_by)
 values(v_uid,'host','active',null)
 on conflict(user_id,role) do nothing;

 if not gongsil_private.has_role('user') or not gongsil_private.has_role('host') then
   raise exception 'seller_role_inactive';
 end if;

 if v_journey not in ('opening','takeover') then raise exception 'invalid_journey'; end if;

 if v_type not in (
   '외도민','외국인관광 도시민박업','외국인관광도시민박업',
   '단기임대','게스트하우스','쉐어하우스'
 ) then raise exception 'invalid_accommodation_type'; end if;

 if length(trim(coalesce(p_payload->>'title','')))<2
    or length(trim(coalesce(p_payload->>'area','')))<2
    or length(trim(coalesce(p_payload->>'exact_address','')))<4 then
   raise exception 'required_property_fields_missing';
 end if;

 if length(v_contact_name)<2 then raise exception 'contact_name_required'; end if;
 if length(regexp_replace(v_contact_phone,'[^0-9]','','g'))<9 then
   raise exception 'contact_phone_required';
 end if;

 v_track:=gongsil_private.verification_track_for_type(v_type);

 insert into gongsil.properties(
   owner_id,journey,title,area,accommodation_type,verification_track,
   publication_status,available_from
 )
 values(
   v_uid,v_journey,trim(p_payload->>'title'),trim(p_payload->>'area'),
   v_type,v_track,'draft',nullif(p_payload->>'available_from','')::date
 )
 returning id into v_id;

 v_private_notes:=concat_ws(
   ' · ',
   nullif(case when coalesce(p_payload->>'local_partners','')<>''
     then '지역 파트너 '||(p_payload->>'local_partners') end,''),
   nullif(case when coalesce(p_payload->>'reuse_rate','')<>''
     then '자산 재사용 '||(p_payload->>'reuse_rate') end,'')
 );

 insert into gongsil.property_private(
   property_id,exact_address,host_phone,contact_name,claimed_business_name,private_notes
 )
 values(
   v_id,trim(p_payload->>'exact_address'),v_contact_phone,v_contact_name,
   nullif(trim(coalesce(p_payload->>'business_name','')),''),
   nullif(v_private_notes,'')
 );

 if v_journey='opening' then
  insert into gongsil.property_opening_data(
    property_id,vacancy_months,expected_rooms,landlord_status,
    deposit_amount,monthly_rent,setup_cost_min
  )
  values(
    v_id,
    nullif(p_payload->>'vacancy_months','')::integer,
    nullif(p_payload->>'expected_rooms','')::integer,
    nullif(p_payload->>'landlord_status',''),
    nullif(p_payload->>'deposit_amount','')::numeric,
    nullif(p_payload->>'monthly_rent','')::numeric,
    nullif(p_payload->>'setup_cost_min','')::numeric
  );
 else
  insert into gongsil.property_takeover_data(
    property_id,operating_months,deposit_amount,monthly_rent,avg_monthly_revenue,
    avg_daily_rate,avg_monthly_operating_cost,monthly_fixed_cost,management_fee,
    occupancy_rate,transfer_fee,transfer_reason,included_assets,takeover_available_at,
    asset_reuse_pct,facility_investment,review_score,reservation_forward_rate,
    accessibility_score,tourism_proximity_score
  )
  values(
    v_id,
    nullif(p_payload->>'operating_months','')::integer,
    nullif(p_payload->>'deposit_amount','')::numeric,
    nullif(p_payload->>'monthly_rent','')::numeric,
    nullif(p_payload->>'avg_monthly_revenue','')::numeric,
    nullif(p_payload->>'avg_daily_rate','')::numeric,
    nullif(p_payload->>'avg_monthly_operating_cost','')::numeric,
    nullif(p_payload->>'monthly_fixed_cost','')::numeric,
    nullif(p_payload->>'management_fee','')::numeric,
    nullif(p_payload->>'occupancy_rate','')::numeric,
    nullif(p_payload->>'transfer_fee','')::numeric,
    nullif(trim(coalesce(p_payload->>'transfer_reason','')),''),
    coalesce(
      array(select jsonb_array_elements_text(coalesce(p_payload->'included_assets','[]'::jsonb))),
      '{}'::text[]
    ),
    nullif(p_payload->>'takeover_available_at','')::date,
    nullif(regexp_replace(coalesce(p_payload->>'reuse_rate',''),'[^0-9.]','','g'),'')::numeric,
    nullif(p_payload->>'facility_investment','')::numeric,
    nullif(p_payload->>'review_score','')::numeric,
    nullif(p_payload->>'reservation_forward_rate','')::numeric,
    nullif(p_payload->>'accessibility_score','')::numeric,
    nullif(p_payload->>'tourism_proximity_score','')::numeric
  );
 end if;

 return v_id;
end;
$function$;

create or replace function gongsil_private.public_photo_count(p_property_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $function$
  select count(*)::integer
  from gongsil.property_documents d
  where d.property_id=p_property_id
    and d.document_type='public_image_candidate'
    and d.storage_bucket='gongsil-property-images';
$function$;

create or replace function gongsil_private.enforce_patent_photo_count_on_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare v_count integer;
begin
  if new.run_type in ('ocr','government_db') then
    v_count := gongsil_private.public_photo_count(new.property_id);
    if v_count < 3 or v_count > 10 then
      raise exception 'property_photo_count_must_be_3_to_10:%',v_count;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists gongsil_patent_photo_count_verification_trg
on gongsil.verification_runs;
create trigger gongsil_patent_photo_count_verification_trg
before insert on gongsil.verification_runs
for each row
execute function gongsil_private.enforce_patent_photo_count_on_verification();

create or replace function gongsil_private.enforce_patent_photo_count_on_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare v_count integer;
begin
  if new.publication_status in ('submitted','published')
     and new.publication_status is distinct from old.publication_status then
    v_count := gongsil_private.public_photo_count(new.id);
    if v_count < 3 or v_count > 10 then
      raise exception 'property_photo_count_must_be_3_to_10:%',v_count;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists gongsil_patent_photo_count_publication_trg
on gongsil.properties;
create trigger gongsil_patent_photo_count_publication_trg
before update of publication_status on gongsil.properties
for each row
execute function gongsil_private.enforce_patent_photo_count_on_publication();

create or replace function public.gongsil_add_property_document(
  p_property_id uuid,
  p_document_type text,
  p_storage_bucket text,
  p_storage_path text,
  p_visibility text default 'owner_admin'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_doc_type text := coalesce(nullif(trim(p_document_type),''),'attachment');
  v_photo_count integer;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if not gongsil_private.owns_property(p_property_id) then
    raise exception 'property_not_owned';
  end if;
  if p_storage_bucket not in ('gongsil-property-images','gongsil-verification-docs') then
    raise exception 'invalid_bucket';
  end if;
  if split_part(p_storage_path,'/',1) <> v_uid::text then
    raise exception 'invalid_storage_path';
  end if;

  if v_doc_type='public_image_candidate' then
    if p_storage_bucket<>'gongsil-property-images' then
      raise exception 'public_image_bucket_required';
    end if;
    v_photo_count := gongsil_private.public_photo_count(p_property_id);
    if v_photo_count >= 10 then raise exception 'property_photo_limit_10'; end if;
  end if;

  insert into gongsil.property_documents(
    property_id,owner_id,document_type,storage_bucket,storage_path,visibility
  )
  values(
    p_property_id,v_uid,v_doc_type,p_storage_bucket,p_storage_path,
    coalesce(nullif(p_visibility,''),'owner_admin')
  )
  returning id into v_id;

  return v_id;
end;
$function$;

revoke execute on function public.gongsil_submit_property(jsonb) from public, anon;
grant execute on function public.gongsil_submit_property(jsonb) to authenticated;

revoke execute on function public.gongsil_add_property_document(uuid,text,text,text,text)
from public, anon;
grant execute on function public.gongsil_add_property_document(uuid,text,text,text,text)
to authenticated;

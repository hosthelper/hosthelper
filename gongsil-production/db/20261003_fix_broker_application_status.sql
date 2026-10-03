-- 2026-10-03
-- Fix broker application status to match broker_applications_status_check.

create or replace function public.gongsil_submit_broker_application_v2(
  p_office_name text,
  p_registration_number text,
  p_service_area text,
  p_specialty text,
  p_contact_phone text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;
  if not gongsil_private.is_kakao_user() then raise exception 'kakao_login_required'; end if;
  if not gongsil_private.has_role('user') then raise exception 'user_role_required'; end if;
  if length(trim(coalesce(p_office_name,'')))<2
     or length(trim(coalesce(p_registration_number,'')))<3 then
    raise exception 'broker_fields_required';
  end if;

  insert into gongsil.broker_applications(
    user_id,office_name,registration_number,service_area,specialty,contact_phone,status
  )
  values(
    v_uid,
    trim(p_office_name),
    trim(p_registration_number),
    nullif(trim(coalesce(p_service_area,'')),''),
    nullif(trim(coalesce(p_specialty,'')),''),
    nullif(trim(coalesce(p_contact_phone,'')),''),
    'pending'
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.gongsil_submit_broker_application_v2(text,text,text,text,text) from public,anon;
grant execute on function public.gongsil_submit_broker_application_v2(text,text,text,text,text) to authenticated;

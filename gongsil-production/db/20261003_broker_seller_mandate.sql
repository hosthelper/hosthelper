-- 2026-10-03
-- Approved broker may register a property on behalf of the actual seller.
-- Seller mandate data stays private to the registering broker and admins.

create table if not exists gongsil.property_listing_mandates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null unique references gongsil.properties(id) on delete cascade,
  broker_user_id uuid not null references auth.users(id) on delete cascade,
  broker_application_id uuid not null references gongsil.broker_applications(id),
  seller_name text not null,
  seller_phone text not null,
  mandate_confirmed boolean not null default false,
  mandate_note text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_listing_mandates_seller_name_check check (length(trim(seller_name)) >= 2),
  constraint property_listing_mandates_seller_phone_check check (length(regexp_replace(seller_phone,'[^0-9]','','g')) >= 9),
  constraint property_listing_mandates_confirmed_check check (mandate_confirmed = true)
);

alter table gongsil.property_listing_mandates enable row level security;

drop policy if exists property_listing_mandates_owner_read on gongsil.property_listing_mandates;
create policy property_listing_mandates_owner_read
on gongsil.property_listing_mandates
for select to authenticated
using (broker_user_id=(select auth.uid()) or gongsil_private.is_admin());

revoke all on gongsil.property_listing_mandates from anon;
grant select on gongsil.property_listing_mandates to authenticated;

create index if not exists property_listing_mandates_broker_idx
  on gongsil.property_listing_mandates(broker_user_id,created_at desc);

create or replace function public.gongsil_submit_broker_mandated_property(
  p_payload jsonb,
  p_seller_name text,
  p_seller_phone text,
  p_mandate_confirmed boolean,
  p_mandate_note text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_property_id uuid;
  v_broker_application_id uuid;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;

  if not exists(
    select 1 from gongsil.user_roles r
    where r.user_id=v_uid and r.role='broker' and r.status='active'
  ) then raise exception 'approved_broker_required'; end if;

  select b.id into v_broker_application_id
  from gongsil.broker_applications b
  where b.user_id=v_uid and b.status='approved'
  order by b.updated_at desc limit 1;

  if v_broker_application_id is null then raise exception 'approved_broker_application_required'; end if;
  if p_mandate_confirmed is not true then raise exception 'seller_mandate_confirmation_required'; end if;
  if length(trim(coalesce(p_seller_name,'')))<2 then raise exception 'seller_name_required'; end if;
  if length(regexp_replace(coalesce(p_seller_phone,''),'[^0-9]','','g'))<9 then raise exception 'seller_phone_required'; end if;

  v_property_id:=public.gongsil_submit_property(p_payload);

  insert into gongsil.property_listing_mandates(
    property_id,broker_user_id,broker_application_id,seller_name,seller_phone,
    mandate_confirmed,mandate_note,confirmed_at
  )
  values(
    v_property_id,v_uid,v_broker_application_id,trim(p_seller_name),trim(p_seller_phone),
    true,nullif(trim(coalesce(p_mandate_note,'')),''),now()
  );

  return v_property_id;
end;
$$;

revoke all on function public.gongsil_submit_broker_mandated_property(jsonb,text,text,boolean,text) from public,anon;
grant execute on function public.gongsil_submit_broker_mandated_property(jsonb,text,text,boolean,text) to authenticated;

-- Expose mandate metadata only through owner/admin views; views stay security-invoker.
create or replace view public.gongsil_admin_properties_v1
with (security_invoker=true)
as
select
  p.id,p.owner_id,p.journey,p.title,p.area,p.accommodation_type,p.publication_status,
  p.verification_summary,p.risk_summary,p.public_image_paths,p.published_at,p.created_at,p.updated_at,
  (m.id is not null) as is_broker_mandated,
  m.seller_name as mandated_seller_name,
  m.seller_phone as mandated_seller_phone,
  m.mandate_note,
  b.office_name as broker_office_name,
  b.registration_number as broker_registration_number
from gongsil.properties p
left join gongsil.property_listing_mandates m on m.property_id=p.id
left join gongsil.broker_applications b on b.id=m.broker_application_id;

grant select on public.gongsil_admin_properties_v1 to authenticated;


create or replace view public.gongsil_my_properties_v1
with (security_invoker=true)
as
select
  p.id,p.owner_id,p.journey,p.title,p.area,p.accommodation_type,p.publication_status,p.available_from,
  p.verification_summary,p.risk_summary,p.social_impact_score,p.published_at,p.created_at,p.updated_at,
  priv.exact_address,priv.private_notes,
  o.vacancy_months,o.expected_rooms,o.landlord_status,
  o.deposit_amount as opening_deposit_amount,o.monthly_rent as opening_monthly_rent,o.setup_cost_min,
  t.operating_months,t.deposit_amount as takeover_deposit_amount,t.monthly_rent as takeover_monthly_rent,
  t.avg_monthly_revenue,t.occupancy_rate,t.transfer_fee,t.transfer_reason,t.included_assets,
  t.takeover_available_at,t.asset_reuse_pct,
  (
    select rh.note
    from gongsil.property_review_history rh
    where rh.property_id=p.id
    order by rh.created_at desc
    limit 1
  ) as latest_review_note,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',d.id,'document_type',d.document_type,'storage_bucket',d.storage_bucket,
      'storage_path',d.storage_path,'created_at',d.created_at
    ) order by d.created_at)
    from gongsil.property_documents d
    where d.property_id=p.id
  ),'[]'::jsonb) as documents,
  p.public_image_paths,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',vi.id,'item_key',vi.item_key,'label',vi.label,'status',vi.status,'source',vi.source,
      'checked_at',vi.checked_at,'public_visible',vi.public_visible,'note',vi.note
    ) order by vi.created_at,vi.item_key)
    from gongsil.verification_items vi
    where vi.property_id=p.id
  ),'[]'::jsonb) as verification_items,
  (m.id is not null) as is_broker_mandated,
  m.seller_name as mandated_seller_name,
  m.seller_phone as mandated_seller_phone,
  m.mandate_note,
  b.office_name as broker_office_name,
  b.registration_number as broker_registration_number
from gongsil.properties p
left join gongsil.property_private priv on priv.property_id=p.id
left join gongsil.property_opening_data o on o.property_id=p.id
left join gongsil.property_takeover_data t on t.property_id=p.id
left join gongsil.property_listing_mandates m on m.property_id=p.id
left join gongsil.broker_applications b on b.id=m.broker_application_id;

grant select on public.gongsil_my_properties_v1 to authenticated;

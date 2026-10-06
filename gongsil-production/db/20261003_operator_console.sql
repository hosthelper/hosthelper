-- 2026-10-03
-- Operator console for seller mandates, property submissions, broker applications.

alter table gongsil.property_listing_mandates
  add column if not exists admin_status text not null default 'pending',
  add column if not exists admin_note text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='property_listing_mandates_admin_status_check'
      and conrelid='gongsil.property_listing_mandates'::regclass
  ) then
    alter table gongsil.property_listing_mandates
      add constraint property_listing_mandates_admin_status_check
      check (admin_status in ('pending','approved','needs_revision','rejected'));
  end if;
end $$;

create or replace function public.gongsil_admin_review_seller_mandate(
  p_mandate_id uuid,
  p_status text,
  p_note text default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
begin
  if not gongsil_private.is_admin() then raise exception 'admin_required'; end if;
  if p_status not in ('approved','needs_revision','rejected') then
    raise exception 'invalid_seller_review_status';
  end if;
  if p_status in ('needs_revision','rejected') and length(trim(coalesce(p_note,'')))<1 then
    raise exception 'review_note_required';
  end if;

  update gongsil.property_listing_mandates
  set admin_status=p_status,
      admin_note=nullif(trim(coalesce(p_note,'')),''),
      reviewed_by=(select auth.uid()),
      reviewed_at=now(),
      updated_at=now()
  where id=p_mandate_id;

  if not found then raise exception 'seller_mandate_not_found'; end if;
  return true;
end;
$$;

revoke all on function public.gongsil_admin_review_seller_mandate(uuid,text,text) from public,anon;
grant execute on function public.gongsil_admin_review_seller_mandate(uuid,text,text) to authenticated;

create or replace function public.gongsil_admin_console()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_result jsonb;
begin
  if not gongsil_private.is_admin() then raise exception 'admin_required'; end if;

  select jsonb_build_object(
    'summary',jsonb_build_object(
      'seller_pending',(select count(*) from gongsil.property_listing_mandates where admin_status='pending'),
      'property_pending',(select count(*) from gongsil.properties where publication_status='submitted'),
      'broker_pending',(select count(*) from gongsil.broker_applications where status='pending'),
      'published_properties',(select count(*) from gongsil.properties where publication_status='published'),
      'active_inquiries',(select count(*) from gongsil.inquiries where stage not in ('cancelled','rejected','completed')),
      'pending_payments',(select count(*) from gongsil.access_pass_orders where status='pending_payment')
    ),
    'seller_applications',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',m.id,'property_id',m.property_id,'seller_name',m.seller_name,'seller_phone',m.seller_phone,
        'admin_status',m.admin_status,'admin_note',m.admin_note,'seller_linked',m.seller_user_id is not null,
        'created_at',m.created_at,'property_title',p.title,'property_area',p.area,
        'broker_office',b.office_name,'broker_registration_number',b.registration_number
      ) order by m.created_at desc)
      from gongsil.property_listing_mandates m
      join gongsil.properties p on p.id=m.property_id
      left join gongsil.broker_applications b on b.id=m.broker_application_id
      where m.admin_status in ('pending','needs_revision')
    ),'[]'::jsonb),
    'property_applications',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',p.id,'title',p.title,'area',p.area,'journey',p.journey,
        'publication_status',p.publication_status,'verification_public_status',p.verification_public_status,
        'verification_summary',p.verification_summary,'risk_summary',p.risk_summary,
        'public_image_paths',p.public_image_paths,'created_at',p.created_at,'owner_email',u.email
      ) order by p.created_at desc)
      from gongsil.properties p
      left join auth.users u on u.id=p.owner_id
      where p.publication_status in ('submitted','needs_revision')
    ),'[]'::jsonb),
    'broker_applications',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',b.id,'user_id',b.user_id,'office_name',b.office_name,'registration_number',b.registration_number,
        'service_area',b.service_area,'specialty',b.specialty,'contact_phone',b.contact_phone,
        'status',b.status,'review_note',b.review_note,'created_at',b.created_at,'email',u.email,
        'document_count',(select count(*) from gongsil.broker_documents d where d.application_id=b.id)
      ) order by b.created_at desc)
      from gongsil.broker_applications b
      left join auth.users u on u.id=b.user_id
      where b.status in ('pending','needs_revision')
    ),'[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.gongsil_admin_console() from public,anon;
grant execute on function public.gongsil_admin_console() to authenticated;

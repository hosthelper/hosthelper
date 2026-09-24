-- 2026-09-24
-- Patent stages 3-5: immutable verification evidence, freshness gate, and publication gate.

create or replace function gongsil_private.patent_verification_gate(p_property_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_track text;
  v_latest_doc uuid;
  v_docs_ok boolean:=false;
  v_items_ok boolean:=false;
  v_gov_ok boolean:=false;
  v_ocr_ok boolean:=false;
  v_photos integer:=0;
  v_photos_ok boolean:=false;
  v_ready boolean:=false;
  v_reasons text[]:='{}'::text[];
begin
  select verification_track into v_track
  from gongsil.properties
  where id=p_property_id;

  if v_track is null then
    return jsonb_build_object('ready',false,'reason','property_not_found');
  end if;

  v_photos:=gongsil_private.public_photo_count(p_property_id);
  v_photos_ok:=v_photos between 3 and 10;
  if not v_photos_ok then
    v_reasons:=array_append(v_reasons,'public_photo_count_3_to_10_required');
  end if;

  if v_track='outdomin_api' then
    v_docs_ok:=not exists(
      select 1
      from unnest(array['business_registration','lease_contract','landlord_consent','resident_register']) x
      where not exists(
        select 1 from gongsil.property_documents d
        where d.property_id=p_property_id and d.document_type=x
      )
    );

    select d.id into v_latest_doc
    from gongsil.property_documents d
    where d.property_id=p_property_id
      and d.document_type='business_registration'
    order by d.created_at desc
    limit 1;

    v_items_ok:=
      exists(
        select 1 from gongsil.verification_items vi
        where vi.property_id=p_property_id
          and vi.item_key='outdomin_registry'
          and vi.status='confirmed'
      )
      and exists(
        select 1 from gongsil.verification_items vi
        where vi.property_id=p_property_id
          and vi.item_key='outdomin_ocr_address'
          and vi.status='confirmed'
      );

    v_gov_ok:=exists(
      select 1
      from gongsil.verification_runs vr
      where vr.property_id=p_property_id
        and vr.run_type='government_db'
        and vr.status='passed'
        and vr.checked_at>=now()-interval '30 days'
        and vr.evidence->>'overallStatus'='confirmed'
        and vr.evidence->>'matchLevel'='unit'
        and coalesce(vr.evidence->>'evidenceFingerprint','') ~ '^[0-9a-f]{64}$'
    );

    v_ocr_ok:=v_latest_doc is not null and exists(
      select 1
      from gongsil.verification_runs vr
      where vr.property_id=p_property_id
        and vr.document_id=v_latest_doc
        and vr.run_type='ocr'
        and vr.status='passed'
        and vr.checked_at>=now()-interval '30 days'
    );

    if not v_docs_ok then v_reasons:=array_append(v_reasons,'required_documents_missing'); end if;
    if not v_items_ok then v_reasons:=array_append(v_reasons,'verification_items_incomplete'); end if;
    if not v_gov_ok then v_reasons:=array_append(v_reasons,'fresh_government_evidence_required'); end if;
    if not v_ocr_ok then v_reasons:=array_append(v_reasons,'fresh_business_registration_ocr_required'); end if;

    v_ready:=v_photos_ok and v_docs_ok and v_items_ok and v_gov_ok and v_ocr_ok;
  else
    select d.id into v_latest_doc
    from gongsil.property_documents d
    where d.property_id=p_property_id
      and d.document_type='landlord_consent'
    order by d.created_at desc
    limit 1;

    v_docs_ok:=v_latest_doc is not null;

    v_items_ok:=not exists(
      select 1
      from unnest(array[
        'sublet_address_match','sublet_landlord','sublet_tenant',
        'sublet_consent','sublet_date','sublet_signature'
      ]) k
      where not exists(
        select 1 from gongsil.verification_items vi
        where vi.property_id=p_property_id
          and vi.item_key=k
          and vi.status='confirmed'
      )
    );

    v_ocr_ok:=v_latest_doc is not null and exists(
      select 1
      from gongsil.verification_runs vr
      where vr.property_id=p_property_id
        and vr.document_id=v_latest_doc
        and vr.run_type='ocr'
        and vr.status='passed'
        and vr.checked_at>=now()-interval '30 days'
    );

    if not v_docs_ok then v_reasons:=array_append(v_reasons,'landlord_consent_required'); end if;
    if not v_items_ok then v_reasons:=array_append(v_reasons,'sublet_six_field_verification_required'); end if;
    if not v_ocr_ok then v_reasons:=array_append(v_reasons,'fresh_landlord_consent_ocr_required'); end if;

    v_ready:=v_photos_ok and v_docs_ok and v_items_ok and v_ocr_ok;
  end if;

  return jsonb_build_object(
    'ready',v_ready,
    'track',v_track,
    'photo_count',v_photos,
    'photos_ok',v_photos_ok,
    'documents_ok',v_docs_ok,
    'items_ok',v_items_ok,
    'government_ok',case when v_track='outdomin_api' then v_gov_ok else null end,
    'ocr_ok',v_ocr_ok,
    'freshness_days',30,
    'reasons',to_jsonb(v_reasons)
  );
end;
$function$;

revoke all on function gongsil_private.patent_verification_gate(uuid) from public, anon, authenticated;

create or replace function gongsil_private.process_auto_verification_jobs()
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare
  j record;
  r record;
  v_json jsonb;
  v_source jsonb;
  v_api_status text;
  v_api_biz text;
  v_api_operation text;
  v_claimed_name text;
  v_name_match boolean;
  v_final_item_status text;
  v_run_status text;
  v_note text;
  v_fingerprint text;
  v_service text;
  v_match_level text;
  v_count integer:=0;
begin
  for j in
    select * from gongsil.auto_verification_jobs
    where status='requested'
    order by requested_at
    limit 100
  loop
    select * into r from net._http_response where id=j.request_id;
    if not found then continue; end if;

    begin
      if r.timed_out or r.error_msg is not null or coalesce(r.status_code,0) <> 200 then
        update gongsil.auto_verification_jobs
           set status='failed',completed_at=now(),
               error_text=coalesce(r.error_msg,'HTTP '||coalesce(r.status_code::text,'0')),
               updated_at=now()
         where id=j.id;

        update gongsil.verification_items
           set status='needs_check',source='seoul_open_data_outdomin_error',
               checked_at=now(),
               note='서울시 외국인관광 도시민박업 API 자동검증 실패 · 운영자 재시도 필요',
               updated_at=now()
         where property_id=j.property_id and item_key='outdomin_registry';

        insert into gongsil.verification_runs(
          property_id,run_type,status,provider,evidence,note,checked_at
        )
        values(
          j.property_id,'government_db','failed','seoul_open_data_outdomin',
          jsonb_build_object('http_status',r.status_code,'error',r.error_msg),
          '외국인관광 도시민박업 API 자동검증 실패',now()
        );

        v_count:=v_count+1;
        continue;
      end if;

      v_json := r.content::jsonb;

      select value into v_source
      from jsonb_array_elements(coalesce(v_json->'sources','[]'::jsonb))
      where value->>'source'='seoul_outdomin_registry'
      limit 1;

      v_api_status:=coalesce(v_source->>'status',v_json->>'overallStatus','needs_check');
      v_api_biz:=v_source#>>'{matches,0,bizName}';
      v_api_operation:=v_source#>>'{matches,0,status}';
      v_fingerprint:=lower(coalesce(v_json->>'evidenceFingerprint',''));
      v_service:=v_json->>'service';
      v_match_level:=v_json->>'matchLevel';

      select nullif(trim(claimed_business_name),'') into v_claimed_name
      from gongsil.property_private
      where property_id=j.property_id;

      if v_claimed_name is null then
        v_name_match:=null;
      else
        v_name_match:=
          regexp_replace(lower(v_claimed_name),'[^0-9a-z가-힣]','','g')
          =
          regexp_replace(lower(coalesce(v_api_biz,'')),'[^0-9a-z가-힣]','','g');
      end if;

      if v_api_status='confirmed'
         and v_match_level='unit'
         and v_fingerprint ~ '^[0-9a-f]{64}$'
         and (v_name_match is distinct from false) then
        v_final_item_status:='confirmed';
        v_run_status:='passed';
        v_note:=concat_ws(
          ' · ',
          '서울시 외국인관광 도시민박업 인허가 확인',
          coalesce(v_api_biz,'상호 미확인'),
          coalesce(v_api_operation,'영업상태 미확인'),
          '호실 일치',
          case
            when v_name_match is true then '상호 일치'
            when v_claimed_name is null then '입력 상호 없음'
          end,
          '증거지문 '||left(v_fingerprint,12),
          '자동검증 통과 · 운영자 최종승인 대기'
        );
      else
        v_final_item_status:='needs_check';
        v_run_status:='needs_review';
        v_note:=concat_ws(
          ' · ',
          case
            when v_api_status='confirmed' then '주소 등록 확인'
            else '인허가 등록/영업상태 추가확인 필요'
          end,
          case when v_match_level is distinct from 'unit' then '호실 정확일치 미확인' end,
          case when v_fingerprint !~ '^[0-9a-f]{64}$' then '증거지문 없음' end,
          case when v_name_match is false then '입력 상호와 서울시 상호 불일치' end,
          coalesce(v_api_biz,'매칭 상호 없음'),
          coalesce(v_api_operation,'영업상태 미확인'),
          '운영자 최종검수 필요'
        );
      end if;

      update gongsil.verification_items
         set status=v_final_item_status,
             source='seoul_open_data_outdomin',
             checked_at=now(),
             note=v_note,
             updated_at=now()
       where property_id=j.property_id and item_key='outdomin_registry';

      insert into gongsil.verification_runs(
        property_id,run_type,status,provider,extracted_fields,evidence,note,checked_at
      )
      values(
        j.property_id,'government_db',v_run_status,'seoul_open_data_outdomin',
        jsonb_build_object(
          'api_business_name',v_api_biz,
          'api_operation_status',v_api_operation,
          'claimed_business_name',v_claimed_name,
          'business_name_match',v_name_match,
          'service',v_service,
          'match_level',v_match_level,
          'checked_at',v_json->>'checkedAt',
          'evidence_fingerprint',v_fingerprint,
          'source_meta',coalesce(v_json->'sourceMeta','{}'::jsonb)
        ),
        v_json,
        v_note,
        now()
      );

      update gongsil.auto_verification_jobs
         set status=case when v_final_item_status='confirmed' then 'confirmed' else 'needs_review' end,
             completed_at=now(),
             response=v_json,
             error_text=null,
             updated_at=now()
       where id=j.id;

      v_count:=v_count+1;
    exception when others then
      update gongsil.auto_verification_jobs
         set status='failed',completed_at=now(),error_text=sqlerrm,updated_at=now()
       where id=j.id;
      v_count:=v_count+1;
    end;
  end loop;

  return v_count;
end;
$function$;

create or replace function public.gongsil_finalize_property(p_property_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_status text;
  v_gate jsonb;
  v_updated boolean;
begin
  if v_uid is null then raise exception 'authentication_required'; end if;

  select publication_status into v_status
  from gongsil.properties
  where id=p_property_id and owner_id=v_uid;

  if v_status is null then raise exception 'property_not_owned'; end if;
  if v_status not in ('draft','needs_revision','paused') then
    raise exception 'property_not_submittable';
  end if;

  v_gate:=gongsil_private.patent_verification_gate(p_property_id);

  if coalesce((v_gate->>'ready')::boolean,false) is not true then
    raise exception 'patent_verification_gate_failed:%',
      array_to_string(
        array(select jsonb_array_elements_text(coalesce(v_gate->'reasons','[]'::jsonb))),
        ','
      );
  end if;

  update gongsil.properties
     set publication_status='submitted',
         admin_review_due_at=now()+interval '48 hours',
         updated_at=now()
   where id=p_property_id
     and owner_id=v_uid
     and publication_status in ('draft','needs_revision','paused');

  v_updated:=found;
  return v_updated;
end;
$function$;

create or replace function public.gongsil_admin_review_property(
  p_property_id uuid,
  p_status text,
  p_note text default null,
  p_public_image_paths text[] default null
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_target text;
  v_current text;
  v_confirmed int:=0;
  v_pending int:=0;
  v_provided int:=0;
  v_estimated int:=0;
  v_admin uuid:=(select auth.uid());
  v_gate jsonb;
  v_image_count int:=coalesce(cardinality(p_public_image_paths),0);
begin
  if not gongsil_private.is_admin() then raise exception 'admin_required'; end if;

  v_target:=case p_status
    when 'approved' then 'published'
    when 'needs_revision' then 'needs_revision'
    when 'rejected' then 'rejected'
    else null
  end;

  if v_target is null then raise exception 'invalid_review_status'; end if;
  if v_target in ('needs_revision','rejected')
     and length(trim(coalesce(p_note,'')))<1 then
    raise exception 'review_note_required';
  end if;

  select publication_status into v_current
  from gongsil.properties
  where id=p_property_id
  for update;

  if v_current is null then raise exception 'property_not_found'; end if;
  if v_current<>'submitted' then raise exception 'property_not_in_admin_review'; end if;

  if v_target='published' then
    if v_image_count<3 or v_image_count>10 then
      raise exception 'public_image_count_must_be_3_to_10:%',v_image_count;
    end if;

    if exists(
      select 1 from unnest(p_public_image_paths) path
      where path not like p_property_id::text || '/%'
    ) then
      raise exception 'invalid_public_image_path';
    end if;

    v_gate:=gongsil_private.patent_verification_gate(p_property_id);
    if coalesce((v_gate->>'ready')::boolean,false) is not true then
      raise exception 'patent_verification_gate_failed:%',
        array_to_string(
          array(select jsonb_array_elements_text(coalesce(v_gate->'reasons','[]'::jsonb))),
          ','
        );
    end if;

    select count(*) filter(where status='needs_check'),
           count(*) filter(where status='confirmed'),
           count(*) filter(where status='host_provided'),
           count(*) filter(where status='estimated')
      into v_pending,v_confirmed,v_provided,v_estimated
    from gongsil.verification_items
    where property_id=p_property_id;

    if v_pending>0 then raise exception 'verification_checklist_incomplete'; end if;
  end if;

  update gongsil.properties
  set publication_status=v_target,
      verification_summary=case
        when v_target='published'
          then '확인 '||v_confirmed||' · 제공 '||v_provided||' · 예상 '||v_estimated
        else coalesce(nullif(trim(coalesce(p_note,'')),''),verification_summary)
      end,
      risk_summary=case
        when v_target in ('needs_revision','rejected')
          then nullif(trim(coalesce(p_note,'')),'')
        else risk_summary
      end,
      published_at=case when v_target='published' then now() else published_at end,
      public_image_paths=case when v_target='published' then p_public_image_paths else '{}'::text[] end,
      admin_review_due_at=null,
      updated_at=now()
  where id=p_property_id;

  insert into gongsil.property_review_history(property_id,action,note,actor_id)
  values(
    p_property_id,
    p_status,
    nullif(trim(coalesce(p_note,'')),''),
    v_admin
  );

  return true;
end;
$function$;

revoke execute on function public.gongsil_finalize_property(uuid) from public, anon;
grant execute on function public.gongsil_finalize_property(uuid) to authenticated;

revoke execute on function public.gongsil_admin_review_property(uuid,text,text,text[]) from public, anon, authenticated;
grant execute on function public.gongsil_admin_review_property(uuid,text,text,text[]) to authenticated;

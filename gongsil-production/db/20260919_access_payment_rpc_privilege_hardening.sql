revoke all on function public.gongsil_create_access_order_idempotent(text, text) from public, anon;
grant execute on function public.gongsil_create_access_order_idempotent(text, text) to authenticated;

revoke all on function public.gongsil_has_active_access_pass() from public, anon;
grant execute on function public.gongsil_has_active_access_pass() to authenticated;

revoke all on function public.gongsil_get_portone_verification_contract(text, uuid) from public, anon, authenticated;
grant execute on function public.gongsil_get_portone_verification_contract(text, uuid) to service_role;

revoke all on function public.gongsil_ingest_portone_verified_event(text, text, text, uuid, text, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function public.gongsil_ingest_portone_verified_event(text, text, text, uuid, text, numeric, text, jsonb) to service_role;

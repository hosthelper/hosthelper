-- 2026-10-03
-- Operator sales dashboard for paid access passes.

create or replace function public.gongsil_admin_sales_dashboard()
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
      'total_revenue',coalesce((select sum(amount_krw) from gongsil.access_pass_orders where status='paid'),0),
      'today_revenue',coalesce((select sum(amount_krw) from gongsil.access_pass_orders where status='paid' and paid_at::date=(now() at time zone 'Asia/Seoul')::date),0),
      'month_revenue',coalesce((select sum(amount_krw) from gongsil.access_pass_orders where status='paid' and date_trunc('month',paid_at at time zone 'Asia/Seoul')=date_trunc('month',now() at time zone 'Asia/Seoul')),0),
      'paid_orders',(select count(*) from gongsil.access_pass_orders where status='paid'),
      'pending_orders',(select count(*) from gongsil.access_pass_orders where status='pending_payment'),
      'refunded_amount',coalesce((select sum(amount_krw) from gongsil.access_pass_orders where status='refunded'),0)
    ),
    'by_plan',coalesce((
      select jsonb_agg(jsonb_build_object(
        'plan_code',x.plan_code,
        'orders',x.orders,
        'revenue',x.revenue
      ) order by x.revenue desc)
      from (
        select plan_code,count(*)::int orders,coalesce(sum(amount_krw),0) revenue
        from gongsil.access_pass_orders
        where status='paid'
        group by plan_code
      ) x
    ),'[]'::jsonb),
    'recent_payments',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',o.id,
        'email',u.email,
        'plan_code',o.plan_code,
        'amount_krw',o.amount_krw,
        'payment_method',o.payment_method,
        'provider_ref',o.provider_ref,
        'paid_at',o.paid_at
      ) order by o.paid_at desc)
      from (
        select * from gongsil.access_pass_orders
        where status='paid'
        order by paid_at desc
        limit 20
      ) o
      left join auth.users u on u.id=o.user_id
    ),'[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.gongsil_admin_sales_dashboard() from public,anon;
grant execute on function public.gongsil_admin_sales_dashboard() to authenticated;

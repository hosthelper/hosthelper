-- 2026-10-03
-- Activate patent-aligned access pass products without duplicating the existing 30-day product.
update gongsil.access_pass_plans
set price_krw=case plan_code
  when 'count_1' then 10000
  when 'count_5' then 30000
  when 'count_10' then 50000
  when 'day_1' then 10000
  when 'week_1' then 30000
  else price_krw end,
  active=case
    when plan_code in ('count_1','count_5','count_10','day_1','week_1') then true
    else active end,
  label=case plan_code
    when 'count_1' then '매물 1건 열람'
    when 'count_5' then '매물 5건 열람'
    when 'count_10' then '매물 10건 열람'
    when 'day_1' then '1일 무제한'
    when 'week_1' then '1주 무제한'
    else label end,
  updated_at=now()
where plan_code in ('count_1','count_5','count_10','day_1','week_1');

-- month_1 remains inactive because day_30 is the existing 30-day/month-equivalent product.

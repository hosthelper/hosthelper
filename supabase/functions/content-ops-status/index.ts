import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SVC = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const H = { apikey: SVC, Authorization: `Bearer ${SVC}` };
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

async function rows(path: string) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: H });
  if (!r.ok) throw new Error(`${path}:${r.status}:${(await r.text()).slice(0, 300)}`);
  return await r.json();
}

function countBy(items: any[], key: string) {
  return items.reduce((acc: Record<string, number>, item: any) => {
    const value = String(item?.[key] ?? 'unknown');
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'GET') return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), { status: 405, headers: CORS });

  try {
    const [campaigns, kpis, contents, assets, jobs, plans, accounts, posts] = await Promise.all([
      rows('content_campaigns?select=campaign_id,name,brand,goal_customers,duration_hours,success_event,status,starts_at,ends_at,updated_at&order=created_at.desc&limit=5'),
      rows('content_kpi_snapshots?select=campaign_id,captured_at,dm_diagnosis,property_link_sent,diagnosis_applied,diagnosis_completed,consultation_converted,goal_customers,achievement_pct&order=captured_at.desc&limit=10'),
      rows('content_items?select=content_id,campaign_id,brand,title,format,qa_score,qa_status,status,auto_publish,updated_at&order=created_at.asc&limit=30'),
      rows('content_assets?select=id,content_id,asset_type,platform,mime_type,ordinal,status,updated_at&order=created_at.asc&limit=100'),
      rows('content_generation_jobs?select=id,content_id,job_type,status,provider,external_job_id,error,updated_at&order=created_at.asc&limit=50'),
      rows('content_channel_plans?select=id,content_id,platform,desired_media_type,scheduled_offset_minutes,status,last_reason,sns_post_id,updated_at&order=created_at.asc&limit=100'),
      rows('sns_accounts?select=platform,username,connection_status,token_expires_at,last_health_at,last_error&order=platform.asc'),
      rows('sns_posts?select=id,platform,campaign_id,content_id,title,status,external_id,attempts,published_at,last_error_code,error&order=created_at.desc&limit=40'),
    ]);

    const latestCampaign = campaigns?.[0] || null;
    const latestKpi = latestCampaign ? kpis.find((k: any) => k.campaign_id === latestCampaign.campaign_id) || null : null;
    const platforms = ['instagram', 'threads', 'youtube', 'tiktok'];
    const accountMap = new Map((accounts || []).map((a: any) => [a.platform, a]));
    const channelSummary = platforms.map((platform) => {
      const account: any = accountMap.get(platform);
      const platformPlans = (plans || []).filter((p: any) => p.platform === platform);
      return {
        platform,
        connected: account?.connection_status === 'connected',
        username: account?.username || null,
        token_expires_at: account?.token_expires_at || null,
        last_health_at: account?.last_health_at || null,
        last_error: account?.last_error || null,
        plan_status: countBy(platformPlans, 'status'),
      };
    });

    const response = {
      ok: true,
      generated_at: new Date().toISOString(),
      p0: {
        asset_generation: {
          total_jobs: (jobs || []).length,
          job_status: countBy(jobs || [], 'status'),
          asset_status: countBy(assets || [], 'status'),
          ready_assets: (assets || []).filter((a: any) => a.status === 'ready').length,
        },
        oauth: { connected: channelSummary.filter((c) => c.connected).length, total: 4 },
        test_publish: {
          published_channels: new Set((posts || []).filter((p: any) => ['published', 'published_with_warning'].includes(p.status)).map((p: any) => p.platform)).size,
          total: 4,
        },
        external_post_ids: {
          verified_channels: new Set((posts || []).filter((p: any) => p.external_id && ['published', 'published_with_warning'].includes(p.status)).map((p: any) => p.platform)).size,
          total: 4,
        },
        campaign: latestCampaign,
      },
      summary: {
        contents: (contents || []).length,
        qa_passed: (contents || []).filter((c: any) => c.qa_status === 'passed').length,
        assets: (assets || []).length,
        generation_jobs: countBy(jobs || [], 'status'),
        channel_plans: countBy(plans || [], 'status'),
        posts: countBy(posts || [], 'status'),
      },
      campaign: latestCampaign,
      kpi: latestKpi,
      channels: channelSummary,
      contents,
      jobs,
      plans,
      posts,
    };

    return new Response(JSON.stringify(response), { headers: CORS });
  } catch (error) {
    console.error('content-ops-status', error);
    return new Response(JSON.stringify({ ok: false, error: String((error as any)?.message || error) }), { status: 500, headers: CORS });
  }
});

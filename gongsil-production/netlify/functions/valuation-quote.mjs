const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const num = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const sanitizeFeatures = (input = {}) => ({
  operating_months: clamp(num(input.operating_months), 0, 600),
  deposit_amount: clamp(num(input.deposit_amount), 0, 100_000_000_000),
  monthly_rent: clamp(num(input.monthly_rent), 0, 10_000_000_000),
  avg_monthly_revenue: clamp(num(input.avg_monthly_revenue), 0, 100_000_000_000),
  avg_daily_rate: clamp(num(input.avg_daily_rate), 0, 100_000_000),
  fixed_cost: clamp(num(input.fixed_cost), 0, 10_000_000_000),
  management_fee: clamp(num(input.management_fee), 0, 10_000_000_000),
  occupancy_rate: clamp(num(input.occupancy_rate, 60), 0, 100),
  asset_reuse_pct: clamp(num(input.asset_reuse_pct), 0, 100),
  facility_investment: clamp(num(input.facility_investment), 0, 100_000_000_000),
  review_score: clamp(num(input.review_score, 4), 0, 5),
  reservation_forward_rate: clamp(
    num(input.reservation_forward_rate, input.occupancy_rate || 60),
    0,
    100,
  ),
  accessibility_score: clamp(num(input.accessibility_score, 50), 0, 100),
  tourism_proximity_score: clamp(num(input.tourism_proximity_score, 50), 0, 100),
  area: String(input.area || "").trim().slice(0, 80),
  accommodation_type: String(input.accommodation_type || "").trim().slice(0, 80),
});

const baselinePremium = (f) => {
  const profit = Math.max(
    f.avg_monthly_revenue - (f.monthly_rent + f.fixed_cost + f.management_fee),
    0,
  );
  const reuse = f.asset_reuse_pct
    ? f.asset_reuse_pct / 100
    : Math.max(0.2, 1 - f.operating_months / 60);
  const facilityValue = f.facility_investment * reuse;
  const quality =
    1 +
    Math.max(-0.08, Math.min(0.12, (f.occupancy_rate - 60) / 400)) +
    Math.max(-0.04, Math.min(0.06, (f.review_score - 4) / 20)) +
    Math.max(
      -0.04,
      Math.min(0.06, (f.reservation_forward_rate - 60) / 500),
    ) +
    Math.max(-0.03, Math.min(0.05, (f.accessibility_score - 50) / 1000)) +
    Math.max(
      -0.03,
      Math.min(0.05, (f.tourism_proximity_score - 50) / 1000),
    );
  const businessValue =
    profit *
    Math.max(6, Math.min(18, 8 + f.operating_months / 6)) *
    quality;
  return Math.max(0, Math.round(facilityValue + businessValue));
};

const supabaseRpc = async (baseUrl, publishableKey, name, body) => {
  const response = await fetch(`${baseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`${name}:${response.status}:${raw.slice(0, 240)}`);
  }
  return raw ? JSON.parse(raw) : null;
};

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > 16_000) {
    return json({ error: "payload_too_large" }, 413);
  }

  let parsed;
  try {
    parsed = JSON.parse(rawBody || "{}");
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const features = sanitizeFeatures(parsed.features || parsed);
  if (
    features.avg_monthly_revenue <= 0 ||
    features.operating_months <= 0 ||
    features.occupancy_rate <= 0
  ) {
    return json({ error: "required_features_missing" }, 400);
  }

  const fallback = baselinePremium(features);
  const fallbackPayload = {
    ok: true,
    mode: "rules_fallback",
    model_version: "valuation-model-v1",
    training_source: "rules",
    premium_recommended: fallback,
    premium_min: Math.round(fallback * 0.85),
    premium_max: Math.round(fallback * 1.15),
    confidence: 55,
    bootstrap_warning: false,
  };

  const supabaseUrl = Netlify.env.get("SUPABASE_URL");
  const publishableKey = Netlify.env.get("SUPABASE_PUBLISHABLE_KEY");
  const proxyToken = Netlify.env.get("GONGSIL_ML_PROXY_SECRET");
  const workerToken = Netlify.env.get("GONGSIL_ML_WORKER_TOKEN");

  if (!supabaseUrl || !publishableKey || !proxyToken || !workerToken) {
    return json({ ...fallbackPayload, reason: "ml_proxy_not_configured" });
  }

  try {
    const model = await supabaseRpc(
      supabaseUrl,
      publishableKey,
      "gongsil_get_active_valuation_model_with_token",
      { p_proxy_token: proxyToken },
    );

    const endpoint = String(model?.worker_endpoint || "").replace(/\/$/, "");
    if (!endpoint) throw new Error("ml_worker_endpoint_missing");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    let response;
    try {
      response = await fetch(`${endpoint}/v1/infer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gongsil-Worker-Token": workerToken,
        },
        body: JSON.stringify({
          artifact_uri: model.artifact_uri,
          features,
          model_metrics: model.model_metrics || {},
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const result = await response.json();
    if (!response.ok || !result?.ok) {
      throw new Error(result?.error || `ml_worker_${response.status}`);
    }

    const source =
      model.training_source ||
      model.model_metrics?.training_source ||
      "unknown";

    return json({
      ok: true,
      mode: "ml",
      model_version: model.model_version,
      training_source: source,
      premium_recommended: Math.round(num(result.prediction)),
      premium_min: Math.round(num(result.premium_min)),
      premium_max: Math.round(num(result.premium_max)),
      confidence: Math.round(num(result.confidence) * 10) / 10,
      bootstrap_warning: source === "historical_asking_premium",
      baseline_prediction: Math.round(
        num(result.metadata?.baseline_prediction, fallback),
      ),
      engine: result.metadata?.engine || model.model_metrics?.engine || "ml_worker",
    });
  } catch (error) {
    console.error("valuation-quote fallback", error);
    return json({
      ...fallbackPayload,
      reason: String(error?.message || error).slice(0, 180),
    });
  }
};

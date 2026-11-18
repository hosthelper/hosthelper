// HostHelper signed Slack Events API receiver — isolated, no guest messages or orders.
// Endpoint: https://buzcnfnimzlsjvbeefjb.supabase.co/functions/v1/hosthelper-slack-events
// This webhook stays fail-closed until HH_SLACK_SIGNING_SECRET is configured securely.
// Slack app must subscribe to message.groups in the PRIVATE channel and be invited.
const CHANNEL_ID = 'C0CKGEYUABA';
const OWNER_USER_ID = 'U0B9136DE0P';
const SUYU_ROOMS = new Set(['101','201','202','203','204','301','302','303','304','401','402','403','404','501']);
const CHANGCHEON_ROOMS = new Set(['103','105','203','205','301','302']);
const te = new TextEncoder();
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
});

async function signedRequest(req: Request, body: string, secret: string): Promise<boolean> {
  const timestamp = req.headers.get('x-slack-request-timestamp') || '';
  const signature = req.headers.get('x-slack-signature') || '';
  if (!/^[0-9]{10,}$/.test(timestamp) ||
      Math.abs(Date.now()/1000 - Number(timestamp)) > 300 ||
      !/^v0=[0-9a-f]{64}$/i.test(signature) || !secret) return false;
  const hmacKey = await crypto.subtle.importKey('raw', te.encode(secret), {name:'HMAC',hash:'SHA-256'},false,['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC',hmacKey,te.encode('v0:'+timestamp+':'+body)));
  const expected = 'v0='+Array.from(mac,b=>b.toString(16).padStart(2,'0')).join('');
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i=0;i<signature.length;i++) mismatch |= expected.charCodeAt(i) ^ signature.toLowerCase().charCodeAt(i);
  return mismatch===0;
}
function permittedUser(user: string) {
  const more = (Deno.env.get('HH_SLACK_ALLOWED_USERS') || '').split(',').map(s=>s.trim()).filter(Boolean);
  return user === OWNER_USER_ID || more.includes(user);
}
function runtimeServiceRoleKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(legacy) return legacy;
  // Explicitly request a legacy service_role JWT when available;
  // newer sb_secret keys require an API-gateway-specific header flow.
  return '';
}
function reportFromMessage(payload: any) {
  const ev = payload?.event;
  if (payload?.type !== 'event_callback' || typeof payload?.event_id !== 'string' ||
      !/^Ev[A-Za-z0-9]{5,128}$/.test(payload.event_id) || !ev ||
      ev.type !== 'message' ||
      (ev.subtype && ev.subtype!=='file_share') ||
      ev.bot_id || !ev.user || !ev.channel) return null;
  if (ev.channel !== CHANNEL_ID || !permittedUser(String(ev.user))) return null;
  const text = String(ev.text||'').slice(0,3000);
  const rawFiles = Array.isArray(ev.files)?ev.files:[];
  const fileIds = [...new Set(rawFiles
    .filter((f:any)=>/^image\//.test(String(f?.mimetype||''))&&/^F[A-Za-z0-9]{5,}$/.test(String(f.id||'')))
    .map((f:any)=>String(f.id)))].slice(0,12);
  const isCleaning = /청소|완료|재청소|객실|linen|cleaning|supplies|비품|파손|고장|누수|악취/i.test(text);
  // Informational notices and multi-room schedules are never individual cleaning reports.
  if (/(?:청소팀\s*안내|객실\s*목록|전체\s*객실|보고\s*양식|청소\s*보고\s*예시)/i.test(text)) return null;
  if (!isCleaning && fileIds.length===0) return null;
  // Require explicit property identity; room 203/301/302 exists in BOTH properties.
  // Ambiguous messages are ignored, not incorrectly recorded under Suyu.
  const hasSuyu = /수유\s*스테이|디하이브\s*수유|suyu/i.test(text);
  const hasChangcheon = /창천(?:동)?\s*321|창천동|changcheon/i.test(text);
  if (hasSuyu === hasChangcheon) return null;
  const propertyId = hasSuyu ? 'suyu' : 'changcheon321';
  const allowedRooms = hasSuyu ? SUYU_ROOMS : CHANGCHEON_ROOMS;
  const matchedRooms = [...text.matchAll(/(?:^|[^0-9])(\d{3})(?:\s*호)?(?=$|[^0-9])/g)]
    .map(m => m[1]).filter(room => allowedRooms.has(room));
  const distinctRooms = [...new Set(matchedRooms)];
  // Prevent bulk announcements from falsely marking the first room.
  if (distinctRooms.length !== 1) return null;
  const room = distinctRooms[0];
  const issue = /파손|누수|고장|오염|악취|곰팡이|분실|부족|위험|불량|broken|damaged|issue|shortage/i.test(text);
  // Only a strict completion claim with two photos is eligible for manual review.
  // Test messages, explicit negations and any reported issues can never mark it completed.
  const completionClaim = Boolean(room) && fileIds.length >= 2 && !issue &&
    !/(?:테스트|검증|점검|실험|훈련|가상|예시|미완료|미\s*완료|아니|아님|완료\s*전|예정|아직|취소|못함|not\s*(?:done|complete)|\btest\b|\bdummy\b)/i.test(text) &&
    /(?:^|[\s#])(?:청소\s*완료|cleaning\s*(?:complete|done))(?=$|[\s.,!?])/i.test(text);
  return {
    event_id: payload.event_id,
    team_id: String(payload.team_id||'').slice(0,40),
    channel_id: CHANNEL_ID,
    reporter_user_id:String(ev.user).slice(0,50),
    event_ts: String(ev.event_ts||ev.ts||'').slice(0,50),
    property_id: propertyId,
    room, photo_file_ids: fileIds,
    cleaning_reported_completed: completionClaim,
    potential_issue: issue,
    review_status: room ? 'pending_review' : 'needs_room_link'
  };
}
async function persistReport(report:any): Promise<{ok:boolean;http:number}> {
  const url=Deno.env.get('SUPABASE_URL') || 'https://buzcnfnimzlsjvbeefjb.supabase.co';
  const key=runtimeServiceRoleKey();
  if(!key) return {ok:false,http:503};
  const res=await fetch(url+'/rest/v1/hosthelper_ai_slack_events?on_conflict=event_id',{
    method:'POST',
    headers:{'apikey':key,'Authorization':'Bearer '+key,
      'Content-Type':'application/json','Prefer':'resolution=ignore-duplicates,return=minimal'},
    body:JSON.stringify(report),signal:AbortSignal.timeout(1900)
  });
  return {ok:res.ok,http:res.status};
}

const BOT_TARGETS = [
  {id:'C0CJP9UTZK4', label:'수유스테이'},
  {id:'C0CJH8L2FSP', label:'창천동321'}
];
function availableBotToken(): string {
  return Deno.env.get('HH_SLACK_BOT_TOKEN') || '';
}
async function sendPushProbe(target:{id:string,label:string}): Promise<{channel:string;ok:boolean;error?:string}> {
  const token = availableBotToken();
  if (!token) return {channel:target.label,ok:false,error:'bot_token_not_configured'};
  const message = '[HostHelper Ops 봇 푸시 테스트 | '+target.label+']\n'+
    '<@'+OWNER_USER_ID+'> 봇 명의로 보낸 실제 알림 테스트입니다.\n'+
    '휴대폰 잠금화면/알림창과 Slack 앱 아이콘 숫자 배지를 확인해 주세요.\n'+
    '실제 신규 예약, 청소 일정 변경, 정산 변경은 없습니다.';
  try {
    const response=await fetch('https://slack.com/api/chat.postMessage',{
      method:'POST',
      headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json;charset=utf-8'},
      body:JSON.stringify({channel:target.id,text:message,unfurl_links:false,unfurl_media:false}),
      signal:AbortSignal.timeout(5000)
    });
    const data=await response.json();
    return {channel:target.label,ok:response.ok && data?.ok===true,
      ...(data?.ok===true?{}:{error:String(data?.error||'slack_http_'+response.status).slice(0,100)})};
  } catch {return {channel:target.label,ok:false,error:'slack_delivery_exception'};}
}

Deno.serve(async(req:Request) => {
  if(req.method==='GET'){
    if(new URL(req.url).pathname.endsWith('/health') || new URL(req.url).pathname.endsWith('/hosthelper-slack-events')){
      return json({service:'hosthelper-slack-events',deployed:true,
        ready:Boolean(Deno.env.get('HH_SLACK_SIGNING_SECRET')&&runtimeServiceRoleKey()),
        eventsSubscribed:'not_verified',
        botTokenConfigured:Boolean(availableBotToken()),botSendProbeEnabled:true,
        mode:'signed_webhook',canSendGuestMessages:false,canPurchase:false});
    }
    return json({error:'not_found'},404);
  }
  if(req.method!=='POST') return json({error:'method_not_allowed'},405);
  const secret=Deno.env.get('HH_SLACK_SIGNING_SECRET')||'';
  if(!secret || !runtimeServiceRoleKey()) return json({error:'server_auth_configuration_incomplete'},503);
  const size=Number(req.headers.get('content-length')||'0');
  if(size>100000) return json({error:'payload_too_large'},413);
  const raw=await req.text();
  if(raw.length>100000) return json({error:'payload_too_large'},413);
  if(!await signedRequest(req,raw,secret)) return json({error:'invalid_signature'},401);
  let payload:any;
  try{payload=JSON.parse(raw)} catch{return json({error:'invalid_json'},400)};
  const teamId=Deno.env.get('HH_SLACK_TEAM_ID')||'';
  if(teamId && payload?.team_id !== teamId) return json({ok:true,ignored:'other_workspace'});
  if(payload?.type==='url_verification'){
    if(typeof payload.challenge!=='string'||payload.challenge.length>2048)return json({error:'invalid_challenge'},400);
    return json({challenge:payload.challenge});
  }
  // Only the signed, allowlisted owner message in the existing private ops channel can trigger a one-off test.
  // No public unauthenticated send endpoint, no guest messages and no secrets exposed.
  const event=payload?.event;
  if (payload?.type==='event_callback' && event?.type==='message' && !event?.subtype &&
      !event?.bot_id && event?.channel===CHANNEL_ID && event?.user===OWNER_USER_ID &&
      String(event?.text||'').trim()==='HHBOT_PUSH_TEST_20261118') {
    const results=await Promise.all(BOT_TARGETS.map(sendPushProbe));
    return json({ok:true,botPushProbe:results});
  }
  const report=reportFromMessage(payload);
  if(!report) return json({ok:true,ignored:true});
  try {
    const saved=await persistReport(report);
    if(!saved.ok) return json({error:'queue_unavailable'},503);
    return json({ok:true,queued:true});
  } catch {
    // Fail non-2xx so Slack retries. Never print messages or secrets.
    return json({error:'retry_later'},503);
  }
});
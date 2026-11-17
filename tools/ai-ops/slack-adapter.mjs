import {verifySlackSignature} from './engine.mjs';

const ROOM_IDS=new Set(['101','201','202','203','204','301','302','303','304','401','402','403','404','501']);
const REPORTED=/청소\s*완료|cleaning\s*(?:complete|done)/i;
const ISSUE=/파손|누수|고장|오염|악취|곰팡이|분실|부족|문제|위험|broken|damaged|issue|shortage/i;
const ROOM_PATTERN=/(?:^|[\s#[(])(?:수유\s*)?(101|201|202|203|204|301|302|303|304|401|402|403|404|501)\s*호?(?=$|[\s#,.\])])/;
const FILE_ID=/^F[A-Z0-9]{5,}$/i;
const EVENT_ID=/^Ev[A-Z0-9]{5,}$/i;
const header=(headers,name)=>String(headers[name]??headers[name.toLowerCase()]??headers[name.toUpperCase()]??'');

/**
 * Slack event -> an internal draft. The result must never mark a room cleaned,
 * authorize early check-in, send guest instructions, or trigger checkout/payment.
 * The authenticated room task is resolved later using HostHelper DB.
 */
export function normalizeCleaningEvent({
  headers={},rawBody='',signingSecret='',allowedTeamId='',allowedChannelIds=[],
  allowedUserIds=[]
}={}) {
  if(typeof rawBody!=='string'||rawBody.length>131072)return {status:'rejected',reason:'payload_invalid'};
  const valid=verifySlackSignature({
    timestamp:header(headers,'x-slack-request-timestamp'),
    signature:header(headers,'x-slack-signature'),rawBody,signingSecret
  });
  if(!valid)return {status:'rejected',reason:'invalid_slack_signature'};
  let payload;
  try {payload=JSON.parse(rawBody)} catch {return {status:'rejected',reason:'invalid_json'}};
  if(!allowedTeamId||payload.team_id!==allowedTeamId)return {status:'ignored',reason:'workspace_not_allowed'};
  if(payload.type==='url_verification') {
    return typeof payload.challenge==='string'&&payload.challenge.length<=2048
      ?{status:'challenge',challenge:payload.challenge}:{status:'rejected',reason:'invalid_challenge'};
  }
  if(payload.type!=='event_callback'||!EVENT_ID.test(String(payload.event_id||'')))
    return {status:'ignored',reason:'unsupported_envelope'};
  const event=payload.event||{};
  if(event.type!=='message'||(event.subtype&&event.subtype!=='file_share')||event.bot_id||!event.user)
    return {status:'ignored',reason:'not_user_message'};
  if(!Array.isArray(allowedChannelIds)||!allowedChannelIds.includes(event.channel))
    return {status:'ignored',reason:'channel_not_allowed'};
  if(!Array.isArray(allowedUserIds)||!allowedUserIds.includes(event.user))
    return {status:'ignored',reason:'user_not_allowed'};
  const text=String(event.text||'').slice(0,4000);
  const match=ROOM_PATTERN.exec(text);
  if(!match||!ROOM_IDS.has(match[1]))
    return {status:'needs_manual_link',reason:'room_not_identified',eventId:payload.event_id};
  const files=Array.isArray(event.files)?event.files:[];
  const photoFileIds=[...new Set(files
    .filter(f=>typeof f?.mimetype==='string'&&f.mimetype.startsWith('image/')&&FILE_ID.test(String(f.id||'')))
    .map(f=>f.id))].slice(0,12);
  return {
    status:'draft_requires_task_link_and_inspection',
    eventId:payload.event_id,teamId:payload.team_id,channelId:event.channel,
    workerId:event.user,room:match[1],propertyId:'suyu',
    reportedCompleted:REPORTED.test(text),
    potentialIssue:ISSUE.test(text),
    photoFileIds,
    photoCount:photoFileIds.length,
    inspectionStatus:'not_verified',
    linkedCleaningTaskId:null,
    externalActionTaken:false
  };
}

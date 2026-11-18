import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
const rooms=new Set(['101','201','202','203','204','301','302','303','304','401','402','403','404','501']);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function eventKey({propertyId,room,reservationCode,eventType,version=1}){
  const parts=[propertyId,room,reservationCode,eventType,version];
  if(parts.some(x=>!String(x??'').trim()))throw new Error('missing_key_part');
  return 'hh_'+createHash('sha256').update(parts.join('|')).digest('hex').slice(0,32);
}
export function verifySlackSignature({timestamp,signature,rawBody,signingSecret,nowSeconds=Math.floor(Date.now()/1000)}){
  if(!signingSecret||!/^[0-9]{10}$/.test(String(timestamp))||Math.abs(nowSeconds-Number(timestamp))>300)return false;
  if(!/^v0=[a-f0-9]{64}$/i.test(String(signature))||typeof rawBody!=='string')return false;
  const expected='v0='+createHmac('sha256',signingSecret).update('v0:'+timestamp+':'+rawBody).digest('hex');
  return timingSafeEqual(Buffer.from(expected),Buffer.from(signature));
}
export function actionPolicy(action){
  if(['purchase','refund','discount','booking_change','door_code_send'].includes(action))return 'operator_approval';
  if(['internal_summary','internal_cleaning_assignment','draft_guest_reply'].includes(action))return 'draft_or_internal_only';
  return action==='send_guest_reply'?'conditional_official_channel':'operator_approval';
}
export function earlyCheckInIntent({booking={},cleaning={},channel={},audit={}}={}){
  const reasons=[];
  if(booking.propertyId!=='suyu'||!rooms.has(String(booking.room)))reasons.push('room_not_verified');
  if(!booking.reservationCode||booking.status!=='confirmed')reasons.push('booking_not_confirmed');
  if(!['approved_pms_api','ota_verified_manual'].includes(booking.source))reasons.push('booking_source_not_verified');
  const ms=Date.parse(booking.sourceVerifiedAt??'');
  if(!Number.isFinite(ms)||Date.now()-ms>900000||ms>Date.now()+60000)reasons.push('booking_snapshot_stale');
  if(booking.checkIn!==today())reasons.push('not_checkin_day');
  if(booking.roomMappingVerified!==true||booking.conflict===true)reasons.push('room_mapping_or_conflict');
  if(booking.earlyCheckInApproved!==true)reasons.push('early_checkin_unapproved');
  if(cleaning.status!=='completed'||!Array.isArray(cleaning.afterPhotoRefs)||cleaning.afterPhotoRefs.length<2)reasons.push('cleaning_or_photos_incomplete');
  if(cleaning.inspection!=='approved'||cleaning.hasIssue!==false)reasons.push('inspection_or_issue');
  if(channel.officialMessagingAuthorized!==true)reasons.push('channel_unverified');
  if(audit.alreadyNotified===true)reasons.push('already_notified');
  const key=booking.propertyId&&booking.room&&booking.reservationCode?eventKey({...booking,eventType:'early_checkin_notice'}):null;
  return reasons.length?{status:'blocked',reasons,key,externalSend:false}:{status:'ready_for_authorized_executor',key,externalSend:false,templateId:'EARLY_CHECKIN_READY_V1',preSendChecks:['refresh_ota_booking','idempotency_lock','channel_permission','room_access_policy']};
}
export function purchaseIntent({product={},request={},audit={}}={}){
  const reasons=[];
  if(!product.sku||product.vendorVerified!==true)reasons.push('vendor_or_sku_unverified');
  if(!Number.isSafeInteger(product.unitPriceKrw)||product.unitPriceKrw<=0)reasons.push('invalid_price');
  if(!Number.isSafeInteger(request.quantity)||request.quantity<=0)reasons.push('invalid_quantity');
  if(request.stockEvidence!==true)reasons.push('no_stock_evidence');
  if(audit.duplicateOpenOrder===true)reasons.push('duplicate_order');
  const totalKrw=product.unitPriceKrw*request.quantity;
  if(!Number.isSafeInteger(totalKrw)||totalKrw>1000000)reasons.push('amount_limit');
  return {status:reasons.length?'blocked':'operator_approval_required',reasons,totalKrw:Number.isSafeInteger(totalKrw)?totalKrw:null,paymentAttempted:false};
}

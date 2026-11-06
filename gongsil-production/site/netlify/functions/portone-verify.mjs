function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
function env(name){const v=Netlify.env.get(name);if(!v)throw new Error('missing_env:'+name);return v}
async function rpc(name,body){
  const base=env('SUPABASE_URL'),key=env('SUPABASE_PUBLISHABLE_KEY');
  const res=await fetch(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,authorization:'Bearer '+key,'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  const raw=await res.text();let data=null;try{data=raw?JSON.parse(raw):null}catch{data=raw}
  if(!res.ok)throw new Error('supabase_'+name+'_'+res.status);
  return data;
}
async function payment(paymentId){
  const res=await fetch('https://api.portone.io/payments/'+encodeURIComponent(paymentId),{headers:{authorization:'PortOne '+env('PORTONE_API_SECRET')},signal:AbortSignal.timeout(15000)});
  const raw=await res.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{}
  if(!res.ok)throw new Error('portone_get_'+res.status);
  return data;
}
async function cancel(paymentId,reason){
  const res=await fetch('https://api.portone.io/payments/'+encodeURIComponent(paymentId)+'/cancel',{method:'POST',headers:{authorization:'PortOne '+env('PORTONE_API_SECRET'),'content-type':'application/json'},body:JSON.stringify({reason}),signal:AbortSignal.timeout(15000)});
  const raw=await res.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{}
  if(!res.ok)throw new Error('portone_cancel_'+res.status);
  return data;
}
function statusOf(p){return String(p?.status||'').toUpperCase()}
function amountOf(p){const n=Number(p?.amount?.total??p?.amount?.totalAmount??p?.totalAmount);return Number.isFinite(n)?n:NaN}
function eventKey(type,id,paymentId,event){return 'server:'+type+':'+id+':'+paymentId+':'+event}
export default async function(req){
  if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
  try{
    env('PORTONE_API_SECRET');env('SUPABASE_URL');env('SUPABASE_PUBLISHABLE_KEY');
    const token=env('GONGSIL_PORTONE_SETTLE_TOKEN');
    let body={};try{body=await req.json()}catch{return reply({error:'invalid_json'},400)}
    const resourceType=String(body.resourceType||''),resourceId=String(body.resourceId||''),paymentId=String(body.paymentId||''),action=String(body.action||'verify_payment');
    if(!['access_order','visit_deposit'].includes(resourceType))return reply({error:'invalid_resource_type'},400);
    if(!/^[0-9a-f-]{36}$/i.test(resourceId))return reply({error:'invalid_resource_id'},400);
    const contract=await rpc('gongsil_get_portone_verification_contract_with_token',{p_settle_token:token,p_resource_type:resourceType,p_resource_id:resourceId});
    const expected=Number(contract?.expected_amount_krw);
    if(!Number.isFinite(expected)||expected<=0)return reply({error:'invalid_server_contract'},409);
    if(action==='request_refund'){
      if(resourceType!=='visit_deposit')return reply({error:'refund_only_for_visit_deposit'},400);
      if(contract?.refundable!==true)return reply({error:'deposit_not_refundable',status:contract?.status},409);
      const providerPaymentId=String(contract?.existing_payment_id||paymentId||'');
      if(!providerPaymentId)return reply({error:'payment_id_missing'},409);
      const cancellation=await cancel(providerPaymentId,String(body.reason||'공실헬퍼 임장보증금 환불'));
      const current=await payment(providerPaymentId);
      if(statusOf(current)==='CANCELLED'){
        const result=await rpc('gongsil_ingest_portone_verified_event_with_token',{p_settle_token:token,p_event_key:String(body.eventKey||eventKey(resourceType,resourceId,providerPaymentId,'refund_completed')),p_resource_type:resourceType,p_event_type:'refund_completed',p_resource_id:resourceId,p_payment_id:providerPaymentId,p_amount_krw:expected,p_provider_status:'refunded',p_payload:{provider:current,cancellation}});
        return reply({ok:true,refunded:true,result});
      }
      return reply({ok:true,refundRequested:true,providerStatus:statusOf(current),cancellation},202);
    }
    if(!paymentId)return reply({error:'payment_id_required'},400);
    const current=await payment(paymentId),providerStatus=statusOf(current),providerAmount=amountOf(current),currency=String(current?.currency||'KRW').toUpperCase();
    if(action==='verify_refund'){
      if(resourceType!=='visit_deposit')return reply({error:'refund_only_for_visit_deposit'},400);
      if(providerStatus!=='CANCELLED')return reply({error:'refund_not_completed',providerStatus},409);
      const result=await rpc('gongsil_ingest_portone_verified_event_with_token',{p_settle_token:token,p_event_key:String(body.eventKey||eventKey(resourceType,resourceId,paymentId,'refund_completed')),p_resource_type:resourceType,p_event_type:'refund_completed',p_resource_id:resourceId,p_payment_id:paymentId,p_amount_krw:expected,p_provider_status:'refunded',p_payload:{provider:current}});
      return reply({ok:true,result});
    }
    if(!['PAID','PARTIAL_CANCELLED'].includes(providerStatus))return reply({error:'payment_not_paid',providerStatus},409);
    if(!['KRW','CURRENCY_KRW'].includes(currency))return reply({error:'currency_mismatch',currency},409);
    if(!Number.isFinite(providerAmount)||Math.round(providerAmount)!==Math.round(expected))return reply({error:'amount_mismatch',expectedAmount:expected,providerAmount},409);
    if(contract?.payable!==true&&contract?.status!=='paid')return reply({error:'resource_not_payable',status:contract?.status},409);
    const result=await rpc('gongsil_ingest_portone_verified_event_with_token',{p_settle_token:token,p_event_key:String(body.eventKey||eventKey(resourceType,resourceId,paymentId,'payment_paid')),p_resource_type:resourceType,p_event_type:'payment_paid',p_resource_id:resourceId,p_payment_id:paymentId,p_amount_krw:providerAmount,p_provider_status:'paid',p_payload:{provider:current}});
    return reply({ok:true,result});
  }catch(error){console.error('portone-verify',error);return reply({error:'server_verification_failed'},500)}
}

(async()=>{
  const B=window.academyBackend;if(!B)return;const state=await B.ready;if(!state?.user)return;
  const sb=B.client,user=state.user,profile=state.profile||{};
  const params=new URLSearchParams(location.search),sessionId=params.get('session');
  const summary=document.getElementById('checkoutSummary'),amountEl=document.getElementById('payAmount'),payButton=document.getElementById('payButton'),terms=document.getElementById('checkoutTerms'),statusEl=document.getElementById('paymentStatus'),liveConfirm=document.getElementById('liveChargeConfirm'),liveAck=document.getElementById('liveChargeAcknowledged');
  let widgets=null,course=null,session=null,amount=0,paymentReady=false,paymentMode='unconfigured',existingPendingOrder=null;
  const setStatus=(m,type='')=>{statusEl.textContent=m;statusEl.className='payment-status '+type};
  if(!sessionId){summary.innerHTML='<div class="empty">결제할 과정을 찾을 수 없습니다.</div>';setStatus('과정 목록에서 다시 선택해주세요.','error');return}
  const{data:s,error:se}=await sb.from('academy_sessions').select('id,course_id,price_override,status,starts_at,venue_name').eq('id',sessionId).maybeSingle();if(se||!s){summary.innerHTML='<div class="empty">세션 정보를 찾을 수 없습니다.</div>';return}session=s;
  const{data:c,error:ce}=await sb.from('academy_courses').select('id,title,subtitle,description,base_price,refund_policy,status').eq('id',s.course_id).maybeSingle();if(ce||!c){summary.innerHTML='<div class="empty">과정 정보를 찾을 수 없습니다.</div>';return}course=c;amount=Number(s.price_override??c.base_price??0);
  amountEl.textContent=amount.toLocaleString('ko-KR')+'원';
  const{data:existingEnrollment}=await sb.from('academy_enrollments').select('id,access_status').eq('user_id',user.id).eq('course_id',course.id).in('access_status',['ACTIVE','COMPLETED']).maybeSingle();
  if(existingEnrollment){setStatus('이미 수강권이 활성화된 과정입니다. 중복 결제할 수 없습니다.','ok');payButton.textContent='내 강의로 이동';payButton.disabled=false;payButton.addEventListener('click',()=>location.href='./course.html?id='+encodeURIComponent(course.id));return}
  const{data:pendingRows}=await sb.from('academy_orders').select('id,order_code,amount,status,expires_at').eq('user_id',user.id).eq('session_id',sessionId).eq('status','PENDING').order('created_at',{ascending:false}).limit(1);
  const candidate=pendingRows?.[0];if(candidate&&new Date(candidate.expires_at).getTime()>Date.now()&&Number(candidate.amount)===amount)existingPendingOrder=candidate;
  summary.innerHTML='<h2>'+course.title+'</h2><p>'+String(course.subtitle||course.description||'')+'</p><div class="purchase-summary"><div><span>과정 금액</span><strong>'+amount.toLocaleString('ko-KR')+'원</strong></div><div><span>제공 방식</span><b>'+String(session.venue_name||'온라인')+'</b></div><div><span>환불 기준</span><b>'+String(course.refund_policy||'결제 전 확인')+'</b></div></div>';
  if(amount<=0){payButton.textContent='무료 수강 시작';payButton.disabled=false;paymentReady=true;setStatus('무료 과정입니다. 결제 없이 수강을 활성화합니다.','ok');payButton.addEventListener('click',async()=>{if(!terms.checked){setStatus('과정 제공범위를 확인해주세요.','error');return}payButton.disabled=true;const{error}=await sb.rpc('academy_enroll_free',{p_session_id:sessionId});if(error){setStatus('수강 활성화에 실패했습니다.','error');payButton.disabled=false}else location.href='./course.html?id='+encodeURIComponent(course.id)});return}
  try{
    const res=await fetch('https://qjtgueuaoohopffatjsp.supabase.co/functions/v1/academy-payment-status',{cache:'no-store'});const cfg=await res.json();
    if(!cfg.ready||!cfg.clientKey){setStatus('토스페이먼츠 API 키가 아직 연결되지 않았습니다. 키 연결 후 즉시 결제가 활성화됩니다.','error');payButton.textContent='결제 설정 필요';return}
    let customerKeyState=null;const{data:ck}=await sb.from('academy_user_state').select('payload').eq('user_id',user.id).eq('state_key','toss_customer_key').maybeSingle();customerKeyState=ck?.payload?.value;
    if(!customerKeyState){customerKeyState='academy-'+crypto.randomUUID();await sb.from('academy_user_state').upsert({user_id:user.id,state_key:'toss_customer_key',payload:{value:customerKeyState}},{onConflict:'user_id,state_key'})}
    const tossPayments=TossPayments(cfg.clientKey);widgets=tossPayments.widgets({customerKey:customerKeyState});
    await widgets.setAmount({currency:'KRW',value:amount});
    await Promise.all([widgets.renderPaymentMethods({selector:'#payment-method',variantKey:'DEFAULT'}),widgets.renderAgreement({selector:'#agreement',variantKey:'AGREEMENT'})]);
    paymentMode=cfg.mode||'unconfigured';paymentReady=true;payButton.disabled=false;if(paymentMode==='live'){if(liveConfirm)liveConfirm.style.display='flex';payButton.textContent=amount.toLocaleString('ko-KR')+'원 실제 결제하기';setStatus('LIVE 결제 환경입니다. 결제를 완료하면 실제 금액이 승인됩니다.','error')}else{payButton.textContent=amount.toLocaleString('ko-KR')+'원 테스트 결제하기';setStatus('TEST 결제 환경입니다. 실제 금액은 청구되지 않습니다.','ok')}
  }catch(e){console.error(e);setStatus('결제 UI를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.','error')}
  payButton.addEventListener('click',async()=>{
    if(!paymentReady||!widgets)return;if(!terms.checked){setStatus('과정 제공범위와 환불기준을 확인해주세요.','error');return}if(paymentMode==='live'&&!liveAck?.checked){setStatus('실제 결제가 발생하는 LIVE 결제임을 확인해주세요.','error');return}
    payButton.disabled=true;
    try{
      let o=existingPendingOrder;if(!o){const{data:order,error}=await sb.rpc('academy_create_order',{p_session_id:sessionId,p_seats:1,p_accept_terms:true});if(error)throw error;o=Array.isArray(order)?order[0]:order;if(!o)throw new Error('주문 생성 실패')}await widgets.requestPayment({orderId:o.order_code,orderName:course.title,successUrl:new URL('./payment-success.html',location.href).href,failUrl:new URL('./payment-fail.html',location.href).href,customerEmail:user.email||undefined,customerName:profile.display_name||undefined});
    }catch(e){console.error(e);setStatus(e.message||'결제 요청을 시작하지 못했습니다.','error');payButton.disabled=false}
  });
})();
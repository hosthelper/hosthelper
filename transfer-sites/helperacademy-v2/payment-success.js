(async()=>{
  const B=window.academyBackend;if(!B)return;
  const state=await B.ready;if(!state?.user)return;

  const q=new URLSearchParams(location.search);
  const paymentKey=q.get('paymentKey');
  const orderId=q.get('orderId');
  const amount=Number(q.get('amount'));

  const title=document.getElementById('resultTitle');
  const text=document.getElementById('resultText');
  const meta=document.getElementById('resultMeta');
  const action=document.getElementById('resultAction');
  const retry=document.getElementById('retryConfirm');

  if(!paymentKey||!orderId||!Number.isInteger(amount)||amount<=0){
    title.textContent='결제 정보를 확인할 수 없습니다.';
    text.textContent='결제·수강권 페이지에서 주문 상태를 확인해주세요.';
    action.href='./payments.html';
    return;
  }

  const payload={paymentKey,orderId,amount};
  sessionStorage.setItem('academy_pending_confirm',JSON.stringify(payload));

  async function confirmPayment(){
    if(retry){retry.style.display='none';retry.disabled=true}
    title.textContent='결제를 확인하고 있습니다.';
    text.textContent='결제 승인 후 수강권을 자동으로 활성화합니다.';
    meta.textContent='';

    try{
      const{data,error}=await B.client.functions.invoke('academy-toss-confirm',{body:payload});
      if(error)throw error;
      if(!data?.ok)throw new Error(data?.message||'결제 승인 실패');

      const{data:order,error:orderError}=await B.client
        .from('academy_orders')
        .select('course_id,status,amount')
        .eq('order_code',orderId)
        .maybeSingle();
      if(orderError)throw orderError;
      if(!order||order.status!=='PAID')throw new Error('결제 상태 반영을 확인하지 못했습니다.');

      const{data:enrollment,error:enrollError}=await B.client
        .from('academy_enrollments')
        .select('id,access_status')
        .eq('user_id',state.user.id)
        .eq('course_id',order.course_id)
        .maybeSingle();
      if(enrollError)throw enrollError;
      if(!enrollment||!['ACTIVE','COMPLETED'].includes(enrollment.access_status)){
        throw new Error('결제는 승인되었지만 수강권 확인이 지연되고 있습니다.');
      }

      sessionStorage.removeItem('academy_pending_confirm');
      title.textContent='결제가 완료되었습니다.';
      text.textContent='수강권이 자동으로 활성화되었습니다.';
      meta.textContent='주문번호 '+orderId+' · '+amount.toLocaleString('ko-KR')+'원';
      action.textContent='바로 수강하기';
      action.className='btn block';
      action.href='./course.html?id='+encodeURIComponent(order.course_id);
    }catch(e){
      console.error(e);
      title.textContent='결제 승인 확인이 필요합니다.';
      text.textContent='중복 결제하지 마세요. 같은 결제 정보를 다시 확인할 수 있습니다.';
      meta.textContent=e?.message||'승인 확인 오류';
      if(retry){retry.style.display='block';retry.disabled=false}
      action.textContent='결제·수강권 상태 보기';
      action.className='btn secondary block';
      action.href='./payments.html';
    }
  }

  if(retry)retry.addEventListener('click',confirmPayment);
  await confirmPayment();
})();
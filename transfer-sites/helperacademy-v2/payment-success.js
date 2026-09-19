(async()=>{
  const B=window.academyBackend;if(!B)return;const state=await B.ready;if(!state?.user)return;
  const q=new URLSearchParams(location.search),paymentKey=q.get('paymentKey'),orderId=q.get('orderId'),amount=Number(q.get('amount'));
  const title=document.getElementById('resultTitle'),text=document.getElementById('resultText'),meta=document.getElementById('resultMeta'),action=document.getElementById('resultAction');
  if(!paymentKey||!orderId||!Number.isInteger(amount)||amount<=0){title.textContent='결제 정보를 확인할 수 없습니다.';text.textContent='내 강의에서 주문 상태를 다시 확인해주세요.';return}
  try{
    const{data,error}=await B.client.functions.invoke('academy-toss-confirm',{body:{paymentKey,orderId,amount}});if(error)throw error;if(!data?.ok)throw new Error(data?.message||'결제 승인 실패');
    const{data:order}=await B.client.from('academy_orders').select('course_id,status,amount').eq('order_code',orderId).maybeSingle();
    title.textContent='결제가 완료되었습니다.';text.textContent='수강권이 자동으로 활성화되었습니다.';meta.textContent='주문번호 '+orderId+' · '+amount.toLocaleString('ko-KR')+'원';
    if(order?.course_id)action.href='./course.html?id='+encodeURIComponent(order.course_id);
  }catch(e){console.error(e);title.textContent='결제 승인 확인이 필요합니다.';text.textContent='결제창 인증은 완료됐지만 최종 수강권 처리를 확인하지 못했습니다. 중복 결제하지 말고 내 강의에서 상태를 확인해주세요.';meta.textContent=e.message||'승인 확인 오류';action.href='./courses.html'}
})();
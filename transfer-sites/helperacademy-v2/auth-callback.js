(async()=>{
  const B=window.academyBackend;if(!B)return;
  const q=new URLSearchParams(location.search);
  const nextRaw=q.get('next')||'index.html';
  const next=/^[a-z0-9_-]+\.html$/i.test(nextRaw)?nextRaw:'index.html';
  const title=document.getElementById('callbackTitle'),text=document.getElementById('callbackText'),meta=document.getElementById('callbackMeta'),action=document.getElementById('callbackAction');
  const fail=(m)=>{title.textContent='로그인 연결을 완료하지 못했습니다.';text.textContent=m;meta.textContent='다시 로그인해주세요.';action.style.display='block'};
  try{
    const oauthError=q.get('error_description')||q.get('error');
    if(oauthError)throw new Error(oauthError);
    let {data:{session}}=await B.client.auth.getSession();
    const code=q.get('code');
    if(!session&&code){
      const {data,error}=await B.client.auth.exchangeCodeForSession(code);
      if(error)throw error;
      session=data.session;
    }
    if(!session){
      await new Promise(r=>setTimeout(r,250));
      const x=await B.client.auth.getSession();session=x.data.session;
    }
    if(!session?.user)throw new Error('로그인 세션을 확인할 수 없습니다.');
    const member=await B.ensureAcademyMember(session.user);
    if(!member)throw new Error('헬퍼아카데미 회원 등록을 확인하지 못했습니다.');
    title.textContent='로그인 완료';
    text.textContent='헬퍼아카데미 회원으로 확인되었습니다.';
    meta.textContent='회원번호 · '+(member.universe_member_id||'-');
    setTimeout(()=>location.replace('./'+next),350);
  }catch(e){console.error(e);fail(e.message||'OAuth 연결 오류가 발생했습니다.')}
})();
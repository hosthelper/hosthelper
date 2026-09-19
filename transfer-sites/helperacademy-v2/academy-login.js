(async()=>{
  const B=window.academyBackend;if(!B)return;
  const initial=await B.ready;
  const page=(location.pathname.split('/').pop()||'login.html').toLowerCase();
  const params=new URLSearchParams(location.search);
  const nextRaw=params.get('next')||'index.html';
  const next=/^[a-z0-9_-]+\.html$/i.test(nextRaw)?nextRaw:'index.html';
  const msg=document.querySelector('.auth-message');
  const show=(t,type='error')=>{if(!msg)return;msg.textContent=t;msg.className='auth-message show '+type};

  if(params.get('blocked')==='1')show('이 계정은 헬퍼아카데미 이용이 제한되어 있습니다.');
  if(initial.user){location.replace('./'+next);return}

  const providerStatus=document.querySelector('[data-provider-status]');
  const socialConsent=document.querySelector('[data-social-consent]');
  const socialButtons=[...document.querySelectorAll('[data-oauth]')];

  try{
    const r=await fetch('https://qjtgueuaoohopffatjsp.supabase.co/functions/v1/academy-auth-status',{cache:'no-store'});
    const status=await r.json();
    let enabled=[];
    for(const btn of socialButtons){
      const provider=btn.dataset.oauth;
      const ok=Boolean(status?.[provider]);
      btn.disabled=!ok;
      if(ok)enabled.push(provider==='google'?'Google':provider==='kakao'?'Kakao':'Apple');
      else if(provider==='apple')btn.querySelector('span:last-child').textContent=(page==='signup.html'?'Apple 가입 (설정 필요)':'Apple 로그인 (설정 필요)');
    }
    if(providerStatus)providerStatus.textContent=enabled.length?enabled.join(' · ')+' 사용 가능':'간편로그인 Provider 설정이 필요합니다.';
  }catch(e){
    if(providerStatus)providerStatus.textContent='간편로그인 상태를 확인하지 못했습니다. 이메일 로그인을 이용해주세요.';
  }

  socialButtons.forEach(btn=>btn.addEventListener('click',async()=>{
    if(btn.disabled)return;
    if(!socialConsent?.checked){show('간편 로그인/가입을 계속하려면 계정 생성 및 학습정보 저장에 동의해주세요.');return}
    const provider=btn.dataset.oauth;
    btn.disabled=true;
    try{
      const callback=new URL('./auth-callback.html',location.href);
      callback.searchParams.set('next',next);
      const {error}=await B.client.auth.signInWithOAuth({provider,options:{redirectTo:callback.href}});
      if(error)throw error;
    }catch(err){
      show(err.message||'간편 로그인 연결 중 오류가 발생했습니다.');
      btn.disabled=false;
    }
  }));

  const form=document.querySelector('form');
  if(!form)return;
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(!form.reportValidity())return;
    const d=Object.fromEntries(new FormData(form).entries()),submit=form.querySelector('button[type="submit"]');submit.disabled=true;
    try{
      if(page==='login.html'){
        const{data,error}=await B.client.auth.signInWithPassword({email:d.email,password:d.password});
        if(error)throw error;if(!data.user)throw new Error('로그인 정보를 확인해주세요.');
        await B.ensureAcademyMember(data.user);
        location.replace('./'+next);
      }else{
        if(d.password!==d.password_confirm)throw new Error('비밀번호가 서로 다릅니다.');
        const{data,error}=await B.client.auth.signUp({email:d.email,password:d.password,options:{data:{name:d.name,display_name:d.name,academy_source:true}}});
        if(error)throw error;
        if(data.session){
          await B.ensureAcademyMember(data.user);
          location.replace('./index.html');
        }else{
          show('회원가입이 접수되었습니다. 이메일 인증이 필요한 경우 인증 후 로그인해주세요.','ok');
          form.reset();
        }
      }
    }catch(err){show(err.message||'처리 중 오류가 발생했습니다.')}finally{submit.disabled=false}
  });
})();
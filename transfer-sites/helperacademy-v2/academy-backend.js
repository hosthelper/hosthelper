(() => {
  const SUPABASE_URL='https://qjtgueuaoohopffatjsp.supabase.co';
  const SUPABASE_KEY='sb_publishable_Vtcm_EkCSeAFGBqbm9caPg_TT0NR5Yb';
  if(!window.supabase?.createClient){console.error('Supabase client failed to load');return}
  const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const publicPages=new Set(['login.html','signup.html','auth-callback.html','payment-fail.html']);

  async function getUser(){const {data,error}=await client.auth.getUser();return error?null:(data.user||null)}
  async function loadProfile(user){if(!user)return null;const {data}=await client.from('profiles').select('id,display_name,universe_member_id,role,signup_provider').eq('id',user.id).maybeSingle();return data||null}
  async function ensureAcademyMember(user){
    if(!user)return null;
    const {data,error}=await client.rpc('academy_touch_member');
    if(error){console.error('academy_touch_member',error);return null}
    return Array.isArray(data)?(data[0]||null):data;
  }
  function providerLabel(v){return({google:'Google',kakao:'Kakao',apple:'Apple',email:'Email'}[String(v||'').toLowerCase()]||String(v||'Email'))}
  function renderMember(member,user){
    const map={
      '[data-member-code]':member?.universe_member_id||'-',
      '[data-member-provider]':providerLabel(member?.signup_provider||user?.app_metadata?.provider||'email'),
      '[data-member-status]':member?.service_status==='active'?'정회원':member?.service_status||'-',
      '[data-member-joined]':member?.first_seen_at?new Date(member.first_seen_at).toLocaleString('ko-KR'):'-',
      '[data-member-last]':member?.last_seen_at?new Date(member.last_seen_at).toLocaleString('ko-KR'):'-',
      '[data-member-email]':user?.email||'이메일 미제공'
    };
    Object.entries(map).forEach(([sel,val])=>document.querySelectorAll(sel).forEach(el=>el.textContent=val));
  }
  function renderUser(profile,user){
    const el=document.querySelector('.profile');
    if(el){
      const label=String(profile?.display_name||user?.user_metadata?.name||user?.user_metadata?.full_name||user?.user_metadata?.nickname||user?.email?.split('@')[0]||'회원');
      el.replaceChildren();const av=document.createElement('span');av.className='avatar';av.textContent=label.slice(0,1).toUpperCase();const name=document.createElement('span');name.textContent=label;el.append(av,name);if(el.tagName==='A')el.href='./profile.html';
    }
    const top=document.querySelector('.topin,.top-inner');
    if(top&&profile?.role==='admin'&&!document.querySelector('[data-admin-members]')){const a=document.createElement('a');a.href='./admin-members.html';a.className='pill';a.dataset.adminMembers='1';a.textContent='회원관리';top.appendChild(a)}
    if(top&&!document.querySelector('[data-logout]')){const logout=document.createElement('button');logout.type='button';logout.className='logout-btn';logout.dataset.logout='1';logout.textContent='로그아웃';logout.addEventListener('click',async()=>{await client.auth.signOut();location.replace('./login.html')});top.appendChild(logout)}
  }

  const ready=(async()=>{
    const user=await getUser();
    if(!publicPages.has(page)&&!user){
      const next=/^[a-z0-9_-]+\.html$/i.test(page)?page:'index.html';
      location.replace('./login.html?next='+encodeURIComponent(next));
      return{user:null,profile:null,member:null};
    }
    const member=user?await ensureAcademyMember(user):null;
    const profile=user?await loadProfile(user):null;
    if(user&&member?.service_status==='blocked'){
      await client.auth.signOut();
      location.replace('./login.html?blocked=1');
      return{user:null,profile:null,member:null};
    }
    if(user&&!publicPages.has(page))renderUser(profile,user);
    if(user)renderMember(member,user);
    return{user,profile,member};
  })();

  window.academyBackend={client,ready,getUser,loadProfile,ensureAcademyMember,renderMember,providerLabel};
})();
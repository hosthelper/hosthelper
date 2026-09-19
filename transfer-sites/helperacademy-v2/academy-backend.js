
(() => {
  const SUPABASE_URL='https://buzcnfnimzlsjvbeefjb.supabase.co';
  const SUPABASE_KEY='sb_publishable_poZ_J1y0WsUNJMkEtgBE_g_OAjTgvqo';
  if(!window.supabase?.createClient){console.error('Supabase client failed to load');return}
  const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const publicPages=new Set(['login.html','signup.html']);
  async function getUser(){const {data,error}=await client.auth.getUser();return error?null:(data.user||null)}
  async function loadHubProfile(user){if(!user)return null;const {data}=await client.from('hu_profiles').select('user_id,helper_id,display_name,current_stage').eq('user_id',user.id).maybeSingle();return data||null}
  function renderUser(profile,user){
    const el=document.querySelector('.profile');if(!el)return;
    const label=String(profile?.display_name||user?.user_metadata?.display_name||user?.email?.split('@')[0]||'회원');
    el.replaceChildren();const av=document.createElement('span');av.className='avatar';av.textContent=label.slice(0,1).toUpperCase();const name=document.createElement('span');name.textContent=label;el.append(av,name);if(el.tagName==='A')el.href='./profile.html';
    const top=document.querySelector('.topin,.top-inner');if(top&&!document.querySelector('[data-logout]')){const logout=document.createElement('button');logout.type='button';logout.className='logout-btn';logout.dataset.logout='1';logout.textContent='로그아웃';logout.addEventListener('click',async()=>{await client.auth.signOut();location.replace('./login.html')});top.appendChild(logout)}
  }
  const ready=(async()=>{const user=await getUser();if(!publicPages.has(page)&&!user){const next=/^[a-z0-9_-]+\.html$/i.test(page)?page:'index.html';location.replace('./login.html?next='+encodeURIComponent(next));return{user:null,profile:null}}const profile=user?await loadHubProfile(user):null;if(user&&!publicPages.has(page))renderUser(profile,user);return{user,profile}})();
  window.academyBackend={client,ready,getUser,loadHubProfile};
})();

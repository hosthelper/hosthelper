(async()=>{
  const B=window.academyBackend;if(!B)return;
  const state=await B.ready;if(!state?.user)return;
  if(state.profile?.role!=='admin'){location.replace('./index.html');return}
  const root=document.getElementById('memberDirectory'),search=document.getElementById('memberSearch');
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label=v=>B.providerLabel(v);
  const {data,error}=await B.client.rpc('academy_admin_member_directory');
  if(error){root.innerHTML='<div class="empty">회원 목록을 불러오지 못했습니다.</div>';console.error(error);return}
  const rows=Array.isArray(data)?data:[];
  const stats=document.querySelectorAll('#memberStats strong');
  if(stats[0])stats[0].textContent=rows.length;
  if(stats[1])stats[1].textContent=rows.filter(x=>x.member_status==='active').length;
  if(stats[2])stats[2].textContent=rows.filter(x=>x.signup_provider==='google').length;
  if(stats[3])stats[3].textContent=rows.filter(x=>x.signup_provider==='kakao').length;
  function render(list){
    root.innerHTML=list.length?list.map(x=>'<div class="member-row"><div class="member-main"><b>'+esc(x.display_name||'이름 없음')+'</b><small>'+esc(x.email||'이메일 미제공')+'</small></div><div><span class="tag">'+esc(label(x.signup_provider))+'</span></div><div><b>'+esc(x.universe_member_id||'-')+'</b><small>회원번호</small></div><div><b>'+esc(x.member_status||'-')+'</b><small>'+new Date(x.first_seen_at).toLocaleDateString('ko-KR')+' 가입 · '+new Date(x.last_seen_at).toLocaleString('ko-KR')+' 최근</small></div></div>').join(''):'<div class="empty">조건에 맞는 회원이 없습니다.</div>';
  }
  render(rows);
  search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();render(!q?rows:rows.filter(x=>[x.display_name,x.email,x.universe_member_id,x.signup_provider].some(v=>String(v||'').toLowerCase().includes(q))))});
})();
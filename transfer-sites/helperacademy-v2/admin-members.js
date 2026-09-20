(async()=>{
  const B=window.academyBackend;if(!B)return;
  const state=await B.ready;if(!state?.user)return;
  if(state.profile?.role!=='admin'){location.replace('./index.html');return}

  const root=document.getElementById('memberDirectory');
  const search=document.getElementById('memberSearch');
  const toast=document.querySelector('.toast');
  let toastTimer;
  const say=m=>{if(!toast)return;toast.textContent=m;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2200)};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const label=v=>B.providerLabel(v);
  const fmt=v=>v?new Date(v).toLocaleString('ko-KR'):'-';

  const {data,error}=await B.client.rpc('academy_admin_member_directory');
  if(error){root.innerHTML='<div class="empty">회원 목록을 불러오지 못했습니다.</div>';console.error(error);return}
  const rows=Array.isArray(data)?data:[];

  const stats=document.querySelectorAll('#memberStats strong');
  if(stats[0])stats[0].textContent=rows.length;
  if(stats[1])stats[1].textContent=rows.filter(x=>x.member_status==='active').length;
  if(stats[2])stats[2].textContent=rows.filter(x=>Number(x.paid_orders||0)>0).length;
  if(stats[3])stats[3].textContent=rows.filter(x=>Number(x.active_enrollments||0)>0).length;

  function rowHtml(x){
    const blocked=x.member_status==='blocked';
    const self=x.user_id===state.user.id;
    const action=self
      ? '<span class="tag gray">관리자 본인</span>'
      : '<button class="btn secondary" data-member-action="'+esc(x.user_id)+'" data-next-status="'+(blocked?'active':'blocked')+'">'+(blocked?'활성화':'차단')+'</button>';
    return '<div class="member-row" data-user-id="'+esc(x.user_id)+'">'
      +'<div class="member-main"><b>'+esc(x.display_name||'이름 없음')+'</b><small>'+esc(x.email||'이메일 미제공')+'</small><small>'+esc(x.universe_member_id||'-')+'</small></div>'
      +'<div><span class="tag '+(blocked?'gray':'')+'">'+esc(x.member_status||'-')+'</span><small>'+esc(label(x.signup_provider))+'</small></div>'
      +'<div><b>'+Number(x.paid_orders||0)+'건 결제</b><small>최근 '+esc(fmt(x.last_payment_at))+'</small></div>'
      +'<div><b>'+Number(x.active_enrollments||0)+'개 수강</b><small>평균 진도 '+Number(x.average_progress||0)+'%</small></div>'
      +'<div><b>'+esc(fmt(x.first_seen_at))+'</b><small>가입 · 최근 '+esc(fmt(x.last_seen_at))+'</small></div>'
      +'<div>'+action+'</div>'
      +'</div>';
  }

  function render(list){
    root.innerHTML=list.length?list.map(rowHtml).join(''):'<div class="empty">조건에 맞는 회원이 없습니다.</div>';
  }
  render(rows);

  function filteredRows(){
    const q=search.value.trim().toLowerCase();
    return !q?rows:rows.filter(x=>[
      x.display_name,x.email,x.universe_member_id,x.signup_provider,x.member_status
    ].some(v=>String(v||'').toLowerCase().includes(q)));
  }

  search.addEventListener('input',()=>render(filteredRows()));

  root.addEventListener('click',async e=>{
    const btn=e.target.closest('[data-member-action]');
    if(!btn)return;
    const userId=btn.dataset.memberAction;
    const nextStatus=btn.dataset.nextStatus;
    const row=rows.find(x=>x.user_id===userId);
    if(!row)return;

    btn.disabled=true;
    try{
      const{error}=await B.client.rpc('academy_admin_set_member_status',{p_user_id:userId,p_status:nextStatus});
      if(error)throw error;
      row.member_status=nextStatus;
      say(nextStatus==='blocked'?'아카데미 이용을 차단했습니다.':'아카데미 이용을 활성화했습니다.');
      if(stats[1])stats[1].textContent=rows.filter(x=>x.member_status==='active').length;
      render(filteredRows());
    }catch(err){
      console.error(err);
      say('상태 변경에 실패했습니다.');
      btn.disabled=false;
    }
  });
})();
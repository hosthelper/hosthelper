(async()=>{
  const B=window.academyBackend;if(!B)return;const state=await B.ready;if(!state?.user)return;
  const sb=B.client,user=state.user,page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const toast=document.querySelector('.toast,#toast');let timer;
  const say=m=>{if(!toast)return;toast.textContent=m;toast.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>toast.classList.remove('show'),2600)};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const formObject=f=>Object.fromEntries(new FormData(f).entries());

  async function saveState(key,payload){
    const {error}=await sb.from('academy_user_state').upsert({user_id:user.id,state_key:key,payload,updated_at:new Date().toISOString()},{onConflict:'user_id,state_key'});
    if(error)throw error;
  }
  async function getState(key){const{data}=await sb.from('academy_user_state').select('payload').eq('user_id',user.id).eq('state_key',key).maybeSingle();return data?.payload||null}
  async function saveTask(key,title,done=true,extra={}){await saveState('task:'+key,{title,done,...extra,updatedAt:new Date().toISOString()})}
  async function saveNote(kind,key,title,content,metadata={}){await saveState(kind+':'+key,{title,content,metadata,status:'submitted',updatedAt:new Date().toISOString()})}

  document.querySelectorAll('[data-check]').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;try{await saveTask(btn.dataset.check,btn.closest('.card,.item')?.querySelector('h3,b')?.textContent||btn.dataset.check,true);btn.textContent='완료됨 ✓';btn.classList.add('ghost');say('완료 상태를 계정에 저장했습니다.')}catch(e){say('저장 중 오류가 발생했습니다.');console.error(e)}finally{btn.disabled=false}
  }));

  document.querySelectorAll('[data-event]').forEach(btn=>btn.addEventListener('click',async()=>{
    btn.disabled=true;try{const title=btn.closest('.card')?.querySelector('h2,h3')?.textContent||'아카데미 이벤트';await saveNote('event','event-'+btn.dataset.event,title,'참석 신청',{eventKey:btn.dataset.event});btn.textContent='신청 완료 ✓';say('이벤트 신청을 저장했습니다.')}catch(e){say('신청 저장 중 오류가 발생했습니다.')}finally{btn.disabled=false}
  }));

  document.querySelectorAll('[data-save]').forEach(btn=>btn.addEventListener('click',async()=>{
    const form=btn.closest('form');if(form&&!form.reportValidity())return;const d=form?formObject(form):{};btn.disabled=true;
    try{
      switch(btn.dataset.save){
        case'profile':
          await sb.from('profiles').update({display_name:d.name||null,updated_at:new Date().toISOString()}).eq('id',user.id);
          await saveState('profile',{region:d.region||null,timeline:d.timeline||null,budget:d.budget||null});break;
        case'settings':await saveState('settings',d);break;
        case'mission_evidence':await saveTask('evidence-'+String(d.mission||'mission').replace(/\s+/g,'-'),d.mission||'실행 인증',true,{evidence:d.evidence||null,proof:d.proof||null});break;
        case'mentor_question':await saveNote('mentor','latest',d.question||'멘토링 질문',d.tried||'',{stage:d.stage||null,question:d.question||null});break;
        case'community_post':{
          const{error}=await sb.from('academy_community_posts').insert({user_id:user.id,category:d.category||'질문',title:d.title||'제목 없음',content:d.content||''});if(error)throw error;await loadCommunity();if(form)form.reset();break;
        }
        case'profit_action':await saveNote('profit','profit-'+Date.now(),d.type||'수익 행동',d.result||'',{amount:Number(d.amount||0),type:d.type||null});break;
      }
      say(btn.dataset.message||'계정에 저장했습니다.');
    }catch(e){say('저장 중 오류가 발생했습니다.');console.error(e)}finally{btn.disabled=false}
  }));

  const ai=document.querySelector('[data-ai-form]');
  if(ai)ai.addEventListener('submit',async e=>{
    e.preventDefault();const q=String(new FormData(ai).get('question')||'');let a='먼저 현재 단계와 이번 주 실행 목표를 하나로 줄여보세요.';
    if(q.includes('매물'))a='매물은 지역·예산·허용업종·예상 매출 순으로 조건을 좁히고, 공실헬퍼에서 실제 후보를 비교하세요.';
    else if(q.includes('수익')||q.includes('매출'))a='월매출보다 고정비·변동비·공실률을 먼저 넣어 손익분기점을 계산한 뒤 판단하세요.';
    else if(q.includes('세팅'))a='오픈 필수품과 매출에 직접 영향을 주는 항목부터 세팅하고 장식 요소는 뒤로 미루세요.';
    else if(q.includes('운영'))a='예약→체크인→청소→CS→리뷰 흐름을 체크리스트로 만들고 반복 업무부터 자동화하세요.';
    const out=document.querySelector('[data-ai-answer]');if(out)out.textContent=a;await saveNote('ai','ai-'+Date.now(),'AI 학습 질문',q,{answer:a}).catch(console.error);
  });

  async function loadTaskStates(){
    const{data}=await sb.from('academy_user_state').select('state_key,payload').eq('user_id',user.id).like('state_key','task:%');
    const done=new Set((data||[]).filter(x=>x.payload?.done).map(x=>x.state_key.slice(5)));
    document.querySelectorAll('[data-check]').forEach(btn=>{if(done.has(btn.dataset.check)){btn.textContent='완료됨 ✓';btn.classList.add('ghost')}})
  }

  async function loadProfile(){
    if(page!=='profile.html'&&page!=='settings.html')return;
    const[{data:profile},saved]=await Promise.all([sb.from('profiles').select('display_name,universe_member_id').eq('id',user.id).maybeSingle(),getState(page==='profile.html'?'profile':'settings')]);
    const form=document.querySelector('.form');if(!form)return;
    if(page==='profile.html'){if(form.elements.name)form.elements.name.value=profile?.display_name||'';if(form.elements.region)form.elements.region.value=saved?.region||'';if(form.elements.timeline&&saved?.timeline)form.elements.timeline.value=saved.timeline;if(form.elements.budget)form.elements.budget.value=saved?.budget||''}
    else if(saved){for(const[k,v]of Object.entries(saved))if(form.elements[k])form.elements[k].value=v}
  }

  async function loadCourses(){
    const root=document.getElementById('dbCourseCatalog');if(!root)return;
    const[{data:courses,error:ce},{data:sessions},{data:enrollments}]=await Promise.all([
      sb.from('academy_courses').select('id,slug,title,subtitle,description,category,base_price,curriculum,status').eq('status','PUBLISHED').order('base_price'),
      sb.from('academy_sessions').select('id,course_id,price_override,status').eq('status','SCHEDULED'),
      sb.from('academy_enrollments').select('id,course_id,session_id,access_status,progress_percent').eq('user_id',user.id)
    ]);
    if(ce){root.innerHTML='<article class="card"><p>과정을 불러오지 못했습니다.</p></article>';return}
    const sm=new Map((sessions||[]).map(s=>[s.course_id,s])), em=new Map((enrollments||[]).map(e=>[e.course_id,e]));
    root.innerHTML=(courses||[]).map(c=>{
      const s=sm.get(c.id),e=em.get(c.id),price=Number(s?.price_override??c.base_price??0),steps=Array.isArray(c.curriculum)?c.curriculum.length:0;
      let action='<div class="empty" style="margin-top:12px">현재 신청 가능한 세션이 없습니다.</div>';
      if(e)action='<a class="btn block" href="./course.html?id='+encodeURIComponent(c.id)+'">'+(e.access_status==='COMPLETED'?'복습하기':'수강하기 · '+e.progress_percent+'%')+'</a>';
      else if(s&&price===0)action='<button class="btn block" data-free-session="'+esc(s.id)+'">무료 수강 시작</button>';
      else if(s)action='<a class="btn block" href="./checkout.html?session='+encodeURIComponent(s.id)+'">'+price.toLocaleString('ko-KR')+'원 결제 후 수강</a>';
      return '<article class="card"><span class="tag '+(price?'blue':'')+'">'+esc(c.category)+'</span><h2 style="margin-top:8px">'+esc(c.title)+'</h2><p>'+esc(c.subtitle||c.description||'')+'</p><div class="course-price">'+price.toLocaleString('ko-KR')+'원</div><div class="meta"><span class="tag gray">'+steps+'단계</span><span class="tag gray">'+(e?esc(e.access_status):'미수강')+'</span></div>'+action+'</article>';
    }).join('');
    root.querySelectorAll('[data-free-session]').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;try{const{error}=await sb.rpc('academy_enroll_free',{p_session_id:btn.dataset.freeSession});if(error)throw error;say('무료 수강이 활성화되었습니다.');await loadCourses()}catch(e){say('무료 수강 신청에 실패했습니다.');console.error(e)}finally{btn.disabled=false}}));
  }

  async function loadCourseDetail(){
    if(page!=='course.html')return;const root=document.getElementById('courseDetail'),id=new URLSearchParams(location.search).get('id');
    if(!id){root.innerHTML='<div class="empty">과정을 찾을 수 없습니다.</div>';return}
    const[{data:course},{data:enrollment},{data:session}]=await Promise.all([
      sb.from('academy_courses').select('*').eq('id',id).maybeSingle(),
      sb.from('academy_enrollments').select('*').eq('user_id',user.id).eq('course_id',id).maybeSingle(),
      sb.from('academy_sessions').select('id,price_override,status').eq('course_id',id).eq('status','SCHEDULED').limit(1).maybeSingle()
    ]);
    if(!course){root.innerHTML='<div class="empty">과정을 찾을 수 없습니다.</div>';return}
    const steps=Array.isArray(course.curriculum)?course.curriculum:[],price=Number(session?.price_override??course.base_price??0);
    if(!enrollment){
      const cta=session?(price===0?'<button class="btn block" id="detailFree">무료 수강 시작</button>':'<a class="btn block" href="./checkout.html?session='+encodeURIComponent(session.id)+'">'+price.toLocaleString('ko-KR')+'원 결제하고 시작</a>'):'';
      root.innerHTML='<section class="card"><span class="tag">'+esc(course.category)+'</span><h2 style="margin-top:8px">'+esc(course.title)+'</h2><p>'+esc(course.description||'')+'</p><div class="course-price">'+price.toLocaleString('ko-KR')+'원</div>'+cta+'</section><section class="card" style="margin-top:12px"><h2>커리큘럼</h2><div class="list">'+steps.map((x,i)=>'<div class="item"><span class="num">'+(i+1)+'</span><div class="grow"><b>'+esc(x.title||('단계 '+(i+1)))+'</b><small>수강 활성화 후 진행상태 저장</small></div></div>').join('')+'</div></section>';
      const f=root.querySelector('#detailFree');if(f)f.addEventListener('click',async()=>{f.disabled=true;const{error}=await sb.rpc('academy_enroll_free',{p_session_id:session.id});if(error){say('무료 수강 신청에 실패했습니다.');f.disabled=false}else location.reload()});
      return;
    }
    root.innerHTML='<section class="card"><span class="tag">'+esc(course.category)+'</span><h2 style="margin-top:8px">'+esc(course.title)+'</h2><p>'+esc(course.description||'')+'</p><div class="progress"><b style="width:'+enrollment.progress_percent+'%"></b></div><div class="meta"><span class="tag gray">진도 '+enrollment.progress_percent+'%</span><span class="tag gray">'+esc(enrollment.access_status)+'</span></div></section><section class="card" style="margin-top:12px"><h2>커리큘럼</h2><div class="list">'+steps.map((x,i)=>{const target=Math.round((i+1)/Math.max(steps.length,1)*100),done=enrollment.progress_percent>=target;return '<div class="item '+(done?'done':'')+'"><span class="num">'+(i+1)+'</span><div class="grow"><b>'+esc(x.title||('단계 '+(i+1)))+'</b><small>'+(done?'완료':'이 단계 완료 후 진도 저장')+'</small></div><button class="btn secondary" data-progress="'+target+'" '+(done?'disabled':'')+'>'+(done?'완료됨 ✓':'완료')+'</button></div>'}).join('')+'</div></section>';
    root.querySelectorAll('[data-progress]').forEach(btn=>btn.addEventListener('click',async()=>{btn.disabled=true;const{error}=await sb.rpc('academy_set_progress',{p_enrollment_id:enrollment.id,p_progress:Number(btn.dataset.progress)});if(error){say('진도 저장에 실패했습니다.');btn.disabled=false}else location.reload()}));
  }

  async function loadCommunity(){
    const root=document.getElementById('communityList');if(!root)return;
    const{data,error}=await sb.from('academy_community_posts').select('id,category,title,content,created_at').eq('status','PUBLISHED').order('created_at',{ascending:false}).limit(20);
    if(error){root.innerHTML='<div class="empty">게시글을 불러오지 못했습니다.</div>';return}
    root.innerHTML=(data||[]).length?(data||[]).map(p=>'<div class="item"><span class="num">'+esc(p.category.slice(0,1))+'</span><div class="grow"><b>'+esc(p.title)+'</b><small>'+esc(p.category)+' · '+new Date(p.created_at).toLocaleDateString('ko-KR')+'</small><p style="margin-top:5px">'+esc(p.content)+'</p></div></div>').join(''):'<div class="empty">첫 글을 작성해보세요.</div>';
  }

  async function loadReport(){
    const[{data:states},{data:enroll},profileState]=await Promise.all([
      sb.from('academy_user_state').select('state_key,payload').eq('user_id',user.id),
      sb.from('academy_enrollments').select('id,progress_percent,access_status').eq('user_id',user.id),
      getState('profile')
    ]);
    const doneTasks=(states||[]).filter(x=>x.state_key.startsWith('task:')&&x.payload?.done).length;
    const active=(enroll||[]).filter(x=>x.access_status==='ACTIVE'||x.access_status==='COMPLETED').length;
    const progressAvg=active?Math.round((enroll||[]).reduce((a,b)=>a+Number(b.progress_percent||0),0)/active):0;
    const coreDone=(states||[]).filter(x=>x.payload?.done&&['task:mission-1','task:mission-2','task:mission-3'].includes(x.state_key)).length;
    const profileComplete=Boolean(profileState?.region&&profileState?.timeline&&profileState?.budget);
    const readiness=Math.min(100,coreDone*25+(profileComplete?25:0));
    if(page==='report.html'){const v=document.querySelectorAll('.g4 .stat strong');if(v[0])v[0].textContent=progressAvg+'%';if(v[1])v[1].textContent=doneTasks+'개';if(v[2])v[2].textContent=active+'개';if(v[3])v[3].textContent=readiness+'%'}
    if(page==='index.html'){const v=document.querySelectorAll('.stats-row strong');if(v[0])v[0].textContent=progressAvg+'%';if(v[1])v[1].textContent=active+'개';if(v[2])v[2].textContent=doneTasks+'개';if(v[3])v[3].textContent=readiness+'%'}
  }

  if(page==='index.html'){
    const go=document.getElementById('goPayment');
    if(go)go.addEventListener('click',async e=>{if(go.disabled)return;e.preventDefault();e.stopImmediatePropagation();const{data:c}=await sb.from('academy_courses').select('id').eq('slug','host-opening-basic').eq('status','PUBLISHED').maybeSingle();if(!c){say('10만원 과정을 찾지 못했습니다.');return}const{data:s}=await sb.from('academy_sessions').select('id').eq('course_id',c.id).eq('status','SCHEDULED').limit(1).maybeSingle();if(!s){say('결제 가능한 세션이 없습니다.');return}location.href='./checkout.html?session='+encodeURIComponent(s.id)},true);
  }

  await Promise.all([loadTaskStates(),loadProfile(),loadCourses(),loadCourseDetail(),loadCommunity(),loadReport()]);
})();
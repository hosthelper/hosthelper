import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const SUPABASE_URL='https://buzcnfnimzlsjvbeefjb.supabase.co';
const SUPABASE_KEY='sb_publishable_poZ_J1y0WsUNJMkEtgBE_g_OAjTgvqo';
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const root=$('#appRoot'), modal=$('#modal'), modalBody=$('#modalBody');
const DOCS=[['business_registration','외국인관광 도시민박업 사업자등록증'],['lease_contract','임대차계약서'],['landlord_consent','임대인 동의서'],['resident_register','전입세대 열람원']];
const state={user:null,candidates:[],saved:[],registerType:'takeover',pending:null};
const HELPER_UNIVERSE_AUTH_URL='https://pds-ai-company-zv30ms.v2.appdeploy.ai';
const HU_SERVICE_TOKEN_KEY='gongsil.helper-universe-session';
function cleanSsoParams(){
  const url=new URL(location.href);
  ['hu_sso','hu_sso_code','hu_sso_service','code','state','error','error_description'].forEach(k=>url.searchParams.delete(k));
  history.replaceState({},'',url.pathname+url.search+url.hash);
}
async function startUnifiedLogin(){
  const redirectTo='https://gongsil-helper.netlify.app/';
  const{data,error}=await supabase.auth.signInWithOAuth({
    provider:'kakao',
    options:{redirectTo}
  });
  if(error)throw error;
  if(!data?.url)throw new Error('카카오 로그인 주소를 만들지 못했습니다.');
}
async function completeUnifiedLogin(){
  const params=new URLSearchParams(location.search);
  const legacyCode=String(params.get('hu_sso_code')||'').trim();
  if(!legacyCode)return null;
  if(!/^[a-f0-9]{32}$/i.test(legacyCode)){cleanSsoParams();return null}
  const res=await fetch(HELPER_UNIVERSE_AUTH_URL+'/api/universe/auth/exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:legacyCode})});
  const exchange=await res.json().catch(()=>({}));
  if(!res.ok||!exchange?.kakaoIdToken)return null;
  const{data,error}=await supabase.auth.signInWithIdToken({provider:'kakao',token:exchange.kakaoIdToken});
  if(error||!data?.session)return null;
  cleanSsoParams();
  return data.session;
}
async function unifiedLogout(){
  const token=localStorage.getItem(HU_SERVICE_TOKEN_KEY)||'';
  localStorage.removeItem(HU_SERVICE_TOKEN_KEY);
  if(token)await fetch(HELPER_UNIVERSE_AUTH_URL+'/api/universe/external/logout',{method:'POST',headers:{Authorization:'Bearer '+token}}).catch(()=>undefined);
  await supabase.auth.signOut();
}
const money=v=>{const n=Number(v||0);if(!n)return '문의';if(n>=100000000){const e=n/100000000;return `${Number.isInteger(e)?e:e.toFixed(1)}억원`}return `${Math.round(n/10000).toLocaleString('ko-KR')}만원`};
const num=v=>Number(String(v||'').replace(/[^0-9.]/g,''))||0;
const won=v=>{const t=String(v||'').replace(/,/g,'');const m=t.match(/[0-9]+(?:\.[0-9]+)?/);if(!m)return 0;const n=Number(m[0]);if(t.includes('억'))return Math.round(n*1e8);if(t.includes('만'))return Math.round(n*1e4);return n>=100000?Math.round(n):Math.round(n*1e4)};
const months=v=>{const t=String(v||'');const y=Number((t.match(/([0-9]+)\s*년/)||[,0])[1]);const m=Number((t.match(/([0-9]+)\s*개월/)||[,0])[1]);return y*12+m||num(t)};
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2800)}
function openModal(html){modalBody.innerHTML=html;modal.classList.add('open');modal.setAttribute('aria-hidden','false')}
function closeModal(){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');modalBody.innerHTML=''}
$('#modalClose').onclick=closeModal;modal.onclick=e=>{if(e.target===modal)closeModal()};
function publicImage(path){return supabase.storage.from('gongsil-public-property-images').getPublicUrl(path).data.publicUrl}
function go(hash){if(location.hash===hash){route()}else location.hash=hash}
function routeName(){const raw=(location.hash||'#home').slice(1);const [name,id]=raw.split('/');return{name:name||'home',id:id||null}}
function page(title,kicker,body,actions=''){return `<section class="route-page"><div class="route-head"><div><span class="section-kicker">${kicker}</span><h1>${title}</h1></div>${actions}</div>${body}</section>`}
function skeleton(label='불러오는 중'){root.innerHTML=`<section class="route-loading"><div class="route-spinner"></div><p>${label}</p></section>`}
function bindNav(){
  $('#authBtn').onclick=()=>state.user?go('#account'):(state.pending={type:'route',hash:'#account'},openLogin());
  $('#mobileAuthBtn').onclick=()=>state.user?go('#account'):(state.pending={type:'route',hash:'#account'},openLogin());
  $('#mobileMenuBtn').onclick=()=>$('#mobileNav').classList.toggle('open');
  $$('#mobileNav a').forEach(a=>a.onclick=()=>$('#mobileNav').classList.remove('open'));
  $$('[data-legal]').forEach(b=>b.onclick=()=>openLegal(b.dataset.legal));
}
function renderHome(){root.innerHTML=`<section class="hero route-hero"><div class="hero-copy"><span class="eyebrow">숙박 매물 거래 플랫폼</span><h1>망하지 않는 숙박사업,<br><em>매물 선택부터 다릅니다.</em></h1><p>기존 호스트의 숙박 매물과 새로운 숙박사업 기회를 찾는 예비·현직 호스트를 연결합니다. 매출·권리금·운영 정보와 자료 확인 상태를 함께 보고 판단하세요.</p><div class="hero-actions"><a class="btn primary" href="#listings">매물 찾기 →</a><a class="btn secondary" href="#verify">공간 자동검증</a></div></div><div class="hero-photo"><div class="hero-note">이 매물로<br>숙박업을 해도 괜찮을까?<small>공실헬퍼<br>확인 가능한 정보부터</small></div></div></section>`;
  root.insertAdjacentHTML('beforeend',`<section class="user-shortcuts"><a href="#listings"><b>01</b><strong>검증 매물 찾기</strong><span>공개정보부터 비교</span></a><a href="#valuation"><b>02</b><strong>권리금 진단</strong><span>예상 범위 계산</span></a><a href="#passes"><b>03</b><strong>열람권 구매</strong><span>상세정보 접근</span></a><a href="#register"><b>04</b><strong>매물 등록</strong><span>증빙과 함께 제출</span></a><a href="#verify"><b>05</b><strong>자동검증</strong><span>관공서 대조 준비</span></a><a href="#account"><b>06</b><strong>내 공실헬퍼</strong><span>열람·저장·매칭 관리</span></a></section>`)}
function mapCandidate(r){
  const opening=r.journey==='opening';
  const deposit=Number(r.deposit_amount||0);
  const premium=Number(r.asking_premium||0);
  const capital=opening?deposit+Number(r.setup_cost_min||0):deposit+premium;
  return{
    id:String(r.id),journey:r.journey,title:r.title||'숙소 후보',area:r.area||'',type:r.accommodation_type||'',
    deposit,capital,rent:Number(r.monthly_rent||0),premium,
    verified:r.verification_summary||'검증정보 정리 중',risk:r.risk_summary||'추가 확인사항 정리 중',
    publishedAt:r.published_at||'',valuationReady:!!r.valuation_ready,
    items:Array.isArray(r.verification_items)?r.verification_items:[],
    images:Array.isArray(r.public_image_paths)?r.public_image_paths.map(publicImage):[]
  }
}
function candidateVerificationState(item){
  const items=Array.isArray(item?.items)?item.items:[];
  const failed=items.filter(v=>['failed','needs_check','unverified'].includes(String(v.status||''))).length;
  const confirmed=items.filter(v=>['confirmed','passed','verified'].includes(String(v.status||''))).length;
  if(failed)return 'unverified';
  if(confirmed)return 'verified';
  return 'checking';
}
function verificationBadge(item){
  const items=Array.isArray(item?.items)?item.items:[];
  const confirmed=items.filter(v=>['confirmed','passed','verified'].includes(String(v.status||''))).length;
  const needs=items.filter(v=>['failed','needs_check','unverified'].includes(String(v.status||''))).length;
  if(needs)return `미검증 · 추가확인 ${needs}`;
  if(confirmed)return `검증 · 확인 ${confirmed}`;
  return '검증 상태 확인 중';
}
async function renderListings(){
  skeleton('공개 매물을 불러오는 중입니다.');
  let rows=[];
  try{rows=await loadCandidates()}catch(e){console.error(e)}
  const types=[...new Set(rows.map(x=>x.type).filter(Boolean))].sort();
  const body=`<div class="notice-card"><b>특허 제5단계 · 기본정보 검색</b><p>사진·지역·금액·검증상태는 공개하고, 정확한 주소·운영수치·권리금 상세는 열람권 이후 공개합니다.</p></div>
  <div class="filters page-filters">
    <button data-journey="all" class="chip active">전체</button>
    <button data-journey="takeover" class="chip">숙소인수</button>
    <button data-journey="opening" class="chip">신규오픈</button>
    <input id="searchInput" placeholder="매물명·특징 검색">
    <input id="areaFilter" placeholder="지역 예: 마포구">
    <select id="typeFilter"><option value="all">전체 숙소유형</option>${types.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select>
    <input id="depositMax" inputmode="numeric" placeholder="보증금 상한 예: 5000만원">
    <input id="rentMax" inputmode="numeric" placeholder="월세 상한 예: 200만원">
    <input id="premiumMax" inputmode="numeric" placeholder="권리금 상한 예: 3000만원">
    <select id="verificationFilter"><option value="all">전체 검증상태</option><option value="verified">검증 매물</option><option value="unverified">미검증/추가확인</option><option value="checking">확인 중</option></select>
  </div>
  <div class="recommendation-panel"><div><span class="section-kicker">SMART MATCH</span><h3>내 조건으로 추천매물 보기</h3><p>지역·숙소유형·보증금·월세·권리금 조건을 조합해 공개매물 적합도를 계산합니다.</p></div><button id="recommendBtn" class="btn secondary" type="button">조건 추천 실행</button></div>
  <div id="recommendationGrid" class="listing-grid recommendation-grid" style="display:none"></div>
  <div class="listing-meta"><span id="listingCount"></span><a href="#register" class="text-btn">내 매물 등록하기 →</a></div>
  <div id="listingGrid" class="listing-grid"></div>
  <div id="emptyState" class="empty-state"><strong>조건에 맞는 공개 매물이 없습니다.</strong><p>운영자 게시승인을 통과한 매물만 공개됩니다.</p><a class="btn primary" href="#register">무료 매물 등록</a></div>`;
  root.innerHTML=page('숙박 매물 찾기','STEP 5 · SEARCH',body,'<a class="outline-btn" href="#verify">자동검증 먼저 해보기</a>');
  let journey='all',query='',area='',type='all',verification='all',depositMax=0,rentMax=0,premiumMax=0;
  const draw=()=>{
    let list=[...rows];
    if(journey!=='all')list=list.filter(x=>x.journey===journey);
    if(query){const q=query.toLowerCase();list=list.filter(x=>(x.title+' '+x.type+' '+x.verified+' '+x.risk).toLowerCase().includes(q))}
    if(area){const q=area.toLowerCase();list=list.filter(x=>String(x.area||'').toLowerCase().includes(q))}
    if(type!=='all')list=list.filter(x=>x.type===type);
    if(verification!=='all')list=list.filter(x=>candidateVerificationState(x)===verification);
    if(depositMax)list=list.filter(x=>x.deposit<=depositMax);
    if(rentMax)list=list.filter(x=>x.rent<=rentMax);
    if(premiumMax)list=list.filter(x=>x.premium<=premiumMax);
    $('#listingCount').textContent=`${list.length}개 공간`;
    $('#listingGrid').innerHTML=list.map(cardHtml).join('');
    $('#emptyState').style.display=list.length?'none':'block';
    $$('[data-property]').forEach(card=>card.onclick=e=>{if(e.target.closest('[data-save]'))return;go(`#property/${card.dataset.property}`)});
    $$('[data-save]').forEach(b=>b.onclick=e=>{e.stopPropagation();saveCandidate(b.dataset.save,b)});
  };
  $$('[data-journey]').forEach(b=>b.onclick=()=>{$$('[data-journey]').forEach(x=>x.classList.remove('active'));b.classList.add('active');journey=b.dataset.journey;draw()});
  $('#searchInput').oninput=e=>{query=e.target.value;draw()};
  $('#areaFilter').oninput=e=>{area=e.target.value;draw()};
  $('#typeFilter').onchange=e=>{type=e.target.value;draw()};
  $('#verificationFilter').onchange=e=>{verification=e.target.value;draw()};
  $('#depositMax').oninput=e=>{depositMax=won(e.target.value);draw()};
  $('#rentMax').oninput=e=>{rentMax=won(e.target.value);draw()};
  $('#premiumMax').oninput=e=>{premiumMax=won(e.target.value);draw()};
  $('#recommendBtn').onclick=async()=>{
    const btn=$('#recommendBtn'),grid=$('#recommendationGrid');btn.disabled=true;btn.textContent='추천 계산 중…';
    try{
      const{data,error}=await supabase.rpc('gongsil_recommend_properties',{p_area:area||null,p_accommodation_type:type==='all'?null:type,p_deposit_max:depositMax||null,p_monthly_rent_max:rentMax||null,p_premium_max:premiumMax||null,p_limit:6});
      if(error)throw error;
      const list=data||[];grid.style.display='grid';grid.innerHTML=list.length?list.map(recommendationCardHtml).join(''):'<div class="mode-empty">현재 조건에 맞는 공개 추천매물이 없습니다.</div>';
      $('[data-property]',grid).forEach(card=>card.onclick=()=>go('#property/'+card.dataset.property));
    }catch(e){console.error(e);toast(String(e?.message||'추천매물을 계산하지 못했습니다.'))}
    finally{btn.disabled=false;btn.textContent='조건 추천 실행'}
  };
  draw();
}
function cardHtml(item){const img=item.images[0]||'';const saved=state.saved.includes(item.id);return `<article class="listing-card" data-property="${item.id}"><div class="listing-image" style="${img?`background-image:url('${img}')`:''}"><span>${esc(item.area||'공개매물')}</span><button class="heart" data-save="${item.id}" aria-label="관심 저장">${saved?'♥':'♡'}</button></div><div class="listing-body"><div class="card-badges"><small>${item.journey==='opening'?'신규오픈':'숙소인수'}</small><small>${verificationBadge(item)}</small>${item.valuationReady?'<small>가치진단</small>':''}</div><h3>${esc(item.title)}</h3><p class="card-type">${esc(item.type||'숙박 운영 후보')}</p><div class="metrics"><div><span>초기 필요자금</span><b>${money(item.capital)}</b></div><div><span>월세</span><b>${money(item.rent)}</b></div></div><p>${esc(item.verified)}</p></div></article>`}
function recommendationCardHtml(item){const img=(item.public_image_paths||[])[0]?publicImage(item.public_image_paths[0]):'';return `<article class="listing-card recommendation-card" data-property="${item.property_id}"><div class="listing-image" style="${img?`background-image:url('${img}')`:''}"><span>추천 적합도 ${Number(item.match_score||0)}점</span></div><div class="listing-body"><div class="card-badges"><small>${esc(item.recommendation_mode||'rules_v1')}</small><small>자료 확인 매물</small></div><h3>${esc(item.title||'추천 매물')}</h3><p class="card-type">${esc(item.area||'')} · ${esc(item.accommodation_type||'')}</p><div class="metrics"><div><span>보증금</span><b>${money(item.deposit_amount)}</b></div><div><span>월세</span><b>${money(item.monthly_rent)}</b></div></div><p>희망 권리금 ${money(item.asking_premium)} · 입력한 조건과의 적합도를 기준으로 정렬했습니다.</p></div></article>`}
async function saveCandidate(id,btn){if(!state.user){state.pending={type:'save',id};return openLogin()}try{const saved=state.saved.includes(id),{error}=await supabase.rpc('gongsil_set_saved',{p_property_id:id,p_saved:!saved});if(error)throw error;state.saved=saved?state.saved.filter(x=>x!==id):[...state.saved,id];if(btn)btn.textContent=saved?'♡':'♥';toast(saved?'관심에서 제거했습니다.':'관심 매물에 저장했습니다.')}catch(e){console.error(e);toast('저장 처리에 실패했습니다.')}}
async function renderProperty(id){skeleton('매물 상세정보를 불러오는 중입니다.');try{const{data,error}=await supabase.rpc('gongsil_get_property_detail',{p_property_id:id});if(error)throw error;const p=data.public||{},d=data.detail||{},a=data.premium||null,imgs=(p.images||[]).map(publicImage),locked=!data.has_access;const checks=(p.verification_items||[]).map(v=>`<li><b>${esc(v.label)}</b><span class="status-pill ${v.status}">${v.status==='confirmed'?'확인':v.status==='host_provided'?'제출정보':v.status==='estimated'?'예상':'추가확인'}</span></li>`).join('');const gallery=imgs.length?`<div class="property-gallery">${imgs.slice(0,5).map((x,i)=>`<img src="${x}" alt="${esc(p.title||'매물')} 사진 ${i+1}">`).join('')}</div>`:'';
const publicInfo=`${gallery}<div class="info-grid detail-public"><article><b>보증금</b><p>${money(p.deposit_amount)}</p></article><article><b>월세</b><p>${money(p.monthly_rent)}</p></article><article><b>희망 권리금</b><p>${p.asking_premium?money(p.asking_premium):'협의'}</p></article></div><h3 class="detail-subtitle">검증 상태</h3><ul class="verification-list">${checks||'<li>검증정보 정리 중</li>'}</ul>`;
const premium=locked?`<div class="locked-box"><b>🔒 프리미엄 상세정보</b><p>정확한 주소, 매출·비용·가동률, 권리금 진단과 매칭 기능은 열람권 사용 후 공개됩니다.</p><div class="mode-actions"><a class="btn primary" href="#passes">열람권 보기</a>${state.user?`<button id="unlockCurrentBtn" class="btn secondary">보유 열람권 사용</button>`:''}</div></div>`:`<div class="premium-detail"><h3>프리미엄 운영정보</h3><div class="premium-grid"><article><span>정확한 주소</span><b>${esc(d.exact_address||'확인 중')}</b></article><article><span>월평균 매출</span><b>${money(d.avg_monthly_revenue)}</b></article><article><span>월 고정비</span><b>${money(d.monthly_fixed_cost)}</b></article><article><span>관리비</span><b>${money(d.management_fee)}</b></article><article><span>가동률</span><b>${d.occupancy_rate!=null?d.occupancy_rate+'%':'확인 중'}</b></article><article><span>운영기간</span><b>${d.operating_months!=null?d.operating_months+'개월':'확인 중'}</b></article></div>${a?`<div class="valuation-result"><small>${esc(a.model_version)} · 데이터 완성도 ${a.confidence}%</small><h3>${money(a.premium_min)} ~ ${money(a.premium_max)}</h3><p>기준값 ${money(a.premium_recommended)} · 실제 계약가를 보장하지 않습니다.</p></div>`:''}${!data.is_owner&&!data.is_admin?`<div class="match-actions"><p class="mode-lead">특허 제7단계 · 상세정보 확인 후 직거래 상대방 연락처 또는 지정중개사 연결을 요청할 수 있습니다.</p><button id="directMatchBtn" class="btn secondary">직거래 연락처 요청</button><button id="brokerMatchBtn" class="btn primary">지정중개사 연결 요청</button></div>`:''}</div>`;
root.innerHTML=page(esc(p.title||'매물 상세'),`${p.journey==='opening'?'신규오픈':'숙소인수'} · ${esc(p.area||'')}`,`<div class="property-detail">${publicInfo}${premium}</div>`,'<a class="outline-btn" href="#listings">← 목록으로</a>');if(locked&&$('#unlockCurrentBtn'))$('#unlockCurrentBtn').onclick=()=>unlockChooser(id);if(!locked&&!data.is_owner&&!data.is_admin){$('#directMatchBtn').onclick=()=>requestMatch(id,'direct');$('#brokerMatchBtn').onclick=()=>requestMatch(id,'broker')}}catch(e){console.error(e);root.innerHTML=page('매물 정보를 불러오지 못했습니다.','ERROR','<p class="mode-lead">잠시 후 다시 시도해 주세요.</p><a class="btn primary" href="#listings">목록으로 돌아가기</a>')}}
async function unlockChooser(propertyId){if(!state.user){state.pending={type:'detail',id:propertyId};return openLogin()}let orders=[];try{const{data}=await supabase.from('gongsil_my_access_orders_v1').select('*').eq('status','paid');orders=data||[]}catch{}const valid=orders.filter(o=>(!o.valid_until||new Date(o.valid_until)>new Date())&&(o.plan_kind==='time'||Number(o.used_count||0)<Number(o.property_limit||0)));openModal(`<div><span class="section-kicker">DETAIL ACCESS</span><h2>보유 열람권 사용</h2><p class="mode-lead">이 매물의 프리미엄 정보를 열 열람권을 선택하세요.</p><div class="mode-list">${valid.length?valid.map(o=>`<article><div><small>${o.plan_kind==='count'?'건수형':'기간형'}</small><h3>${esc(o.label)}</h3><p>${o.plan_kind==='count'?`${o.used_count||0}/${o.property_limit}건 사용`:o.valid_until?`${new Date(o.valid_until).toLocaleDateString('ko-KR')}까지`:'사용 가능'}</p></div><button class="outline-btn" data-use-order="${o.id}">사용</button></article>`).join(''):'<div class="mode-empty">사용 가능한 열람권이 없습니다.</div>'}</div><a href="#passes" class="btn primary" id="modalPassLink">열람권 구매하기</a></div>`);$$('[data-use-order]').forEach(b=>b.onclick=async()=>{try{const{error}=await supabase.rpc('gongsil_unlock_property',{p_property_id:propertyId,p_order_id:b.dataset.useOrder});if(error)throw error;closeModal();toast('상세정보가 열렸습니다.');renderProperty(propertyId)}catch(e){toast(String(e?.message||'열람권 적용에 실패했습니다.'))}});$('#modalPassLink').onclick=closeModal}
async function requestMatch(propertyId,mode){if(!state.user){state.pending={type:'detail',id:propertyId};return openLogin()}const note=window.prompt(mode==='direct'?'직거래 요청 시 전달할 메시지를 입력해 주세요.':'공인중개사에게 전달할 요청사항을 입력해 주세요.','');if(note===null)return;try{const{error}=await supabase.rpc('gongsil_request_match',{p_property_id:propertyId,p_mode:mode,p_note:note||null});if(error)throw error;toast(mode==='direct'?'직거래 매칭을 요청했습니다.':'공인중개사 연결을 요청했습니다.');go('#account')}catch(e){toast(String(e?.message||'매칭 요청에 실패했습니다.'))}}
function transactionStageLabel(stage){
  return ({matched:'매칭 완료',visit_scheduled:'임장 일정 확정',deposit_pending:'보증금 결제 대기',deposit_paid:'보증금 결제 완료',address_shared:'임장 주소 공유',visit_completed:'방문 확인 완료',refund_pending:'보증금 환불 대기',deposit_refunded:'임장 절차 완료',dispute_open:'분쟁 검토',no_show_review:'노쇼 검토',no_show_settled:'노쇼 정산 완료'}[stage]||stage||'진행 중');
}
async function verifyVisitDeposit(depositId,paymentId,inquiryId){
  const res=await fetch('/.netlify/functions/portone-verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resourceType:'visit_deposit',resourceId:depositId,paymentId,action:'verify_payment'})});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||data?.ok!==true)throw new Error(data.error||data.detail||'임장 보증금 결제 검증에 실패했습니다.');
  sessionStorage.removeItem('gongsil.visit.depositId');sessionStorage.removeItem('gongsil.visit.inquiryId');sessionStorage.removeItem('gongsil.visit.paymentId');
  history.replaceState({},'',location.pathname+'#deal/'+inquiryId);
  toast('임장 안심보증금 5만원 결제가 확인되었습니다.');
  await renderDeal(inquiryId);
}
async function payVisitDeposit(visitId,inquiryId){
  try{
    toast('임장 보증금 주문을 준비하고 있습니다.');
    const{data:depositId,error}=await supabase.rpc('gongsil_create_visit_deposit',{p_visit_id:visitId});
    if(error)throw error;
    const{data:dep,error:depError}=await supabase.from('gongsil_my_visit_deposits_v2').select('*').eq('deposit_id',depositId).maybeSingle();
    if(depError)throw depError;
    const amount=Number(dep?.amount_krw||50000);
    const cfgRes=await fetch('/.netlify/functions/portone-config',{cache:'no-store'}),cfg=await cfgRes.json();
    if(!cfgRes.ok||!cfg.storeId||!cfg.channelKey)throw new Error(cfg.error||'PortOne 설정을 불러오지 못했습니다.');
    const PortOne=await import('https://esm.sh/@portone/browser-sdk@0.1.5/v2');
    const paymentId='GSV-'+crypto.randomUUID();
    sessionStorage.setItem('gongsil.visit.depositId',String(depositId));
    sessionStorage.setItem('gongsil.visit.inquiryId',String(inquiryId));
    sessionStorage.setItem('gongsil.visit.paymentId',paymentId);
    const redirectUrl=`${location.origin}${location.pathname}?visitDepositId=${encodeURIComponent(depositId)}&inquiryId=${encodeURIComponent(inquiryId)}#deal/${inquiryId}`;
    const response=await PortOne.requestPayment({storeId:cfg.storeId,channelKey:cfg.channelKey,paymentId,orderName:'공실헬퍼 임장 안심보증금',totalAmount:amount,currency:'CURRENCY_KRW',payMethod:'CARD',customer:{customerId:state.user.id,fullName:state.user.user_metadata?.nickname||state.user.user_metadata?.name||'공실헬퍼 회원',email:state.user.email||undefined},redirectUrl});
    if(response?.code)throw new Error(response.message||'결제가 취소되었습니다.');
    if(response?.paymentId)await verifyVisitDeposit(String(depositId),response.paymentId,String(inquiryId));
  }catch(e){console.error(e);toast(String(e?.message||'임장 보증금 결제를 시작하지 못했습니다.'))}
}
async function renderDeal(inquiryId){
  if(!state.user){
    root.innerHTML=page('거래 진행','DEAL ROOM',`<div class="login-gate route-card"><span class="login-symbol">공</span><h2>카카오 인증이 필요합니다.</h2><p>매칭 당사자와 지정중개사만 거래방을 확인할 수 있습니다.</p><button id="dealLoginBtn" class="kakao-btn">카카오로 계속하기</button></div>`);
    $('#dealLoginBtn').onclick=()=>{state.pending={type:'route',hash:'#deal/'+inquiryId};openLogin()};return;
  }
  skeleton('거래 진행상태를 불러오는 중입니다.');
  try{
    const[{data:thread,error},{data:tx,error:txError}]=await Promise.all([
      supabase.rpc('gongsil_get_inquiry_thread',{p_inquiry_id:inquiryId}),
      supabase.rpc('gongsil_get_transaction_state',{p_inquiry_id:inquiryId})
    ]);
    if(error)throw error;if(txError)throw txError;
    const progress=tx||thread?.progress||{},visit=thread?.visit||{},deposit=thread?.deposit||{},messages=Array.isArray(thread?.messages)?thread.messages:[];
    const role=String(thread?.viewer_role||'participant');
    const activeVisit=visit?.id&&String(visit.id)!=='null';
    const startAt=visit?.start_at?new Date(visit.start_at):null;
    const started=!!startAt&&Date.now()>=startAt.getTime();
    const paid=String(deposit?.status||progress?.deposit_status||'')==='paid';
    const addressShared=progress?.address_shared===true||messages.some(m=>m.message_type==='visit_address');
    const canCounterparty=['owner','broker','admin'].includes(role);
    const messageHtml=messages.length?messages.map(m=>`<article class="deal-message ${m.is_mine?'mine':''} ${m.message_type==='visit_address'?'address':''}"><small>${m.is_mine?'나':m.message_type==='visit_address'?'임장주소':'상대방'} · ${m.created_at?new Date(m.created_at).toLocaleString('ko-KR'):''}</small><p>${esc(m.body||'')}</p></article>`).join(''):'<div class="mode-empty">아직 대화가 없습니다. 매칭 목적과 확인할 조건부터 남겨보세요.</div>';
    const visitSummary=activeVisit?`<div class="transaction-box"><b>임장 일정</b><p>${startAt?startAt.toLocaleString('ko-KR'):'일정 미정'} · ${esc(visit.status||'')}</p><small>보증금 ${esc(deposit?.status||progress?.deposit_status||'미결제')} · 주소공유 ${addressShared?'완료':'대기'}</small></div>`:'<div class="transaction-box"><b>임장 일정</b><p>아직 확정되지 않았습니다.</p></div>';
    const actions=[];
    if(['matched','accepted'].includes(String(progress.transaction_stage||''))||(!activeVisit&&['approved','broker_assigned'].includes(String(progress.match_status||'')))){
      actions.push(`<form id="visitScheduleForm" class="deal-action-form"><label>임장 일시<input id="visitStartAt" type="datetime-local" required></label><button class="btn primary" type="submit">임장 일정 확정</button></form>`);
    }
    if(activeVisit&&role==='buyer'&&!paid&&!['refund_pending','refunded','no_show_review','settled'].includes(String(deposit?.status||''))){
      actions.push(`<button id="visitDepositBtn" class="btn primary">임장 안심보증금 5만원 결제</button>`);
    }
    if(activeVisit&&paid&&!addressShared&&canCounterparty){
      actions.push(`<button id="shareVisitAddressBtn" class="btn primary">결제 확인 · 임장주소 공유</button>`);
    }
    if(activeVisit&&paid&&addressShared&&started&&String(visit.status||'')!=='completed'){
      actions.push(`<button id="confirmVisitBtn" class="btn secondary">방문 완료 확인</button>`);
      if(canCounterparty)actions.push(`<button id="reportNoShowBtn" class="outline-btn danger">양수인 노쇼 신고</button>`);
      if(role==='buyer')actions.push(`<button id="reportCounterNoShowBtn" class="outline-btn danger">상대방 노쇼 신고</button>`);
    }
    const body=`<div class="deal-layout">
      <section class="route-card">
        <span class="section-kicker">TRANSACTION STATE</span>
        <h2>${esc(progress.title||'거래 진행')}</h2>
        <div class="transaction-stage"><b>${esc(transactionStageLabel(progress.transaction_stage))}</b><p>${esc(progress.next_action||'매칭 진행상태를 확인하세요.')}</p></div>
        <div class="transaction-grid"><div><span>매칭 방식</span><b>${progress.match_mode==='broker'?'지정중개사':'직거래'}</b></div><div><span>문의 상태</span><b>${esc(progress.inquiry_stage||'-')}</b></div><div><span>매칭 상태</span><b>${esc(progress.match_status||'-')}</b></div><div><span>내 역할</span><b>${esc(role)}</b></div></div>
        ${visitSummary}
        <div class="deal-actions">${actions.join('')}</div>
      </section>
      <section class="route-card deal-chat">
        <div class="account-section-head"><div><h2>거래방 · 내부채팅</h2><p>양수인·양도인·지정중개사만 참여합니다.</p></div><button id="refreshDealBtn" class="text-btn" type="button">새로고침</button></div>
        <div class="deal-messages">${messageHtml}</div>
        <form id="dealMessageForm" class="deal-message-form"><textarea id="dealMessageBody" maxlength="2000" required placeholder="확인할 조건, 임장 관련 내용 등을 입력하세요."></textarea><button class="btn primary" type="submit">메시지 보내기</button></form>
      </section>
    </div>`;
    root.innerHTML=page(progress.title?esc(progress.title):'거래 진행','PATENT STEP 7 · MATCH',body,'<a class="outline-btn" href="#account">내 공실헬퍼</a>');
    $('#refreshDealBtn').onclick=()=>renderDeal(inquiryId);
    $('#dealMessageForm').onsubmit=async e=>{e.preventDefault();const body=$('#dealMessageBody').value.trim();if(!body)return;const btn=e.currentTarget.querySelector('button');btn.disabled=true;try{const{error}=await supabase.rpc('gongsil_send_inquiry_message',{p_inquiry_id:inquiryId,p_body:body});if(error)throw error;await renderDeal(inquiryId)}catch(err){toast(String(err?.message||'메시지를 보내지 못했습니다.'));btn.disabled=false}};
    if($('#visitScheduleForm'))$('#visitScheduleForm').onsubmit=async e=>{e.preventDefault();const value=$('#visitStartAt').value;if(!value)return;const btn=e.currentTarget.querySelector('button');btn.disabled=true;try{const{error}=await supabase.rpc('gongsil_schedule_visit',{p_inquiry_id:inquiryId,p_start_at:new Date(value).toISOString()});if(error)throw error;toast('임장 일정을 확정했습니다.');await renderDeal(inquiryId)}catch(err){toast(String(err?.message||'임장 일정을 확정하지 못했습니다.'));btn.disabled=false}};
    if($('#visitDepositBtn'))$('#visitDepositBtn').onclick=()=>payVisitDeposit(visit.id,inquiryId);
    if($('#shareVisitAddressBtn'))$('#shareVisitAddressBtn').onclick=async()=>{try{const{error}=await supabase.rpc('gongsil_share_visit_address',{p_visit_id:visit.id});if(error)throw error;toast('임장 주소를 거래방에 공유했습니다.');await renderDeal(inquiryId)}catch(err){toast(String(err?.message||'주소를 공유하지 못했습니다.'))}};
    if($('#confirmVisitBtn'))$('#confirmVisitBtn').onclick=async()=>{try{const{error}=await supabase.rpc('gongsil_confirm_visit_attendance',{p_visit_id:visit.id});if(error)throw error;toast('방문 완료를 확인했습니다.');await renderDeal(inquiryId)}catch(err){toast(String(err?.message||'방문 확인을 완료하지 못했습니다.'))}};
    if($('#reportNoShowBtn'))$('#reportNoShowBtn').onclick=async()=>{const note=window.prompt('양수인 노쇼 신고 사유를 입력해 주세요.','');if(note===null)return;try{const{error}=await supabase.rpc('gongsil_report_visit_no_show',{p_visit_id:visit.id,p_note:note||null});if(error)throw error;toast('노쇼 검토 요청을 접수했습니다.');await renderDeal(inquiryId)}catch(err){toast(String(err?.message||'노쇼 신고를 접수하지 못했습니다.'))}};
    if($('#reportCounterNoShowBtn'))$('#reportCounterNoShowBtn').onclick=async()=>{const note=window.prompt('상대방 노쇼 신고 사유를 입력해 주세요.','');if(note===null)return;try{const{error}=await supabase.rpc('gongsil_report_counterparty_no_show',{p_visit_id:visit.id,p_note:note||null});if(error)throw error;toast('노쇼 검토 요청을 접수했습니다.');await renderDeal(inquiryId)}catch(err){toast(String(err?.message||'노쇼 신고를 접수하지 못했습니다.'))}};
  }catch(e){console.error(e);root.innerHTML=page('거래 진행을 불러오지 못했습니다.','DEAL ROOM',`<div class="route-card"><p>${esc(e?.message||'거래 참가자만 확인할 수 있습니다.')}</p><a class="btn secondary" href="#account">내 공실헬퍼로 돌아가기</a></div>`)}
}

function renderValuation(){
  const body=`<div class="split-page"><div class="route-card"><h2>특허 제4단계 · 권리금 산정 입력</h2><p class="mode-lead">금액·수익 정보뿐 아니라 리뷰·예약현황·접근성·관광지 인접성을 함께 반영합니다.</p>
  <form id="valuationForm"><div class="form-grid">
    <label>지역<input name="area" placeholder="예: 서울 마포구"></label>
    <label>숙소 유형<input name="accommodationType" placeholder="예: 외국인관광 도시민박업"></label>
    <label>보증금<input name="deposit" placeholder="예: 3000만원"></label>
    <label>월평균 매출 *<input name="revenue" required placeholder="예: 550만원"></label>
    <label>월세 *<input name="rent" required placeholder="예: 180만원"></label>
    <label>월 고정비 *<input name="fixed" required placeholder="예: 120만원"></label>
    <label>관리비<input name="management" placeholder="예: 30만원"></label>
    <label>운영기간 *<input name="months" required placeholder="예: 24개월"></label>
    <label>평균 가동률 *<input name="occupancy" required placeholder="예: 72"></label>
    <label>평균 객단가<input name="adr" placeholder="예: 12만원"></label>
    <label>시설 투자액<input name="facility" placeholder="예: 2500만원"></label>
    <label>재사용 가능 자산 비율<input name="reuse" placeholder="예: 70"></label>
    <label>리뷰 점수<input name="review" placeholder="예: 4.8"></label>
    <label>향후 예약률<input name="forward" placeholder="예: 65"></label>
    <label>접근성 점수<input name="accessibility" placeholder="0~100"></label>
    <label>관광지 인접도<input name="tourism" placeholder="0~100"></label>
  </div><button class="submit-btn" type="submit">AI 적정 권리금 계산</button></form></div>
  <aside class="result-panel" id="valuationPreview"><span class="section-kicker">RESULT</span><h2>아직 계산 전입니다.</h2><p>실제 계약가는 현장상태, 계약조건, 허가·신고 가능성, 수요 등 추가 요소에 따라 달라질 수 있습니다.</p></aside></div>`;
  root.innerHTML=page('무료 AI 권리금 시세진단','STEP 4 · XGBOOST / RULE FALLBACK',body,'<a class="outline-btn" href="#register">진단 후 매물등록</a>');
  $('#valuationForm').onsubmit=calculateValuation;
}
async function calculateValuation(e){
  e.preventDefault();
  const fd=new FormData(e.currentTarget);
  const area=String(fd.get('area')||'').trim(),accommodationType=String(fd.get('accommodationType')||'').trim();
  const deposit=won(fd.get('deposit')),revenue=won(fd.get('revenue')),rent=won(fd.get('rent')),fixed=won(fd.get('fixed')),
    management=won(fd.get('management')),operating=months(fd.get('months')),occ=num(fd.get('occupancy'))||60,
    adr=won(fd.get('adr')),facility=won(fd.get('facility')),reuse=num(fd.get('reuse'))||Math.max(20,100-operating/0.6),
    review=num(fd.get('review'))||4,forward=num(fd.get('forward'))||occ,access=num(fd.get('accessibility'))||50,tourism=num(fd.get('tourism'))||50;
  const preview=$('#valuationPreview');
  preview.innerHTML='<div class="route-spinner small"></div><p>리뷰·예약·접근성·관광지 인접성까지 포함해 권리금 범위를 분석하고 있습니다.</p>';
  const features={operating_months:operating,deposit_amount:deposit,monthly_rent:rent,avg_monthly_revenue:revenue,avg_daily_rate:adr,fixed_cost:fixed,management_fee:management,occupancy_rate:occ,asset_reuse_pct:reuse,facility_investment:facility,review_score:review,reservation_forward_rate:forward,accessibility_score:access,tourism_proximity_score:tourism,area,accommodation_type:accommodationType};
  const completeness=Object.entries(features).filter(([k,v])=>!['area','accommodation_type'].includes(k)?Number(v)!==0:String(v||'').trim()!=='').length;
  const local=()=>{
    const profit=Math.max(revenue-rent-fixed-management,0);
    const quality=1+Math.max(-.08,Math.min(.12,(occ-60)/400))+Math.max(-.04,Math.min(.06,(review-4)/20))+Math.max(-.04,Math.min(.06,(forward-60)/500))+Math.max(-.03,Math.min(.05,(access-50)/1000))+Math.max(-.03,Math.min(.05,(tourism-50)/1000));
    const facilityValue=facility*Math.min(1,Math.max(0,reuse/100));
    const business=profit*Math.max(6,Math.min(18,8+operating/6))*quality;
    const recommended=Math.max(0,facilityValue+business);
    return{premium_recommended:recommended,premium_min:recommended*.85,premium_max:recommended*1.15,confidence:55,mode:'local_fallback',facilityValue,business};
  };
  let result;
  try{
    const res=await fetch('https://gongsil-ml-http.onrender.com/v1/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({features}),signal:AbortSignal.timeout(10000)});
    const data=await res.json();
    if(!res.ok||!data?.ok)throw new Error(data?.error||'AI 진단을 불러오지 못했습니다.');
    result=data;
  }catch(err){console.warn('ML valuation fallback',err);result=local()}
  const mode=result.mode==='ml'?'XGBoost AI 모델':result.mode==='rules_fallback'?'AI 기준모델':'간이 기준모델';
  const confidence=Math.round(Number(result.confidence||55));
  preview.innerHTML=`<span class="section-kicker">${esc(mode)} · 신뢰도 ${confidence}%</span><h2>${money(result.premium_min)} ~ ${money(result.premium_max)}</h2>
  <div class="result-breakdown">
    <div><span>권리금 기준값</span><b>${money(result.premium_recommended)}</b></div>
    <div><span>분석 방식</span><b>${esc(mode)}</b></div>
    <div><span>모델 버전</span><b>${esc(result.model_version||'valuation-v1')}</b></div>
    <div><span>입력 완성도</span><b>${completeness}/${Object.keys(features).length}</b></div>
  </div>
  <p>반영요소: 매출·비용·가동률·리뷰·예약현황·접근성·관광지 인접성·지역·숙소유형.</p>
  <p>AI 분석값은 거래 판단을 위한 참고 정보이며 실제 계약가·수익을 보장하지 않습니다.</p><a href="#register" class="btn primary">이 숙소 등록하기</a>`;
}
async function renderPasses(){skeleton('열람권 상품을 불러오는 중입니다.');let plans=[];try{const{data,error}=await supabase.from('gongsil_access_plans_v1').select('*').order('display_order');if(error)throw error;plans=data||[]}catch(e){console.error(e)}const cards=plans.length?`<div class="plan-grid user-plan-grid">${plans.map(p=>`<article><small>${p.plan_kind==='count'?'건수형':'기간형'}</small><h3>${esc(p.label)}</h3><b>${money(p.price_krw)}</b><p>${p.plan_kind==='count'?`${p.property_limit}개 매물 상세열람`:`${p.valid_days}일 동안 프리미엄 상세정보 열람`}</p><button class="btn primary" data-buy-plan="${p.plan_code}">PortOne으로 구매</button></article>`).join('')}</div>`:'<div class="mode-empty"><b>현재 판매 중인 열람권이 없습니다.</b><p>운영정책 확정 후 다시 열립니다.</p></div>';root.innerHTML=page('프리미엄 열람권','ACCESS PASS',`<div class="route-card"><p class="mode-lead">공개정보는 무료입니다. 정확한 주소·운영수치·권리금 분석 등 보호가 필요한 정보만 열람권으로 엽니다.</p>${cards}<div class="notice-card"><b>결제 안전장치</b><p>PortOne 결제 완료 후 서버가 결제상태와 금액을 다시 확인해야 열람권이 활성화됩니다.</p></div></div>`,'<a class="outline-btn" href="#account">내 열람권</a>');$$('[data-buy-plan]').forEach(b=>b.onclick=()=>buyPlan(b.dataset.buyPlan,plans.find(p=>p.plan_code===b.dataset.buyPlan)))}
async function buyPlan(planCode,plan){if(!state.user){state.pending={type:'route',hash:'#passes'};return openLogin()}if(!plan?.price_krw)return toast('판매가격이 설정되지 않은 상품입니다.');try{toast('결제 주문을 만들고 있습니다.');let idem=sessionStorage.getItem('gongsil.payment.idempotency.'+planCode);if(!idem){idem=crypto.randomUUID();sessionStorage.setItem('gongsil.payment.idempotency.'+planCode,idem)}const{data:orderId,error}=await supabase.rpc('gongsil_create_access_order_idempotent',{p_plan_code:planCode,p_idempotency_key:idem});if(error)throw error;sessionStorage.setItem('gongsil.payment.orderId',String(orderId));sessionStorage.setItem('gongsil.payment.planCode',planCode);const cfgRes=await fetch('/.netlify/functions/portone-config',{cache:'no-store'}),cfg=await cfgRes.json();if(!cfgRes.ok||!cfg.storeId||!cfg.channelKey)throw new Error(cfg.error||'PortOne 설정을 불러오지 못했습니다.');const PortOne=await import('https://esm.sh/@portone/browser-sdk@0.1.5/v2');const paymentId=`GSP-${crypto.randomUUID()}`;sessionStorage.setItem('gongsil.payment.paymentId',paymentId);const redirectUrl=`${location.origin}${location.pathname}?orderId=${encodeURIComponent(orderId)}#passes`;const response=await PortOne.requestPayment({storeId:cfg.storeId,channelKey:cfg.channelKey,paymentId,orderName:`공실헬퍼 ${plan.label}`,totalAmount:Number(plan.price_krw),currency:'CURRENCY_KRW',payMethod:'CARD',customer:{customerId:state.user.id,fullName:state.user.user_metadata?.nickname||state.user.user_metadata?.name||'공실헬퍼 회원',email:state.user.email||undefined},redirectUrl});if(response?.code)throw new Error(response.message||'결제가 취소되었습니다.');if(response?.paymentId)await settlePortOne(orderId,response.paymentId)}catch(e){console.error(e);toast(String(e?.message||'결제를 시작하지 못했습니다.'))}}
async function settlePortOne(orderId,paymentId){const{data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');toast('결제 결과를 확인하고 있습니다.');const res=await fetch('/.netlify/functions/portone-verify',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},body:JSON.stringify({resourceType:'access_order',resourceId:orderId,paymentId,action:'verify_payment'})});const data=await res.json();if(!res.ok||data?.ok!==true)throw new Error(data.error||data.detail||'결제 검증에 실패했습니다.');sessionStorage.removeItem('gongsil.payment.orderId');sessionStorage.removeItem('gongsil.payment.paymentId');const paidPlan=sessionStorage.getItem('gongsil.payment.planCode');if(paidPlan)sessionStorage.removeItem('gongsil.payment.idempotency.'+paidPlan);sessionStorage.removeItem('gongsil.payment.planCode');history.replaceState({},'',location.pathname+'#account');toast('결제가 완료되어 열람권이 활성화되었습니다.');await renderAccount()}
function typeFieldsHtml(){return state.registerType==='takeover'?`<div class="form-grid wide"><label>운영기간 *<input name="operatingMonths" required placeholder="예: 20개월"></label><label>최근 월평균 매출 *<input name="avgRevenue" required placeholder="예: 420만원"></label><label>평균 가동률 *<input name="occupancy" required placeholder="예: 72"></label><label>희망 권리금 *<input name="transferFee" required placeholder="예: 2500만원"></label><label>월 고정비 *<input name="fixedCost" required placeholder="예: 120만원"></label><label>관리비<input name="managementFee" placeholder="예: 30만원"></label><label>시설 투자액<input name="facilityInvestment" placeholder="예: 2000만원"></label><label>평균 객단가<input name="avgDailyRate" placeholder="예: 12만원"></label><label>리뷰 점수<input name="reviewScore" placeholder="예: 4.8"></label><label>향후 예약률<input name="reservationForwardRate" placeholder="예: 65"></label><label>접근성 점수<input name="accessibilityScore" placeholder="0~100"></label><label>관광지 인접도<input name="tourismScore" placeholder="0~100"></label><label class="wide">양도사유 *<textarea name="transferReason" required></textarea></label><label class="wide">포함 자산<textarea name="includedAssets" placeholder="가구·가전, 침구, 운영 매뉴얼 등"></textarea></label></div>`:`<div class="form-grid wide"><label>공실기간<input name="vacancyMonths" placeholder="예: 14"></label><label>예상 객실 수 *<input name="expectedRooms" required placeholder="예: 3"></label><label>임대인 협의 *<select name="landlordStatus" required><option value="">선택</option><option value="agreed">협의 완료</option><option value="discussing">협의 중</option><option value="not_discussed">미협의</option></select></label><label>예상 세팅비 *<input name="setupCost" required placeholder="예: 1800만원"></label></div>`}
function docsHtml(){return `<div class="docs-head"><h3>비공개 검증자료</h3><p>없는 서류는 비워둘 수 있으며, 미제출 항목은 확인 완료로 표시되지 않습니다.</p></div><div class="docs-grid">${DOCS.map(([key,label])=>`<label>${label}<input type="file" data-doc-key="${key}" accept="image/jpeg,image/png,image/webp,application/pdf"><small>${key==='business_registration'?'사업자번호·주소 OCR 보조':'OCR 보조 + 운영자 확인'}</small></label>`).join('')}</div>`}
function renderRegister(){if(!state.user){root.innerHTML=page('매물 등록','SELL / OPENING',`<div class="login-gate route-card"><span class="login-symbol">공</span><h2>카카오 인증 후 등록할 수 있습니다.</h2><p>등록정보·검증자료·진행상태를 같은 계정에서 관리합니다.</p><button id="pageLoginBtn" class="kakao-btn">카카오로 계속하기</button></div>`);$('#pageLoginBtn').onclick=()=>{state.pending={type:'route',hash:'#register'};openLogin()};return}state.registerType='takeover';const form=`<div class="register-types"><button data-type="takeover" class="active">운영 숙소 양도</button><button data-type="opening">신규오픈 후보</button></div><form id="registerForm"><div class="form-grid"><label>매물명 *<input name="title" required placeholder="예: 연남동 스테이"></label><label>지역 *<input name="area" required placeholder="예: 서울 마포구"></label><label class="wide">정확한 주소 *<input name="address" required placeholder="승인 전 공개되지 않습니다."></label><label>숙소/공간 유형 *<input name="accommodationType" required placeholder="외국인관광 도시민박업 등"></label><label>입주·인수 가능일<input type="date" name="availableDate"></label><label>담당자명 *<input name="contactName" required></label><label>담당자 연락처 *<input name="contactPhone" required placeholder="010-0000-0000"></label><label>보증금 *<input name="deposit" required placeholder="예: 3000만원"></label><label>월세 *<input name="rent" required placeholder="예: 180만원"></label><div id="typeFields" class="wide"></div><label class="wide">공개 사진 * <small>3~10장</small><input id="publicPhotos" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif"></label></div><div id="patentDocs" class="patent-docs"></div><label class="consent"><input id="ocrAssist" type="checkbox" checked> 이미지 증빙은 브라우저 OCR 보조확인을 실행합니다.</label><label class="consent"><input id="registerConsent" type="checkbox"> 제출정보 검토 및 개인정보 처리 안내를 확인했습니다. *</label><button class="submit-btn" type="submit">검증자료와 함께 제출</button></form>`;root.innerHTML=page('매물·증빙 등록','STEP 2',`<div class="route-card register-view"><p class="mode-lead">정확한 주소와 증빙 원본은 공개 탐색에 노출하지 않습니다. 운영 숙소 양도 매물은 해당 호수의 영업/정상 인허가 확인 후 제출할 수 있습니다.</p>${form}</div>`,'<a class="outline-btn" href="#verify">자동검증 보기</a>');const refresh=()=>{$('#typeFields').innerHTML=typeFieldsHtml();$('#patentDocs').innerHTML=state.registerType==='takeover'?docsHtml():'<div class="docs-head"><h3>신규오픈 검토자료</h3><p>주소 자동검증 결과와 현장·관할기관 확인을 조합합니다.</p></div>'};refresh();$$('.register-types button').forEach(b=>b.onclick=()=>{$$('.register-types button').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.registerType=b.dataset.type;refresh()});$('#registerForm').onsubmit=submitRegistration}
async function uploadFile(bucket,userId,propertyId,file,type){const clean=file.name.replace(/[^a-zA-Z0-9._-]+/g,'_'),path=`${userId}/${propertyId}/${crypto.randomUUID()}-${clean}`;const{error}=await supabase.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type||undefined});if(error)throw error;const{data:documentId,error:meta}=await supabase.rpc('gongsil_add_property_document',{p_property_id:propertyId,p_document_type:type,p_storage_bucket:bucket,p_storage_path:path,p_visibility:'owner_admin'});if(meta)throw meta;return{path,documentId}}
const norm=s=>String(s||'').replace(/\s+/g,'').replace(/[^0-9A-Za-z가-힣]/g,'').toLowerCase();
async function runBrowserOCR(file,address){if(!file.type.startsWith('image/'))return{status:'unavailable',provider:'browser_ocr',fields:{file_type:file.type},note:'PDF는 브라우저 OCR 대상에서 제외'};try{const{createWorker}=await import('https://cdn.jsdelivr.net/npm/tesseract.js@5/+esm');const worker=await createWorker('kor+eng');const{data}=await worker.recognize(file);await worker.terminate();const text=String(data?.text||''),business=(text.match(/\b\d{3}[- ]?\d{2}[- ]?\d{5}\b/)||[])[0]||null,token=norm(address).slice(0,12),addressMatch=!!token&&norm(text).includes(token);return{status:text.trim().length>20?'needs_review':'failed',provider:'tesseract.js-browser',fields:{char_count:text.length,business_registration_number:business,address_match:addressMatch,confidence:Math.round(Number(data?.confidence||0))},note:'OCR 원문 전체는 저장하지 않고 추출 메타데이터만 기록'}}catch(e){console.error(e);return{status:'unavailable',provider:'tesseract.js-browser',fields:{},note:'브라우저 OCR 실행 실패 · 수동확인 필요'}}}
async function recordVerification(propertyId,documentId,ocr,address){try{const ocrStatus=ocr?.fields?.address_match===true?'passed':ocr.status==='unavailable'?'unavailable':'needs_review';await supabase.rpc('gongsil_record_verification_run',{p_property_id:propertyId,p_document_id:documentId,p_run_type:'ocr',p_status:ocrStatus,p_provider:ocr.provider,p_extracted_fields:ocr.fields,p_evidence:{client:'web',supplemental:true},p_note:ocr.note});const auto=await runGovernmentCheck({address,businessNo:ocr.fields?.business_registration_number||null});const govStatus=auto.overallStatus==='confirmed'?'passed':auto.overallStatus==='unavailable'?'unavailable':auto.overallStatus==='inactive'||auto.overallStatus==='not_found'?'failed':'needs_review';await supabase.rpc('gongsil_record_verification_run',{p_property_id:propertyId,p_document_id:documentId,p_run_type:'government_db',p_status:govStatus,p_provider:'netlify-government-check',p_extracted_fields:auto,p_evidence:{sources:auto.sources||[],supplemental:true},p_note:auto.summary||'자동대조 결과'})}catch(e){console.warn('verification log skipped',e)}}
async function runGovernmentCheck(payload){const res=await fetch('/.netlify/functions/lodging-check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await res.json();if(!res.ok)throw new Error(data.error||'자동대조 요청에 실패했습니다.');return data}
async function submitRegistration(e){e.preventDefault();if(!$('#registerConsent').checked)return toast('제출정보 검토 및 개인정보 처리 안내 확인이 필요합니다.');const fd=new FormData(e.currentTarget),photos=Array.from($('#publicPhotos').files||[]);if(state.registerType==='takeover'){let verified=null;try{verified=JSON.parse(sessionStorage.getItem('gongsil.lastVerify')||'null')}catch{}const entered=norm(String(fd.get('address')||'')),checked=norm(String(verified?.verifiedAddress||''));if(!verified||verified.overallStatus!=='confirmed')return toast('운영 숙소 양도 매물은 먼저 자동검증에서 해당 호수의 영업/정상 인허가를 확인해 주세요.');if(!entered||entered!==checked)return toast('매물 주소와 자동검증을 통과한 주소가 일치해야 합니다. 다시 자동검증해 주세요.')}if(photos.length<3||photos.length>10)return toast('공개 사진은 3장 이상 10장 이하로 등록해 주세요.');const p={journey:state.registerType,title:String(fd.get('title')||''),area:String(fd.get('area')||''),exact_address:String(fd.get('address')||''),accommodation_type:String(fd.get('accommodationType')||''),contact_name:String(fd.get('contactName')||''),contact_phone:String(fd.get('contactPhone')||''),available_from:state.registerType==='opening'?(fd.get('availableDate')||null):null,takeover_available_at:state.registerType==='takeover'?(fd.get('availableDate')||null):null,deposit_amount:won(fd.get('deposit')),monthly_rent:won(fd.get('rent')),setup_cost_min:state.registerType==='opening'?won(fd.get('setupCost')):null,vacancy_months:state.registerType==='opening'?num(fd.get('vacancyMonths'))||null:null,expected_rooms:state.registerType==='opening'?num(fd.get('expectedRooms'))||null:null,landlord_status:state.registerType==='opening'?String(fd.get('landlordStatus')||''):null,operating_months:state.registerType==='takeover'?months(fd.get('operatingMonths'))||null:null,avg_monthly_revenue:state.registerType==='takeover'?won(fd.get('avgRevenue')):null,occupancy_rate:state.registerType==='takeover'?num(fd.get('occupancy')):null,transfer_fee:state.registerType==='takeover'?won(fd.get('transferFee')):null,monthly_fixed_cost:state.registerType==='takeover'?won(fd.get('fixedCost')):null,management_fee:state.registerType==='takeover'?won(fd.get('managementFee')):null,facility_investment:state.registerType==='takeover'?won(fd.get('facilityInvestment')):null,avg_daily_rate:state.registerType==='takeover'?won(fd.get('avgDailyRate')):null,review_score:state.registerType==='takeover'?num(fd.get('reviewScore'))||null:null,reservation_forward_rate:state.registerType==='takeover'?num(fd.get('reservationForwardRate'))||null:null,accessibility_score:state.registerType==='takeover'?num(fd.get('accessibilityScore'))||null:null,tourism_proximity_score:state.registerType==='takeover'?num(fd.get('tourismScore'))||null:null,transfer_reason:state.registerType==='takeover'?String(fd.get('transferReason')||''):null,included_assets:state.registerType==='takeover'?String(fd.get('includedAssets')||'').split(/[,\n]/).map(x=>x.trim()).filter(Boolean):[]};try{toast('매물 정보를 저장하고 있습니다.');const{data:id,error}=await supabase.rpc('gongsil_submit_property',{p_payload:p});if(error)throw error;for(const f of photos)await uploadFile('gongsil-property-images',state.user.id,String(id),f,'public_image_candidate');let ocrDocPath=null;if(state.registerType==='takeover'){const outdominTypes=['외도민','외국인관광 도시민박업','외국인관광도시민박업'],ocrDocKey=outdominTypes.includes(p.accommodation_type)?'business_registration':'landlord_consent';for(const input of $('[data-doc-key]')){const f=input.files?.[0];if(!f)continue;const up=await uploadFile('gongsil-verification-docs',state.user.id,String(id),f,input.dataset.docKey);if(input.dataset.docKey===ocrDocKey)ocrDocPath=up.path;if($('#ocrAssist')?.checked){toast(`${DOCS.find(x=>x[0]===input.dataset.docKey)?.[1]||'서류'} OCR·자동대조 중`);const ocr=await runBrowserOCR(f,p.exact_address);await recordVerification(String(id),up.documentId,ocr,p.exact_address)}}}const{data:verification,error:verifyErr}=await supabase.rpc('gongsil_start_property_verification',{p_property_id:String(id)});if(verifyErr)throw verifyErr;const ocrRunId=verification?.ocr_run_id||verification?.run_id;if(ocrRunId&&ocrDocPath){const ttlSeconds=900,{data:signed,error:signErr}=await supabase.storage.from('gongsil-verification-docs').createSignedUrl(ocrDocPath,ttlSeconds);if(signErr||!signed?.signedUrl)throw signErr||new Error('OCR 문서 접근권한을 만들지 못했습니다.');const expiresAt=new Date(Date.now()+ttlSeconds*1000).toISOString();const{error:attachErr}=await supabase.rpc('gongsil_attach_ocr_signed_url',{p_run_id:String(ocrRunId),p_signed_url:signed.signedUrl,p_expires_at:expiresAt});if(attachErr)throw attachErr;}if(state.registerType==='takeover'){try{await supabase.rpc('gongsil_request_premium_assessment',{p_property_id:String(id)})}catch(err){console.warn('valuation deferred',err)}}toast(verification?.status==='queued'?'매물 저장 완료 · 서버 OCR·관공서 자동검증을 시작했습니다.':'매물 저장 완료 · 검증 상태를 확인해 주세요.');go('#account')}catch(err){console.error(err);toast(String(err?.message||'등록 요청에 실패했습니다.'))}}
function renderVerify(){const body=`<div class="verify-intro"><article><b>1</b><strong>주소 입력</strong><span>공개 전 정확한 주소로 확인</span></article><article><b>2</b><strong>주소 정규화</strong><span>카카오 Local API 연결 시 법정동코드 확인</span></article><article><b>3</b><strong>인허가 대조</strong><span>서울시 외국인관광 도시민박업 조회</span></article><article><b>4</b><strong>영업상태 판정</strong><span>영업/정상 · 같은 건물 · 비활성 · 미확인</span></article></div><div class="split-page verify-split"><div class="route-card"><h2>관공서 자동대조</h2><p class="mode-lead">도로명주소와 동·층·호수까지 정확히 입력하면 서울시 외국인관광 도시민박업 인허가 DB와 대조합니다. 띄어쓰기는 상관없으며 사업자등록번호는 입력하지 않아도 됩니다.</p><form id="verifyForm"><div class="form-grid"><label class="wide">주소 *<input name="address" required placeholder="도로명주소 + 동/층/호수 입력 (띄어쓰기 상관없음)"></label><label>사업자등록번호 (선택)<input name="businessNo" placeholder="입력하지 않아도 조회됩니다."></label><label>자가 확인 건물용도<select name="buildingUse"><option value="unknown">선택 안 함</option><option value="detached">단독주택</option><option value="multi_family">다가구/다세대</option><option value="apartment">공동주택</option><option value="office">업무시설</option><option value="commercial">근린생활/상업시설</option></select></label></div><button class="submit-btn" type="submit">자동대조 실행</button></form><div class="verify-note"><b>개인정보 안내</b><p>이 화면은 주소와 사업자번호를 자동조회 목적으로만 전송합니다. 주민등록번호는 입력하지 마세요.</p></div></div><aside id="verifyResult" class="result-panel"><span class="section-kicker">VERIFY RESULT</span><h2>아직 조회 전입니다.</h2><p>주소를 입력하면 현재 연결 가능한 데이터 소스별 결과를 보여드립니다.</p></aside></div>`;root.innerHTML=page('숙박 공간 자동검증','STEP 3 · #verify',body,'<a class="outline-btn" href="#register">검증자료 등록 →</a>');$('#verifyForm').onsubmit=submitVerify}
async function submitVerify(e){e.preventDefault();const fd=new FormData(e.currentTarget),address=String(fd.get('address')||'').trim(),businessNo=String(fd.get('businessNo')||'').trim(),buildingUse=String(fd.get('buildingUse')||'unknown'),box=$('#verifyResult');const hasUnit=/(?:\d+\s*동\s*\d+\s*호|(?:b\s*\d+|지하\s*\d+\s*층|\d+\s*층)\s*[a-z]?\d{1,4}\s*호?|[a-z]?\d{2,4}\s*호)/i.test(address);if(!hasUnit){box.innerHTML='<span class="section-kicker">주소 보완 필요</span><h2>도로명주소와 동·층·호수까지 정확히 입력해 주세요.</h2><p>건물 주소만으로는 같은 건물의 다른 숙소와 구분할 수 없어 활성 인허가를 확정하지 않습니다. 사업자등록번호는 입력하지 않아도 됩니다.</p>';return}box.innerHTML='<div class="route-spinner small"></div><p>주소·인허가 데이터를 대조하고 있습니다.</p>';try{const data=await runGovernmentCheck({address,businessNo:businessNo||null,buildingUse});sessionStorage.setItem('gongsil.lastVerify',JSON.stringify({...data,verifiedAddress:address,verifiedAt:new Date().toISOString()}));const statusLabel=data.overallStatus==='confirmed'?'활성 영업 확인':data.overallStatus==='partial'?'같은 건물 활성':data.overallStatus==='inactive'?'비활성 인허가':data.overallStatus==='not_found'?'인허가 미확인':data.overallStatus==='unavailable'?'공공데이터 조회 오류':'추가 확인 필요';const sources=(data.sources||[]).map(s=>`<article class="verify-source"><div><small>${esc(s.source)}</small><h3>${esc(s.label)}</h3></div><span class="status-pill ${s.status==='confirmed'?'confirmed':'needs_check'}">${esc(s.statusLabel||s.status)}</span><p>${esc(s.message||'')}</p></article>`).join('');const permits=(data.permitMatches||[]).map(p=>`<article class="verify-source"><div><small>${esc(p.managementNo||'인허가')}</small><h3>${esc(p.businessName||'사업장명 미표시')}</h3></div><span class="status-pill ${String(p.tradeStatus||p.detailStatus||'').includes('영업')?'confirmed':'needs_check'}">${esc(p.tradeStatus||p.detailStatus||'상태 확인')}</span><p>${esc(p.roadAddress||p.lotAddress||'')} ${p.permitDate?'· 인허가 '+esc(p.permitDate):''}</p></article>`).join('');const canRegister=data.overallStatus==='confirmed';box.innerHTML=`<span class="section-kicker">${esc(statusLabel)}</span><h2>${esc(data.summary||statusLabel)}</h2><div class="verify-sources">${sources}</div>${permits?`<div class="verify-sources">${permits}</div>`:''}${data.building?`<div class="result-breakdown"><div><span>공개데이터 건물용도</span><b>${esc(data.building.useName||data.building.use||'확인 중')}</b></div></div>`:''}<p class="verify-disclaimer">${esc(data.disclaimer||'자동대조 결과는 참고정보입니다. 최종 영업신고·인허가는 관할기관 확인이 필요합니다.')}</p>${canRegister?'<a href="#register" class="btn primary">이 공간 등록하기</a>':'<button class="btn secondary" type="button" disabled>활성 인허가 확인 후 등록 가능</button>'}`}catch(err){console.error(err);box.innerHTML=`<span class="section-kicker">ERROR</span><h2>자동대조를 완료하지 못했습니다.</h2><p>${esc(err?.message||'잠시 후 다시 시도해 주세요.')}</p>`}}

function propertyVerificationMeta(p){
  const docs=Array.isArray(p.documents)?p.documents:[];
  const items=Array.isArray(p.verification_items)?p.verification_items:[];
  const item=k=>items.find(x=>x.item_key===k);
  const outdomin=items.some(x=>x.item_key==='outdomin_registry'||x.item_key==='outdomin_ocr_address')||/외국인관광/.test(String(p.accommodation_type||''));
  const done=s=>s==='confirmed';
  const issue=s=>['failed','rejected','unavailable'].includes(String(s||''));
  const pub=String(p.publication_status||'draft');
  const submitted=['submitted','approved','published'].includes(pub);
  let steps=[],ready=false,waiting=false;
  if(outdomin){
    const required=['business_registration','lease_contract','landlord_consent','resident_register'];
    const have=new Set(docs.map(d=>d.document_type));
    const docCount=required.filter(x=>have.has(x)).length;
    const docsOk=docCount===required.length;
    const ocr=item('outdomin_ocr_address'),gov=item('outdomin_registry');
    ready=docsOk&&done(ocr?.status)&&done(gov?.status);
    waiting=docsOk&&(!done(ocr?.status)||!done(gov?.status));
    steps=[
      {label:'필수서류',detail:`${docCount}/4`,status:docsOk?'done':'wait'},
      {label:'OCR 주소일치',detail:done(ocr?.status)?'확인':issue(ocr?.status)?'재확인 필요':'처리 중',status:done(ocr?.status)?'done':issue(ocr?.status)?'issue':'wait'},
      {label:'관공서 인허가',detail:done(gov?.status)?'영업/정상':issue(gov?.status)?'재확인 필요':'조회 중',status:done(gov?.status)?'done':issue(gov?.status)?'issue':'wait'},
      {label:'최종 제출',detail:submitted?'제출 완료':ready?'제출 가능':'대기',status:submitted?'done':ready?'ready':'wait'}
    ];
  }else{
    const docOk=docs.some(d=>d.document_type==='landlord_consent');
    const keys=['sublet_address_match','sublet_landlord','sublet_tenant','sublet_consent','sublet_date','sublet_signature'];
    const confirmed=keys.filter(k=>done(item(k)?.status)).length;
    ready=docOk&&confirmed===6;
    waiting=docOk&&confirmed<6;
    steps=[
      {label:'전대동의서',detail:docOk?'제출':'필요',status:docOk?'done':'wait'},
      {label:'OCR 6항목',detail:`${confirmed}/6 확인`,status:confirmed===6?'done':'wait'},
      {label:'운영자 검토',detail:submitted?'접수':'대기',status:submitted?'done':'wait'},
      {label:'최종 제출',detail:submitted?'제출 완료':ready?'제출 가능':'대기',status:submitted?'done':ready?'ready':'wait'}
    ];
  }
  const html=`<div class="verification-progress">${steps.map((s,i)=>`<div class="verification-step ${s.status}"><i>${s.status==='done'?'✓':i+1}</i><div><strong>${esc(s.label)}</strong><span>${esc(s.detail)}</span></div></div>`).join('')}</div>`;
  return{outdomin,ready,waiting,submitted,html};
}
async function restartPropertyVerification(p){
  const meta=propertyVerificationMeta(p);
  const docType=meta.outdomin?'business_registration':'landlord_consent';
  const doc=(Array.isArray(p.documents)?p.documents:[]).filter(d=>d.document_type===docType).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
  if(!doc)throw new Error(meta.outdomin?'사업자등록증을 먼저 업로드해 주세요.':'전대동의서를 먼저 업로드해 주세요.');
  const{data:verification,error}=await supabase.rpc('gongsil_start_property_verification',{p_property_id:String(p.id)});
  if(error)throw error;
  const runId=verification?.ocr_run_id||verification?.run_id;
  if(runId){
    const ttlSeconds=900;
    const{data:signed,error:signErr}=await supabase.storage.from('gongsil-verification-docs').createSignedUrl(doc.storage_path,ttlSeconds);
    if(signErr||!signed?.signedUrl)throw signErr||new Error('OCR 문서 접근권한을 만들지 못했습니다.');
    const expiresAt=new Date(Date.now()+ttlSeconds*1000).toISOString();
    const{error:attachErr}=await supabase.rpc('gongsil_attach_ocr_signed_url',{p_run_id:String(runId),p_signed_url:signed.signedUrl,p_expires_at:expiresAt});
    if(attachErr)throw attachErr;
  }
  return verification;
}
async function renderAccount(){
  if(!state.user){
    root.innerHTML=page('내 공실헬퍼','MY ACCOUNT',`<div class="login-gate route-card"><span class="login-symbol">공</span><h2>카카오 인증이 필요합니다.</h2><p>열람권, 저장매물, 등록매물, 매칭 진행을 한 곳에서 확인합니다.</p><button id="accountLoginBtn" class="kakao-btn">카카오로 계속하기</button></div>`);
    $('#accountLoginBtn').onclick=()=>{state.pending={type:'route',hash:'#account'};openLogin()};
    return;
  }
  skeleton('내 정보를 불러오는 중입니다.');
  let orders=[],matches=[],properties=[],saved=[],progress=[],roles=[];
  try{
    const[a,b,c1,d,e1,f1]=await Promise.all([
      supabase.from('gongsil_my_access_orders_v1').select('*').order('created_at',{ascending:false}).limit(20),
      supabase.from('gongsil_my_match_requests_v1').select('*').order('created_at',{ascending:false}).limit(20),
      supabase.from('gongsil_my_properties_v1').select('*').order('created_at',{ascending:false}).limit(20),
      supabase.from('gongsil_my_saved_v1').select('*').limit(20),
      supabase.from('gongsil_my_transaction_progress_v1').select('*').limit(20),
      supabase.from('gongsil_my_roles_v1').select('*')
    ]);
    orders=a.data||[];matches=b.data||[];properties=c1.data||[];saved=d.data||[];progress=e1.data||[];roles=f1.data||[];
  }catch(e){console.error(e)}
  const name=state.user.user_metadata?.nickname||state.user.user_metadata?.name||'카카오 회원';
  const brokerRole=roles.find(r=>r.role==='broker'&&r.status==='active');
  const propertyCards=properties.length?properties.map(p=>{
    const meta=propertyVerificationMeta(p);
    const actionable=['draft','needs_revision','paused'].includes(p.publication_status);
    const action=!actionable?'':meta.ready
      ?`<button class="outline-btn verification-action primary" data-finalize-property="${p.id}">검증 완료 · 최종 제출</button>`
      :`<button class="outline-btn verification-action" data-restart-verification="${p.id}">OCR·인허가 다시 확인</button>`;
    const patentState=meta.ready||meta.submitted?'검증 매물 후보':'미검증 매물';
    const statusText=meta.submitted?'운영자 검토 단계':meta.ready?'자동검증 완료':meta.waiting?'자동검증 처리 중':'검증 준비 필요';
    return `<article class="property-account-card"><div class="property-account-main"><small>${esc(patentState)} · ${esc(p.publication_status||'draft')} · ${p.journey==='opening'?'신규오픈':'숙소인수'}</small><h3>${esc(p.area||'')} · ${esc(p.title||'등록 숙소')}</h3><p>${esc(p.verification_summary||p.latest_review_note||statusText)}</p>${meta.html}</div>${action}</article>`;
  }).join(''):'<div class="mode-empty">등록한 매물이 없습니다.</div>';
  const dealCards=progress.length?progress.map(p=>`<article><div><small>${esc(p.match_mode==='broker'?'지정중개사':'직거래')} · ${esc(transactionStageLabel(p.transaction_stage||p.match_status||p.inquiry_stage||'진행'))}</small><h3>${esc(p.area||'')} · ${esc(p.title||'거래 매물')}</h3><p>매칭 ${esc(p.match_status||'-')} · 임장 ${esc(p.visit_status||'미정')} · 보증금 ${esc(p.deposit_status||'미결제')}</p></div><div class="mode-actions">${p.inquiry_id?`<a class="outline-btn" href="#deal/${p.inquiry_id}">거래방 열기</a>`:''}${p.property_id&&['approved','broker_assigned','completed'].includes(String(p.match_status||''))?`<button class="outline-btn" data-contact="${p.property_id}">연락처 확인</button>`:''}</div></article>`).join(''):matches.length?matches.map(m=>`<article><div><small>${m.mode==='broker'?'지정중개사':'직거래'} · ${esc(m.status)}</small><h3>${esc(m.area||'')} · ${esc(m.title||'매물')}</h3><p>매칭 요청 접수 후 승인되면 상대방 또는 지정중개사 연락처가 공개됩니다.</p></div><div class="mode-actions">${m.inquiry_id?`<a class="outline-btn" href="#deal/${m.inquiry_id}">거래방 열기</a>`:''}${['approved','broker_assigned','completed'].includes(m.status)?`<button class="outline-btn" data-contact="${m.property_id}">연락처 확인</button>`:''}</div></article>`).join(''):'<div class="mode-empty">아직 거래 연결 요청이 없습니다.</div>';
  const body=`<div class="account-summary"><article><span>활성/최근 열람권</span><b>${orders.filter(o=>o.status==='paid').length}</b></article><article><span>저장한 공간</span><b>${saved.length}</b></article><article><span>매칭 요청</span><b>${matches.length}</b></article><article><span>내 등록매물</span><b>${properties.length}</b></article></div>
  <div class="account-grid">
    <section class="route-card"><h2>열람권</h2><div class="mode-list">${orders.length?orders.map(o=>`<article><div><small>${esc(o.status)}</small><h3>${esc(o.label)}</h3><p>${money(o.amount_krw)} · ${o.status==='paid'?(o.valid_until?new Date(o.valid_until).toLocaleDateString('ko-KR')+'까지':'사용 가능'):'결제 확인 전'}</p></div></article>`).join(''):'<div class="mode-empty">열람권 내역이 없습니다.</div>'}</div><a class="outline-btn" href="#passes">열람권 구매</a></section>
    <section class="route-card"><h2>특허 제7단계 · 거래 연결</h2><p class="mode-lead">상세정보 확인 후 직거래 또는 지정중개사를 선택하고, 승인되면 연락처를 확인합니다.</p><div class="mode-list">${dealCards}</div></section>
    <section class="route-card account-properties"><div class="account-section-head"><div><h2>내 등록매물</h2><p>서류 → OCR → 관공서 → 운영자 검토 순서로 진행됩니다.</p></div><button id="refreshVerificationBtn" class="text-btn" type="button">상태 새로고침</button></div><div class="mode-list">${propertyCards}</div><a class="outline-btn" href="#register">새 매물 등록</a></section>
    <section class="route-card"><h2>공인중개사</h2><p class="mode-lead">${brokerRole?'승인된 공인중개사 계정입니다. 의뢰받은 매물을 등록하고 지정중개사 업무를 진행할 수 있습니다.':'공인중개사도 매도인의 의뢰를 받아 매물을 등록·연결할 수 있습니다.'}</p><a class="outline-btn" href="#broker">${brokerRole?'중개사 대시보드':'공인중개사 신청'}</a></section>
    <section class="route-card"><h2>계정</h2><p class="mode-lead">${esc(state.user.email||'카카오 인증 계정')}</p><button id="logoutBtn" class="btn secondary">로그아웃</button></section>
  </div>`;
  root.innerHTML=page(`${esc(name)}님의 공실헬퍼`,'MY GONGSIL',body);
  $$('[data-contact]').forEach(b=>b.onclick=()=>showMatchContact(b.dataset.contact));
  $$('[data-restart-verification]').forEach(b=>b.onclick=async()=>{
    const p=properties.find(x=>String(x.id)===String(b.dataset.restartVerification));if(!p)return;
    b.disabled=true;b.textContent='검증 요청 중…';
    try{await restartPropertyVerification(p);toast('클라우드 OCR·관공서 자동검증을 다시 시작했습니다.');setTimeout(()=>{if(location.hash==='#account')renderAccount()},1200)}
    catch(e){toast(String(e?.message||'자동검증을 다시 시작하지 못했습니다.'));b.disabled=false;b.textContent='OCR·인허가 다시 확인'}
  });
  $$('[data-finalize-property]').forEach(b=>b.onclick=async()=>{
    b.disabled=true;b.textContent='제출 중…';
    try{const{data,error}=await supabase.rpc('gongsil_finalize_property',{p_property_id:b.dataset.finalizeProperty});if(error)throw error;if(!data)throw new Error('최종 제출 조건을 충족하지 못했습니다.');toast('검증 완료 · 운영자 검토 단계로 제출했습니다.');renderAccount()}
    catch(e){toast(String(e?.message||'OCR·인허가 검증이 아직 완료되지 않았습니다.'));b.disabled=false;b.textContent='검증 완료 · 최종 제출'}
  });
  if($('#refreshVerificationBtn'))$('#refreshVerificationBtn').onclick=()=>renderAccount();
  $('#logoutBtn').onclick=logout;
  clearTimeout(state.accountRefreshTimer);
  if(properties.some(p=>propertyVerificationMeta(p).waiting)&&location.hash==='#account')state.accountRefreshTimer=setTimeout(()=>{if(location.hash==='#account')renderAccount()},15000);
}

async function renderBroker(){
  if(!state.user){
    root.innerHTML=page('공인중개사 파트너','PATENT CLAIM 3',`<div class="login-gate route-card"><span class="login-symbol">공</span><h2>카카오 인증 후 신청할 수 있습니다.</h2><p>공인중개사는 매도인의 의뢰를 받아 매물을 등록하고 지정중개사로 거래 연결에 참여할 수 있습니다.</p><button id="brokerLoginBtn" class="kakao-btn">카카오로 계속하기</button></div>`);
    $('#brokerLoginBtn').onclick=()=>{state.pending={type:'route',hash:'#broker'};openLogin()};return;
  }
  skeleton('공인중개사 정보를 불러오는 중입니다.');
  let applications=[],roles=[],dashboard=[],assigned=[];
  try{
    const[a,b,d,e]=await Promise.all([
      supabase.from('gongsil_broker_applications_v1').select('*').eq('user_id',state.user.id).order('created_at',{ascending:false}).limit(1),
      supabase.from('gongsil_my_roles_v1').select('*'),
      supabase.from('gongsil_broker_dashboard_v1').select('*').limit(1),
      supabase.from('gongsil_broker_assigned_properties_v1').select('*').order('assigned_at',{ascending:false}).limit(30)
    ]);
    applications=a.data||[];roles=b.data||[];dashboard=d.data||[];assigned=e.data||[];
  }catch(e){console.error(e)}
  const app=applications[0]||null,active=roles.some(r=>r.role==='broker'&&r.status==='active');
  if(active){
    const d=dashboard[0]||{};
    const cards=assigned.length?assigned.map(p=>`<article><div><small>${esc(p.publication_status||'배정')}</small><h3>${esc(p.area||'')} · ${esc(p.title||'매물')}</h3><p>진행 문의 ${Number(p.active_inquiry_count||0)}건 · 예정 임장 ${Number(p.upcoming_visit_count||0)}건</p></div></article>`).join(''):'<div class="mode-empty">현재 지정 배정된 매물이 없습니다.</div>';
    root.innerHTML=page('공인중개사 대시보드','PATENT CLAIM 3',`<div class="account-summary"><article><span>지정 매물</span><b>${Number(d.designated_property_count||0)}</b></article><article><span>진행 문의</span><b>${Number(d.active_inquiry_count||0)}</b></article><article><span>상담 대기</span><b>${Number(d.pending_consultation_count||0)}</b></article><article><span>예정 임장</span><b>${Number(d.upcoming_visit_count||0)}</b></article></div><section class="route-card"><h2>지정 매물</h2><div class="mode-list">${cards}</div><a class="btn primary" href="#register">의뢰 매물 등록하기</a></section>`,'<a class="outline-btn" href="#account">내 공실헬퍼</a>');
    return;
  }
  if(app&&['submitted','pending','in_review'].includes(String(app.status))){
    root.innerHTML=page('공인중개사 신청','PATENT CLAIM 3',`<section class="route-card"><h2>신청 검토 중입니다.</h2><p class="mode-lead">${esc(app.office_name)} · ${esc(app.registration_number)}</p><p>상태: ${esc(app.status)}. 승인 후 매도인의 의뢰 매물을 등록하고 지정중개사로 연결할 수 있습니다.</p></section>`,'<a class="outline-btn" href="#account">내 공실헬퍼</a>');return;
  }
  root.innerHTML=page('공인중개사 신청','PATENT CLAIM 3',`<section class="route-card"><h2>공인중개사도 매물 등록 주체가 될 수 있습니다.</h2><p class="mode-lead">중개사무소 정보를 제출하면 운영자 확인 후 지정중개사 기능을 활성화합니다.</p><form id="brokerApplyForm"><div class="form-grid"><label>중개사무소명 *<input name="officeName" required></label><label>중개사무소 등록번호 *<input name="registrationNumber" required></label><label>서비스 지역<input name="serviceArea" placeholder="예: 서울 전역"></label><label>전문 분야<input name="specialty" placeholder="예: 외도민·게스트하우스"></label><label>연락처 *<input name="contactPhone" required placeholder="010-0000-0000"></label></div><button class="submit-btn" type="submit">공인중개사 신청</button></form></section>`,'<a class="outline-btn" href="#account">내 공실헬퍼</a>');
  $('#brokerApplyForm').onsubmit=async e=>{
    e.preventDefault();const fd=new FormData(e.currentTarget);
    const btn=e.currentTarget.querySelector('button[type="submit"]');btn.disabled=true;btn.textContent='신청 중…';
    try{
      const{error}=await supabase.rpc('gongsil_submit_broker_application_v2',{p_office_name:String(fd.get('officeName')||''),p_registration_number:String(fd.get('registrationNumber')||''),p_service_area:String(fd.get('serviceArea')||'')||null,p_specialty:String(fd.get('specialty')||'')||null,p_contact_phone:String(fd.get('contactPhone')||'')});
      if(error)throw error;toast('공인중개사 신청을 접수했습니다.');renderBroker();
    }catch(err){toast(String(err?.message||'신청을 접수하지 못했습니다.'));btn.disabled=false;btn.textContent='공인중개사 신청'}
  };
}
async function showMatchContact(propertyId){try{const{data,error}=await supabase.rpc('gongsil_get_match_contact',{p_property_id:propertyId});if(error)throw error;if(!data)return toast('연락처 정보가 아직 등록되지 않았습니다.');openModal(`<div><span class="section-kicker">MATCH CONTACT</span><h2>${esc(data.label||'매칭 연락처')}</h2><div class="contact-card"><small>${data.mode==='broker'?'공인중개사':'직거래'}</small><h3>${esc(data.contact_name||data.office_name||'담당자')}</h3><p>${esc(data.contact_phone||'연락처 등록 대기')}</p>${data.office_name?`<p>${esc(data.office_name)} · ${esc(data.registration_number||'')} · ${esc(data.service_area||'')}</p>`:''}</div></div>`)}catch(e){toast(String(e?.message||'연락처를 확인하지 못했습니다.'))}}
function openLogin(){openModal(`<div class="login-view"><span class="login-symbol">공</span><h2>카카오로 시작하기</h2><p>카카오 로그인 후 바로 공실헬퍼 내 계정으로 돌아옵니다.</p><button id="kakaoLoginBtn" class="kakao-btn">카카오로 계속하기</button><small>최초 로그인 시 공실헬퍼 계정이 자동 생성됩니다.</small></div>`);$('#kakaoLoginBtn').onclick=async()=>{try{const pending=state.pending||{type:'route',hash:'#account'};localStorage.setItem('gongsil.pending',JSON.stringify(pending));$('#kakaoLoginBtn').disabled=true;$('#kakaoLoginBtn').textContent='카카오 연결 중…';await startUnifiedLogin()}catch(e){console.error(e);$('#kakaoLoginBtn').disabled=false;$('#kakaoLoginBtn').textContent='카카오로 계속하기';toast(String(e?.message||'카카오 로그인을 시작하지 못했습니다.'))}}}
async function bootstrapUser(user){state.user=user;$('#authBtn').textContent='내 공실헬퍼';$('#mobileAuthBtn').textContent='내 공실헬퍼';try{await supabase.rpc('gongsil_bootstrap_profile',{p_display_name:String(user.user_metadata?.nickname||user.user_metadata?.name||'카카오 회원')})}catch{}try{await Promise.all([supabase.rpc('hu_sync_gongsil_kakao'),supabase.rpc('hu_ensure_service_user',{p_service:'gongsil'})])}catch{}try{const{data}=await supabase.from('gongsil_my_saved_v1').select('*');state.saved=(data||[]).map(x=>String(x.property_id))}catch{}let pending=state.pending;const raw=localStorage.getItem('gongsil.pending');if(raw){localStorage.removeItem('gongsil.pending');try{pending=JSON.parse(raw)}catch{}}state.pending=null;if(pending?.type==='save'){await saveCandidate(pending.id);go('#listings')}else if(pending?.type==='detail'){go(`#property/${pending.id}`)}else if(pending?.type==='route'&&pending.hash){go(pending.hash)}}
async function logout(){await unifiedLogout();state.user=null;state.saved=[];$('#authBtn').textContent='● 카카오로 시작';$('#mobileAuthBtn').textContent='카카오로 시작';toast('로그아웃했습니다.');go('#home')}
function openLegal(kind){openModal(kind==='privacy'?`<div class="legal-copy"><span class="section-kicker">PRIVACY</span><h3>개인정보 처리 안내 요약</h3><p>카카오 계정 식별정보, 사용자가 직접 입력한 매물·문의·결제·매칭 정보, 선택적으로 제출한 검증자료를 처리합니다.</p><ul><li>정확한 주소·연락처·검증 원본은 공개탐색에 노출하지 않습니다.</li><li>OCR 원문 전체를 DB에 저장하지 않고 확인 메타데이터를 저장합니다.</li><li>결제는 PortOne 결과를 서버에서 재검증한 뒤 권한을 활성화합니다.</li></ul></div>`:`<div class="legal-copy"><span class="section-kicker">SERVICE POLICY</span><h3>검증·열람·매칭 기준</h3><p>제출정보, OCR 보조, 공공데이터 자동대조, 운영자 확인을 구분합니다.</p><ul><li>자동조회만으로 최종 합법·적법을 확정하지 않습니다.</li><li>권리금 진단은 참고범위이며 실제 계약가를 보장하지 않습니다.</li><li>상세주소·운영정보·연락처는 인증·결제·매칭 승인 단계에 따라 공개합니다.</li></ul></div>`)}
async function handlePaymentCallback(){const q=new URLSearchParams(location.search),paymentId=q.get('paymentId'),code=q.get('code'),message=q.get('message');const visitDepositId=q.get('visitDepositId')||sessionStorage.getItem('gongsil.visit.depositId'),visitInquiryId=q.get('inquiryId')||sessionStorage.getItem('gongsil.visit.inquiryId');if(visitDepositId&&(paymentId||code)){if(code){history.replaceState({},'',location.pathname+(visitInquiryId?'#deal/'+visitInquiryId:'#account'));toast(`결제가 완료되지 않았습니다: ${message||code}`);return true}try{await verifyVisitDeposit(visitDepositId,paymentId,visitInquiryId||'');return true}catch(e){console.error(e);history.replaceState({},'',location.pathname+(visitInquiryId?'#deal/'+visitInquiryId:'#account'));toast(String(e?.message||'임장 보증금 결제 검증에 실패했습니다.'));return true}}const orderId=q.get('orderId')||sessionStorage.getItem('gongsil.payment.orderId');if(!paymentId&&!code)return false;if(code){history.replaceState({},'',location.pathname+'#passes');toast(`결제가 완료되지 않았습니다: ${message||code}`);return true}if(!orderId){history.replaceState({},'',location.pathname+'#passes');toast('결제 주문 정보를 찾지 못했습니다.');return true}try{await settlePortOne(orderId,paymentId);return true}catch(e){console.error(e);history.replaceState({},'',location.pathname+'#passes');toast(String(e?.message||'결제 검증에 실패했습니다.'));return true}}
async function route(){
  const{name,id}=routeName();
  window.scrollTo({top:0,behavior:'instant'});
  $$('.nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')===`#${name}`));
  if(name==='home'||name==='top')return renderHome();
  if(name==='listings')return renderListings();
  if(name==='property'&&id)return renderProperty(id);
  if(name==='valuation')return renderValuation();
  if(name==='passes')return renderPasses();
  if(name==='register')return renderRegister();
  if(name==='verify')return renderVerify();
  if(name==='broker')return renderBroker();
  if(name==='deal'&&id)return renderDeal(id);
  if(name==='account')return renderAccount();
  return renderHome();
}
window.addEventListener('hashchange',route);bindNav();try{await completeUnifiedLogin()}catch(e){console.error(e);toast(String(e?.message||'카카오 통합로그인을 완료하지 못했습니다.'))}const{data:{session}}=await supabase.auth.getSession();if(session?.user)await bootstrapUser(session.user);supabase.auth.onAuthStateChange(async(_event,s)=>{if(s?.user&&!state.user){await bootstrapUser(s.user)}else if(!s?.user&&state.user){state.user=null;state.saved=[];$('#authBtn').textContent='● 카카오로 시작';$('#mobileAuthBtn').textContent='카카오로 시작'}});const handled=await handlePaymentCallback();if(!handled)await route();

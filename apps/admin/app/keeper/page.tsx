'use client';

import { useEffect, useMemo, useState } from 'react';

type Status = '예정' | '청소중' | '확인요청' | '승인완료';
type Task = { id: string; date: string; room: string; assignee: string; status: Status; checked: string[]; note: string; updatedAt: string; };
const KEY = 'hosthelper-suyu-cleaning-v1';
const queen = ['101','201','202','301','302','401','402','501'];
const twin = ['203','204','303','304','403','404'];
const allRooms = [...queen,...twin];
const kst = () => new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
const water = (room:string) => twin.includes(room) ? 4 : 2;
const roomLabel = (room:string) => twin.includes(room) ? '4인실 · 슈퍼싱글 2개' : '2인실 · 퀸 1개';
const checklist = (room:string) => [
  {section:'출입 준비',label:'예약·퇴실 여부 확인'},
  {section:'출입 준비',label:'집기실 마스터키 수령 확인'},
  {section:'침구 세팅',label:twin.includes(room) ? '매트리스 2 · 이불 2 · 일반 베개 4 · 핑크 베개 4 커버 교체':'매트리스 1 · 이불 1 · 일반 베개 2 · 핑크 베개 2 커버 교체'},
  {section:'객실 청소',label:'객실 쓰레기 · 바닥 · 먼지 · 거울 · 냉장고 청소'},
  {section:'화장실 청소',label:'변기 · 세면대 · 샤워실 · 배수구 · 거울 청소'},
  {section:'비품 세팅',label:'수건 · 휴지 · 샴푸 · 린스 · 바디워시 보충'},
  {section:'비품 세팅',label:'생수 '+water(room)+'개 냉장고 비치'},
  {section:'시설 점검',label:'에어컨 · 리모컨 · 조명 · 냉장고 · 온수 · 도어락 점검'},
  {section:'퇴실 마무리',label:'객실 문 잠금 및 마스터키 집기실 반납'},
];
const btn: React.CSSProperties = {minHeight:46,padding:'12px 16px',borderRadius:12,border:'1px solid #d5d9e0',background:'#fff',cursor:'pointer',fontWeight:700,fontSize:14};
const card: React.CSSProperties = {border:'1px solid #e5e7eb',borderRadius:16,background:'#fff',padding:16,marginBottom:12};
const sampleTask = (): Task => ({id:'demo-203',date:kst(),room:'203',assignee:'샘플 담당자',status:'예정',checked:[],note:'',updatedAt:new Date().toISOString()});

export default function HousekeeperMobile() {
  const [date,setDate]=useState(kst);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [demo,setDemo]=useState(false);
  const [example,setExample]=useState<Task>(sampleTask);
  const [page,setPage]=useState<'today'|'check'|'report'>('today');
  const [currentId,setCurrentId]=useState('');
  const [photos,setPhotos]=useState<File[]>([]);
  const [notice,setNotice]=useState('');

  useEffect(()=>{
    try {
      const raw=localStorage.getItem(KEY);
      const parsed=raw ? JSON.parse(raw) : [];
      setTasks(Array.isArray(parsed)?parsed.filter((t):t is Task=>Boolean(t&&typeof t.id==='string'&&allRooms.includes(t.room))):[]);
    } catch {setNotice('이 브라우저의 청소 일정 데이터를 불러오지 못했습니다.');}
    setLoaded(true);
  },[]);
  useEffect(()=>{if(loaded&&!demo)localStorage.setItem(KEY,JSON.stringify(tasks));},[tasks,loaded,demo]);

  const dayTasks=useMemo(()=>demo?[example]:tasks.filter(t=>t.date===date).sort((a,b)=>Number(a.room)-Number(b.room)),[demo,example,tasks,date]);
  const selected=dayTasks.find(t=>t.id===currentId)||dayTasks[0];
  const items=selected?checklist(selected.room):[];
  const done=selected?items.filter(it=>selected.checked.includes(it.label)).length:0;
  const ratio=items.length?Math.round(done/items.length*100):0;

  const update=(patch:Partial<Task>)=>{
    if(!selected)return;
    if(demo){setExample(old=>({...old,...patch,updatedAt:new Date().toISOString()}));return;}
    setTasks(old=>old.map(t=>t.id===selected.id?{...t,...patch,updatedAt:new Date().toISOString()}:t));
  };
  const changePage=(next:'today'|'check'|'report')=>{setPage(next);setNotice('');};
  const enter=(id:string)=>{setCurrentId(id);setPhotos([]);changePage('check');};
  const start=()=>{
    if(!selected||selected.status==='승인완료'||selected.status==='확인요청')return;
    update({status:'청소중'});changePage('check');
  };
  const submit=()=>{
    if(!selected)return;
    if(selected.status==='승인완료'){setNotice('관리자 승인 완료된 객실입니다.');return;}
    if(done!==items.length){setNotice('모든 청소 체크 항목을 완료해 주세요.');return;}
    if(photos.length<5){setNotice('필수 사진 5장을 선택해 주세요. (이 화면은 업로드 시연용이며 서버에 저장되지 않습니다.)');return;}
    update({status:'확인요청'});setNotice('시연용 완료 요청 상태로 변경했습니다. 실제 사진 전송·관리자 알림은 연결되지 않았습니다.');
  };
  const statusColor=(s:Status)=>s==='승인완료'?'#166534':s==='확인요청'?'#0d7490':s==='청소중'?'#a16207':'#667085';
  const canEdit=Boolean(selected && selected.status!=='승인완료' && selected.status!=='확인요청');
  const roomCount=dayTasks.length;
  const submitted=dayTasks.filter(t=>t.status==='확인요청'||t.status==='승인완료').length;

  return <main style={{maxWidth:520,minHeight:'100vh',margin:'0 auto',fontFamily:'system-ui,sans-serif',background:'#f8fafc',color:'#111827',padding:'0 14px 95px'}}>
    <header style={{padding:'22px 4px 14px'}}>
      <div style={{fontSize:12,letterSpacing:1.6,color:'#64748b',fontWeight:700}}>HOSTHELPER · THE HIVE SUYU</div>
      <h1 style={{fontSize:25,margin:'8px 0 5px',letterSpacing:'-0.7px'}}>호스트키퍼 작업관리</h1>
      <p style={{fontSize:14,color:'#64748b',margin:0}}>오늘의 객실 청소와 완료 보고</p>
    </header>
    <div style={{...card,background:'#fff7ed',borderColor:'#fed7aa',fontSize:13,lineHeight:1.6}}>
      <strong>시험 화면</strong> · 정식 직원 로그인/공유 DB/사진 저장은 미연동입니다. 작업 기록은 이 브라우저에서만 유지됩니다. 출입 비밀번호는 보안상 표시하지 않습니다.
    </div>
    {notice&&<div role="status" style={{...card,background:'#eff6ff',borderColor:'#bfdbfe',fontSize:13,lineHeight:1.5}}>{notice}</div>}

    {page==='today'&&<>
      <section style={{...card,display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
        <div><div style={{fontSize:12,color:'#64748b',marginBottom:5}}>확인할 날짜</div><input type="date" value={date} onChange={e=>{setDate(e.target.value);setDemo(false);setCurrentId('');}} style={{border:'none',fontSize:17,fontWeight:700,background:'transparent',maxWidth:170}} /></div>
        <div style={{textAlign:'right'}}><div style={{fontSize:12,color:'#64748b'}}>작업 완료 요청</div><strong style={{fontSize:21}}>{submitted} / {roomCount}</strong></div>
      </section>
      {roomCount===0&&<section style={{...card,textAlign:'center',padding:'30px 18px'}}>
        <strong>배정된 청소 일정이 없습니다.</strong>
        <p style={{color:'#64748b',fontSize:14,lineHeight:1.6}}>관리자 화면에서 일정을 등록하면 같은 브라우저에서 표시됩니다. 다른 휴대폰으로 자동 공유되지는 않습니다.</p>
        <button style={{...btn,background:'#111827',color:'#fff'}} onClick={()=>{setDemo(true);setExample(sampleTask());setNotice('203호 샘플 청소를 표시합니다. 실제 예약이 아닙니다.');}}>샘플 화면 체험</button>
      </section>}
      {roomCount>0&&dayTasks.map(t=><section key={t.id} style={card}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
          <div><div style={{fontSize:12,color:'#64748b'}}>{roomLabel(t.room)}</div><strong style={{fontSize:25}}>{t.room}호</strong></div>
          <span style={{fontSize:12,fontWeight:800,color:statusColor(t.status),background:'#f1f5f9',borderRadius:99,padding:'7px 10px'}}>{t.status}</span>
        </div>
        <p style={{color:'#64748b',fontSize:13,margin:'8px 0 15px'}}>담당: {t.assignee||'미배정'} · 생수 {water(t.room)}개 · 체크인 16:00</p>
        <button style={{...btn,background:'#111827',borderColor:'#111827',color:'#fff',width:'100%'}} onClick={()=>enter(t.id)}>{t.status==='예정'?'청소 작업 열기':'점검 내역 확인'}</button>
      </section>)}
      {demo&&<button style={{...btn,width:'100%'}} onClick={()=>{setDemo(false);setPage('today');setCurrentId('');setNotice('샘플 화면을 종료했습니다.');}}>샘플 종료</button>}
    </>}

    {page==='check'&&selected&&<>
      <section style={card}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'start'}}>
          <div><div style={{color:'#64748b',fontSize:13}}>{roomLabel(selected.room)}</div><h2 style={{fontSize:26,margin:'5px 0'}}>{selected.room}호 청소</h2></div>
          <span style={{fontSize:13,color:statusColor(selected.status),fontWeight:700}}>{selected.status}</span>
        </div>
        <div style={{fontSize:14,color:'#475569',margin:'8px 0'}}>체크리스트 {done} / {items.length}</div>
        <div style={{height:8,borderRadius:20,background:'#e2e8f0',overflow:'hidden'}}><div style={{height:8,width:ratio+'%',background:'#0f766e',transition:'width .2s'}} /></div>
        {selected.status==='예정'&&<button style={{...btn,width:'100%',marginTop:14,background:'#111827',color:'white'}} onClick={start}>청소 시작</button>}
      </section>
      <section style={card}>
        {Array.from(new Set(items.map(x=>x.section))).map(section=><div key={section} style={{marginBottom:15}}>
          <h3 style={{fontSize:15,margin:'4px 0 8px'}}>{section}</h3>
          {items.filter(x=>x.section===section).map(it=><label key={it.label} style={{display:'flex',gap:12,padding:'11px 0',borderBottom:'1px solid #f1f5f9',lineHeight:1.45,fontSize:14,cursor:canEdit?'pointer':'default'}}>
            <input type="checkbox" style={{width:20,height:20,accentColor:'#0f766e',flexShrink:0}} checked={selected.checked.includes(it.label)} disabled={!canEdit||selected.status==='예정'} onChange={e=>update({checked:e.target.checked?[...selected.checked,it.label]:selected.checked.filter(x=>x!==it.label)})}/>
            <span>{it.label}</span>
          </label>)}
        </div>)}
        <button style={{...btn,width:'100%',background:'#111827',color:'#fff'}} onClick={()=>changePage('report')}>완료 보고로 이동</button>
      </section>
    </>}

    {page==='report'&&selected&&<>
      <section style={card}>
        <h2 style={{fontSize:19,margin:'0 0 8px'}}>{selected.room}호 완료 보고</h2>
        <p style={{fontSize:14,color:'#64748b'}}>진행 체크 {done}/{items.length} · 청소 상태 {selected.status}</p>
        <label style={{display:'block',fontSize:14,fontWeight:700,marginBottom:8}}>완료 사진 5장 이상 선택 (화면 시연용)</label>
        <input type="file" accept="image/*" multiple onChange={e=>setPhotos(Array.from(e.target.files||[]))} disabled={!canEdit} style={{width:'100%',fontSize:13}} />
        <p style={{color:'#64748b',fontSize:12,lineHeight:1.5}}>선택된 사진 {photos.length}장 · 실제 서버 업로드 및 보관 기능은 아직 연결되지 않았습니다.</p>
        <label style={{display:'block',fontSize:14,fontWeight:700,margin:'18px 0 8px'}}>특이사항 / 시설 고장</label>
        <textarea value={selected.note} disabled={!canEdit} onChange={e=>update({note:e.target.value})} placeholder="파손, 오염, 재고 부족, 분실물 등을 작성해 주세요." style={{width:'100%',minHeight:100,borderRadius:10,border:'1px solid #cbd5e1',padding:10,boxSizing:'border-box',fontSize:14}} />
        <p style={{fontSize:12,color:'#64748b',margin:'12px 0'}}>필수 체크: 퇴실 확인, 마스터키 수령·반납, 도어락 잠금, 비품 보충</p>
        <button style={{...btn,width:'100%',background:'#111827',color:'white'}} onClick={submit} disabled={!canEdit||selected.status==='예정'}>청소 완료 요청 (시연)</button>
        {selected.status==='확인요청'&&<p style={{color:'#0369a1',fontSize:13}}>관리자 확인 요청 상태입니다. 정식 서버 통보는 이루어지지 않았습니다.</p>}
      </section>
    </>}

    <nav aria-label="호스트키퍼 하단 메뉴" style={{position:'sticky',bottom:0,margin:'22px -14px -95px',padding:'10px 16px 20px',background:'#fff',borderTop:'1px solid #e5e7eb',display:'flex',gap:8}}>
      {([{id:'today',text:'오늘 일정'},{id:'check',text:'청소 체크'},{id:'report',text:'완료 보고'}] as const).map(p=><button key={p.id} disabled={p.id!=='today'&&!selected} onClick={()=>changePage(p.id)} style={{...btn,flex:1,background:page===p.id?'#111827':'#fff',color:page===p.id?'#fff':'#374151',padding:'12px 4px'}}>{p.text}</button>)}
    </nav>
  </main>;
}

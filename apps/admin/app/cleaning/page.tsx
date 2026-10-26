'use client';

import { useEffect, useMemo, useState } from 'react';
import { Shell, card } from '../ui';

type RoomType = 'QUEEN' | 'TWIN';
type TaskStatus = '예정' | '청소중' | '확인요청' | '승인완료';
type CleaningTask = {
  id: string; date: string; room: string; assignee: string;
  status: TaskStatus; checked: string[]; note: string; updatedAt: string;
};

const queenRooms = ['101','201','202','301','302','401','402','501'];
const twinRooms = ['203','204','303','304','403','404'];
const roomNumbers = [...queenRooms, ...twinRooms].sort((a,b)=>Number(a)-Number(b));
const roomType = (room: string): RoomType => queenRooms.includes(room) ? 'QUEEN' : 'TWIN';
const waterCount = (room: string) => roomType(room) === 'QUEEN' ? 2 : 4;
const KEY = 'hosthelper-suyu-cleaning-v1';
const template = (room: string) => {
  const queen = roomType(room) === 'QUEEN';
  return [
    '체크아웃 확인 및 분실물·파손 점검',
    '1층 집기실 마스터키 수령',
    queen ? '퀸 1개: 매트리스 커버 1·이불 커버 1·일반 베개 커버 2·핑크 베개 커버 2 교체'
          : '슈퍼싱글 2개: 매트리스 커버 2·이불 커버 2·일반 베개 커버 4·핑크 베개 커버 4 교체',
    '객실 쓰레기 수거, 바닥·침대 아래·선반·창틀·거울 청소',
    '화장실 변기·세면대·샤워기·배수구·거울 청소, 휴지·샴푸·린스·바디워시 보충',
    '냉장고 청소 및 생수 ' + waterCount(room) + '개 비치',
    '수건 보충, 에어컨·냉장고·조명·온수·도어락 점검',
    '침구·객실·화장실·냉장고 등 완료 사진 5장 제출 확인',
    '객실 문 잠금 확인 및 마스터키 집기실 반납',
  ];
};
const todayKST = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const line = (v: string) => '"' + v.replace(/"/g, '""') + '"';
const viewStatus = (task: CleaningTask) => task.status;

export default function SuyuCleaningPage() {
  const [tasks, setTasks] = useState<CleaningTask[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [date, setDate] = useState(todayKST);
  const [room, setRoom] = useState('101');
  const [assignee, setAssignee] = useState('');
  const [notice, setNotice] = useState('');
  const [viewAll, setViewAll] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setTasks(parsed.filter(x => x && typeof x.id === 'string' && roomNumbers.includes(x.room)));
      }
    } catch { setNotice('기존 저장 자료를 읽지 못했습니다.'); }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) window.localStorage.setItem(KEY, JSON.stringify(tasks));
  }, [tasks, hydrated]);

  const visible = useMemo(() =>
    tasks.filter(t => viewAll ? t.date.startsWith(date.substring(0,7)) : t.date === date)
      .sort((a,b) => a.date.localeCompare(b.date) || Number(a.room)-Number(b.room)),
    [tasks,date,viewAll]);
  const total = visible.length;
  const approved = visible.filter(t=>t.status==='승인완료').length;
  const pending = visible.filter(t=>t.status!=='승인완료').length;

  const change = (id: string, update: Partial<CleaningTask>) =>
    setTasks(old=>old.map(t=>t.id===id ? {...t,...update,updatedAt:new Date().toISOString()} : t));

  const add = () => {
    if (tasks.some(t=>t.date===date && t.room===room)) {
      setNotice('이 날짜에 같은 객실 일정이 이미 있습니다.'); return;
    }
    setTasks(old=>[...old,{id:date+'-'+room,date,room,assignee:assignee.trim(),status:'예정',checked:[],note:'',updatedAt:new Date().toISOString()}]);
    setNotice(room+'호 청소 일정이 이 브라우저에 저장되었습니다.');
  };
  const copySchedule = async () => {
    const msg=['디하이브 수유 청소 일정 ('+(viewAll?date.slice(0,7):date)+')',
      ...visible.map(t=>t.date+' / '+t.room+'호 / '+roomType(t.room)==='QUEEN' ? '' : '')];
    const body = ['디하이브 수유 청소 일정 ('+(viewAll?date.slice(0,7):date)+')',
      ...visible.map(t=>t.date+' | '+t.room+'호 | '+(roomType(t.room)==='QUEEN'?'퀸 1개':'슈퍼싱글 2개')+' | 생수 '+waterCount(t.room)+'개 | '+t.status+' | 담당 '+(t.assignee||'미배정')),
      '청소 시 1층 집기실 마스터키 수령·반납 및 완료 사진 5장 제출을 확인해 주세요.'].join('\n');
    try { await navigator.clipboard.writeText(body); setNotice('공유용 일정이 복사되었습니다. 메시지에 붙여넣어 보내세요.'); }
    catch { setNotice('복사할 수 없습니다. HTTPS 환경과 브라우저 권한을 확인하세요.'); }
  };
  const downloadCsv = () => {
    const header = ['날짜','객실','침대','담당자','상태','생수','체크진행','총항목','메모','수정시각'];
    const rows = visible.map(t=>[t.date,t.room,roomType(t.room)==='QUEEN'?'퀸 1개':'슈퍼싱글 2개',t.assignee,t.status,String(waterCount(t.room)),String(t.checked.length),String(template(t.room).length),t.note,t.updatedAt]);
    const csv='\uFEFF'+[header,...rows].map(x=>x.map(line).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    const el=document.createElement('a'); el.href=url; el.download='suyu-cleaning-'+(viewAll?date.slice(0,7):date)+'.csv'; el.click(); URL.revokeObjectURL(url);
  };
  const setStatus = (t:CleaningTask,status:TaskStatus) => {
    if ((status==='확인요청'||status==='승인완료') && template(t.room).some(v=>!t.checked.includes(v))) {
      setNotice('체크리스트 전 항목을 확인한 후 완료 요청 또는 승인할 수 있습니다.'); return;
    }
    change(t.id,{status}); setNotice(t.room+'호 상태 변경: '+status);
  };

  const label: React.CSSProperties = {fontSize:13,fontWeight:600,color:'#444',display:'block',marginBottom:6};
  const input: React.CSSProperties = {border:'1px solid #d1d5db',borderRadius:8,padding:'10px 12px',fontSize:15,width:'100%',boxSizing:'border-box'};
  const button: React.CSSProperties = {padding:'10px 14px',border:'1px solid #d1d5db',background:'#fff',borderRadius:8,cursor:'pointer',fontSize:14,fontWeight:600};
  return <Shell title="디하이브 수유 | 청소 일정·체크">
    <p style={{color:'#6b7280',lineHeight:1.6}}>14개 객실 전용 운영표입니다. 2인실 생수 2개, 4인실 생수 4개를 자동 적용합니다.</p>
    <div style={{...card,background:'#fffbeb',marginBottom:16,fontSize:13,lineHeight:1.6}}>
      <strong>현재 운영 방식: 브라우저 임시 저장</strong> — 이 기기에서만 자료가 유지됩니다. 청소업체와 자동 동기화되거나 에어비앤비 예약이 자동 반영되는 상태는 아닙니다. 일정 공유 버튼으로 내용을 복사해 전달하고, 별도로 CSV 파일을 보관해 주세요.
    </div>
    <section style={{...card,marginBottom:16}}>
      <h2 style={{marginTop:0,fontSize:18}}>청소 일정 등록</h2>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12}}>
        <label><span style={label}>청소일</span><input style={input} type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
        <label><span style={label}>객실</span><select style={input} value={room} onChange={e=>setRoom(e.target.value)}>{roomNumbers.map(r=><option key={r} value={r}>{r}호 · {roomType(r)==='QUEEN'?'퀸':'슈퍼싱글 2개'}</option>)}</select></label>
        <label><span style={label}>청소 담당자</span><input style={input} placeholder="담당자 입력" value={assignee} onChange={e=>setAssignee(e.target.value)} /></label>
      </div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}><button style={{...button,background:'#111827',color:'white'}} onClick={add}>일정 등록</button><button style={button} onClick={copySchedule}>일정 공유용 복사</button><button style={button} onClick={downloadCsv}>CSV 내보내기</button></div>
      <label style={{fontSize:13,display:'flex',alignItems:'center',gap:8,marginTop:14}}><input type="checkbox" checked={viewAll} onChange={e=>setViewAll(e.target.checked)} /> 해당 월 전체 일정 보기</label>
    </section>
    {notice&&<p role="status" style={{padding:'10px 14px',background:'#f3f4f6',borderRadius:8}}>{notice}</p>}
    <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16}}>
      {[[String(total),'전체 일정'],[String(approved),'승인 완료'],[String(pending),'진행 필요']].map(([value,title])=><div key={title} style={{...card,minWidth:110,flex:1}}><div style={{fontSize:13,color:'#666'}}>{title}</div><strong style={{fontSize:25}}>{value}</strong></div>)}
    </div>
    {visible.length===0?<div style={{...card,textAlign:'center',color:'#6b7280'}}>등록된 청소 일정이 없습니다. 실제 체크아웃 일정 확인 후 등록해 주세요.</div>:visible.map(t=><article key={t.id} style={{...card,marginBottom:14}}>
      <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexWrap:'wrap'}}>
        <div><strong style={{fontSize:20}}>{t.room}호</strong> <span style={{color:'#666',fontSize:13}}>{t.date} · {roomType(t.room)==='QUEEN'?'퀸 1개':'슈퍼싱글 2개'} · 생수 {waterCount(t.room)}개</span></div>
        <select aria-label={t.room+'호 청소상태'} value={t.status} onChange={e=>setStatus(t,e.target.value as TaskStatus)} style={{...input,width:'auto'}}>{(['예정','청소중','확인요청','승인완료'] as TaskStatus[]).map(v=><option key={v}>{v}</option>)}</select>
      </header>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:10,margin:'12px 0'}}>
        <label style={{fontSize:13}}>담당자<input style={{...input,marginTop:4}} value={t.assignee} onChange={e=>change(t.id,{assignee:e.target.value})}/></label>
        <label style={{fontSize:13}}>특이사항<textarea style={{...input,marginTop:4,minHeight:44,resize:'vertical'}} value={t.note} onChange={e=>change(t.id,{note:e.target.value})} placeholder="분실물·파손·부족품 등"/></label>
      </div>
      <div style={{fontSize:13,fontWeight:600,color:'#666',marginBottom:8}}>청소 체크리스트 ({t.checked.length}/{template(t.room).length})</div>
      {template(t.room).map(item=><label key={item} style={{display:'flex',gap:10,alignItems:'start',padding:'8px 0',borderTop:'1px solid #f3f4f6',lineHeight:1.5,fontSize:14}}>
        <input type="checkbox" checked={t.checked.includes(item)} onChange={e=>{
          const checked=e.target.checked?[...t.checked,item]:t.checked.filter(x=>x!==item);
          change(t.id,{checked,status:t.status==='승인완료'&&checked.length<template(t.room).length?'청소중':t.status});
        }}/> <span>{item}</span>
      </label>)}
      <div style={{display:'flex',gap:8,justifyContent:'space-between',alignItems:'center',marginTop:10,flexWrap:'wrap'}}>
        <small style={{color:'#6b7280'}}>체크인 16:00 이전 청소·잠금·마스터키 반납 확인</small>
        <button style={{...button,color:'#991b1b'}} onClick={()=>{if(window.confirm(t.room+'호 '+t.date+' 청소 일정을 삭제할까요?'))setTasks(old=>old.filter(x=>x.id!==t.id))}}>일정 삭제</button>
      </div>
    </article>)}
  </Shell>;
}

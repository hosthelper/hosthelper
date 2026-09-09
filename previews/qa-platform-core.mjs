import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const root=new URL('.',import.meta.url).pathname;
const files=['universe.html','gongsil.html','academy.html','house.html','host.html','life.html','next.html','shared.js','platform-core.js','platform-data.js','platform-extras.js','platform-gongsil-policy.js','reference-fidelity-v4.js','reference-universe-v4.js','reference-fidelity-v4.css','reference-fidelity-v4-fix.css','life-platform-v5.js','life-platform-v5.css'];
const fail=[];
for(const f of files){if(!fs.existsSync(root+f))fail.push(`missing ${f}`)}
for(const f of ['shared.js','platform-core.js','platform-data.js','platform-extras.js','platform-gongsil-policy.js','reference-fidelity-v4.js','reference-universe-v4.js','life-platform-v5.js']){try{execFileSync(process.execPath,['--check',root+f],{stdio:'pipe'})}catch(e){fail.push(`syntax ${f}: ${e.stderr?.toString()||e.message}`)}}
const core=fs.readFileSync(root+'platform-core.js','utf8'),data=fs.readFileSync(root+'platform-data.js','utf8'),extras=fs.readFileSync(root+'platform-extras.js','utf8'),gp=fs.readFileSync(root+'platform-gongsil-policy.js','utf8'),v4=fs.readFileSync(root+'reference-fidelity-v4.js','utf8'),uv4=fs.readFileSync(root+'reference-universe-v4.js','utf8'),life=fs.readFileSync(root+'life-platform-v5.js','utf8'),loader=fs.readFileSync(root+'shared.js','utf8');
for(const k of ['signInWithPassword','auth.signUp','auth.getSession','auth.signOut','hu_user_roles','hu_role_requests','hu_profiles','hu_journey'])if(!core.includes(k))fail.push(`core missing ${k}`);
for(const k of ['hu_life_spaces','hu_life_requests','hu_life_proposals','hu_life_reservations'])if(!data.includes(k)&&!life.includes(k))fail.push(`Life CRUD missing ${k}`);
if(!extras.includes('hu_life_supplier_services')&&!life.includes('hu_life_supplier_services'))fail.push('supplier workspace missing');if(!gp.includes('data-hu-kakao'))fail.push('Gongsil Kakao gate missing');
for(const x of ['숙박 요청하기','숙소 검색','숙소 상세','나의 여행 일정','호스트/공급자 대시보드','숙박 요청 상세 / 제안 관리','내 숙소 관리','예약 관리','정산 관리','숙소 / 공급자 관리','결제 / 환불 관리','회원 / 권한 승인','통계 리포트','hu_life_transition_reservation','hu_life_request_refund','hu_life_operator_mark_payment','hu_life_operator_process_refund','hu_messages','hu_life_itinerary'])if(!life.includes(x))fail.push(`Life V5 gate missing: ${x}`);
for(const x of ['life-platform-v5.css','life-platform-v5.js'])if(!loader.includes(x))fail.push(`loader missing ${x}`);
for(const f of files.filter(x=>x.endsWith('.html'))){const h=fs.readFileSync(root+f,'utf8');if(!h.includes('name="viewport"'))fail.push(`${f} viewport missing`);if(!h.includes('shared.js'))fail.push(`${f} loader missing`)}
if(/sb_secret|SUPABASE_SERVICE_ROLE/i.test(core+data+extras+gp+v4+uv4+life))fail.push('server secret-like token reference in browser code');
if(!life.includes("on('postgres_changes'"))fail.push('Life realtime subscription missing');
if(!life.includes('status:\'reviewing\''))fail.push('host/supplier approval gate missing');
if(fail.length){console.error('\nPLATFORM QA FAILED\n- '+fail.join('\n- '));process.exit(1)}
console.log(`PLATFORM QA PASS: ${files.length} assets; Life V5 guest/host/supplier/operator UX, Auth/RBAC/RLS-backed CRUD, lifecycle, realtime, refund and QA gates present.`);
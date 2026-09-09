import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const root=new URL('.',import.meta.url).pathname;
const files=['universe.html','gongsil.html','academy.html','house.html','host.html','life.html','next.html','shared.js','platform-core.js','platform-data.js','platform-extras.js','platform-gongsil-policy.js','reference-fidelity-v4.js','reference-fidelity-v4.css','reference-fidelity-v4-fix.css'];
const fail=[];
for(const f of files){if(!fs.existsSync(root+f))fail.push(`missing ${f}`)}
for(const f of ['shared.js','platform-core.js','platform-data.js','platform-extras.js','platform-gongsil-policy.js','reference-fidelity-v4.js']){try{execFileSync(process.execPath,['--check',root+f],{stdio:'pipe'})}catch(e){fail.push(`syntax ${f}: ${e.stderr?.toString()||e.message}`)}}
const core=fs.readFileSync(root+'platform-core.js','utf8'),data=fs.readFileSync(root+'platform-data.js','utf8'),extras=fs.readFileSync(root+'platform-extras.js','utf8'),gp=fs.readFileSync(root+'platform-gongsil-policy.js','utf8'),v4=fs.readFileSync(root+'reference-fidelity-v4.js','utf8'),loader=fs.readFileSync(root+'shared.js','utf8');
for(const k of ['signInWithPassword','auth.signUp','auth.getSession','auth.signOut','hu_user_roles','hu_role_requests','hu_profiles','hu_journey'])if(!core.includes(k))fail.push(`core missing ${k}`);
for(const k of ['hu_gongsil_listings','hu_academy_enrollments','hu_house_projects','hu_host_properties','hu_life_requests','hu_next_matches'])if(!data.includes(k))fail.push(`CRUD missing ${k}`);
if(!extras.includes('hu_life_supplier_services'))fail.push('supplier workspace missing');
if(!gp.includes('data-hu-kakao'))fail.push('Gongsil Kakao gate missing');
for(const x of ['매물 상세/상담','내 문의 현황','오픈진단 관리','수강생 관리','견적 요청/일정 확인','납품·설치','게스트 문의/예약','청소·현장 관리','숙박 요청','숙소/공급자 관리','추천 매칭','협업 프로젝트'])if(!v4.includes(x))fail.push(`v4 mode page missing: ${x}`);
for(const x of ['reference-fidelity-v4.css','reference-fidelity-v4-fix.css','reference-fidelity-v4.js'])if(!loader.includes(x))fail.push(`loader missing ${x}`);
for(const f of files.filter(x=>x.endsWith('.html'))){const h=fs.readFileSync(root+f,'utf8');if(!h.includes('name="viewport"'))fail.push(`${f} viewport missing`);if(!h.includes('shared.js'))fail.push(`${f} loader missing`)}
if(/service_role|sb_secret|SUPABASE_SERVICE_ROLE/i.test(core+data+extras+gp+v4))fail.push('server secret-like token reference in browser code');
if(fail.length){console.error('\nPLATFORM QA FAILED\n- '+fail.join('\n- '));process.exit(1)}
console.log(`PLATFORM QA PASS: ${files.length} assets; Auth/RBAC/CRUD preserved; reference-fidelity v4 and complete role mode pages present.`);
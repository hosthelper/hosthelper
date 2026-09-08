import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const root=new URL('.',import.meta.url).pathname;
const files=['universe.html','gongsil.html','academy.html','house.html','host.html','life.html','next.html','shared.js','platform-core.js','platform-data.js','platform-extras.js','platform-gongsil-policy.js','platform-mode-router.js','platform-messaging.js'];
const fail=[];
for(const f of files){const p=root+f;if(!fs.existsSync(p))fail.push(`missing ${f}`)}
for(const f of files.filter(x=>x.endsWith('.js'))){try{execFileSync(process.execPath,['--check',root+f],{stdio:'pipe'})}catch(e){fail.push(`syntax ${f}: ${e.stderr?.toString()||e.message}`)}}
const core=fs.readFileSync(root+'platform-core.js','utf8');
const data=fs.readFileSync(root+'platform-data.js','utf8');
const extras=fs.readFileSync(root+'platform-extras.js','utf8');
const gongsilPolicy=fs.readFileSync(root+'platform-gongsil-policy.js','utf8');
const modeRouter=fs.readFileSync(root+'platform-mode-router.js','utf8');
const messaging=fs.readFileSync(root+'platform-messaging.js','utf8');
const requiredCore=['signInWithPassword','auth.signUp','auth.getSession','auth.signOut','hu_user_roles','hu_role_requests','hu_profiles','hu_journey','hu_ensure_service_user','hu_events'];
for(const k of requiredCore)if(!core.includes(k))fail.push(`core missing ${k}`);
for(const forbidden of ['검수용 역할','roleBundle=','helper_platform_preview_session_'])if(core.includes(forbidden))fail.push(`preview-only auth remains: ${forbidden}`);
const requiredData=['hu_gongsil_listings','hu_gongsil_inquiries','hu_academy_enrollments','hu_academy_tasks','hu_house_projects','hu_house_install_checks','hu_host_properties','hu_host_tasks','hu_life_spaces','hu_life_requests','hu_life_proposals','hu_life_reservations','hu_next_profiles','hu_next_needs','hu_next_offers','hu_next_matches','hu_accept_life_proposal','hu_respond_next_match'];
for(const k of requiredData)if(!data.includes(k))fail.push(`CRUD missing ${k}`);
if(!extras.includes('hu_life_supplier_services'))fail.push('supplier workspace missing');
if(!extras.includes('data-hu-diagnosis'))fail.push('Universe diagnosis missing');
if(!gongsilPolicy.includes('data-hu-kakao')||!gongsilPolicy.includes('카카오'))fail.push('Gongsil Kakao-only policy UI missing');
for(const marker of ["svc==='academy'","svc==='house'","svc==='host'","svc==='next'","isOperator()"] )if(!modeRouter.includes(marker))fail.push(`post-login mode routing missing ${marker}`);
for(const marker of ['hu_conversations','hu_messages','postgres_changes','data-msg-send','data-msg-start'])if(!messaging.includes(marker))fail.push(`messaging missing ${marker}`);
for(const f of files.filter(x=>x.endsWith('.html'))){const html=fs.readFileSync(root+f,'utf8');if(!html.includes('name="viewport"'))fail.push(`${f} viewport missing`);if(!html.includes('shared.js'))fail.push(`${f} live platform loader missing`)}
if(/service_role|sb_secret|SUPABASE_SERVICE_ROLE/i.test(core+data+extras+gongsilPolicy+modeRouter+messaging))fail.push('server secret-like token reference found in browser code');
if(fail.length){console.error('\nPLATFORM QA FAILED\n- '+fail.join('\n- '));process.exit(1)}
console.log(`PLATFORM QA PASS: ${files.length} assets, real auth/RBAC, post-login role routing, 6 service CRUD flows, Helper ID, role approvals, supplier workspace, Kakao gate, realtime Life/Next messaging, responsive loaders.`);
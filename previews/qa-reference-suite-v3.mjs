import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const js=fs.readFileSync('previews/reference-suite-v3.js','utf8');
const css=fs.readFileSync('previews/reference-suite-v3.css','utf8');
const shared=fs.readFileSync('previews/shared.js','utf8');
const fail=[];
try{execFileSync(process.execPath,['--check','previews/reference-suite-v3.js'],{stdio:'pipe'})}catch(e){fail.push('reference-suite JS syntax error')}
for(const f of ['gongsil.html','academy.html','house.html','host.html','life.html','next.html'])if(!js.includes(`'${f}'`))fail.push('platform missing '+f);
for(const token of ['매물 검증','무료진단 관리','현장 실측·제안','계약·온보딩','숙박 요청','숙소·공급자 관리','추천 매칭'])if(!js.includes(token))fail.push('mode page missing '+token);
for(const token of ['body[data-ref-platform="gongsil"]','body[data-ref-platform="academy"]','body[data-ref-platform="house"]','body[data-ref-platform="host"]','body[data-ref-platform="life"]'])if(!css.includes(token))fail.push('brand CSS missing '+token);
if(!shared.includes('reference-suite-v3.css')||!shared.includes('reference-suite-v3.js'))fail.push('shared loader missing reference suite');
if(fail.length){console.error('REFERENCE SUITE V3 QA FAILED\n- '+fail.join('\n- '));process.exit(1)}
console.log('REFERENCE SUITE V3 QA PASS: platform-specific mode pages and visual layers found.');

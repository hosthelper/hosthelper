// 창업정보 모임 — 자동 콘텐츠 발행 (AI 원본 + 공공자료 재가공)
//
// 매일 09:00 KST(=00:00 UTC)에 GitHub Action이 실행합니다. GitHub Models 무료 추론
// (openai/gpt-4o-mini 기본, GITHUB_TOKEN 사용 — 별도 키·가입 불필요)로 주제를 로테이션하며
// 창업 정보 기사를 생성해, 라이브 SPA(app.html)의 ARTICLES/SOURCES에 직접 삽입하고
// index.html로 복사(Netlify 배포본과 동일)합니다.
// 워크플로에 permissions: models: read 필요. https://github.com/marketplace/models
//
// 중요: 라이브 사이트는 app.html 단일 파일이 원본이며, 기사는 그 안의 var ARTICLES=[...] 에서
// 읽습니다. 과거의 posts/ 개별 페이지 구조는 더 이상 쓰지 않습니다.
//
// 저작권 안전: 언론·매거진 글을 복제하지 않습니다. 공공(공공누리) 자료·데이터를 근거로
// 재구성하고 출처를 표기합니다. web_search는 공공기관 도메인으로 제한합니다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '..');
const APP_HTML = path.join(SITE, 'app.html');
const INDEX_HTML = path.join(SITE, 'index.html');

const MODEL = process.env.CHANGUP_AI_MODEL || 'openai/gpt-4o-mini'; // GitHub Models 무료(하루 1편에 충분)

// 카테고리는 목록 필터 칩과 일치해야 함(정책자금·권리금·운영방식·상권분석)
const TOPICS = [
  { cat: '정책자금', topic: '소상공인 정책자금(시설·운전자금) 활용 방법과 신청 순서' },
  { cat: '정책자금', topic: '예비창업자 사전보증으로 계약 전 대출 한도를 확정하는 절차' },
  { cat: '정책자금', topic: '지역신용보증재단·신용보증기금 창업 보증 활용법' },
  { cat: '정책자금', topic: '정부·지자체 창업 지원사업 공고를 읽고 지원하는 법' },
  { cat: '권리금', topic: '바닥·영업·시설 권리금의 차이와 적정 권리금 산정 기준' },
  { cat: '권리금', topic: '권리금에 붙는 세금과 권리양수도 계약서 유의점' },
  { cat: '권리금', topic: '권리금 분쟁을 예방하는 매출 검증과 계약 실무' },
  { cat: '운영방식', topic: '직영·풀오토·위탁·본사(프랜차이즈) 운영 방식 비교' },
  { cat: '운영방식', topic: '프랜차이즈 정보공개서에서 꼭 확인할 항목(평균매출·폐점률)' },
  { cat: '운영방식', topic: '무인·자동화 매장 창업의 장단점과 현실적 수익 구조' },
  { cat: '상권분석', topic: '상권정보시스템 등 공공데이터로 상권을 검증하는 순서' },
  { cat: '상권분석', topic: '지방행정 인허가데이터로 폐업률 높은 자리를 거르는 법' },
  { cat: '상권분석', topic: '배후세대·생활인구로 업종 적합성을 판단하는 법' },
];

const GOV_DOMAINS = [
  'semas.or.kr', 'sbiz.or.kr', 'ftc.go.kr', 'kodit.or.kr', 'kosmes.or.kr',
  'bizinfo.go.kr', 'k-startup.go.kr', 'mss.go.kr', 'korea.kr', 'localdata.go.kr',
];

const Article = z.object({
  title: z.string().min(10).max(60),
  excerpt: z.string().min(10).max(120),
  lead: z.string().min(40),
  blocks: z.array(z.object({ h2: z.string().min(2), p: z.string().min(80) })).min(3).max(6),
  summary: z.array(z.string().min(8)).min(3).max(5),
  source: z.string().min(20),
  sources: z.array(z.object({ label: z.string().min(2).max(80), url: z.string().url() })).min(1).max(6),
});

const SYSTEM = `당신은 한국 창업(점포 양수도)·소상공인 정책 전문 에디터입니다. '창업정보 모임'의 정보 코너에 실을 뉴스 기사형 글을 작성합니다.

규칙:
- 반드시 "원본"으로 작성합니다. 언론·블로그·매거진 글을 그대로 옮기지 않습니다.
- 공공기관(소상공인시장진흥공단·중기부·공정위·신용보증기금 등) 자료·데이터를 근거로 재구성하고, 출처를 명시합니다(공공누리 자유이용 범위).
- 사실만 씁니다. 확인되지 않은 수치·특정 수익·대출 승인은 단정하지 않고 "통상/기관 확인 필요"로 표현합니다.
- 부동산 중개법 주의: 우리는 "중개" 업체가 아닙니다. "중개/부동산 중개/중개수수료" 표현을 쓰지 말고, 임대차·매매 계약은 "개업공인중개사를 통해 진행"으로 표현합니다.
- 분량은 네이버 뉴스기사 평균 수준(본문 공백 제외 약 900~1,300자, 최소 500자 이상).
- 톤: 객관적·정보 전달 중심. 과장 광고 표현 금지.
- 출력은 오직 하나의 JSON 객체. 코드펜스·설명·서두 없이 JSON만 출력합니다.

JSON 스키마:
{
  "title": "헤드라인(공백 포함 40자 안팎)",
  "excerpt": "목록용 한 줄 요약(60자 안팎)",
  "lead": "리드문 1~2문장(요약)",
  "blocks": [ {"h2":"소제목","p":"본문 문단(HTML 허용: <b> 강조만)"} , ... 4개 내외 ],
  "summary": ["핵심 요약 3~4개"],
  "source": "근거·출처 문장(공공기관 명시 + 보장하지 않는다는 고지)",
  "sources": [ {"label":"소상공인시장진흥공단 정책자금","url":"https://ols.semas.or.kr"} ]
}
- "sources"는 반드시 <b>공공기관·정부·공식 사이트의 https URL</b>만 2~4개 넣습니다(언론·블로그 금지). 실제 존재하는 대표 도메인을 사용하세요(예: semas.or.kr, sg.sbiz.or.kr, ftc.go.kr, franchise.ftc.go.kr, law.go.kr, kodit.co.kr, localdata.go.kr, sgis.kostat.go.kr, hometax.go.kr, bizinfo.go.kr, smes.go.kr).
본문 p 안에는 <b>강조</b>만 허용하고 다른 태그·링크는 넣지 마세요.`;

async function generate(topic, cat) {
  const token = process.env.GITHUB_TOKEN;
  const today = new Date().toISOString().slice(0, 10);
  const userPrompt = `오늘 날짜: ${today}\n카테고리: ${cat}\n주제: ${topic}\n\n`
    + `위 주제로 뉴스 기사형 원본 글을 작성하세요. 공공기관(소상공인시장진흥공단·중기부·공정위 등) 자료를 근거로 재구성하고, "sources"에는 실제 존재하는 공식 공공기관 https URL만 2~4개 넣으세요(예: ${GOV_DOMAINS.join(', ')}). category는 "${cat}"로 고정. 오직 JSON 객체만 출력하세요.`;
  const res = await fetch('https://models.github.ai/inference/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub Models ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  if (!text) throw new Error('GitHub Models 응답이 비었습니다: ' + JSON.stringify(data).slice(0, 300));
  const jsonStr = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = jsonStr.indexOf('{'), end = jsonStr.lastIndexOf('}');
  const parsed = JSON.parse(jsonStr.slice(start, end + 1));
  return Article.parse(parsed);
}

function plainLen(a) {
  const t = (a.lead + ' ' + a.blocks.map(b => b.h2 + ' ' + b.p).join(' ') + ' ' + a.summary.join(' '))
    .replace(/<[^>]+>/g, '');
  return t.replace(/\s/g, '').length;
}

function slugify(cat) {
  const map = { '정책자금': 'policy', '권리금': 'premium', '운영방식': 'operation', '상권분석': 'market' };
  return map[cat] || 'post';
}

// SPA(app.html) 인라인 문자열용 이스케이프: <b>만 허용, 나머지 태그 제거 후 JS 작은따옴표 문자열로.
function sanitize(s) {
  return String(s).replace(/<(?!\/?b\b)[^>]*>/gi, ''); // b 외 태그 제거
}
function jsStr(s) {
  return sanitize(s)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

// 새 기사 객체 문자열(ARTICLES 배열 최상단 삽입용)
function articleLiteral(a, slug, cat, dateDisp) {
  const blocks = a.blocks.map(b => `   ['${jsStr(b.h2)}','${jsStr(b.p)}']`).join(',\n');
  const summary = a.summary.map(s => `'${jsStr(s)}'`).join(',');
  return ` {slug:'${slug}',cat:'${cat}',date:'${dateDisp}',\n`
    + `  title:'${jsStr(a.title)}',\n`
    + `  excerpt:'${jsStr(a.excerpt)}',\n`
    + `  lead:'${jsStr(a.lead)}',\n`
    + `  blocks:[\n${blocks}],\n`
    + `  summary:[${summary}],\n`
    + `  src:'${jsStr(a.source)}'},\n`;
}

// SOURCES 맵 항목 문자열
function sourcesLiteral(a, slug) {
  const entries = a.sources.map(s => `['${jsStr(s.label)}','${jsStr(s.url)}']`).join(',');
  return ` '${slug}':[${entries}],\n`;
}

// var ARTICLES=[ / var SOURCES={ 바로 뒤에 삽입
function insertAfter(html, anchor, insertText) {
  const i = html.indexOf(anchor);
  if (i < 0) throw new Error(`anchor not found (구조 변경?): ${anchor}`);
  const at = i + anchor.length;
  return html.slice(0, at) + '\n' + insertText + html.slice(at);
}

// app.html 에 새 기사 반영 (ARTICLES 최상단 + SOURCES + TODAY 갱신)
function applyToApp(html, a, slug, cat, dateDisp) {
  if (html.includes(`slug:'${slug}'`)) {
    return null; // 이미 오늘 같은 slug 존재 → 중복 방지
  }
  let out = insertAfter(html, 'var ARTICLES=[', articleLiteral(a, slug, cat, dateDisp));
  out = insertAfter(out, 'var SOURCES={', sourcesLiteral(a, slug));
  out = out.replace(/var TODAY='[^']*';/, `var TODAY='${dateDisp}';`);
  return out;
}

async function main() {
  const now = new Date();
  const idx = (now.getUTCFullYear() * 100000 + now.getUTCMonth() * 1000 + now.getUTCDate() * 24 + now.getUTCHours()) % TOPICS.length;
  const { topic, cat } = TOPICS[idx];
  console.log(`[generate] topic="${topic}" cat=${cat} model=${MODEL}`);

  const iso = now.toISOString().slice(0, 10);
  const dateDisp = iso.replace(/-/g, '.');
  const slug = `${slugify(cat)}-${iso.replace(/-/g, '')}`;

  const appHtml = fs.readFileSync(APP_HTML, 'utf8');
  if (appHtml.includes(`slug:'${slug}'`)) {
    console.log(`[skip] 오늘(${slug}) 기사가 이미 있습니다 — 건너뜁니다.`);
    return;
  }

  let a;
  for (let attempt = 1; attempt <= 2; attempt++) {
    a = await generate(topic, cat);
    const len = plainLen(a);
    console.log(`[generate] attempt ${attempt}: 본문 ${len}자`);
    if (len >= 600) break;
    if (attempt === 2) throw new Error(`본문이 너무 짧습니다(${len}자).`);
  }

  const updated = applyToApp(appHtml, a, slug, cat, dateDisp);
  if (!updated) {
    console.log('[skip] 중복 slug — 건너뜁니다.');
    return;
  }
  fs.writeFileSync(APP_HTML, updated);
  fs.writeFileSync(INDEX_HTML, updated); // Netlify 배포본(cp app.html index.html)과 동일하게 동기화
  console.log(`[write] app.html + index.html 에 기사 삽입: ${slug}`);

  const out = process.env.GITHUB_OUTPUT;
  if (out) fs.appendFileSync(out, `slug=${slug}\ntitle=${a.title}\ncat=${cat}\n`);
  console.log(`[done] ${a.title}`);
}

export { applyToApp, articleLiteral, sourcesLiteral, insertAfter, plainLen, jsStr, Article, TOPICS, slugify };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // 토큰 미설정 시(로컬 등): 실패로 빨간불 내지 말고 조용히 건너뛴다.
  // GitHub Actions에서는 GITHUB_TOKEN이 자동 주입되므로 항상 동작합니다(permissions: models: read 필요).
  if (!process.env.GITHUB_TOKEN) {
    console.warn('[skip] GITHUB_TOKEN 미설정 — 자동 기사 생성을 건너뜁니다. (GitHub Actions에서는 자동 주입됩니다)');
    process.exit(0);
  }
  main().catch((e) => {
    const msg = (e && e.message) ? e.message : String(e);
    // 무료 한도 초과·과부하·네트워크 등 "일시적 API 오류"만 조용히 건너뛴다(exit 0).
    // 구조/코드 오류(anchor not found 등)는 빨간불(exit 1)로 드러내 재발을 즉시 알린다.
    const transient = /rate.?limit|RateLimitReached|tokens per|requests per|quota|overloaded|unavailable|ETIMEDOUT|ECONNRESET|fetch failed|GitHub Models (429|500|502|503|529)/i.test(msg);
    if (transient) {
      console.warn('[skip] 일시적 API 오류 — 이번 회차 건너뜁니다: ' + msg);
      if (/rate.?limit|RateLimitReached|429/i.test(msg)) {
        console.warn('[hint] GitHub Models 무료 한도를 넘었습니다. 잠시 후 다음 회차에 자동 재시도됩니다.');
      }
      process.exit(0);
    }
    console.error('[error] 자동 기사 생성 실패(구조/코드 오류): ' + msg);
    process.exit(1);
  });
}

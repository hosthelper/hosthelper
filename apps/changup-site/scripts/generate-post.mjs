// 창업정보 모임 — 자동 콘텐츠 발행 (① AI 원본 + ③ 공공 보도자료 재가공)
//
// 5시간마다 GitHub Action이 실행합니다. Claude(@anthropic-ai/sdk, claude-opus-4-7 기본)로
// 주제를 로테이션하며 네이버 뉴스기사 평균 분량(약 1,500자, 최소 500자)의 "원본" 창업 정보
// 기사를 생성해 posts/ 에 파일을 추가하고, 목록/홈 피드를 갱신합니다.
//
// 저작권 안전: 언론·매거진 글을 복제하지 않습니다. 공공(공공누리) 보도자료·데이터를 근거로
// 재구성하고 출처를 표기합니다. web_search는 공공기관 도메인으로 제한합니다.
//
// M&A 분리 유지: @hosthelper/ai 게이트웨이에 의존하지 않는 독립 스크립트입니다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '..');
const POSTS = path.join(SITE, 'posts');

const MODEL = process.env.CHANGUP_AI_MODEL || 'claude-opus-4-7'; // CLAUDE.md 규약 준수

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
});

const SYSTEM = `당신은 한국 창업(점포 양수도)·소상공인 정책 전문 에디터입니다. '창업정보 모임'의 정보 코너에 실을 뉴스 기사형 글을 작성합니다.

규칙:
- 반드시 "원본"으로 작성합니다. 언론·블로그·매거진 글을 그대로 옮기지 않습니다.
- 공공기관(소상공인시장진흥공단·중기부·공정위·신용보증기금 등) 자료·데이터를 근거로 재구성하고, 출처를 명시합니다(공공누리 자유이용 범위).
- 사실만 씁니다. 확인되지 않은 수치·특정 수익·대출 승인은 단정하지 않고 "통상/기관 확인 필요"로 표현합니다.
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
  "source": "근거·출처 문장(공공기관 명시 + 보장하지 않는다는 고지)"
}
본문 p 안에는 <b>강조</b>만 허용하고 다른 태그·링크는 넣지 마세요.`;

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
// p/lead/source는 <b>만 허용 → 이스케이프 후 <b> 복원
function richText(s) {
  return esc(s).replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>');
}
function plainLen(a) {
  const t = (a.lead + ' ' + a.blocks.map(b => b.h2 + ' ' + b.p).join(' ') + ' ' + a.summary.join(' '))
    .replace(/<[^>]+>/g, '');
  return t.replace(/\s/g, '').length;
}

const TOKENS = fs.readFileSync(path.join(POSTS, '_tokens.css'), 'utf8');

function renderArticle(a, cat, dateDisp) {
  const body = a.blocks.map(b => `  <h2>${richText(b.h2)}</h2>\n  <p>${richText(b.p)}</p>`).join('\n');
  const sm = a.summary.map(s => `    <li>${richText(s)}</li>`).join('\n');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(a.title)} — 창업정보 모임</title>
<meta name="description" content="${esc(a.excerpt)}">
<style>
${TOKENS}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font-family:'Pretendard','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.6;word-break:keep-all}
.bar{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.bar .row{max-width:600px;margin:0 auto;padding:.75rem 1.25rem;display:flex;align-items:center;justify-content:space-between}
.brand-id{display:flex;align-items:center;gap:.55rem;text-decoration:none;color:var(--ink);font-weight:800;font-size:1rem;letter-spacing:-.02em}
.logo{width:30px;height:30px;border-radius:9px;background:var(--brand);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:.95rem}
.nav{display:flex;align-items:center;gap:1.1rem}.nav .lnk{font-size:.9rem;font-weight:700;color:var(--ink);text-decoration:none}
.nav .lnk[aria-current]{color:var(--brand)}
.navcta{font-size:.83rem;font-weight:700;color:#fff;background:var(--brand);padding:.5rem 1rem;border-radius:999px;text-decoration:none}
main{max-width:600px;margin:0 auto;padding:.5rem 1.5rem 3rem}
.cat{display:inline-block;margin:1.4rem 0 .5rem;background:var(--tint);color:var(--brand-d);font-size:.74rem;font-weight:700;padding:.28rem .7rem;border-radius:999px}
.date{color:var(--mute);font-size:.78rem;margin:0 0 .5rem}
h1{font-size:1.7rem;line-height:1.35;letter-spacing:-.02em;font-weight:800;margin:.2rem 0 1.1rem;text-wrap:balance}
.lead{font-size:1.05rem;line-height:1.75;color:var(--ink);font-weight:600;margin:0 0 1.6rem;padding-bottom:1.4rem;border-bottom:1px solid var(--line)}
h2{font-size:1.18rem;font-weight:800;letter-spacing:-.01em;margin:2rem 0 .7rem}
main p{color:var(--sub);font-size:1rem;line-height:1.85;margin:0 0 1.1rem}main p b{color:var(--ink);font-weight:700}
.summary{margin:2rem 0 0;background:var(--tint);border-radius:var(--r);padding:1.3rem 1.4rem}
.summary b{display:block;color:var(--brand-d);font-size:.92rem;font-weight:800;margin-bottom:.6rem}
.summary ul{margin:0;padding-left:1.1rem}.summary li{color:var(--ink);font-size:.94rem;line-height:1.7;margin-bottom:.4rem}
.source{color:var(--mute);font-size:.78rem;line-height:1.75;margin:1.8rem 0 0;padding-top:1.2rem;border-top:1px solid var(--line)}
.btn{display:block;text-align:center;margin-top:1.8rem;padding:1rem 1.4rem;border-radius:999px;background:var(--brand);color:#fff;font-weight:800;text-decoration:none;box-shadow:0 8px 22px rgba(14,115,88,.28)}
.back{display:inline-block;margin-top:1.2rem;font-size:.82rem;color:var(--brand);text-decoration:none;font-weight:700}
a:focus-visible{outline:2px solid var(--brand);outline-offset:3px}
</style>
</head>
<body>
<div class="bar"><div class="row">
  <a class="brand-id" href="../"><span class="logo">창</span>창업정보 모임</a>
  <nav class="nav"><a class="lnk" href="./" aria-current="page">정보</a><a class="navcta" href="../s/">무료 설문</a></nav>
</div></div>
<main>
  <span class="cat">${esc(cat)}</span>
  <p class="date">${dateDisp} · 창업정보 모임</p>
  <h1>${esc(a.title)}</h1>
  <p class="lead">${richText(a.lead)}</p>
${body}
  <div class="summary"><b>핵심 요약</b><ul>
${sm}
  </ul></div>
  <p class="source">${richText(a.source)}</p>
  <a class="btn" href="../s/">내 조건에 맞는 매물 추천받기 (30초 설문)</a><br>
  <a class="back" href="./">← 창업 정보 전체보기</a>
</main>
</body>
</html>
`;
}

async function generate(topic, cat) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic(); // ANTHROPIC_API_KEY 환경변수 사용
  const today = new Date().toISOString().slice(0, 10);
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3, allowed_domains: GOV_DOMAINS }],
    messages: [{
      role: 'user',
      content: `오늘 날짜: ${today}\n카테고리: ${cat}\n주제: ${topic}\n\n`
        + `위 주제로 뉴스 기사형 원본 글을 작성하세요. 가능하면 공공기관 사이트에서 관련 최신 제도·공고를 확인해 근거로 반영하고 출처를 밝히세요(없으면 일반 원칙으로 작성). category는 "${cat}"로 고정. JSON만 출력하세요.`,
    }],
  });
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
  const jsonStr = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = jsonStr.indexOf('{'), end = jsonStr.lastIndexOf('}');
  const parsed = JSON.parse(jsonStr.slice(start, end + 1));
  return Article.parse(parsed);
}

function slugify(cat) {
  const map = { '정책자금': 'policy', '권리금': 'premium', '운영방식': 'operation', '상권분석': 'market' };
  return map[cat] || 'post';
}

function insertBetween(html, startMarker, endMarker, newContent, keep) {
  const s = html.indexOf(startMarker), e = html.indexOf(endMarker);
  if (s < 0 || e < 0) throw new Error(`markers not found: ${startMarker}`);
  const before = html.slice(0, s + startMarker.length);
  const region = html.slice(s + startMarker.length, e);
  const after = html.slice(e);
  let merged = '\n' + newContent + region;
  if (keep) {
    const cards = merged.match(/<a class="article"[\s\S]*?<\/a>/g) || [];
    merged = '\n' + cards.slice(0, keep).join('\n') + '\n    ';
  }
  return before + merged + after;
}

async function main() {
  const now = new Date();
  const idx = (now.getUTCFullYear() * 100000 + now.getUTCMonth() * 1000 + now.getUTCDate() * 24 + now.getUTCHours()) % TOPICS.length;
  const { topic, cat } = TOPICS[idx];
  console.log(`[generate] topic="${topic}" cat=${cat} model=${MODEL}`);

  let a;
  for (let attempt = 1; attempt <= 2; attempt++) {
    a = await generate(topic, cat);
    const len = plainLen(a);
    console.log(`[generate] attempt ${attempt}: 본문 ${len}자`);
    if (len >= 600) break;
    if (attempt === 2) throw new Error(`본문이 너무 짧습니다(${len}자).`);
  }

  const iso = now.toISOString().slice(0, 10);
  const dateDisp = iso.replace(/-/g, '.');
  const fname = `${iso}-${slugify(cat)}-${String(now.getUTCHours()).padStart(2, '0')}.html`;
  fs.writeFileSync(path.join(POSTS, fname), renderArticle(a, cat, dateDisp));
  console.log(`[write] posts/${fname}`);

  // 목록(posts/index.html) 피드 카드 prepend
  const listCard = `    <a class="card" data-cat="${esc(cat)}" href="./${fname}">
      <div class="top"><span class="cat">${esc(cat)}</span><span class="date">${dateDisp}</span></div>
      <div class="title">${esc(a.title)}</div>
      <p class="excerpt">${esc(a.excerpt)}</p>
      <span class="more">자세히 읽기 →</span>
    </a>`;
  const listPath = path.join(POSTS, 'index.html');
  fs.writeFileSync(listPath, insertBetween(fs.readFileSync(listPath, 'utf8'),
    '<!--FEED:START (자동 발행 삽입 지점 — 이 주석과 FEED:END 사이에 최신 글 카드가 추가됩니다)-->',
    '<!--FEED:END-->', listCard));

  // 홈(index.html) 피드 최신 3편 유지
  const homeCard = `      <a class="article" href="./posts/${fname}">
        <div class="meta">${dateDisp} · ${esc(cat)}</div>
        <div class="title">${esc(a.title)}</div>
        <p class="excerpt">${esc(a.excerpt)}</p>
        <span class="more">자세히 읽기 →</span>
      </a>`;
  const homePath = path.join(SITE, 'index.html');
  fs.writeFileSync(homePath, insertBetween(fs.readFileSync(homePath, 'utf8'),
    '<!--HOMEFEED:START (자동 발행 시 최신 3편으로 유지)-->', '<!--HOMEFEED:END-->', homeCard, 3));

  // Action이 사용할 출력
  const out = process.env.GITHUB_OUTPUT;
  if (out) fs.appendFileSync(out, `file=posts/${fname}\ntitle=${a.title}\ncat=${cat}\n`);
  console.log(`[done] ${a.title}`);
}

export { renderArticle, insertBetween, plainLen, Article, TOPICS };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error('[error]', e.message); process.exit(1); });
}

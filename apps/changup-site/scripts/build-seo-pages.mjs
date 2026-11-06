#!/usr/bin/env node
// 기사별 정적 SEO 페이지 + sitemap.xml 생성기
//
// 문제: 기사가 해시 URL(/#post/slug)로만 존재해 검색엔진이 개별 기사를 색인하지 못하고,
//       sitemap.xml에도 홈 1건만 있어 무료 검색 유입이 사실상 0이었다.
// 해결: app.html의 ARTICLES를 읽어 기사마다 /p/<slug>.html 정적 페이지(메타·OG·JSON-LD·본문)를
//       만들고, 해시 앵커로 즉시 이동시킨다(사용자 경험 유지). sitemap.xml에 전 기사 등록.
//
// 사용: node apps/changup-site/scripts/build-seo-pages.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(HERE, '..');
const APP = path.join(SITE, 'app.html');
const OUT_DIR = path.join(SITE, 'p');
const SITEMAP = path.join(SITE, 'sitemap.xml');
const BASE = 'https://changup-moim.netlify.app';

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// app.html의 var ARTICLES=[...] 를 안전하게 평가해 배열로 얻는다(JS 리터럴이므로 Function 사용).
function readArticles(html) {
  const start = html.indexOf('var ARTICLES=[');
  if (start < 0) throw new Error('ARTICLES 앵커를 찾을 수 없습니다(app.html 구조 변경?)');
  const from = html.indexOf('[', start);
  let depth = 0, end = -1;
  for (let i = from; i < html.length; i++) {
    const c = html[i];
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (end < 0) throw new Error('ARTICLES 배열 끝을 찾을 수 없습니다');
  return Function(`"use strict";return (${html.slice(from, end)});`)();
}

function page(a) {
  const url = `${BASE}/p/${a.slug}.html`;
  const desc = a.excerpt || a.lead || '';
  const body = (a.blocks || [])
    .filter(b => Array.isArray(b) && b[0] && b[0] !== 'undefined')
    .map(b => `<h2>${esc(b[0])}</h2>\n<p>${b[1]}</p>`)
    .join('\n');
  const summary = (a.summary || []).map(s => `<li>${esc(s)}</li>`).join('');
  const ld = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: a.title, description: desc,
    datePublished: (a.date || '').replace(/\./g, '-'),
    articleSection: a.cat,
    publisher: { '@type': 'Organization', name: '창업정보 모임' },
    mainEntityOfPage: url,
  };
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(a.title)} | 창업정보 모임</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(a.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="ko_KR">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>
body{max-width:720px;margin:0 auto;padding:32px 20px 64px;font-family:'Pretendard','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif;line-height:1.75;color:#1a1a19;word-break:keep-all;background:#fdfcf9}
a{color:#c2703a} h1{font-size:1.7rem;line-height:1.3} h2{font-size:1.1rem;margin-top:1.6em}
.cat{display:inline-block;font-size:.78rem;font-weight:700;color:#c2703a;background:#f6e7da;padding:3px 10px;border-radius:999px}
.meta{color:#6b6963;font-size:.85rem;margin:.6em 0 1.4em} .lead{font-size:1.05rem;color:#3d3b37}
.sum{background:#f6e7da;border-radius:12px;padding:16px 20px;margin:24px 0} .sum b{display:block;margin-bottom:6px}
.cta{display:inline-block;margin-top:20px;background:#c2703a;color:#fff;padding:12px 20px;border-radius:10px;font-weight:700;text-decoration:none}
.src{color:#6b6963;font-size:.85rem;margin-top:24px;border-top:1px solid #e5e3d9;padding-top:14px}
</style>
</head>
<body>
<article>
  <span class="cat">${esc(a.cat)}</span>
  <h1>${esc(a.title)}</h1>
  <div class="meta">${esc(a.date)} · 창업정보 모임</div>
  <p class="lead">${esc(a.lead || '')}</p>
  ${body}
  ${summary ? `<div class="sum"><b>✅ 핵심 요약</b><ul>${summary}</ul></div>` : ''}
  ${a.src ? `<p class="src">${esc(a.src)}</p>` : ''}
  <a class="cta" href="${BASE}/s/">내 조건에 맞는 매물 추천받기 (30초 설문)</a>
  <p style="margin-top:18px"><a href="${BASE}/#post/${a.slug}">← 창업정보 모임에서 보기</a></p>
</article>
</body>
</html>`;
}

function main() {
  const html = fs.readFileSync(APP, 'utf8');
  const articles = readArticles(html).filter(a => a && a.slug);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const a of articles) {
    fs.writeFileSync(path.join(OUT_DIR, `${a.slug}.html`), page(a));
  }

  const urls = [
    `  <url>\n    <loc>${BASE}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
    `  <url>\n    <loc>${BASE}/s/</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.9</priority>\n  </url>`,
    ...articles.map(a => {
      const d = (a.date || '').replace(/\./g, '-');
      return `  <url>\n    <loc>${BASE}/p/${a.slug}.html</loc>${d ? `\n    <lastmod>${d}</lastmod>` : ''}\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
    }),
  ].join('\n');

  fs.writeFileSync(SITEMAP, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  console.log(`[seo] 기사 페이지 ${articles.length}건 생성 → p/`);
  console.log(`[seo] sitemap.xml URL ${articles.length + 2}건 기록`);
}

main();

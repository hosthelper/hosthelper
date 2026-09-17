const BLOG_ID = process.env.NAVER_BLOG_ID || 'kimtaewook86';
const KAKAO_SEND_ENDPOINT = process.env.KAKAO_SEND_ENDPOINT || 'https://auction-community-pearl.vercel.app/api/kakao/send';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const STATE_REPO = process.env.NAVER_COMMENT_STATE_REPO || 'hosthelper/hosthelper';
const STATE_BRANCH = process.env.NAVER_COMMENT_STATE_BRANCH || 'runtime/seocho-cleaning-state-v2';
const STATE_PATH = process.env.NAVER_COMMENT_STATE_PATH || 'helper-office-worker/runtime/naver-blog-comment-state.json';
const MAX_POSTS = Number(process.env.NAVER_COMMENT_MAX_POSTS || 20);
const CONCURRENCY = 5;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36';

function decodeHtml(s='') { return String(s).replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).trim(); }

async function fetchText(url, accept='*/*') {
  const r = await fetch(url,{headers:{'user-agent':UA,accept},redirect:'follow',cache:'no-store',signal:AbortSignal.timeout(15_000)});
  if(!r.ok) throw new Error(`HTTP_${r.status}:${url}`);
  return r.text();
}

function extractIds(text) {
  const out=[], seen=new Set(), esc=BLOG_ID.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const patterns=[new RegExp(`https?://(?:m\\.)?blog\\.naver\\.com/${esc}/(\\d{8,})`,'g'),/[?&]logNo=(\d{8,})/g,/["']logNo["']\s*:\s*["']?(\d{8,})/g];
  for(const p of patterns) for(const m of text.matchAll(p)) if(!seen.has(m[1])){seen.add(m[1]);out.push(m[1]);}
  return out;
}

async function discoverPosts() {
  const sources=[
    [`https://rss.blog.naver.com/${BLOG_ID}.xml`,'application/rss+xml,application/xml,text/xml,*/*'],
    [`https://m.blog.naver.com/PostList.naver?blogId=${BLOG_ID}&categoryNo=0&currentPage=1&countPerPage=${MAX_POSTS}`,'text/html,*/*'],
    [`https://m.blog.naver.com/${BLOG_ID}`,'text/html,*/*']
  ];
  const out=[],seen=new Set(),diagnostics=[];
  for(const [url,accept] of sources){
    try{const body=await fetchText(url,accept);const ids=extractIds(body);diagnostics.push({url,bytes:body.length,found:ids.length});for(const id of ids)if(!seen.has(id)){seen.add(id);out.push(id);}}
    catch(e){diagnostics.push({url,error:String(e.message||e)});}
    if(out.length>=MAX_POSTS)break;
  }
  console.log('discovery',JSON.stringify(diagnostics));
  if(!out.length)throw new Error(`NAVER_POST_DISCOVERY_EMPTY:${JSON.stringify(diagnostics)}`);
  return out.slice(0,MAX_POSTS);
}

function parsePost(html,logNo){
  const cm=html.match(/\bcommentCount=["'](\d+)["']/i)||html.match(/\\?"commentCount\\?"\s*:\s*(\d+)/i)||html.match(/\bcommentCount\s*:\s*(\d+)/i);
  if(!cm)throw new Error(`COMMENT_COUNT_NOT_FOUND:${logNo}`);
  const tm=html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i)||html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return{logNo:String(logNo),title:decodeHtml(tm?.[1]||`네이버 블로그 글 ${logNo}`).replace(/\s*:\s*네이버 블로그\s*$/i,''),commentCount:Number(cm[1]),url:`https://blog.naver.com/${BLOG_ID}/${logNo}`,checkedAt:new Date().toISOString()};
}

async function fetchPost(logNo){return parsePost(await fetchText(`https://m.blog.naver.com/PostView.naver?blogId=${BLOG_ID}&logNo=${logNo}`,'text/html,*/*'),logNo);}

async function mapLimit(items,limit,fn){
  const out=new Array(items.length);let next=0;
  async function worker(){while(true){const i=next++;if(i>=items.length)return;try{out[i]={ok:true,value:await fn(items[i])};}catch(error){out[i]={ok:false,error:String(error.message||error)};}}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},()=>worker()));return out;
}

async function gh(path,init={}){
  if(!GITHUB_TOKEN)throw new Error('GITHUB_TOKEN_NOT_CONFIGURED');
  const r=await fetch(`https://api.github.com/repos/${STATE_REPO}/${path}`,{...init,headers:{authorization:`Bearer ${GITHUB_TOKEN}`,accept:'application/vnd.github+json','content-type':'application/json','x-github-api-version':'2022-11-28','user-agent':'hosthelper-naver-comment-monitor',...(init.headers||{})},signal:AbortSignal.timeout(15_000)});
  const text=await r.text();let body;try{body=text?JSON.parse(text):null;}catch{body={raw:text.slice(0,500)};}
  if(!r.ok){const e=new Error(`GITHUB_${r.status}:${body?.message||'unknown'}`);e.status=r.status;throw e;}return body;
}

async function loadState(){try{const f=await gh(`contents/${STATE_PATH}?ref=${encodeURIComponent(STATE_BRANCH)}`);const s=JSON.parse(Buffer.from(String(f.content||'').replace(/\s/g,''),'base64').toString('utf8')||'{}');return{initialized:s.initialized===true,posts:s.posts||{},sha:f.sha||''};}catch(e){if(e.status===404)return{initialized:false,posts:{},sha:''};throw e;}}
async function saveState(posts,sha=''){const s={version:1,initialized:true,blogId:BLOG_ID,updatedAt:new Date().toISOString(),posts};const payload={message:'chore(runtime): update Naver blog comment state',content:Buffer.from(JSON.stringify(s,null,2),'utf8').toString('base64'),branch:STATE_BRANCH};if(sha)payload.sha=sha;await gh(`contents/${STATE_PATH}`,{method:'PUT',body:JSON.stringify(payload)});}

async function sendKakao(text){const r=await fetch(KAKAO_SEND_ENDPOINT,{method:'POST',headers:{'content-type':'application/json','user-agent':'hosthelper-naver-comment-monitor/1.0'},body:JSON.stringify({text}),signal:AbortSignal.timeout(20_000)});const raw=await r.text();let b;try{b=raw?JSON.parse(raw):null;}catch{b={raw:raw.slice(0,500)};}if(!r.ok||b?.ok===false)throw new Error(`KAKAO_SEND_${r.status}:${JSON.stringify(b)}`);}
function message(events){const a=['💬 네이버 블로그 새 댓글'];for(const e of events)a.push('',`글: ${e.title}`,`새 댓글: +${e.delta}개 (총 ${e.commentCount}개)`,`확인: ${e.url}`);return a.join('\n').slice(0,1900);}

async function main(){
  const prev=await loadState(),ids=await discoverPosts(),results=await mapLimit(ids,CONCURRENCY,fetchPost),current={...prev.posts},events=[],failures=[];
  results.forEach((r,i)=>{const id=ids[i];if(!r.ok){failures.push({logNo:id,error:r.error});return;}const p=r.value,b=prev.posts[id];if(prev.initialized){if(b&&p.commentCount>Number(b.commentCount||0))events.push({...p,delta:p.commentCount-Number(b.commentCount||0)});else if(!b&&p.commentCount>0)events.push({...p,delta:p.commentCount});}current[id]=p;});
  const keep={};for(const id of ids)if(current[id])keep[id]=current[id];
  if(!prev.initialized){await saveState(keep,prev.sha);console.log(JSON.stringify({ok:true,baselineOnly:true,posts:Object.keys(keep).length,events:[],failures}));return;}
  if(events.length)await sendKakao(message(events));await saveState(keep,prev.sha);console.log(JSON.stringify({ok:true,baselineOnly:false,posts:Object.keys(keep).length,events:events.map(e=>({logNo:e.logNo,title:e.title,delta:e.delta,commentCount:e.commentCount,url:e.url})),failures}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});

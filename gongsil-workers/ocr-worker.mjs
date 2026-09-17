import http from 'node:http';
import { createWorker } from 'tesseract.js';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';

globalThis.DOMMatrix ??= DOMMatrix;
globalThis.ImageData ??= ImageData;
globalThis.Path2D ??= Path2D;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const WORKER_TOKEN = process.env.GONGSIL_WORKER_TOKEN;
const WORKER_ID = process.env.WORKER_ID || 'render-ocr-01';
const PORT = Number(process.env.PORT || 10000);
const POLL_MS = Number(process.env.POLL_MS || 20000);

if (!SUPABASE_URL || !SUPABASE_KEY || !WORKER_TOKEN) throw new Error('Missing required environment');

async function rpc(name, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, { method:'POST', headers:{'content-type':'application/json',apikey:SUPABASE_KEY,authorization:`Bearer ${SUPABASE_KEY}`}, body:JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`${name}:${r.status}:${text.slice(0,500)}`);
  return text ? JSON.parse(text) : null;
}

let tess;
async function getTess(){ if(!tess) tess=await createWorker('kor+eng'); return tess; }
function conf(found,base){ if(!found) return 0; return Math.max(0.71,Math.min(0.98,base||0.71)); }

function extractFields(text,baseConfidence){
  const clean=String(text||'').replace(/\r/g,'');
  const lines=clean.split('\n').map(v=>v.trim()).filter(Boolean);
  const pick=(re)=>lines.find(l=>re.test(l))||'';
  const addressLine=pick(/(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|전라|경상|제주).{2,}(로|길|동|읍|면|리|번지|호)/);
  const landlordMatch=clean.match(/임\s*대\s*인\s*[:：]?\s*([가-힣A-Za-z0-9]{2,30})/i);
  const tenantMatch=clean.match(/임\s*차\s*인\s*[:：]?\s*([가-힣A-Za-z0-9]{2,30})/i);
  const consentLine=lines.find(l=>/(전대|재임대|sublet)/i.test(l)&&/(동의|허용|승낙|가능|consent|allow)/i.test(l))||'';
  const dateMatch=clean.match(/(20\d{2}|19\d{2}|\d{2})\s*[.년\-/]\s*(\d{1,2})\s*[.월\-/]\s*(\d{1,2})\s*일?/);
  const sigFound=/(서명|날인|서명\s*\/\s*인|\(\s*인\s*\)|도장)/.test(clean);
  const base=Math.max(0,Math.min(1,Number(baseConfidence||0)));
  return {address:addressLine.slice(0,300),landlord:(landlordMatch?.[1]||'').slice(0,100),tenant:(tenantMatch?.[1]||'').slice(0,100),consent_text:consentLine.slice(0,1000),document_date:dateMatch?`${dateMatch[1]}-${String(dateMatch[2]).padStart(2,'0')}-${String(dateMatch[3]).padStart(2,'0')}`:'',signature_present:sigFound,confidence:{address:conf(Boolean(addressLine),base),landlord:conf(Boolean(landlordMatch),base),tenant:conf(Boolean(tenantMatch),base),consent:conf(Boolean(consentLine),base),date:conf(Boolean(dateMatch),base),signature:sigFound?Math.max(0.71,Math.min(0.90,base)):0}};
}

async function ocrImage(bytes){ const worker=await getTess(); const out=await worker.recognize(bytes); return {text:out.data.text||'',confidence:Number(out.data.confidence||0)/100}; }
async function ocrDocument(bytes,contentType){
  if(contentType!=='application/pdf') return ocrImage(bytes);
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf=await pdfjs.getDocument({data:new Uint8Array(bytes),disableWorker:true}).promise;
  const texts=[],cs=[];
  for(let i=1;i<=Math.min(pdf.numPages,4);i++){
    const page=await pdf.getPage(i), viewport=page.getViewport({scale:2});
    const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
    const r=await ocrImage(canvas.toBuffer('image/png')); texts.push(r.text); cs.push(r.confidence);
  }
  return {text:texts.join('\n\n'),confidence:cs.length?cs.reduce((a,b)=>a+b,0)/cs.length:0};
}

async function heartbeat(){ return rpc('gongsil_worker_heartbeat',{p_worker_token:WORKER_TOKEN,p_worker_id:WORKER_ID,p_kind:'ocr'}); }
async function processOne(){
  const job=await rpc('gongsil_worker_claim_sublet_ocr_job',{p_worker_token:WORKER_TOKEN,p_worker_id:WORKER_ID});
  if(!job) return false;
  try{
    const response=await fetch(job.signed_url); if(!response.ok) throw new Error(`document_download_${response.status}`);
    const bytes=Buffer.from(await response.arrayBuffer()); if(bytes.length>8*1024*1024) throw new Error('document_too_large');
    const contentType=(job.content_type||response.headers.get('content-type')||'').split(';')[0];
    const {text,confidence}=await ocrDocument(bytes,contentType); const fields=extractFields(text,confidence);
    await rpc('gongsil_worker_settle_sublet_ocr_result',{p_worker_token:WORKER_TOKEN,p_run_id:job.run_id,p_worker_id:WORKER_ID,p_claim_token:job.claim_token,p_fields:fields,p_raw_text:text.slice(0,20000),p_provider:'render_tesseract_v1',p_payload:{engine:'tesseract.js',languages:['kor','eng'],content_type:contentType,mean_confidence:confidence}});
    return true;
  }catch(err){
    try{await rpc('gongsil_worker_fail_sublet_ocr_job',{p_worker_token:WORKER_TOKEN,p_run_id:job.run_id,p_worker_id:WORKER_ID,p_claim_token:job.claim_token,p_error:String(err?.message||err).slice(0,1800),p_retry:true});}catch{}
    throw err;
  }
}

let busy=false;
async function tick(){ if(busy) return; busy=true; try{await heartbeat(); let n=0; while(n<3&&await processOne()) n++;}catch(e){console.error(new Date().toISOString(),e);}finally{busy=false;} }
http.createServer((req,res)=>{res.setHeader('content-type','application/json'); if(req.url==='/health')res.end(JSON.stringify({ok:true,worker:WORKER_ID,kind:'ocr',busy}));else{res.statusCode=404;res.end('{"ok":false}');}}).listen(PORT,()=>console.log(`OCR worker listening on ${PORT}`));
setInterval(tick,POLL_MS); tick();
process.on('SIGTERM',async()=>{try{if(tess)await tess.terminate();}catch{} process.exit(0);});

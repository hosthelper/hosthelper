import express from 'express';
import { createWorker } from 'tesseract.js';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';

globalThis.DOMMatrix ??= DOMMatrix;
globalThis.ImageData ??= ImageData;
globalThis.Path2D ??= Path2D;

const app = express();
app.use(express.json({ limit: '1mb' }));
const PORT = Number(process.env.PORT || 10000);
const MAX_BYTES = Number(process.env.MAX_BYTES || 8388608);
const SUPABASE_HOST = 'buzcnfnimzlsjvbeefjb.supabase.co';
const REQUIRED_PATH_PREFIX = '/storage/v1/object/sign/gongsil-verification-docs/';
let workerPromise;
let serial = Promise.resolve();
function getWorker(){ if(!workerPromise) workerPromise=createWorker('kor+eng'); return workerPromise; }
function runSerial(task){ const r=serial.then(task,task); serial=r.catch(()=>undefined); return r; }
function compact(s=''){ return String(s).replace(/\r/g,'').replace(/[ \t]+/g,' ').trim(); }
function normalizeToken(s=''){ return String(s).toLowerCase().replace(/[^0-9a-z가-힣]/g,''); }
function scoreExpectedAddress(rawText,expectedAddress){
  if(!expectedAddress) return {value:null,confidence:0};
  const rawNorm=normalizeToken(rawText); const parts=compact(expectedAddress).split(/\s+/).map(normalizeToken).filter(x=>x.length>=2);
  if(!parts.length) return {value:null,confidence:0}; const matched=parts.filter(p=>rawNorm.includes(p)); const ratio=matched.length/parts.length;
  return {value:ratio>=0.5?compact(expectedAddress):null,confidence:Math.min(0.96,Math.max(0,ratio))};
}
function extractLabelValue(lines,labels){ for(const line of lines){ for(const label of labels){ const m=line.match(new RegExp(`${label}\\s*[:：]?\\s*([가-힣A-Za-z]{2,30})`,'i')); if(m?.[1]) return compact(m[1]); } } return null; }
function extractConsent(lines){ const strong=lines.find(line=>/(전대|재임대|sublet)/i.test(line)&&/(동의|허용|승낙|가능|consent|allow)/i.test(line)); return strong?compact(strong):(lines.find(line=>/(전대|재임대|sublet)/i.test(line))||null); }
function extractDate(text){ const m=text.match(/(20\d{2}|\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*[일]?/); if(!m)return null; const y=m[1].length===2?`20${m[1]}`:m[1]; return `${y}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`; }
function signatureSignal(lines){ const i=lines.findIndex(line=>/(서명|날인|도장|인\)|\(인|signature)/i.test(line)); if(i<0)return {present:false,confidence:0}; const local=[lines[i],lines[i+1]||''].join(' '); const has=/[가-힣]{2,4}/.test(local.replace(/서명|날인|도장|인/g,'')); return {present:has,confidence:has?0.74:0.45}; }
function buildFields(rawText,ocrConfidence,expectedAddress){
  const text=String(rawText||'').replace(/\r/g,''); const lines=text.split('\n').map(compact).filter(Boolean); const address=scoreExpectedAddress(text,expectedAddress);
  const landlord=extractLabelValue(lines,['임대인','소유자','갑']); const tenant=extractLabelValue(lines,['임차인','사용자','을']); const consent=extractConsent(lines); const documentDate=extractDate(text); const signature=signatureSignal(lines); const base=Math.max(0,Math.min(1,Number(ocrConfidence||0)/100));
  return {address:address.value,landlord,tenant,consent_text:consent,document_date:documentDate,signature_present:signature.present,confidence:{address:Number(Math.min(address.confidence,Math.max(0.72,base)).toFixed(3)),landlord:landlord?Number(Math.max(0.72,base*0.92).toFixed(3)):0,tenant:tenant?Number(Math.max(0.72,base*0.92).toFixed(3)):0,consent:consent?Number(Math.max(0.72,base*0.90).toFixed(3)):0,date:documentDate?Number(Math.max(0.72,base*0.90).toFixed(3)):0,signature:Number(signature.confidence.toFixed(3))}};
}
function assertDocumentUrl(input){ const u=new URL(input); if(u.protocol!=='https:'||u.hostname!==SUPABASE_HOST||!u.pathname.startsWith(REQUIRED_PATH_PREFIX)) throw new Error('document_url_not_allowed'); return u; }
async function ocrImage(buf){ const worker=await getWorker(); const r=await worker.recognize(buf); return {text:String(r?.data?.text||''),confidence:Number(r?.data?.confidence||0)}; }
async function ocrDocument(buf,contentType){
  if(contentType!=='application/pdf') return ocrImage(buf);
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'); const pdf=await pdfjs.getDocument({data:new Uint8Array(buf),disableWorker:true}).promise; const texts=[],confs=[];
  for(let i=1;i<=Math.min(pdf.numPages,4);i++){ const p=await pdf.getPage(i); const v=p.getViewport({scale:2}); const c=createCanvas(Math.ceil(v.width),Math.ceil(v.height)); await p.render({canvasContext:c.getContext('2d'),viewport:v}).promise; const r=await ocrImage(c.toBuffer('image/png')); texts.push(r.text); confs.push(r.confidence); }
  return {text:texts.join('\n\n'),confidence:confs.length?confs.reduce((a,b)=>a+b,0)/confs.length:0};
}
app.get('/health',(_req,res)=>res.json({ok:true,service:'gongsil-ocr-worker',version:'2.0.0',engine:'tesseract.js',languages:['kor','eng'],pdf:true}));
app.post('/v1/sublet-ocr',async(req,res)=>{
  try{
    const documentUrl=String(req.body?.document_url||req.body?.image_url||''); const expectedAddress=req.body?.expected_address?String(req.body.expected_address):null; if(!documentUrl)return res.status(400).json({error:'document_url_required'}); const u=assertDocumentUrl(documentUrl);
    const rr=await fetch(u,{signal:AbortSignal.timeout(25000)}); if(!rr.ok)return res.status(502).json({error:'document_fetch_failed',status:rr.status}); const ct=(rr.headers.get('content-type')||'').split(';')[0].toLowerCase(); if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(ct))return res.status(415).json({error:'content_type_not_allowed',content_type:ct}); const len=Number(rr.headers.get('content-length')||0); if(len>MAX_BYTES)return res.status(413).json({error:'document_too_large'}); const buf=Buffer.from(await rr.arrayBuffer()); if(buf.byteLength>MAX_BYTES)return res.status(413).json({error:'document_too_large'});
    const out=await runSerial(()=>ocrDocument(buf,ct)); const fields=buildFields(out.text,out.confidence,expectedAddress);
    res.json({ok:true,provider:'render_tesseract_v2',fields,raw_text:out.text.slice(0,20000),ocr_confidence:out.confidence,meta:{content_type:ct,bytes:buf.byteLength}});
  }catch(err){ console.error('[ocr-error]',err?.message||err); res.status(500).json({error:err?.message||'ocr_failed'}); }
});
app.listen(PORT,()=>console.log(`gongsil-ocr-worker v2 listening on ${PORT}`));

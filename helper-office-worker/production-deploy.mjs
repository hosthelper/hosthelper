const BASE = process.env.HELPER_OFFICE_PRODUCTION_SNAPSHOT || 'https://helper-office-4vmzn0t90-lifehelper.vercel.app';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
const VERCEL_TOKEN = process.env.VERCEL_TOKEN || '';
const PROJECT_ID = process.env.VERCEL_PROJECT_ID || 'prj_NqiuOriBTEEiMG4NnPZyFaqJN9eD';
const ORG_ID = process.env.VERCEL_ORG_ID || 'team_bTTQ4keENdDaBRIcpINqZFVU';
const RELEASE_REPO = 'hosthelper/lifehelper';
const RELEASE_REF = process.env.HELPER_OFFICE_RELEASE_REF || 'helper-office/control-plane-v1';
const ASSET_VERSION = process.env.HELPER_OFFICE_ASSET_VERSION || '20260912-p0-4';
const OFFICIAL_URL = process.env.HELPER_OFFICE_OFFICIAL_URL || 'https://helper-office-hq-lifehelper.vercel.app';
const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

async function text(url, headers = {}) {
  const response = await fetch(url, { headers: { 'user-agent': 'helper-office-production-deployer', ...headers }, redirect: 'follow' });
  if (!response.ok) throw new Error(`FETCH_${response.status}:${url}`);
  return response.text();
}
async function githubFile(path) {
  if (!GITHUB_TOKEN) throw new Error('GITHUB_TOKEN_NOT_CONFIGURED');
  const url = `https://api.github.com/repos/${RELEASE_REPO}/contents/${path}?ref=${encodeURIComponent(RELEASE_REF)}`;
  const response = await fetch(url, { headers: { authorization:`Bearer ${GITHUB_TOKEN}`, accept:'application/vnd.github+json', 'x-github-api-version':'2022-11-28', 'user-agent':'helper-office-production-deployer' } });
  if (!response.ok) throw new Error(`GITHUB_${response.status}:${path}`);
  const body = await response.json();
  return Buffer.from(String(body.content || '').replace(/\s/g, ''), 'base64').toString('utf8');
}
function versionAsset(index, file) {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(`((?:\\./|/)?)${escaped}(?:\\?[^\\"']*)?`, 'gi');
  return index.replace(rx, (_m, prefix) => `${prefix || './'}${file}?v=${ASSET_VERSION}`);
}
function prepareIndex(index) {
  let out=index;
  for (const file of ['styles.css','app.js','enhancements.js','runtime-status-v3.js']) out=versionAsset(out,file);
  const localScripts=['session-recovery-v1.js','p0-hardening-v1.js'];
  for(const file of localScripts){
    if(!new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i').test(out)){
      const tag=`<script src="./${file}?v=${ASSET_VERSION}"></script>`;
      out=/<\/body>/i.test(out)?out.replace(/<\/body>/i,`  ${tag}\n</body>`):`${out}\n${tag}`;
    }else out=versionAsset(out,file);
  }
  if(!out.includes(SUPABASE_CDN)){
    const tag=`<script src="${SUPABASE_CDN}"></script>`;
    const p0Tag=`<script src="./p0-hardening-v1.js?v=${ASSET_VERSION}"></script>`;
    out=out.replace(p0Tag,`${tag}\n  ${p0Tag}`);
  }
  return out;
}
async function vercel(path, init = {}) {
  if (!VERCEL_TOKEN || VERCEL_TOKEN.length < 20) throw new Error('VERCEL_TOKEN_NOT_CONFIGURED');
  const joiner=path.includes('?')?'&':'?';
  const url=`https://api.vercel.com${path}${joiner}teamId=${encodeURIComponent(ORG_ID)}`;
  const response=await fetch(url,{...init,headers:{authorization:`Bearer ${VERCEL_TOKEN}`,'content-type':'application/json',...(init.headers||{})}});
  const raw=await response.text();let body=null;try{body=raw?JSON.parse(raw):{};}catch{body={raw};}
  if(!response.ok){const message=body?.error?.message||body?.message||raw.slice(0,500)||'unknown_error';throw new Error(`VERCEL_${response.status}:${message}`);}
  return body;
}
async function waitUntilReady(deploymentId) {
  const deadline=Date.now()+120000;
  while(Date.now()<deadline){
    const state=await vercel(`/v13/deployments/${encodeURIComponent(deploymentId)}`);const readyState=String(state.readyState||state.state||'').toUpperCase();
    if(readyState==='READY')return state;if(['ERROR','CANCELED'].includes(readyState))throw new Error(`VERCEL_DEPLOY_${readyState}:${state.errorMessage||state.errorCode||'unknown'}`);
    await new Promise(r=>setTimeout(r,2500));
  }
  throw new Error('VERCEL_DEPLOY_TIMEOUT');
}
async function verifyOfficialProduction() {
  const nonce=`${ASSET_VERSION}-${Date.now()}`;
  const index=await text(`${OFFICIAL_URL}/?verify=${encodeURIComponent(nonce)}`,{'cache-control':'no-cache'});
  const markers=[`app.js?v=${ASSET_VERSION}`,`enhancements.js?v=${ASSET_VERSION}`,`runtime-status-v3.js?v=${ASSET_VERSION}`,`session-recovery-v1.js?v=${ASSET_VERSION}`,`p0-hardening-v1.js?v=${ASSET_VERSION}`,SUPABASE_CDN];
  const missing=markers.filter(marker=>!index.includes(marker));if(missing.length)throw new Error(`PRODUCTION_BUNDLE_MARKER_MISSING:${missing.join(',')}`);
  const[runtime,recovery,p0]=await Promise.all([
    text(`${OFFICIAL_URL}/runtime-status-v3.js?v=${encodeURIComponent(ASSET_VERSION)}&verify=${Date.now()}`,{'cache-control':'no-cache'}),
    text(`${OFFICIAL_URL}/session-recovery-v1.js?v=${encodeURIComponent(ASSET_VERSION)}&verify=${Date.now()}`,{'cache-control':'no-cache'}),
    text(`${OFFICIAL_URL}/p0-hardening-v1.js?v=${encodeURIComponent(ASSET_VERSION)}&verify=${Date.now()}`,{'cache-control':'no-cache'}),
  ]);
  if(!runtime.includes('runtime-status-v3-20260912'))throw new Error('PRODUCTION_RUNTIME_STATUS_VERSION_MISMATCH');
  if(!recovery.includes('session-recovery-v1-20260912'))throw new Error('PRODUCTION_SESSION_RECOVERY_VERSION_MISMATCH');
  if(!p0.includes('p0-hardening-v1-20260912-secure-realtime'))throw new Error('PRODUCTION_P0_HARDENING_VERSION_MISMATCH');
  return{official_url:OFFICIAL_URL,asset_version:ASSET_VERSION,index_markers_verified:markers.length,runtime_status_verified:true,session_recovery_verified:true,p0_hardening_verified:true,realtime_sdk_injected:true,secure_realtime_signal_channel:true};
}
export async function deployHelperOfficeProduction() {
  if(process.env.ALLOW_PRODUCTION_DEPLOY!=='true')throw new Error('PRODUCTION_DEPLOY_NOT_APPROVED');
  if(!VERCEL_TOKEN||VERCEL_TOKEN.length<20)throw new Error('VERCEL_TOKEN_NOT_CONFIGURED');
  const[index,app,styles,enhancements,runtimeStatus,sessionRecovery,p0Hardening]=await Promise.all([
    githubFile('helper-office-hq/index.html'),githubFile('helper-office-hq/app.js'),githubFile('helper-office-hq/styles.css'),githubFile('helper-office-hq/enhancements.js'),githubFile('helper-office-hq/runtime-status-v3.js'),githubFile('helper-office-hq/session-recovery-v1.js'),githubFile('helper-office-hq/p0-hardening-v1.js')
  ]);
  const files=[{file:'index.html',data:prepareIndex(index)},{file:'app.js',data:app},{file:'styles.css',data:styles},{file:'enhancements.js',data:enhancements},{file:'runtime-status-v3.js',data:runtimeStatus},{file:'session-recovery-v1.js',data:sessionRecovery},{file:'p0-hardening-v1.js',data:p0Hardening}];
  const created=await vercel('/v13/deployments?forceNew=1&skipAutoDetectionConfirmation=1',{method:'POST',body:JSON.stringify({name:'helper-office-hq',project:PROJECT_ID,target:'production',files,projectSettings:{framework:null},meta:{helperOfficeReleaseRef:RELEASE_REF,helperOfficeRuntimeOverlay:'p0-v6',helperOfficeAssetVersion:ASSET_VERSION,source:'render-worker'}})});
  const deploymentId=String(created.id||'');if(!deploymentId)throw new Error('VERCEL_DEPLOYMENT_ID_MISSING');
  const ready=await waitUntilReady(deploymentId);const deploymentUrl=ready.url?`https://${ready.url}`:created.url?`https://${created.url}`:null;const productionVerification=await verifyOfficialProduction();
  return{ok:true,project_id:PROJECT_ID,release_ref:RELEASE_REF,asset_version:ASSET_VERSION,deployment_id:deploymentId,deployment_url:deploymentUrl,ready_state:ready.readyState||ready.state||null,production_verification:productionVerification};
}

(()=>{
const scripts=[
 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
 'platform-core.js',
 'platform-data.js',
 'platform-extras.js',
 'platform-gongsil-policy.js',
 'platform-mode-router.js'
];
const load=(src)=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error('script load failed: '+src));document.head.appendChild(s)});
(async()=>{for(const src of scripts)await load(src)})().catch(err=>{console.error(err);const e=document.createElement('div');e.style.cssText='position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;padding:12px 14px;background:#8f2424;color:white;border-radius:10px;font:12px system-ui';e.textContent='플랫폼 모듈을 불러오지 못했습니다. 네트워크를 확인하고 새로고침해주세요.';document.body.appendChild(e)});
})();
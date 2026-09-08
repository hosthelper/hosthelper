(()=>{
let lastUser=null;
function route(force=false){if(!window.HU?.user)return;const id=window.HU.user.id;if(!force&&lastUser===id)return;lastUser=id;const svc=window.HU.cfg.service;let target='';if(window.HU.isOperator()){target=({gongsil:'operator',academy:'admin',house:'operator',host:'ops',life:'operator',next:'operator'})[svc]||''}else if(svc==='academy')target='student';else if(svc==='house')target='quote';else if(svc==='host'&&window.HU.hasRole('host'))target='host';else if(svc==='next')target='matches';else if(svc==='life')target='guest';else if(svc==='gongsil')target='user';if(target&&window.HU.isAllowed(target))window.HU.setScreen(target)}
function reset(){if(!window.HU?.user)lastUser=null}
document.addEventListener('hu:ready',()=>route(true));document.addEventListener('hu:auth',()=>{reset();route(false)});
})();
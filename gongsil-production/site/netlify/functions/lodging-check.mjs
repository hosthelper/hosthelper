function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
const clean=v=>String(v||'').replace(/\s+/g,'').replace(/[^0-9A-Za-z가-힣]/g,'').toLowerCase();
function regionOf(address){const p=String(address||'').trim().split(/\s+/);return{sido:p[0]||'',sigungu:p[1]||''}}
async function seoulLookup(address){
  const key=Netlify.env.get('SEOUL_API_KEY'),service=Netlify.env.get('SEOUL_SERVICE')||'LOCALDATA_031104';
  if(!key||!String(address).includes('서울'))return{status:'unavailable',message:'서울시 공개데이터 자동조회 대상이 아니거나 API 설정을 확인해야 합니다.'};
  try{
    const url='https://openapi.seoul.go.kr:8088/'+encodeURIComponent(key)+'/json/'+encodeURIComponent(service)+'/1/1000/';
    const res=await fetch(url,{signal:AbortSignal.timeout(12000)});
    if(!res.ok)return{status:'unavailable',message:'서울시 공개데이터 응답을 확인하지 못했습니다.'};
    const data=await res.json(),block=data?.[service]||data?.[Object.keys(data).find(k=>data?.[k]?.row)];
    const rows=Array.isArray(block?.row)?block.row:[],needle=clean(address);
    const exact=needle.length>=8?rows.find(row=>clean(JSON.stringify(row)).includes(needle)):null;
    return exact?{status:'confirmed',message:'서울시 공개데이터에서 입력 주소와 일치하는 영업정보 후보를 확인했습니다.',evidence:exact}:{status:'needs_check',message:'서울시 공개데이터에서 입력 주소와 일치하는 항목을 자동확정하지 못했습니다. 원본 자료 확인이 필요합니다.'};
  }catch{return{status:'unavailable',message:'서울시 공개데이터 자동조회가 일시적으로 불가능합니다. 외부 확인이 필요합니다.'}}
}
export default async function(req){
  if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
  let body={};try{body=await req.json()}catch{return reply({error:'요청 형식이 올바르지 않습니다.'},400)}
  const address=String(body.address||'').trim(),businessNo=String(body.businessNo||'').replace(/[^0-9]/g,''),buildingUse=String(body.buildingUse||'unknown');
  if(address.length<5)return reply({error:'주소를 정확히 입력해 주세요.'},400);
  const region=regionOf(address),seoul=await seoulLookup(address),sources=[];
  sources.push({source:'address_input',label:'입력 주소',status:'confirmed',statusLabel:'입력 확인',message:region.sido&&region.sigungu?region.sido+' '+region.sigungu+' 기준으로 확인을 시작했습니다.':'입력 주소 형식을 확인했습니다.'});
  sources.push({source:'seoul_open_data',label:'서울시 공개데이터',status:seoul.status,statusLabel:seoul.status==='confirmed'?'확인':seoul.status==='unavailable'?'외부확인 필요':'추가확인',message:seoul.message});
  if(businessNo)sources.push({source:'business_number',label:'사업자등록번호',status:'needs_check',statusLabel:'추가확인',message:'사업자등록번호 형식을 받았습니다. 국세청 원천정보와의 최종 상태 확인이 필요합니다.'});
  sources.push({source:'building_use',label:'건축물 용도',status:buildingUse==='unknown'?'needs_check':'needs_check',statusLabel:'추가확인',message:buildingUse==='unknown'?'건축물대장 원본에서 주용도를 확인해야 합니다.':'선택한 건물용도는 자가 입력값이며 건축물대장 원본 확인이 필요합니다.'});
  const confirmed=sources.filter(x=>x.status==='confirmed').length,external=sources.some(x=>x.status==='unavailable');
  const overallStatus=seoul.status==='confirmed'?'partial':external?'unavailable':'partial';
  return reply({ok:true,overallStatus,summary:overallStatus==='partial'?'자동확인 가능한 항목과 추가 확인 항목을 구분했습니다.':'현재 자동조회로 확정할 수 없어 원본·관할기관 확인이 필요합니다.',region,sources,building:null,disclaimer:'자동대조 결과는 참고정보이며 최종 영업신고·인허가·권리관계를 보장하지 않습니다.'});
}

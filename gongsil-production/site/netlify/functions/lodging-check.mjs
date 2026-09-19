function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}

const SERVICE_BY_DISTRICT={
  '종로구':'LOCALDATA_031104_JN','중구':'LOCALDATA_031104_JG','용산구':'LOCALDATA_031104_YS',
  '성동구':'LOCALDATA_031104_SD','광진구':'LOCALDATA_031104_GJ','동대문구':'LOCALDATA_031104_DD',
  '중랑구':'LOCALDATA_031104_JR','성북구':'LOCALDATA_031104_SB','강북구':'LOCALDATA_031104_GB',
  '도봉구':'LOCALDATA_031104_DB','노원구':'LOCALDATA_031104_NW','은평구':'LOCALDATA_031104_EP',
  '서대문구':'LOCALDATA_031104_SDM','마포구':'LOCALDATA_031104_MP','양천구':'LOCALDATA_031104_YC',
  '강서구':'LOCALDATA_031104_GS','구로구':'LOCALDATA_031104_GR','금천구':'LOCALDATA_031104_GC',
  '영등포구':'LOCALDATA_031104_YD','동작구':'LOCALDATA_031104_DJ','관악구':'LOCALDATA_031104_GA',
  '서초구':'LOCALDATA_031104_SC','강남구':'LOCALDATA_031104_GN','송파구':'LOCALDATA_031104_SP',
  '강동구':'LOCALDATA_031104_GD'
};

const clean=v=>String(v||'').normalize('NFKC').replace(/\([^)]*\)/g,'').replace(/\s+/g,'').replace(/[^0-9A-Za-z가-힣-]/g,'').toLowerCase();
const unitPattern=/(?:,?\s*(?:b\s*\d+|비\s*\d+\s*층|지하\s*\d+\s*층|\d+\s*층|\d+\s*호|[a-z]?\d{3,4}\s*호?))(?:\s|$)/ig;
function baseAddress(v){return clean(String(v||'').replace(unitPattern,' ').replace(/,.*$/,''))}
function hasUnit(v){return /(?:b\s*\d+|비\s*\d+\s*층|지하\s*\d+\s*층|\d+\s*층|\d+\s*호|[a-z]?\d{3,4}\s*호?)/i.test(String(v||''))}
function districtOf(address){return Object.keys(SERVICE_BY_DISTRICT).find(d=>String(address||'').includes(d))||''}
function regionOf(address){const text=String(address||'').trim(),district=districtOf(text);return{sido:text.includes('서울')?'서울특별시':(text.split(/\s+/)[0]||''),sigungu:district||(text.split(/\s+/)[1]||'')}}
function isActive(row){
  const state=(String(row?.TRDSTATENM||'')+' '+String(row?.DTLSTATENM||'')).trim();
  return /영업|정상/.test(state)&&!/폐업|취소|말소|정지|휴업/.test(state)
}
function rowAddress(row){return String(row?.RDNWHLADDR||row?.SITEWHLADDR||'').trim()}
function compactEvidence(row){
  return {
    businessName:String(row?.BPLCNM||'').trim()||null,
    roadAddress:String(row?.RDNWHLADDR||'').trim()||null,
    lotAddress:String(row?.SITEWHLADDR||'').trim()||null,
    permitDate:String(row?.APVPERMYMD||'').trim()||null,
    managementNo:String(row?.MGTNO||'').trim()||null,
    tradeStatus:String(row?.TRDSTATENM||'').trim()||null,
    detailStatus:String(row?.DTLSTATENM||'').trim()||null,
    buildingUse:String(row?.BDNGSRVNM||'').trim()||null,
    lastModified:String(row?.LASTMODTS||row?.UPDATEDT||'').trim()||null
  }
}

async function seoulLookup(address){
  const key=Netlify.env.get('SEOUL_API_KEY'),district=districtOf(address),service=SERVICE_BY_DISTRICT[district];
  if(!String(address).includes('서울'))return{status:'out_of_scope',message:'현재 서울시 주소부터 자동조회합니다.',matches:[]};
  if(!key)return{status:'unavailable',message:'서울 열린데이터 API 키가 설정되지 않았습니다.',matches:[]};
  if(!service)return{status:'unavailable',message:'주소에서 서울시 자치구를 확인하지 못했습니다.',matches:[]};
  try{
    const url='https://openapi.seoul.go.kr:8088/'+encodeURIComponent(key)+'/json/'+encodeURIComponent(service)+'/1/1000/';
    const res=await fetch(url,{signal:AbortSignal.timeout(15000)});
    if(!res.ok)return{status:'unavailable',message:'서울시 공개데이터 응답을 확인하지 못했습니다.',matches:[],service};
    const data=await res.json(),block=data?.[service]||data?.[Object.keys(data).find(k=>data?.[k]?.row)];
    const apiCode=String(block?.RESULT?.CODE||data?.RESULT?.CODE||'');
    if(apiCode&&apiCode!=='INFO-000')return{status:'unavailable',message:'서울시 공개데이터 API 오류: '+apiCode,matches:[],service};
    const rows=Array.isArray(block?.row)?block.row:[];
    const inputFull=clean(address),inputBase=baseAddress(address),inputHasUnit=hasUnit(address);
    const candidates=rows.filter(row=>{
      const addr=rowAddress(row);
      if(!addr)return false;
      const rowFull=clean(addr),rowBase=baseAddress(addr);
      return rowBase===inputBase||rowFull.includes(inputBase)||inputFull.includes(rowBase);
    });
    if(!candidates.length)return{status:'not_found',message:'해당 주소에서 외국인관광 도시민박업 인허가를 찾지 못했습니다.',matches:[],service,district};

    const active=candidates.filter(isActive),inactive=candidates.filter(row=>!isActive(row));
    const exactActive=inputHasUnit?active.filter(row=>{
      const rf=clean(rowAddress(row));
      return rf===inputFull||rf.includes(inputFull)||inputFull.includes(rf);
    }):[];

    if(exactActive.length){
      return{status:'confirmed',message:'입력한 호수와 일치하는 외국인관광 도시민박업 인허가가 영업/정상 상태입니다.',matches:exactActive.map(compactEvidence),service,district,matchLevel:'unit'};
    }
    if(active.length){
      return{status:'building_match',message:inputHasUnit?'같은 건물에 영업/정상 인허가는 있으나 입력한 호수와 정확히 일치하지 않습니다.':'같은 건물에 영업/정상 인허가가 있습니다. 정확한 호수를 입력하면 해당 호수까지 확인할 수 있습니다.',matches:active.map(compactEvidence),service,district,matchLevel:'building'};
    }
    return{status:'inactive',message:'같은 주소의 인허가 기록은 있으나 현재 영업/정상 상태로 확인되지 않습니다.',matches:inactive.map(compactEvidence),service,district,matchLevel:'building'};
  }catch(error){
    console.error('seoulLookup',error);
    return{status:'unavailable',message:'서울시 공개데이터 자동조회가 일시적으로 불가능합니다.',matches:[],service,district};
  }
}

export default async function(req){
  if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
  let body={};try{body=await req.json()}catch{return reply({error:'요청 형식이 올바르지 않습니다.'},400)}
  const address=String(body.address||'').trim(),businessNo=String(body.businessNo||'').replace(/[^0-9]/g,''),buildingUse=String(body.buildingUse||'unknown');
  if(address.length<5)return reply({error:'주소를 정확히 입력해 주세요.'},400);

  const region=regionOf(address),seoul=await seoulLookup(address),sources=[];
  sources.push({source:'address_input',label:'입력 주소',status:'confirmed',statusLabel:'입력 확인',message:region.sigungu?region.sido+' '+region.sigungu+' 기준으로 조회했습니다.':'입력 주소 형식을 확인했습니다.'});

  const seoulStatus=seoul.status==='confirmed'?'confirmed':seoul.status==='building_match'?'needs_check':seoul.status==='inactive'?'needs_check':seoul.status==='not_found'?'needs_check':'needs_check';
  const seoulLabel=seoul.status==='confirmed'?'영업/정상':seoul.status==='building_match'?'같은 건물 활성':seoul.status==='inactive'?'비활성':seoul.status==='not_found'?'인허가 미확인':'조회 오류';
  const evidenceText=(seoul.matches||[]).slice(0,3).map(x=>[x.businessName,x.roadAddress,x.tradeStatus||x.detailStatus,x.permitDate&&('인가 '+x.permitDate),x.managementNo&&('관리번호 '+x.managementNo)].filter(Boolean).join(' · ')).join(' / ');
  sources.push({source:'seoul_foreign_homestay',label:'서울시 외국인관광 도시민박업',status:seoulStatus,statusLabel:seoulLabel,message:seoul.message+(evidenceText?' '+evidenceText:''),evidence:seoul.matches||[],service:seoul.service||null});

  if(businessNo)sources.push({source:'business_number',label:'사업자등록번호',status:'needs_check',statusLabel:'별도 확인',message:'외국인관광 도시민박업 공개 인허가 데이터에는 사업자등록번호가 없어 국세청/홈택스 원천 확인이 별도로 필요합니다.'});

  const apiUse=(seoul.matches||[]).map(x=>x.buildingUse).find(Boolean)||null;
  sources.push({source:'building_use',label:'건축물 용도',status:apiUse?'confirmed':'needs_check',statusLabel:apiUse?'공개데이터 확인':'추가확인',message:apiUse?'인허가 공개데이터 건물용도: '+apiUse:(buildingUse==='unknown'?'건축물대장 원본에서 주용도를 추가 확인해야 합니다.':'선택한 건물용도는 자가 입력값입니다. 건축물대장 원본과 대조가 필요합니다.')});

  const overallStatus=seoul.status==='confirmed'?'confirmed':seoul.status==='building_match'?'partial':seoul.status==='inactive'?'inactive':seoul.status==='not_found'?'not_found':'unavailable';
  const summary=seoul.status==='confirmed'
    ?'입력한 호수의 외국인관광 도시민박업이 영업/정상 상태로 확인됩니다.'
    :seoul.status==='building_match'
      ?'같은 건물에 영업/정상 인허가가 있습니다. 정확한 호수를 확인해 주세요.'
      :seoul.status==='inactive'
        ?'같은 주소의 인허가 기록은 있지만 현재 활성 영업으로 확인되지 않습니다.'
        :seoul.status==='not_found'
          ?'입력 주소에서 외국인관광 도시민박업 인허가를 확인하지 못했습니다.'
          :'공공데이터 조회가 완료되지 않았습니다. 원천데이터 확인이 필요합니다.';

  return reply({ok:true,overallStatus,summary,region,sources,permitMatches:seoul.matches||[],matchLevel:seoul.matchLevel||null,service:seoul.service||null,building:apiUse?{useName:apiUse}:null,disclaimer:'서울 열린데이터광장 지방행정 인허가 데이터를 기준으로 한 자동대조이며 데이터는 최대 수일의 시차가 있을 수 있습니다. 최종 계약·영업 가능 여부는 관할기관 원본 확인이 필요합니다.'});
}

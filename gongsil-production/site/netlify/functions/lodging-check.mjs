function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}

const SERVICE_BY_DISTRICT={
  '종로구':'LOCALDATA_031104_JN','중구':'LOCALDATA_031104_JG','용산구':'LOCALDATA_031104_YS',
  '성동구':'LOCALDATA_031104_SD','광진구':'LOCALDATA_031104_GJ','동대문구':'LOCALDATA_031104_DD',
  '중랑구':'LOCALDATA_031104_JR','성북구':'LOCALDATA_031104_SB','강북구':'LOCALDATA_031104_GB',
  '도봉구':'LOCALDATA_031104_DB','노원구':'LOCALDATA_031104_NW','은평구':'LOCALDATA_031104_EP',
  '서대문구':'LOCALDATA_031104_SM','마포구':'LOCALDATA_031104_MP','양천구':'LOCALDATA_031104_YC',
  '강서구':'LOCALDATA_031104_GS','구로구':'LOCALDATA_031104_GR','금천구':'LOCALDATA_031104_GC',
  '영등포구':'LOCALDATA_031104_YD','동작구':'LOCALDATA_031104_DJ','관악구':'LOCALDATA_031104_GA',
  '서초구':'LOCALDATA_031104_SC','강남구':'LOCALDATA_031104_GN','송파구':'LOCALDATA_031104_SP',
  '강동구':'LOCALDATA_031104_GD'
};

const clean=v=>String(v||'').normalize('NFKC').replace(/\([^)]*\)/g,'').replace(/\s+/g,'').replace(/[^0-9A-Za-z가-힣-]/g,'').toLowerCase();
function compactAddress(v){return clean(v)}
function normNum(v){const n=parseInt(String(v||'').replace(/\D/g,''),10);return Number.isFinite(n)?String(n):''}
function unitIdentity(v){
  const s=String(v||'').normalize('NFKC').toLowerCase();
  const dong=s.match(/(\d{1,4})\s*동(?:\s|,|$)/i);
  const basementFloor=s.match(/(?:b|비|지하)\s*(\d{1,2})\s*층/i);
  const floor=!basementFloor?s.match(/(?:^|\s|,)(\d{1,2})\s*층/i):null;
  const basementHo=s.match(/(?:b|비)\s*(\d{1,4})\s*호/i);
  const ho=!basementHo?s.match(/(?:^|\s|,)(\d{1,4})\s*호/i):null;
  return {
    dong:dong?normNum(dong[1]):'',
    floor:basementFloor?'b'+normNum(basementFloor[1]):floor?normNum(floor[1]):'',
    ho:basementHo?'b'+normNum(basementHo[1]):ho?normNum(ho[1]):''
  };
}
function sameUnitIdentity(a,b){
  const aa=unitIdentity(a),bb=unitIdentity(b);
  if(!aa.ho&&!aa.floor)return false;
  if(!bb.ho&&!bb.floor)return false;
  if(aa.ho!==bb.ho)return false;
  if(aa.dong||bb.dong){if(aa.dong!==bb.dong)return false}
  if(aa.floor&&bb.floor&&aa.floor!==bb.floor)return false;
  return true;
}
function sameCompactAddress(a,b){
  const aa=compactAddress(a),bb=compactAddress(b);
  const baseHit=!!aa&&!!bb&&(aa===bb||aa.includes(bb)||bb.includes(aa));
  return baseHit&&sameUnitIdentity(a,b);
}
async function sha256Hex(value){
  const bytes=new TextEncoder().encode(String(value||''));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
}

const unitPattern=/(?:,?\s*(?:b\s*\d+|비\s*\d+\s*층|지하\s*\d+\s*층|\d+\s*층|\d+\s*호|[a-z]?\d{3,4}\s*호?))(?:\s|$)/ig;
function baseAddress(v){return clean(String(v||'').replace(unitPattern,' ').replace(/,.*$/,''))}
function hasUnit(v){return /(?:b\s*\d+|비\s*\d+\s*층|지하\s*\d+\s*층|\d+\s*층|\d+\s*호|[a-z]?\d{3,4}\s*호?)/i.test(String(v||''))}
function roadCore(v){
  const s=clean(v);
  const m=s.match(/([가-힣0-9]+(?:대로|로|길)\d+(?:-\d+)?)/);
  return m?m[1]:'';
}
function districtOf(address){return Object.keys(SERVICE_BY_DISTRICT).find(d=>String(address||'').includes(d))||''}
function regionOf(address,fallbackDistrict=''){const text=String(address||'').trim(),district=districtOf(text)||fallbackDistrict;return{sido:'서울특별시',sigungu:district||''}}
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

async function fetchApiPage(key,service,start,end){
  const url='http://openapi.seoul.go.kr:8088/'+encodeURIComponent(key)+'/json/'+encodeURIComponent(service)+'/'+start+'/'+end+'/';
  const res=await fetch(url,{signal:AbortSignal.timeout(12000)});
  if(!res.ok)throw new Error('http_'+res.status);
  const data=await res.json(),block=data?.[service]||data?.[Object.keys(data).find(k=>data?.[k]?.row)];
  const apiCode=String(block?.RESULT?.CODE||data?.RESULT?.CODE||'');
  if(apiCode&&apiCode!=='INFO-000'&&apiCode!=='INFO-200')throw new Error(apiCode);
  return {
    rows:Array.isArray(block?.row)?block.row:[],
    total:Number(block?.list_total_count||0)||0,
    apiCode:apiCode||'INFO-000'
  };
}
async function fetchDistrictRows(key,district,service){
  try{
    const first=await fetchApiPage(key,service,1,1000);
    const rows=[...first.rows];
    const total=Math.max(first.total,rows.length);
    const maxRows=Math.min(total,10000);
    let pagesFetched=1;
    for(let start=1001;start<=maxRows;start+=1000){
      const end=Math.min(start+999,maxRows);
      const page=await fetchApiPage(key,service,start,end);
      rows.push(...page.rows);
      pagesFetched++;
      if(!page.rows.length)break;
    }
    return{district,service,rows,totalCount:total,pagesFetched,truncated:total>10000};
  }catch(error){
    return{district,service,rows:[],totalCount:0,pagesFetched:0,truncated:false,error:String(error?.message||error)};
  }
}

async function seoulLookup(address){
  const key=Netlify.env.get('SEOUL_API_KEY');
  if(!key)return{status:'unavailable',message:'서울 열린데이터 API 키가 설정되지 않았습니다.',matches:[]};

  const explicitDistrict=districtOf(address);
  const targets=explicitDistrict
    ? [[explicitDistrict,SERVICE_BY_DISTRICT[explicitDistrict]]]
    : Object.entries(SERVICE_BY_DISTRICT);

  const inputFull=clean(address),inputBase=baseAddress(address),inputHasUnit=hasUnit(address);
  if(inputBase.length<5)return{status:'not_found',message:'도로명과 번지를 조금 더 정확히 입력해 주세요.',matches:[]};

  const settled=await Promise.all(targets.map(([district,service])=>fetchDistrictRows(key,district,service)));
  const candidates=[];
  const sourceMeta={
    searchedDistricts:targets.length,
    failedDistricts:settled.filter(x=>x.error).length,
    totalRowsScanned:settled.reduce((sum,x)=>sum+(x.rows?.length||0),0),
    pagesFetched:settled.reduce((sum,x)=>sum+(x.pagesFetched||0),0),
    truncatedDistricts:settled.filter(x=>x.truncated).map(x=>x.district)
  };

  for(const result of settled){
    for(const row of result.rows||[]){
      const addr=rowAddress(row);
      if(!addr)continue;
      const rowFull=compactAddress(addr),rowBase=baseAddress(addr);
      const inputRoad=roadCore(address),rowRoad=roadCore(addr);const hit=rowBase===inputBase||rowFull.includes(inputBase)||inputFull.includes(rowBase)||(inputRoad&&rowRoad&&inputRoad===rowRoad);
      if(hit)candidates.push({row,district:result.district,service:result.service});
    }
  }

  if(!candidates.length){
    const failures=settled.filter(x=>x.error);
    if(failures.length===settled.length){
      return{
        status:'unavailable',
        message:'서울 열린데이터 API 응답을 받지 못했습니다. 잠시 후 다시 조회해 주세요.',
        matches:[],
        ...sourceMeta
      };
    }
    return{
      status:'not_found',
      message:explicitDistrict
        ?'해당 주소에서 외국인관광 도시민박업 인허가를 찾지 못했습니다.'
        :'서울 25개 자치구 인허가 DB를 검색했지만 입력 주소와 일치하는 항목을 찾지 못했습니다.',
      matches:[],
      ...sourceMeta
    };
  }

  const active=candidates.filter(x=>isActive(x.row));
  const inactive=candidates.filter(x=>!isActive(x.row));
  const exactActive=inputHasUnit?active.filter(x=>sameCompactAddress(rowAddress(x.row),address)):[];

  const pack=list=>list.map(x=>({...compactEvidence(x.row),district:x.district,service:x.service}));
  const first=(exactActive[0]||active[0]||inactive[0]||candidates[0]);

  if(exactActive.length){
    return{status:'confirmed',message:'입력한 호수와 일치하는 외국인관광 도시민박업 인허가가 영업/정상 상태입니다.',matches:pack(exactActive),service:first.service,district:first.district,matchLevel:'unit',...sourceMeta};
  }
  if(active.length){
    return{
      status:'building_match',
      message:inputHasUnit
        ?'같은 건물에 영업/정상 인허가는 있으나 입력한 호수와 정확히 일치하지 않습니다.'
        :'같은 건물에 영업/정상 인허가가 있습니다. 호수 없이 조회했으므로 건물 단위 결과입니다.',
      matches:pack(active),
      service:first.service,
      district:first.district,
      matchLevel:'building',
      ...sourceMeta
    };
  }
  return{status:'inactive',message:'같은 주소의 인허가 기록은 있으나 현재 영업/정상 상태로 확인되지 않습니다.',matches:pack(inactive),service:first.service,district:first.district,matchLevel:'building',...sourceMeta};
}

export default async function(req){
  if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
  let body={};try{body=await req.json()}catch{return reply({error:'요청 형식이 올바르지 않습니다.'},400)}
  const address=String(body.address||'').trim(),businessNo=String(body.businessNo||'').replace(/[^0-9]/g,''),buildingUse=String(body.buildingUse||'unknown');
  if(address.length<5)return reply({error:'주소를 정확히 입력해 주세요.'},400);
  if(!hasUnit(address))return reply({error:'도로명주소와 동·층·호수까지 정확히 입력해 주세요. 사업자등록번호는 입력하지 않아도 됩니다.',code:'unit_required'},400);

  const seoul=await seoulLookup(address),region=regionOf(address,seoul.district||''),sources=[];
  sources.push({source:'address_input',label:'입력 주소',status:'confirmed',statusLabel:'입력 확인',message:region.sigungu?region.sido+' '+region.sigungu+' 인허가 DB에서 조회했습니다.':'서울 25개 자치구 인허가 DB를 자동 검색했습니다.'});

  const seoulStatus=seoul.status==='confirmed'?'confirmed':seoul.status==='building_match'?'needs_check':seoul.status==='inactive'?'needs_check':seoul.status==='not_found'?'needs_check':'needs_check';
  const seoulLabel=seoul.status==='confirmed'?'영업/정상':seoul.status==='building_match'?'같은 건물 활성':seoul.status==='inactive'?'비활성':seoul.status==='not_found'?'인허가 미확인':'조회 오류';
  const evidenceText=(seoul.matches||[]).slice(0,3).map(x=>[x.businessName,x.roadAddress,x.tradeStatus||x.detailStatus,x.permitDate&&('인가 '+x.permitDate),x.managementNo&&('관리번호 '+x.managementNo)].filter(Boolean).join(' · ')).join(' / ');
  const legacyMatches=(seoul.matches||[]).map(x=>({bizName:x.businessName||null,status:x.tradeStatus||x.detailStatus||null,address:x.roadAddress||x.lotAddress||null,permitDate:x.permitDate||null,managementNo:x.managementNo||null}));
  sources.push({source:'seoul_outdomin_registry',label:'서울시 외국인관광 도시민박업',status:seoulStatus,statusLabel:seoulLabel,message:seoul.message+(evidenceText?' '+evidenceText:''),matches:legacyMatches,evidence:seoul.matches||[],service:seoul.service||null});

  if(businessNo)sources.push({source:'business_number',label:'사업자등록번호',status:'needs_check',statusLabel:'별도 확인',message:'외국인관광 도시민박업 공개 인허가 데이터에는 사업자등록번호가 없어 국세청/홈택스 원천 확인이 별도로 필요합니다.'});

  const apiUse=(seoul.matches||[]).map(x=>x.buildingUse).find(Boolean)||null;
  sources.push({source:'building_use',label:'건축물 용도',status:apiUse?'confirmed':'needs_check',statusLabel:apiUse?'공개데이터 확인':'추가확인',message:apiUse?'인허가 공개데이터 건물용도: '+apiUse:(buildingUse==='unknown'?'건축물대장 원본에서 주용도를 추가 확인해야 합니다.':'선택한 건물용도는 자가 입력값입니다. 건축물대장 원본과 대조가 필요합니다.')});

  const overallStatus=seoul.status==='confirmed'?'confirmed':seoul.status==='building_match'?'partial':seoul.status==='inactive'?'inactive':seoul.status==='not_found'?'not_found':'unavailable';
  const summary=seoul.status==='confirmed'
    ?'입력한 호수의 외국인관광 도시민박업이 영업/정상 상태로 확인됩니다.'
    :seoul.status==='building_match'
      ?'같은 건물에 영업/정상 인허가는 있으나 입력한 동·층·호수와 정확히 일치하지 않습니다.'
      :seoul.status==='inactive'
        ?'같은 주소의 인허가 기록은 있지만 현재 활성 영업으로 확인되지 않습니다.'
        :seoul.status==='not_found'
          ?'입력 주소에서 외국인관광 도시민박업 인허가를 확인하지 못했습니다.'
          :'공공데이터 조회가 완료되지 않았습니다. 원천데이터 확인이 필요합니다.';

  const checkedAt=new Date().toISOString();
  const evidenceFingerprint=await sha256Hex(JSON.stringify({
    normalizedAddress:compactAddress(address),
    unit:unitIdentity(address),
    overallStatus,
    service:seoul.service||null,
    matches:(seoul.matches||[]).map(x=>({managementNo:x.managementNo,status:x.tradeStatus||x.detailStatus,lastModified:x.lastModified,roadAddress:x.roadAddress}))
  }));
  return reply({
    ok:true,overallStatus,summary,region,sources,
    permitMatches:seoul.matches||[],
    matchLevel:seoul.matchLevel||null,
    service:seoul.service||null,
    checkedAt,
    evidenceFingerprint,
    sourceMeta:{
      searchedDistricts:seoul.searchedDistricts||0,
      failedDistricts:seoul.failedDistricts||0,
      totalRowsScanned:seoul.totalRowsScanned||0,
      pagesFetched:seoul.pagesFetched||0,
      truncatedDistricts:seoul.truncatedDistricts||[]
    },
    building:apiUse?{useName:apiUse}:null,
    disclaimer:'서울 열린데이터광장 지방행정 인허가 데이터를 기준으로 한 자동대조이며 데이터는 최대 수일의 시차가 있을 수 있습니다. 최종 계약·영업 가능 여부는 관할기관 원본 확인이 필요합니다.'
  });
}

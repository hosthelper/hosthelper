import React from 'https://esm.sh/react@18.2.0'
import { ImageResponse } from 'https://deno.land/x/og_edge@0.0.4/mod.ts'

type Slide = { eyebrow:string; title:string; body:string; bullets:string[]; dark?:boolean; accent?:boolean }

const packs: Record<string, Record<number, Slide>> = {
  'CNT-HOST-72H-02': {
    1:{eyebrow:'HOSTHELPER · EMPATHY',title:'숙소 운영하면서\n이런 생각\n해본 적 있으세요?',body:'예약·문의·리뷰 하나에 하루 기분이 달라지는 운영자에게.',bullets:['예약이 없으면 “내 숙소가 별론가?”','문의가 몰리면 “계속 내가 답해야 하나?”','리뷰가 떨어지면 “뭘 잘못했지?”'],dark:true},
    2:{eyebrow:'01  예약이 조용할 때',title:'“가격을 더\n내려야 하나?”',body:'예약이 없다고 원인이 항상 가격인 것은 아닙니다.',bullets:['노출','사진·상세','리뷰','예약조건','지역 수요']},
    3:{eyebrow:'02  문의가 몰릴 때',title:'“이걸 계속\n직접 해야 하나?”',body:'반복 문의는 친절의 문제가 아니라 시스템의 문제일 수 있습니다.',bullets:['체크인','와이파이','주차','냉난방','체크아웃']},
    4:{eyebrow:'03  리뷰 하나가 떨어질 때',title:'“도대체\n뭘 잘못했지?”',body:'리뷰는 감정이 아니라 운영 병목을 찾는 데이터로 봅니다.',bullets:['청결','안내','사진과 실제','응답','시설']},
    5:{eyebrow:'HELPER CONTENT INSIGHT',title:'운영자가 부족해서가\n아닐 수 있습니다.',body:'문제는 ‘기준 없이 혼자 다 판단하는 운영’일 수 있습니다.',bullets:['데이터로 확인','가장 큰 병목 1개 선택','다음 행동 1~3개 실행'],dark:true},
    6:{eyebrow:'HOSTHELPER FREE DIAGNOSIS',title:'숙소 링크 +\n“진단”',body:'가격·사진·리뷰·예약전환·운영을 함께 봅니다.',bullets:['현재 상태','가장 큰 병목','다음 최우선 액션'],accent:true},
  },
  'CNT-HOST-72H-04': {
    1:{eyebrow:'72H CUSTOMER ACQUISITION',title:'숙소 운영\n5대 항목\n무료진단',body:'운영 중인데 어디부터 고쳐야 할지 모르겠다면, 한 번에 다 보지 않습니다.',bullets:['가격','사진·상세','리뷰','예약전환','운영'],dark:true},
    2:{eyebrow:'01  가격',title:'예약이 없다고\n가격부터 내리면\n안 됩니다.',body:'먼저 원인을 구분합니다.',bullets:['노출이 부족한가?','상세페이지 전환이 약한가?','특정 날짜 수요가 약한가?']},
    3:{eyebrow:'02  사진 · 상세페이지',title:'게스트가 클릭한 뒤\n“여기서 자고 싶다”는\n확신을 얻는가?',body:'예쁜 사진보다 예약 판단에 필요한 정보가 먼저입니다.',bullets:['공간감·침대·욕실·동선','불안을 줄이는 설명','검색 조건과 실제 편의시설의 일치']},
    4:{eyebrow:'03  리뷰',title:'리뷰는\n“평점”이 아니라\n운영 데이터입니다.',body:'반복되는 불만은 운영 병목을 알려줍니다.',bullets:['청결 문제 반복','체크인 안내 불명확','사진과 실제의 차이','응답 속도·친절도','소음·시설 불편'],dark:true},
    5:{eyebrow:'04 예약전환  +  05 운영',title:'예약이 안 되는 이유와\n운영이 힘든 이유는\n다를 수 있습니다.',body:'가장 큰 병목 1개부터 고칩니다.',bullets:['예약전환: 가격·최소숙박·취소조건·사진/리뷰','운영: 체크인·청소·CS·반복업무']},
    6:{eyebrow:'HOSTHELPER FREE DIAGNOSIS',title:'숙소 링크 +\n“진단”',body:'DM으로 보내주세요.',bullets:['5대 항목 현재 상태','가장 큰 병목 1개','다음 최우선 액션 1~3개'],accent:true},
  },
  'CNT-HOST-72H-06': {
    1:{eyebrow:'72H FIELD EXPERIMENT',title:'숙소 10곳\n운영진단\n실험',body:'과장된 성공담 대신 실제 숙소의 병목을 찾아보겠습니다.',bullets:['실제 운영 중인 숙소','숙소 링크 필요','무료 5대 항목 진단'],dark:true},
    2:{eyebrow:'WHY',title:'왜 이 실험을\n하나요?',body:'운영자는 매출이 답답해도 어디부터 바꿔야 할지 모르는 경우가 많습니다.',bullets:['가격부터 내릴까?','사진부터 바꿀까?','광고부터 할까?']},
    3:{eyebrow:'WHAT WE CHECK',title:'5가지만\n봅니다.',body:'많이 말하는 것보다 가장 큰 병목을 찾는 게 먼저입니다.',bullets:['가격','사진·상세페이지','리뷰','예약전환','운영 프로세스']},
    4:{eyebrow:'OUTPUT',title:'결과는\n“점수 자랑”이\n아닙니다.',body:'진단 결과를 실제 다음 행동으로 바꿉니다.',bullets:['현재 상태','가장 큰 병목 1개','우선 실행 액션 1~3개'],dark:true},
    5:{eyebrow:'WHO',title:'이런 호스트를\n찾습니다.',body:'현재 숙소를 실제로 운영하면서 개선 우선순위가 필요한 분.',bullets:['예약이 답답한 숙소','운영 피로가 큰 숙소','무엇부터 볼지 모르는 숙소']},
    6:{eyebrow:'HOSTHELPER FREE DIAGNOSIS',title:'숙소 링크 +\n“진단”',body:'DM으로 보내주세요.',bullets:['5대 항목 현재 상태','가장 큰 병목 1개','다음 최우선 액션 1~3개'],accent:true},
  },
}

const wrapLines = (text:string) => text.split('\n').map((line, i, arr) => <React.Fragment key={i}>{line}{i < arr.length-1 ? <br/> : null}</React.Fragment>)

export default function handler(req: Request) {
  const url = new URL(req.url)
  const content = url.searchParams.get('content') || 'CNT-HOST-72H-04'
  const slide = Math.max(1, Math.min(6, Number(url.searchParams.get('slide') || '1')))
  const pack = packs[content]
  if (!pack) return new Response('not found', { status: 404 })
  const s = pack[slide]
  const bg = s.accent ? '#2ab5a4' : (s.dark ? '#101c34' : '#f8f6f0')
  const fg = s.dark || s.accent ? '#ffffff' : '#171c26'
  const sub = s.dark ? '#dce2ec' : (s.accent ? '#0f2740' : '#606a78')
  const cardBg = s.dark ? '#1b2c4a' : '#ffffff'
  const accent = s.accent ? '#101c34' : '#2ab5a4'
  return new ImageResponse(
    <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',background:bg,color:fg,padding:'78px 72px',fontFamily:'sans-serif'}}>
      <div style={{display:'flex',alignItems:'center',fontSize:30,fontWeight:700,color:s.dark?'#2ab5a4':accent,letterSpacing:'0.02em'}}>{s.eyebrow}</div>
      <div style={{display:'flex',fontSize:slide===1?86:(slide===6?92:70),fontWeight:800,lineHeight:1.16,marginTop:'50px',whiteSpace:'pre-wrap'}}>{wrapLines(s.title)}</div>
      <div style={{display:'flex',fontSize:33,lineHeight:1.5,color:sub,marginTop:'30px'}}>{s.body}</div>
      <div style={{display:'flex',flexDirection:'column',gap:'16px',marginTop:'42px'}}>
        {s.bullets.map((b,i)=><div key={i} style={{display:'flex',alignItems:'center',background:cardBg,borderRadius:22,padding:'20px 26px',color:s.dark?'#ffffff':'#171c26',fontSize:29,fontWeight:600}}><div style={{display:'flex',minWidth:34,width:34,height:34,borderRadius:17,background:accent,color:'#ffffff',alignItems:'center',justifyContent:'center',fontSize:20,marginRight:20}}>{i+1}</div>{b}</div>)}
      </div>
      <div style={{display:'flex',marginTop:'auto',justifyContent:'space-between',fontSize:22,color:s.dark?'#909bad':(s.accent?'#15594f':'#8c94a0'),fontWeight:700}}><span>HOSTHELPER · HELPER CONTENT</span><span>{slide}/6</span></div>
    </div>,
    { width:1080, height:1350, headers:{'Cache-Control':'public, max-age=31536000, no-transform, immutable','Content-Type':'image/png'} }
  )
}

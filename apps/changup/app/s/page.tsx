'use client';

// 공개 설문 — SNS로 공유하는 예비창업자 희망 조건 접수 페이지 (모바일 우선, 1열).
import { useState } from 'react';
import {
  CONTACT_CHANNEL_LABELS,
  OPERATION_TYPE_LABELS,
  type ContactChannel,
  type OperationType,
} from '@hosthelper/shared';
import { api } from '../api-client';
import { BRAND, Btn, input, label } from '../ui';

const OPERATION_TYPES = Object.keys(OPERATION_TYPE_LABELS) as OperationType[];
const CHANNELS = Object.keys(CONTACT_CHANNEL_LABELS) as ContactChannel[];

// "카페, 치킨" → ["카페", "치킨"]
function splitTags(s: string): string[] {
  return s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

// 만원 단위 입력 → 원 (빈 값 = 무제한)
function manToWon(s: string): number | null {
  const n = Number(s.replace(/[^0-9]/g, ''));
  return s.trim() === '' || Number.isNaN(n) || n <= 0 ? null : n * 10_000;
}

export default function SurveyPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState<ContactChannel>('PHONE');
  const [ops, setOps] = useState<OperationType[]>([]);
  const [industries, setIndustries] = useState('');
  const [regions, setRegions] = useState('');
  const [depositMan, setDepositMan] = useState('');
  const [rentMan, setRentMan] = useState('');
  const [premiumMan, setPremiumMan] = useState('');
  const [notes, setNotes] = useState('');
  const [website, setWebsite] = useState(''); // 허니팟
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  function toggleOp(op: OperationType) {
    setOps((prev) => (prev.includes(op) ? prev.filter((o) => o !== op) : [...prev, op]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (ops.length === 0) {
      setError('운영 방식을 하나 이상 선택해주세요.');
      return;
    }
    setState('sending');
    setError('');
    try {
      await api.submitSurvey({
        name,
        phone,
        contactChannel: channel,
        operationTypes: ops,
        industries: splitTags(industries),
        regions: splitTags(regions),
        depositMax: manToWon(depositMan),
        rentMax: manToWon(rentMan),
        premiumMax: manToWon(premiumMan),
        notes: notes.trim() || undefined,
        website,
      });
      setState('done');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : '제출에 실패했습니다. 다시 시도해주세요.');
    }
  }

  if (state === 'done') {
    return (
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '3rem 1.25rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem' }}>✅</div>
        <h1 style={{ fontSize: '1.3rem' }}>접수 완료!</h1>
        <p style={{ color: '#6b7280', lineHeight: 1.6 }}>
          희망 조건을 잘 받았습니다.
          <br />
          조건에 맞는 매물이 준비되는 대로
          <br />
          담당자가 연락드립니다.
        </p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '1.5rem 1.25rem 3rem' }}>
      <header style={{ margin: '0.5rem 0 1.5rem' }}>
        <div style={{ fontWeight: 700, color: BRAND }}>창업이지</div>
        <h1 style={{ fontSize: '1.35rem', margin: '0.5rem 0' }}>
          어떤 가게를 찾고 계신가요?
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0, lineHeight: 1.6 }}>
          희망 조건을 남겨주시면 딱 맞는 창업 매물이 나왔을 때 가장 먼저 알려드립니다.
        </p>
      </header>

      <form onSubmit={submit}>
        <span style={label}>운영 방식 (복수 선택)</span>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {OPERATION_TYPES.map((op) => {
            const on = ops.includes(op);
            return (
              <button
                key={op}
                type="button"
                onClick={() => toggleOp(op)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 999,
                  border: `1px solid ${on ? BRAND : '#d1d5db'}`,
                  background: on ? BRAND : '#fff',
                  color: on ? '#fff' : '#374151',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {OPERATION_TYPE_LABELS[op]}
              </button>
            );
          })}
        </div>

        <label style={label} htmlFor="industries">
          희망 업종 <span style={{ color: '#9ca3af', fontWeight: 400 }}>(쉼표로 구분, 예: 카페, 치킨)</span>
        </label>
        <input
          id="industries"
          style={input}
          value={industries}
          onChange={(e) => setIndustries(e.target.value)}
          placeholder="무관이면 비워두세요"
        />

        <label style={label} htmlFor="regions">
          희망 지역 <span style={{ color: '#9ca3af', fontWeight: 400 }}>(예: 마포구, 강남구)</span>
        </label>
        <input
          id="regions"
          style={input}
          value={regions}
          onChange={(e) => setRegions(e.target.value)}
          placeholder="무관이면 비워두세요"
        />

        <label style={label} htmlFor="deposit">보증금 최대 (만원)</label>
        <input
          id="deposit"
          style={input}
          inputMode="numeric"
          value={depositMan}
          onChange={(e) => setDepositMan(e.target.value)}
          placeholder="예: 3000 (무관이면 비워두세요)"
        />

        <label style={label} htmlFor="rent">월세 최대 (만원)</label>
        <input
          id="rent"
          style={input}
          inputMode="numeric"
          value={rentMan}
          onChange={(e) => setRentMan(e.target.value)}
          placeholder="예: 200"
        />

        <label style={label} htmlFor="premium">권리금 최대 (만원)</label>
        <input
          id="premium"
          style={input}
          inputMode="numeric"
          value={premiumMan}
          onChange={(e) => setPremiumMan(e.target.value)}
          placeholder="예: 5000"
        />

        <label style={label} htmlFor="name">성함</label>
        <input
          id="name"
          style={input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={50}
        />

        <label style={label} htmlFor="phone">휴대폰 번호</label>
        <input
          id="phone"
          style={input}
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          placeholder="010-0000-0000"
        />

        <label style={label} htmlFor="channel">연락 받으실 방법</label>
        <select
          id="channel"
          style={input}
          value={channel}
          onChange={(e) => setChannel(e.target.value as ContactChannel)}
        >
          {CHANNELS.map((c) => (
            <option key={c} value={c}>
              {CONTACT_CHANNEL_LABELS[c]}
            </option>
          ))}
        </select>

        <label style={label} htmlFor="notes">추가로 남기실 말씀</label>
        <textarea
          id="notes"
          style={{ ...input, minHeight: 80, resize: 'vertical' }}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
        />

        {/* 허니팟 — 사람에게는 보이지 않는 필드. 봇이 채우면 서버가 저장을 생략한다. */}
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
        />

        {error ? (
          <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '1rem' }}>{error}</p>
        ) : null}

        <div style={{ marginTop: '1.5rem' }}>
          <Btn type="submit" disabled={state === 'sending'}>
            {state === 'sending' ? '접수 중…' : '무료로 매물 추천받기'}
          </Btn>
        </div>
        <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '0.75rem', lineHeight: 1.5 }}>
          남겨주신 연락처는 매물 안내 목적으로만 사용됩니다.
        </p>
      </form>
    </main>
  );
}

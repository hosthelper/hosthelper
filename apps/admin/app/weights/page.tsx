'use client';

import { useState } from 'react';
import { Shell, card, Btn } from '../ui';

interface Weights {
  wDistance: number;
  wRating: number;
  wCompleted: number;
  wRebooking: number;
  wDeclinePenalty: number;
  newCleanerBoost: number;
  maxDistanceKm: number;
  topN: number;
  offerTtlMinutes: number;
  maxRounds: number;
}

const DEFAULTS: Weights = {
  wDistance: 0.35,
  wRating: 0.25,
  wCompleted: 0.15,
  wRebooking: 0.15,
  wDeclinePenalty: 0.1,
  newCleanerBoost: 0.1,
  maxDistanceKm: 10,
  topN: 5,
  offerTtlMinutes: 15,
  maxRounds: 3,
};

const FIELDS: { key: keyof Weights; label: string; step: number; max: number }[] = [
  { key: 'wDistance', label: '거리 가중치', step: 0.05, max: 1 },
  { key: 'wRating', label: '평점 가중치', step: 0.05, max: 1 },
  { key: 'wCompleted', label: '완료건수 가중치', step: 0.05, max: 1 },
  { key: 'wRebooking', label: '재예약률 가중치', step: 0.05, max: 1 },
  { key: 'wDeclinePenalty', label: '거절 패널티', step: 0.05, max: 1 },
  { key: 'newCleanerBoost', label: '신규 청소사 부스트', step: 0.05, max: 1 },
  { key: 'maxDistanceKm', label: '최대 거리(km)', step: 1, max: 50 },
  { key: 'topN', label: '라운드당 후보 수', step: 1, max: 20 },
  { key: 'offerTtlMinutes', label: '오퍼 만료(분)', step: 1, max: 60 },
  { key: 'maxRounds', label: '최대 라운드', step: 1, max: 10 },
];

export default function WeightsPage() {
  const [w, setW] = useState<Weights>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  function update(key: keyof Weights, value: number) {
    setW((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  const weightSum = (w.wDistance + w.wRating + w.wCompleted + w.wRebooking).toFixed(2);

  return (
    <Shell title="매칭 가중치 튜닝">
      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {FIELDS.map((f) => (
            <label key={f.key} style={{ display: 'block' }}>
              <span style={{ display: 'block', color: '#6b7280', fontSize: '0.8rem', marginBottom: '0.3rem' }}>{f.label}</span>
              <input
                type="number"
                value={w[f.key]}
                step={f.step}
                min={0}
                max={f.max}
                onChange={(e) => update(f.key, Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.7rem',
                  border: '1px solid #ececec',
                  borderRadius: 8,
                  fontSize: '0.95rem',
                }}
              />
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
            점수 가중치 합(거리+평점+완료+재예약): <strong style={{ color: '#0a0a0a' }}>{weightSum}</strong> · 1.0 권장
          </span>
          <span style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
            {saved ? <span style={{ color: '#047857', fontSize: '0.85rem' }}>저장됨 ✓</span> : null}
            <Btn variant="ghost" onClick={() => { setW(DEFAULTS); setSaved(false); }}>기본값</Btn>
            <Btn onClick={() => setSaved(true)}>저장</Btn>
          </span>
        </div>
      </div>
    </Shell>
  );
}

'use client';

import { useState } from 'react';
import { Shell, card, Btn, pill, th, td } from '../ui';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED';

interface Applicant {
  id: string;
  name: string;
  phone: string;
  area: string;
  experience: string;
  status: Status;
}

const initial: Applicant[] = [
  { id: 'c-1', name: '박지은', phone: '010-2345-****', area: '강남·서초', experience: '3년', status: 'PENDING' },
  { id: 'c-2', name: '김서연', phone: '010-8821-****', area: '용산·마포', experience: '5년', status: 'PENDING' },
  { id: 'c-3', name: '이도윤', phone: '010-5567-****', area: '송파·강동', experience: '1년', status: 'PENDING' },
  { id: 'c-4', name: '최민준', phone: '010-3390-****', area: '성동·광진', experience: '7년', status: 'APPROVED' },
];

const STATUS_LABEL: Record<Status, string> = { PENDING: '대기', APPROVED: '승인됨', REJECTED: '거절됨' };
const STATUS_COLOR: Record<Status, string> = { PENDING: '#c2410c', APPROVED: '#047857', REJECTED: '#b91c1c' };

export default function KycPage() {
  const [list, setList] = useState<Applicant[]>(initial);

  function set(id: string, status: Status) {
    setList((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }

  const pending = list.filter((a) => a.status === 'PENDING').length;

  return (
    <Shell
      title="청소사 KYC 승인"
      actions={<span style={pill}>대기 {pending}건</span>}
    >
      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>이름</th>
              <th style={th}>연락처</th>
              <th style={th}>활동 지역</th>
              <th style={th}>경력</th>
              <th style={th}>상태</th>
              <th style={{ ...th, textAlign: 'right' }}>처리</th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id}>
                <td style={td}>{a.name}</td>
                <td style={td}>{a.phone}</td>
                <td style={td}>{a.area}</td>
                <td style={td}>{a.experience}</td>
                <td style={{ ...td, color: STATUS_COLOR[a.status], fontWeight: 600 }}>{STATUS_LABEL[a.status]}</td>
                <td style={{ ...td, textAlign: 'right' }}>
                  {a.status === 'PENDING' ? (
                    <span style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                      <Btn variant="ghost" onClick={() => set(a.id, 'REJECTED')}>거절</Btn>
                      <Btn onClick={() => set(a.id, 'APPROVED')}>승인</Btn>
                    </span>
                  ) : (
                    <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

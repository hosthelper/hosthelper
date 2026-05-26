'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Wrap, Section, Card, Field, TextInput, Button, ListItem, Badge } from '@hosthelper/ui';
import {
  getProperties,
  addProperty,
  connectCalendar,
  useStoreVersion,
} from '../../demo-store';

export default function PropertiesPage() {
  useStoreVersion();
  const props = getProperties();

  const [name, setName] = useState('');
  const [district, setDistrict] = useState('');
  const [justConnected, setJustConnected] = useState<{ name: string; count: number } | null>(null);

  function add() {
    if (!name.trim()) return;
    addProperty({ name: name.trim(), district: district.trim() || '서울', connected: false });
    setName('');
    setDistrict('');
  }

  function connect(id: string, propName: string) {
    const created = connectCalendar(id);
    setJustConnected({ name: propName, count: created.length });
  }

  return (
    <Wrap>
      <Section title="숙소 · 스케줄 연결" />
      <p className="hh-list-item__meta" style={{ marginTop: '-0.5rem' }}>
        숙소의 예약 캘린더(Airbnb iCal 등)를 연결하면 체크아웃마다 청소 일감이 자동 생성되어 청소사에게 노출됩니다.
      </p>

      {justConnected ? (
        <div style={{ marginTop: '1rem' }}>
          <Card>
            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
              {justConnected.name} 캘린더 연결 완료 ✓
            </div>
            <div className="hh-list-item__meta">
              다가오는 체크아웃 {justConnected.count}건에 대한 청소 일감을 생성했습니다.
            </div>
            <div className="hh-inline" style={{ marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <Link href="/host"><Button>대시보드에서 보기</Button></Link>
              <Link href="/cleaner"><Button variant="ghost">청소사 화면에서 보기</Button></Link>
            </div>
          </Card>
        </div>
      ) : null}

      <div style={{ marginTop: '1rem' }}>
        <Card>
          {props.map((p) => (
            <ListItem
              key={p.id}
              left={
                <>
                  <div>{p.name}</div>
                  <div className="hh-list-item__meta">
                    {p.district}
                    {p.connected && p.source ? ` · ${p.source} 연동` : ''}
                  </div>
                </>
              }
              right={
                p.connected ? (
                  <Badge tone="live">연결됨</Badge>
                ) : (
                  <Button onClick={() => connect(p.id, p.name)} style={{ minWidth: '7rem', padding: '0.5rem 0.9rem' }}>
                    캘린더 연결
                  </Button>
                )
              }
            />
          ))}
        </Card>
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <Section title="숙소 추가" />
        <Card>
          <Field label="숙소 이름" htmlFor="name">
            <TextInput id="name" placeholder="예: 성수 루프탑하우스" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="지역(구)" htmlFor="district">
            <TextInput id="district" placeholder="예: 성동구" value={district} onChange={(e) => setDistrict(e.target.value)} />
          </Field>
          <Button block onClick={add} disabled={!name.trim()}>
            숙소 추가
          </Button>
        </Card>
      </div>
    </Wrap>
  );
}

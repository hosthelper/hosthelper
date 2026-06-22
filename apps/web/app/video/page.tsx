'use client';

import { useState } from 'react';
import { Wrap, Section, Card, Field, TextInput, Button, Badge } from '@hosthelper/ui';
import type { VideoAnalysisResponse, VideoContentType } from '@hosthelper/shared';
import { DEMO } from '../demo';

const SOURCE_LABEL: Record<'captions' | 'speech' | 'metadata', string> = {
  captions: '자막 기반',
  speech: '음성 인식(STT)',
  metadata: '제목·설명 기반(추정)',
};

const CONTENT_TYPE_LABEL: Record<VideoContentType, string> = {
  educational: '교육',
  tutorial: '튜토리얼',
  review: '리뷰',
  news: '뉴스',
  entertainment: '엔터테인먼트',
  vlog: '브이로그',
  marketing: '마케팅',
  interview: '인터뷰',
  other: '기타',
};

function buildDemoResult(url: string): VideoAnalysisResponse {
  return {
    id: 'demo',
    sourceUrl: url,
    platform: url.includes('youtu') ? 'youtube' : 'web',
    videoTitle: '데모 영상 — 에어비앤비 슈퍼호스트의 청소 루틴',
    author: '데모 채널',
    hasTranscript: true,
    transcriptSource: 'captions',
    analysis: {
      tldr: '체크아웃 후 90분 안에 끝내는 표준 청소 동선과 사진 검수 팁을 소개하는 영상입니다.',
      summary:
        '영상은 수익형 숙박 호스트가 청소 시간을 줄이기 위해 사용하는 표준 동선을 단계별로 보여줍니다. ' +
        '침실→욕실→주방 순서로 진행하며, 각 구역마다 필수 사진 검수 포인트를 짚습니다. ' +
        '소모품 재고 확인과 다음 게스트를 위한 어메니티 세팅으로 마무리합니다.',
      keyPoints: [
        '청소는 침실 → 욕실 → 주방 → 거실 순서로 동선을 고정하면 시간이 단축된다',
        '구역별로 "전·후" 사진을 남겨 분쟁을 예방한다',
        '소모품(휴지·수건·세제) 재고를 체크리스트로 관리한다',
        '리넨 교체는 게스트 체크인 직전이 아니라 청소 시작 시 먼저 한다',
        '마지막으로 냄새·머리카락 등 게스트가 가장 민감해하는 항목을 재점검한다',
      ],
      topics: ['숙박 청소', '슈퍼호스트', '운영 효율', '사진 검수'],
      contentType: 'tutorial',
      language: '한국어',
      confidence: 0.82,
    },
    createdAt: new Date().toISOString(),
  };
}

export default function VideoAnalyzePage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VideoAnalysisResponse | null>(null);

  const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

  async function analyze() {
    const trimmed = url.trim();
    if (!trimmed) {
      setError('분석할 영상 링크를 입력하세요.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      if (DEMO) {
        await new Promise((r) => setTimeout(r, 900));
        setResult(buildDemoResult(trimmed));
        return;
      }
      const res = await fetch(`${api}/api/ai/video/analyze`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.message === 'string' ? data.message : '분석에 실패했습니다.');
        return;
      }
      setResult(data as VideoAnalysisResponse);
    } catch {
      setError('서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Wrap>
      <Section title="영상 요약 · 분석" />
      <p className="hh-list-item__meta" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
        유튜브·인스타그램·틱톡 등 영상 링크를 붙여넣으면 내용을 추출해 한국어 요약과 중요 포인트로 정리해드립니다.
        자막이 없는 영상은 음성 인식(STT)으로 분석하며, 이 경우 시간이 더 걸릴 수 있습니다.
      </p>

      <Card>
        <Field label="영상 링크" htmlFor="url">
          <TextInput
            id="url"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) analyze();
            }}
            inputMode="url"
            autoFocus
          />
        </Field>
        <Button block onClick={analyze} disabled={loading}>
          {loading ? '분석 중… (최대 1분)' : '분석하기'}
        </Button>
        {error ? (
          <p style={{ color: 'var(--hh-danger, #c0392b)', marginTop: '0.75rem', fontSize: '0.9rem' }}>
            {error}
          </p>
        ) : null}
      </Card>

      {result ? (
        <div style={{ marginTop: '1.25rem' }}>
          <Card>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <Badge>{CONTENT_TYPE_LABEL[result.analysis.contentType]}</Badge>
              <Badge tone={result.transcriptSource === 'metadata' ? 'warn' : 'live'}>
                {SOURCE_LABEL[result.transcriptSource]}
              </Badge>
              <Badge>원어 {result.analysis.language}</Badge>
              <Badge>신뢰도 {Math.round(result.analysis.confidence * 100)}%</Badge>
            </div>

            {result.videoTitle ? (
              <div style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                {result.videoTitle}
              </div>
            ) : null}
            {result.author ? (
              <div className="hh-list-item__meta" style={{ marginBottom: '0.75rem' }}>
                {result.author}
              </div>
            ) : null}

            <div
              style={{
                background: '#fafafa',
                border: '1px solid var(--hh-line)',
                borderRadius: 'var(--hh-radius)',
                padding: '0.85rem',
                marginBottom: '1rem',
                fontWeight: 600,
              }}
            >
              {result.analysis.tldr}
            </div>

            <h3 style={{ fontSize: '1rem', margin: '0 0 0.4rem' }}>요약</h3>
            <p style={{ lineHeight: 1.7, margin: '0 0 1.25rem', whiteSpace: 'pre-wrap' }}>
              {result.analysis.summary}
            </p>

            <h3 style={{ fontSize: '1rem', margin: '0 0 0.4rem' }}>중요 포인트</h3>
            <ul style={{ lineHeight: 1.7, paddingLeft: '1.1rem', margin: '0 0 1.25rem' }}>
              {result.analysis.keyPoints.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>

            {result.analysis.topics.length > 0 ? (
              <>
                <h3 style={{ fontSize: '1rem', margin: '0 0 0.4rem' }}>주제</h3>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {result.analysis.topics.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
              </>
            ) : null}

            <p className="hh-list-item__meta" style={{ marginTop: '1.25rem' }}>
              <a href={result.sourceUrl} target="_blank" rel="noreferrer">
                원본 영상 열기 ↗
              </a>
            </p>
          </Card>
        </div>
      ) : null}
    </Wrap>
  );
}

export const DEMO = process.env.NEXT_PUBLIC_DEMO === '1';

// 운영진(admin) 데모 URL이 주어지면 랜딩에서 링크로 노출.
export const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL ?? '';

export function DemoBanner() {
  if (!DEMO) return null;
  return (
    <div
      style={{
        background: '#0a0a0a',
        color: '#fff',
        textAlign: 'center',
        fontSize: '0.8rem',
        padding: '0.45rem 1rem',
        letterSpacing: '0.01em',
      }}
    >
      데모 모드 · 목업 데이터입니다 (실제 백엔드 미연결)
    </div>
  );
}

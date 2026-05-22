'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wrap, Nav, Hero, Card, Field, TextInput, Button } from '@hosthelper/ui';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

  async function requestOtp() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${api}/api/auth/otp/request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) throw new Error('인증 요청 실패');
      setStep('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${api}/api/auth/otp/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      if (!res.ok) throw new Error('인증 실패');
      const data = (await res.json()) as { otpToken: string };
      sessionStorage.setItem('otpToken', data.otpToken);
      sessionStorage.setItem('phone', phone);
      router.push('/host');
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Wrap>
      <Nav />
      <Hero title="로그인" subtitle="휴대폰 번호로 시작합니다." />

      <div style={{ maxWidth: 420, margin: '0 auto' }}>
        <Card>
          {step === 'phone' ? (
            <>
              <Field label="휴대폰 번호" htmlFor="phone">
                <TextInput
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="01012345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  maxLength={11}
                />
              </Field>
              <Button block onClick={requestOtp} disabled={loading || phone.length < 10}>
                {loading ? '전송 중...' : '인증번호 받기'}
              </Button>
            </>
          ) : (
            <>
              <Field label="인증번호 6자리" htmlFor="code">
                <TextInput
                  id="code"
                  type="tel"
                  inputMode="numeric"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  maxLength={6}
                />
              </Field>
              <Button block onClick={verifyOtp} disabled={loading || code.length !== 6}>
                {loading ? '확인 중...' : '확인'}
              </Button>
            </>
          )}
          {error ? (
            <p style={{ color: 'var(--hh-danger)', fontSize: '0.85rem', marginTop: '0.75rem' }}>
              {error}
            </p>
          ) : null}
        </Card>
      </div>
    </Wrap>
  );
}

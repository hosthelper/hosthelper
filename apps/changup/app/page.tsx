'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// 정적 export 호환을 위해 클라이언트 리다이렉트 사용.
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/s');
  }, [router]);
  return null;
}

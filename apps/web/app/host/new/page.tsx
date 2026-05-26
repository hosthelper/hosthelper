import Link from 'next/link';
import { Wrap, Hero, Button } from '@hosthelper/ui';

export default function HostNewPage() {
  return (
    <Wrap>
      <Hero
        title="호스트로 시작"
        subtitle="휴대폰 인증 후 바로 예약할 수 있습니다."
        ctas={<Link href="/login"><Button>시작하기</Button></Link>}
      />
    </Wrap>
  );
}

import Link from 'next/link';
import { Wrap, Hero, Button } from '@hosthelper/ui';

export default function CleanerNewPage() {
  return (
    <Wrap>
      <Hero
        title="청소사로 시작"
        subtitle="휴대폰 인증과 KYC 후 일감을 받으실 수 있습니다."
        ctas={<Link href="/login"><Button>시작하기</Button></Link>}
      />
    </Wrap>
  );
}

import {
  Wrap, Nav, Hero, Section, Card, Field, TextInput,
  Button, ListItem, Badge, Divider, Footer, UI_VERSION,
} from '@hosthelper/ui';

export const metadata = { title: '@hosthelper/ui · 컴포넌트 카탈로그' };

function Block({ title, code, children }: { title: string; code: string; children: React.ReactNode }) {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <strong>{title}</strong>
        <Badge>example</Badge>
      </div>
      <div style={{ marginBottom: '1rem' }}>{children}</div>
      <pre style={{
        background: '#fafafa',
        border: '1px solid var(--hh-line)',
        borderRadius: 'var(--hh-radius)',
        padding: '0.85rem',
        fontSize: '0.8rem',
        overflow: 'auto',
        color: 'var(--hh-muted)',
      }}>{code}</pre>
    </Card>
  );
}

export default function LibraryPage() {
  return (
    <Wrap>
      <Nav right={<span>v{UI_VERSION}</span>} />

      <Hero
        title="@hosthelper/ui"
        subtitle="미니멀 · 모노크롬 · 한국어 우선 · M&A 분리 가능"
      />

      <Section title="설치" />
      <Card>
        <pre style={{ fontSize: '0.85rem', color: 'var(--hh-muted)' }}>
{`pnpm add @hosthelper/ui react

// 사용
import '@hosthelper/ui/styles.css';
import { Button, Card, Field, TextInput } from '@hosthelper/ui';`}
        </pre>
      </Card>

      <Divider />

      <Section title="컴포넌트" />
      <div className="hh-stack">
        <Block title="Button" code={`<Button>기본</Button>
<Button variant="ghost">고스트</Button>
<Button block>전체 너비</Button>
<Button disabled>비활성</Button>`}>
          <div className="hh-inline" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <Button>기본</Button>
            <Button variant="ghost">고스트</Button>
            <Button disabled>비활성</Button>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <Button block>전체 너비</Button>
          </div>
        </Block>

        <Block title="Badge" code={`<Badge>default</Badge>
<Badge tone="live">live</Badge>
<Badge tone="warn">warn</Badge>`}>
          <div className="hh-inline">
            <Badge>default</Badge>
            <Badge tone="live">매칭 완료</Badge>
            <Badge tone="warn">매칭 중</Badge>
          </div>
        </Block>

        <Block title="Field + TextInput" code={`<Field label="휴대폰" htmlFor="ph">
  <TextInput id="ph" placeholder="01012345678" />
</Field>`}>
          <Field label="휴대폰" htmlFor="lib-phone">
            <TextInput id="lib-phone" placeholder="01012345678" />
          </Field>
        </Block>

        <Block title="ListItem" code={`<ListItem
  left="청담 스카이뷰"
  right={<Badge tone="live">매칭 완료</Badge>}
/>`}>
          <ListItem left="청담 스카이뷰 #301" right={<Badge tone="live">매칭 완료</Badge>} />
          <ListItem left="한남 리버하우스" right={<Badge tone="warn">매칭 중</Badge>} />
        </Block>

        <Block title="Hero" code={`<Hero
  title="시간을 아껴드립니다"
  subtitle="턴오버 청소, 한 번에."
  ctas={<Button>시작</Button>}
/>`}>
          <div style={{ borderRadius: 'var(--hh-radius)', border: '1px dashed var(--hh-line)' }}>
            <Hero
              title="시간을 아껴드립니다"
              subtitle="턴오버 청소, 한 번에."
              ctas={
                <>
                  <Button>호스트로 시작</Button>
                  <Button variant="ghost">청소사로 시작</Button>
                </>
              }
            />
          </div>
        </Block>

        <Block title="디자인 토큰" code={`:root {
  --hh-accent: #0a0a0a;
  --hh-line: #ececec;
  --hh-radius: 10px;
  ...
}`}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[
              ['--hh-accent', '#0a0a0a'],
              ['--hh-fg', '#0a0a0a'],
              ['--hh-muted', '#6b7280'],
              ['--hh-line', '#ececec'],
              ['--hh-success', '#047857'],
              ['--hh-warn', '#c2410c'],
            ].map(([name, value]) => (
              <div key={name} style={{ width: 96 }}>
                <div style={{
                  height: 48,
                  background: value,
                  border: '1px solid var(--hh-line)',
                  borderRadius: 'var(--hh-radius)',
                }} />
                <div style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>{name}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--hh-muted)' }}>{value}</div>
              </div>
            ))}
          </div>
        </Block>
      </div>

      <Footer>© hosthelper · 디자인 시스템</Footer>
    </Wrap>
  );
}

# @hosthelper/ui

> hosthelper 디자인 시스템. 미니멀 · 모노크롬 · 한국어 우선.

**M&A 친화**: 본 패키지는 hosthelper 코어 도메인과 독립적으로 동작합니다. 별도 라이선싱·매각이 가능합니다. (`peerDependencies: react ^18`)

## 설치

```bash
pnpm add @hosthelper/ui react
```

## 사용

```tsx
import '@hosthelper/ui/styles.css';
import { Wrap, Nav, Hero, Button, Card, Field, TextInput } from '@hosthelper/ui';

export default function Page() {
  return (
    <Wrap>
      <Nav right={<a href="/login">로그인</a>} />
      <Hero
        title={<>시간을<br />아껴드립니다</>}
        subtitle="턴오버 청소, 한 번에."
        ctas={
          <>
            <Button variant="primary">시작</Button>
            <Button variant="ghost">자세히</Button>
          </>
        }
      />
    </Wrap>
  );
}
```

## 컴포넌트

| 이름 | 용도 |
|---|---|
| `Wrap` | 최대 720px 컨테이너 |
| `Nav` | 상단 네비게이션 (로고 + 우측) |
| `Hero` | 랜딩 히어로 (제목·부제·CTA) |
| `Section` | 섹션 타이틀 + 본문 |
| `Button` | `variant="primary\|ghost"`, `block` |
| `Card` | 컨텐츠 박스 |
| `Field` + `TextInput` | 폼 입력 |
| `ListItem` | 좌/우 2분할 리스트 행 |
| `Badge` | `tone="default\|live\|warn"` 상태 표시 |
| `Divider` | 1px 구분선 |
| `Footer` | 푸터 |

## 디자인 토큰

CSS 변수로 노출 (`:root`):

```
--hh-bg, --hh-fg, --hh-muted, --hh-line
--hh-accent, --hh-accent-fg
--hh-success, --hh-warn, --hh-danger
--hh-radius, --hh-font
```

## 라이선스

`UNLICENSED` (private). M&A·라이선스 협의 문의: hosthelper01@gmail.com

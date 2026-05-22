# Third-Party Licenses

> M&A 실사 대비. 모든 외부 의존성은 상업적 사용에 호환되는 라이선스만 채택.

## 직접 의존성 (Runtime)

| 패키지 | 버전 | 라이선스 | 비고 |
|---|---|---|---|
| react | ^18.3 | MIT | UI |
| react-dom | ^18.3 | MIT | UI |
| next | ^14.2 | MIT | Web framework |
| @nestjs/core | ^10.3 | MIT | Backend framework |
| @nestjs/common | ^10.3 | MIT | |
| @nestjs/config | ^3.2 | MIT | |
| @nestjs/jwt | ^10.2 | MIT | |
| @nestjs/swagger | ^7.3 | MIT | OpenAPI |
| @prisma/client | ^5.13 | Apache-2.0 | ORM |
| bullmq | ^5.4 | MIT | Job queue |
| ioredis | ^5.3 | MIT | Redis client |
| zod | ^3.23 | MIT | Schema validation |
| passport-jwt | ^4.0 | MIT | Auth |

## 개발 의존성 (Build/Test)

| 패키지 | 라이선스 |
|---|---|
| typescript | Apache-2.0 |
| turbo | MIT |
| jest | MIT |
| ts-jest | MIT |
| eslint | MIT |
| prettier | MIT |
| prisma | Apache-2.0 |
| tsx | MIT |

## 결론

- **모든 의존성이 MIT 또는 Apache-2.0** → 상업적 이용·재배포·수정·사유화 자유
- **Copyleft (GPL/AGPL/LGPL) 의존성 없음** → 소스 공개 의무 없음
- M&A 양도 시 라이선스 호환성 이슈 없음

## 갱신 방법

```bash
pnpm licenses list > docs/third-party-snapshot.txt
```

# infra/brev — NVIDIA AI Workbench 워크샵 노드 프로비저닝

> 분리 매각 가치: GPU 개발/워크샵 노드 부트스트랩은 hosthelper 도메인과 완전히 독립적인
> 인프라 자산으로, 별도 매각·이관이 가능합니다.

## startup.sh

Brev / EC2 GPU 노드에서 **최초 1회** 실행되는 클라우드-init 스타일 부트스트랩 스크립트입니다.

수행 단계:

1. **NVIDIA AI Workbench(nvwb) 설치** — 미설치 시에만 CLI 다운로드 후 비대화형 설치
   (`--docker --drivers`).
2. **워크샵 프로젝트 클론 및 마운트 구성** — `GIT_REPO` 를 로컬 컨텍스트로 클론하고,
   `/var/run` 및 `/run/cdi` (NVIDIA CDI 사양)를 컨테이너에 마운트.
3. **systemd 서비스 등록** — `nvwb-workshop.service` 를 생성하여 부팅 시
   `TARGET_APPLICATION` 을 자동 기동.
4. **nginx 리버스 프록시** — `8888` 포트에서 `/projects/` 요청을 Workbench 프록시
   (`127.0.0.1:10000`)로 전달하고, 그 외 요청은 Jupyter 앱 경로로 302 리다이렉트.

### 구성 값

스크립트 상단의 세 변수만 수정하면 됩니다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `GIT_REPO` | `brevdev/workshop-build-an-agent` | 클론할 워크샵 저장소 |
| `TARGET_BRANCH` | `main` | 전환 대상 브랜치 (기본은 클론된 브랜치 사용) |
| `TARGET_APPLICATION` | `DevX-Lab` | 기동/노출할 Workbench 애플리케이션 이름 |

### 사용

Brev 인스턴스의 startup script 필드에 붙여넣거나, 노드에서 직접 실행합니다.

```bash
sudo bash infra/brev/startup.sh
```

로그는 설치 사용자 홈의 `~/.startup-script.log` 에 기록됩니다.

### 운영 확인

```bash
sudo systemctl status nvwb-workshop.service       # 서비스 상태
sudo journalctl -u nvwb-workshop.service -f       # 서비스 로그
```

### 참고

- 스크립트는 root 로 실행되며, `SUDO_USER` → 비-root 현재 사용자 →
  (`ubuntu`/`shadowform`/`nvidia`/`ec2-user`) 순으로 설치 대상 사용자를 자동 결정합니다.
- 중첩 heredoc 이스케이프(`\$` = 1단계, `\\\$` = 2단계)는 생성 파일에 리터럴 `$` 를
  남기기 위한 것으로, 임의로 제거하지 마십시오.

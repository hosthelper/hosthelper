#!/bin/bash
#
# NVIDIA AI Workbench 워크샵 노드 부트스트랩 스크립트 (Brev / EC2)
#
# 새로 프로비저닝된 GPU 노드에서 1회 실행되어 다음을 수행합니다.
#   1) NVIDIA AI Workbench(nvwb) 설치
#   2) 워크샵 프로젝트 클론 및 마운트 구성
#   3) 부팅 시 애플리케이션을 자동 기동하는 systemd 서비스 등록
#   4) 8888 포트에서 Jupyter 애플리케이션으로 프록시/리다이렉트하는 nginx 구성
#
# 주의: 이 파일은 원본(영문) 스크립트가 기계 번역으로 손상된 것을 복원한 것입니다.
#       bash/nginx 키워드는 반드시 영문이어야 하며, 중첩 heredoc의 이스케이프
#       단계(\$ = 1단계, \\\$ = 2단계)는 의도적으로 유지되어 있습니다.

### 시작 스크립트 구성 ###
readonly GIT_REPO="https://github.com/brevdev/workshop-build-an-agent"
readonly TARGET_BRANCH=main
readonly TARGET_APPLICATION=DevX-Lab

#################################
### 사용자 설정 종료 ###
#################################

# 설치 대상 사용자 결정 (sudo 호출자 → 비-root 현재 사용자 → 알려진 기본 계정 순)
if [ -n "${SUDO_USER:-}" ] && id "${SUDO_USER}" &>/dev/null; then
  INSTALL_USER="${SUDO_USER}"
elif [ "$(id -u)" -ne 0 ]; then
  INSTALL_USER="$(whoami)"
else
  for INSTALL_USER in ubuntu shadowform nvidia ec2-user; do
    id "$INSTALL_USER" &>/dev/null && break
  done
fi

INSTALL_UID="$(id -u "$INSTALL_USER")"
INSTALL_GID="$(id -g "$INSTALL_USER")"
INSTALL_GROUP="$(id -gn "$INSTALL_USER")"
INSTALL_HOME="$(getent passwd "$INSTALL_USER" | cut -d: -f6)"
readonly LOG_FILE="${INSTALL_HOME}/.startup-script.log"

### 로그 파일 생성 ###
cat > "$LOG_FILE" << EOF
### 시작 스크립트 로그 ###
$(date): 시작 스크립트 시작
$(date): GIT_REPO: $GIT_REPO
$(date): TARGET_BRANCH: $TARGET_BRANCH
$(date): TARGET_APPLICATION: $TARGET_APPLICATION
$(date): BREV_PROJ_DIR: ${BREV_PROJ_DIR:-}
$(date): INSTALL_USER: $INSTALL_USER
$(date): INSTALL_HOME: $INSTALL_HOME
$(date): INSTALL_GROUP: $INSTALL_GROUP

EOF

### apt 준비가 완료될 때까지 대기 ###
while sudo fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 \
   || sudo fuser /var/lib/apt/lists/lock >/dev/null 2>&1 \
   || sudo fuser /var/cache/apt/archives/lock >/dev/null 2>&1; do
    echo "$(date): APT가 잠겨 있습니다. 10초 동안 대기합니다..." | tee -a "$LOG_FILE"
    sleep 10
done

### NVIDIA AI Workbench 설치 ###
sudo -i -u "$INSTALL_USER" /bin/bash --login << EOF 2>&1 | tee -a "$LOG_FILE"
sudo systemctl start docker

# NVIDIA AI Workbench가 설치되어 있지 않은 경우에만 다운로드하여 설치합니다.
if [ ! -x "\$HOME/.nvwb/bin/nvwb-cli" ]; then
    echo "NVIDIA AI Workbench를 찾을 수 없습니다. 설치를 진행합니다..."

    # NVIDIA AI Workbench CLI 다운로드
    echo "NVIDIA AI Workbench를 다운로드하는 중입니다..."
    mkdir -p ~/.nvwb/bin
    curl -L "https://workbench.download.nvidia.com/stable/workbench-cli/\$(curl -L -s https://workbench.download.nvidia.com/stable/workbench-cli/LATEST)/nvwb-cli-\$(uname)-\$(uname -m)" --output ~/.nvwb/bin/nvwb-cli
    chmod +x ~/.nvwb/bin/nvwb-cli

    # NVIDIA AI Workbench 설치
    echo "NVIDIA AI Workbench를 설치하는 중입니다..."
    sudo ~/.nvwb/bin/nvwb-cli install --noninteractive --accept --docker --drivers --uid $INSTALL_UID --gid $INSTALL_GID
else
    echo "NVIDIA AI Workbench가 이미 설치되어 있습니다. 다운로드 및 설치를 건너뜁니다."
fi
EOF


### 워크샵 클론 및 구성 ###
sudo -i -u "$INSTALL_USER" /bin/bash --login << EOF 2>&1 | tee -a "$LOG_FILE"
# 워크벤치 래퍼 로드
source ~/.bashrc
source ~/.local/share/nvwb/nvwb-wrapper.sh

# 워크샵 클론
nvwb activate local
nvwb clone project $GIT_REPO --context local

# 프로젝트 경로/이름 조회
export PROJECT_PATH=\$(nvwb list projects -o json | jq -r '.result[] | select(.RemoteUrl == "'$GIT_REPO'").Path')
export PROJECT_NAME=\$(nvwb list projects -o json | jq -r '.result[] | select(.RemoteUrl == "'$GIT_REPO'").Name')
echo "프로젝트 이름: \$PROJECT_NAME"
echo "프로젝트 경로: \$PROJECT_PATH"

# 현재 작업을 모두 중지하고 대상 브랜치로 전환합니다.
# nvwb discard --context local --project \$PROJECT_PATH
# nvwb switch-branch $TARGET_BRANCH --context local --project \$PROJECT_PATH

# 애플리케이션 빌드
# nvwb build --context local --project \$PROJECT_PATH

# NVWB 검증 전에 /run/cdi/ 디렉터리가 존재하고 NVIDIA CDI 사양이 채워져 있는지 확인합니다.
# 새로 설치된 Brev 노드에는 nvidia-cdi-refresh.service가 아직 없을 수 있으므로,
# GPU를 컨테이너에 연결할 수 있도록 사양을 미리 생성합니다.
sudo mkdir -p /run/cdi
sudo nvidia-ctk cdi generate --output=/run/cdi/nvidia.yaml 2>/dev/null || true

# 프로젝트 시스템 마운트 구성
nvwb configure mounts /var/run/:/var/host-run/ --project \$PROJECT_PATH --context local
nvwb configure mounts /run/cdi/:/run/cdi/ --project \$PROJECT_PATH --context local

### 워크샵 systemd 서비스 유닛 구성 ###
# systemd 서비스가 실행할 시작 스크립트 생성
cat > ~/nvwb-startup.sh << SCRIPT_EOF
#!/bin/bash
source ~/.bashrc
source ~/.local/share/nvwb/nvwb-wrapper.sh

# 프로젝트 경로 조회
export PROJECT_PATH=\\\$(nvwb list projects -o json | jq -r '.result[] | select(.RemoteUrl == "'$GIT_REPO'").Path')
echo "프로젝트 시작 중: \\\$PROJECT_PATH"

# 로컬 컨텍스트를 활성화하고 애플리케이션을 시작합니다.
cd ~
nvwb activate local
nvwb start $TARGET_APPLICATION --context local --project \\\$PROJECT_PATH

echo "NVIDIA AI Workbench 시작 스크립트가 완료되었습니다."
SCRIPT_EOF
chmod +x ~/nvwb-startup.sh

# systemd 서비스 파일 생성
sudo tee /etc/systemd/system/nvwb-workshop.service > /dev/null << SERVICE_EOF
[Unit]
Description=NVIDIA AI Workbench를 활용한 DevX 워크샵
After=network.target docker.service
Requires=docker.service

[Service]
Type=oneshot
User=$INSTALL_USER
Group=$INSTALL_GROUP
ExecStart=$INSTALL_HOME/nvwb-startup.sh
WorkingDirectory=$INSTALL_HOME
Environment=HOME=$INSTALL_HOME
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
SERVICE_EOF

# 서비스 활성화 및 실행
sudo systemctl daemon-reload
sudo systemctl enable --now nvwb-workshop.service
echo "NVIDIA AI Workbench 워크샵 서비스가 생성되어 활성화되었습니다."
echo "시스템 재부팅 시 서비스가 워크벤치 애플리케이션을 자동으로 시작합니다."
echo "서비스 상태 확인: sudo systemctl status nvwb-workshop.service"
echo "로그 확인: sudo journalctl -u nvwb-workshop.service -f"


### NGINX 서비스 라우터 ###
# Nginx 설치
DEBIAN_FRONTEND=noninteractive sudo apt-get install -y nginx

# Nginx 설정 파일 생성
sudo tee /etc/nginx/nginx.conf > /dev/null << NGINX_EOF
user www-data;
worker_processes auto;

error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    sendfile on;
    keepalive_timeout 65;

    # --- 웹소켓용 업그레이드 매핑 ---
    map \\\$http_upgrade \\\$connection_upgrade {
        default upgrade;
        '' close;
    }

    # --- AI Workbench 프록시 업스트림 ---
    upstream workbench_proxy {
        server 127.0.0.1:10000;
        keepalive 32;
    }

    # --- 메인 서버 ---
    server {
        listen 8888;
        server_name _;

        # 1) /projects/ 로 시작하는 요청은 프록시
        location ^~ /projects/ {
            proxy_pass http://workbench_proxy;
            proxy_http_version 1.1;

            # 백엔드는 Host 헤더로 "localhost"를 인식해야 합니다.
            proxy_set_header Host localhost;
            proxy_set_header Origin http://localhost;
            proxy_set_header X-Forwarded-Host \\\$host;

            # 클라이언트 정보 전달
            proxy_set_header X-Real-IP \\\$remote_addr;
            proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto http;

            # 웹소켓 / 스트리밍
            proxy_set_header Upgrade \\\$http_upgrade;
            proxy_set_header Connection \\\$connection_upgrade;
            proxy_read_timeout 3600;
            proxy_send_timeout 3600;

            # Jupyter 스트리밍 버퍼링 비활성화
            proxy_buffering off;
            proxy_cache off;
        }

        # 2) 그 외 모든 요청: Jupyter 앱 경로로 리다이렉트
        location / {
            return 302 https://\\\$host/projects/\$PROJECT_NAME/applications/$TARGET_APPLICATION\\\$request_uri;
        }
    }
}
NGINX_EOF

# Nginx 활성화 및 시작
sudo systemctl enable --now nginx
sudo systemctl restart nginx
EOF


### 로그 파일 완료 ###
cat >> "$LOG_FILE" << EOF
### 시작 스크립트 로그 ###
$(date): 시작 스크립트 완료
EOF

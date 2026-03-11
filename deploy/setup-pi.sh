#!/bin/bash
# ============================================================
# setup-pi.sh — Raspberry Pi 5 一键部署脚本
# 在 Pi 上运行：bash deploy/setup-pi.sh
# ============================================================
set -e

CYAN='\033[0;36m'; GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
error()   { echo -e "${RED}[ERR]${NC} $1"; exit 1; }

cd "$(dirname "$0")/.."
APP_DIR=$(pwd)
info "部署目录：$APP_DIR"

# ── 1. 安装 Docker ──────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  info "安装 Docker..."
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  success "Docker 已安装（需重新登录生效，本次用 sudo 继续）"
  DOCKER="sudo docker"
  COMPOSE="sudo docker compose"
else
  success "Docker 已存在"
  DOCKER="docker"
  COMPOSE="docker compose"
fi

# ── 2. 检查 .env 文件 ──────────────────────────────────────
if [ ! -f ".env" ]; then
  error ".env 文件不存在，请先创建（参考 .env.example）"
fi

# 检查必填项
for var in JWT_SECRET NEXT_PUBLIC_APP_URL SMS_GATEWAY_URL SMS_GATEWAY_USER SMS_GATEWAY_PASS; do
  if ! grep -q "^${var}=" .env; then
    error ".env 缺少 ${var}"
  fi
done
success ".env 检查通过"

# ── 3. 检查数据库备份 ──────────────────────────────────────
if [ -f "deploy/db-backup.sql" ]; then
  info "发现数据库备份，首次启动将自动导入"
else
  info "未发现 deploy/db-backup.sql，将创建空数据库（之后运行 migrate）"
fi

# ── 4. 构建并启动 ──────────────────────────────────────────
info "构建 Docker 镜像（首次约需 5-10 分钟）..."
$COMPOSE build --no-cache

info "启动服务..."
$COMPOSE up -d

# ── 5. 等待数据库就绪 ──────────────────────────────────────
info "等待数据库就绪..."
for i in $(seq 1 30); do
  if $COMPOSE exec db pg_isready -U carnation -d carnation_spa &>/dev/null; then
    success "数据库已就绪"
    break
  fi
  sleep 2
done

# ── 6. 运行数据库迁移 ──────────────────────────────────────
info "运行 Prisma 迁移..."
$COMPOSE exec app npx prisma db push --skip-generate 2>/dev/null || \
  info "迁移跳过（数据库可能已是最新）"

# ── 7. 查看状态 ──────────────────────────────────────────
$COMPOSE ps

success "部署完成！"
echo ""
echo "  访问地址：http://$(hostname -I | awk '{print $1}'):3000"
echo "  查看日志：docker compose logs -f app"
echo "  停止服务：docker compose down"
echo ""

# ── 8. 配置开机自启（可选）─────────────────────────────────
read -p "是否设置开机自动启动？(y/N) " ans
if [[ "$ans" == "y" || "$ans" == "Y" ]]; then
  sudo systemctl enable docker
  cat > /tmp/carnation-spa.service <<EOF
[Unit]
Description=Carnation Spa
Requires=docker.service
After=docker.service

[Service]
WorkingDirectory=$APP_DIR
ExecStart=$(which docker) compose up
ExecStop=$(which docker) compose down
Restart=always
User=$USER

[Install]
WantedBy=multi-user.target
EOF
  sudo mv /tmp/carnation-spa.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable carnation-spa
  success "开机自启已配置"
fi

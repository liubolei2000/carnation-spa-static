#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Carnation Spa — Raspberry Pi 5 部署脚本
# 系统：Raspberry Pi OS 64-bit
# 运行方式：bash deploy.sh
# ═══════════════════════════════════════════════════════════════

set -e  # 出错立即停止

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
info() { echo -e "${BLUE}[→]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo "🌸 Carnation Spa — 树莓派部署脚本"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─────────────────────────────────────────
# 1. 系统更新
# ─────────────────────────────────────────
info "更新系统包..."
sudo apt update && sudo apt upgrade -y
log "系统更新完成"

# ─────────────────────────────────────────
# 2. 安装 Node.js 20 LTS（arm64）
# ─────────────────────────────────────────
info "安装 Node.js 20 LTS..."
if command -v node &> /dev/null; then
  NODE_VER=$(node -v)
  warn "Node.js 已安装: $NODE_VER，跳过"
else
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
  log "Node.js $(node -v) 安装完成"
fi

# ─────────────────────────────────────────
# 3. 安装 PostgreSQL 15
# ─────────────────────────────────────────
info "安装 PostgreSQL 15..."
if command -v psql &> /dev/null; then
  warn "PostgreSQL 已安装，跳过"
else
  sudo apt install -y postgresql postgresql-contrib
  sudo systemctl enable postgresql
  sudo systemctl start postgresql
  log "PostgreSQL 安装完成"
fi

# ─────────────────────────────────────────
# 4. 创建数据库和用户
# ─────────────────────────────────────────
info "配置数据库..."

DB_NAME="carnation_spa"
DB_USER="carnation"
DB_PASS="$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 20)"

# 检查数据库是否已存在
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null || echo "")

if [ "$DB_EXISTS" = "1" ]; then
  warn "数据库 $DB_NAME 已存在，跳过创建"
  # 读取已有密码
  if [ -f /home/pi/.carnation_db_pass ]; then
    DB_PASS=$(cat /home/pi/.carnation_db_pass)
  fi
else
  sudo -u postgres psql << EOF
CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
\q
EOF
  # 保存密码到文件（部署后可删除）
  echo "$DB_PASS" > /home/pi/.carnation_db_pass
  chmod 600 /home/pi/.carnation_db_pass
  log "数据库创建完成: $DB_NAME"
fi

DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"

# ─────────────────────────────────────────
# 5. 安装 PM2（进程守护）
# ─────────────────────────────────────────
info "安装 PM2..."
if command -v pm2 &> /dev/null; then
  warn "PM2 已安装，跳过"
else
  sudo npm install -g pm2
  log "PM2 安装完成"
fi

# ─────────────────────────────────────────
# 6. 克隆 / 更新项目代码
# ─────────────────────────────────────────
APP_DIR="/home/pi/carnation-spa"

info "准备项目目录: $APP_DIR"
if [ -d "$APP_DIR" ]; then
  warn "目录已存在，如需重新部署请先删除: sudo rm -rf $APP_DIR"
else
  mkdir -p "$APP_DIR"
  log "目录创建完成"
fi

# ─────────────────────────────────────────
# 7. 生成 .env.local
# ─────────────────────────────────────────
info "生成环境变量文件..."

JWT_SECRET="$(openssl rand -base64 32)"
CRON_SECRET="$(openssl rand -hex 32)"

# 读取用户输入
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "请输入以下配置信息："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

read -p "管理员手机号（格式 +1xxxxxxxxxx）: " ADMIN_PHONE
read -s -p "管理员密码（至少8位）: " ADMIN_PASSWORD
echo ""
read -p "Twilio Account SID（AC开头）: " TWILIO_SID
read -s -p "Twilio Auth Token: " TWILIO_TOKEN
echo ""
read -p "Twilio 电话号码（格式 +1xxxxxxxxxx）: " TWILIO_NUMBER
read -p "你的域名（Cloudflare Tunnel 配置后填写，如 carnation.yourdomain.com）: " APP_DOMAIN

APP_URL="https://$APP_DOMAIN"

cat > "$APP_DIR/.env.local" << EOF
# ═══ 数据库 ═══
DATABASE_URL="$DATABASE_URL"
DIRECT_URL="$DATABASE_URL"

# ═══ Auth ═══
JWT_SECRET="$JWT_SECRET"
JWT_EXPIRES_IN="7d"

# ═══ 管理员初始账户 ═══
ADMIN_PHONE="$ADMIN_PHONE"
ADMIN_PASSWORD="$ADMIN_PASSWORD"
ADMIN_NAME="Admin"

# ═══ Twilio ═══
TWILIO_ACCOUNT_SID="$TWILIO_SID"
TWILIO_AUTH_TOKEN="$TWILIO_TOKEN"
TWILIO_PHONE_NUMBER="$TWILIO_NUMBER"

# ═══ 应用 ═══
NEXT_PUBLIC_APP_URL="$APP_URL"
NODE_ENV="production"

# ═══ Cron ═══
CRON_SECRET="$CRON_SECRET"

# ═══ 图片存储（本地） ═══
UPLOAD_DIR="/home/pi/carnation-uploads"
EOF

chmod 600 "$APP_DIR/.env.local"
log "环境变量文件已生成"

# ─────────────────────────────────────────
# 8. 图片上传目录
# ─────────────────────────────────────────
mkdir -p /home/pi/carnation-uploads/{services,therapists,hero}
log "上传目录创建完成: /home/pi/carnation-uploads"

# ─────────────────────────────────────────
# 9. 安装项目依赖 & 构建
# ─────────────────────────────────────────
info "安装 npm 依赖（首次可能需要 3-5 分钟）..."
cd "$APP_DIR"

# 设置 node 内存限制（Pi 5 有 4-8GB，给 Next.js 构建多一点）
export NODE_OPTIONS="--max-old-space-size=2048"

npm install
log "依赖安装完成"

info "初始化数据库 Schema..."
npx prisma db push

# ─────────────────────────────────────────
# 恢复数据库备份（如果存在）
# ─────────────────────────────────────────
BACKUP_FILE="$APP_DIR/carnation_spa_backup.sql"
if [ -f "$BACKUP_FILE" ]; then
  info "检测到数据库备份，正在恢复数据..."
  # 需要用 postgres 超级用户权限来恢复
  sudo -u postgres psql -d "$DB_NAME" -f "$BACKUP_FILE" > /dev/null 2>&1 || true
  log "数据库数据恢复完成"
  # 恢复后删除备份文件（包含敏感密码哈希）
  rm -f "$BACKUP_FILE"
  info "备份文件已删除"
else
  info "未找到数据库备份，写入初始 seed 数据..."
  npm run db:seed
fi

info "构建 Next.js（约 2-3 分钟）..."
npm run build
log "构建完成"

# ─────────────────────────────────────────
# 10. PM2 配置
# ─────────────────────────────────────────
info "配置 PM2 进程..."

cat > "$APP_DIR/ecosystem.config.js" << 'EOF'
module.exports = {
  apps: [{
    name:         'carnation-spa',
    script:       'node_modules/.bin/next',
    args:         'start',
    cwd:          '/home/pi/carnation-spa',
    instances:    1,
    autorestart:  true,
    watch:        false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT:     3000,
    },
    // 日志
    out_file:  '/home/pi/logs/carnation-out.log',
    error_file:'/home/pi/logs/carnation-err.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
}
EOF

mkdir -p /home/pi/logs

# 停止旧进程（如果有）
pm2 stop carnation-spa 2>/dev/null || true
pm2 delete carnation-spa 2>/dev/null || true

pm2 start "$APP_DIR/ecosystem.config.js"
pm2 save

# 开机自启
pm2 startup systemd -u pi --hp /home/pi | tail -1 | sudo bash
log "PM2 配置完成，应用已启动"

# ─────────────────────────────────────────
# 11. 配置 Cron（替代 Vercel Cron）
# ─────────────────────────────────────────
info "配置定时提醒任务..."

CRON_CMD="curl -s -H 'Authorization: Bearer $CRON_SECRET' http://localhost:3000/api/cron/remind >> /home/pi/logs/cron.log 2>&1"

# 添加到 crontab（每小时第0分钟执行）
(crontab -l 2>/dev/null | grep -v 'cron/remind'; echo "0 * * * * $CRON_CMD") | crontab -
log "Cron 任务已配置（每小时执行一次）"

# ─────────────────────────────────────────
# 12. 安装 Cloudflare Tunnel
# ─────────────────────────────────────────
info "安装 Cloudflare Tunnel (cloudflared)..."

if command -v cloudflared &> /dev/null; then
  warn "cloudflared 已安装，跳过"
else
  # arm64 版本
  wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
  sudo dpkg -i cloudflared-linux-arm64.deb
  rm cloudflared-linux-arm64.deb
  log "cloudflared 安装完成"
fi

# ─────────────────────────────────────────
# 完成！输出总结
# ─────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "🌸 ${GREEN}部署完成！${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "  本地访问:   ${BLUE}http://$(hostname -I | awk '{print $1}'):3000${NC}"
echo -e "  数据库:     ${BLUE}$DATABASE_URL${NC}"
echo -e "  日志目录:   ${BLUE}/home/pi/logs/${NC}"
echo -e "  上传目录:   ${BLUE}/home/pi/carnation-uploads/${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  下一步：配置 Cloudflare Tunnel（见下方说明）"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  1. 运行: cloudflared tunnel login"
echo "  2. 运行: cloudflared tunnel create carnation-spa"
echo "  3. 运行: cloudflared tunnel route dns carnation-spa $APP_DOMAIN"
echo "  4. 运行: sudo bash setup-tunnel.sh  （脚本已生成）"
echo ""
echo "  常用命令:"
echo "    pm2 status          # 查看进程状态"
echo "    pm2 logs            # 查看实时日志"
echo "    pm2 restart all     # 重启应用"
echo "    pm2 monit           # 实时监控面板"
echo ""

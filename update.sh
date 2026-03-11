#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Carnation Spa — 更新脚本
# 以后每次更新代码后运行：bash update.sh
# ═══════════════════════════════════════════════════════════════

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="/home/pi/carnation-spa"
export NODE_OPTIONS="--max-old-space-size=2048"

echo "🌸 开始更新 Carnation Spa..."

cd "$APP_DIR"

echo "→ 安装/更新依赖..."
npm install

echo "→ 同步数据库 Schema..."
npx prisma db push

echo "→ 重新构建..."
npm run build

echo "→ 重启应用..."
pm2 restart carnation-spa

echo ""
echo -e "${GREEN}✓ 更新完成！${NC}"
pm2 status carnation-spa

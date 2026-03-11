#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Cloudflare Tunnel 配置脚本
# 在 deploy.sh 完成后运行
# 前提：已运行 cloudflared tunnel login 和 cloudflared tunnel create
# ═══════════════════════════════════════════════════════════════

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "🌐 配置 Cloudflare Tunnel..."

# 读取 tunnel ID（从已创建的 tunnel 获取）
TUNNEL_ID=$(cloudflared tunnel list | grep 'carnation-spa' | awk '{print $1}')

if [ -z "$TUNNEL_ID" ]; then
  echo "❌ 未找到 carnation-spa tunnel，请先运行："
  echo "   cloudflared tunnel create carnation-spa"
  exit 1
fi

echo "Tunnel ID: $TUNNEL_ID"

# 创建配置文件
mkdir -p /home/pi/.cloudflared

cat > /home/pi/.cloudflared/config.yml << EOF
tunnel: $TUNNEL_ID
credentials-file: /home/pi/.cloudflared/$TUNNEL_ID.json

ingress:
  # 主应用
  - hostname: carnation.yourdomain.com   # ← 改成你的域名
    service: http://localhost:3000
  # 兜底规则（必须有）
  - service: http_status:404
EOF

echo -e "${GREEN}配置文件已生成: /home/pi/.cloudflared/config.yml${NC}"
echo ""
echo "⚠️  请编辑配置文件，将域名改为你的实际域名："
echo "   nano /home/pi/.cloudflared/config.yml"
echo ""

# 安装为系统服务（开机自启）
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

echo -e "${GREEN}✓ Cloudflare Tunnel 已作为系统服务安装并启动${NC}"
echo ""
echo "  查看状态: sudo systemctl status cloudflared"
echo "  查看日志: sudo journalctl -u cloudflared -f"
echo ""
echo -e "  外网访问: ${BLUE}https://carnation.yourdomain.com${NC}"
echo ""

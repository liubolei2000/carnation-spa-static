#!/bin/bash
# Install SIM7600G SMS Gateway as systemd service
# Run: sudo bash install.sh

set -e
INSTALL_DIR="/opt/sim7600-gateway"
SERVICE="/etc/systemd/system/sms-gateway.service"

echo "=== Installing SIM7600G SMS Gateway ==="

# 1. Dependencies
apt-get update -qq
apt-get install -y python3-pip python3-serial
pip3 install pyserial --break-system-packages 2>/dev/null || true

# 2. Install files
mkdir -p "$INSTALL_DIR"
cp sms_gateway.py "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/sms_gateway.py"

# 3. Serial port access
usermod -aG dialout lbl 2>/dev/null || true
usermod -aG dialout pi  2>/dev/null || true

# 4. Systemd service
cat > "$SERVICE" << 'EOF'
[Unit]
Description=SIM7600G SMS Web Gateway
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/sim7600-gateway
ExecStart=/usr/bin/python3 /opt/sim7600-gateway/sms_gateway.py
Restart=always
RestartSec=5

# ── Edit these to match your setup ────────────────────
Environment=PORT=8080
Environment=SMS_GW_USER=sms
Environment=SMS_GW_PASS=carnation
# Web UI password (leave empty for no password on local network)
Environment=WEB_PASS=
# Serial port: auto-detect by default, or set explicitly:
# Environment=SERIAL_PORT=/dev/ttyUSB2
Environment=BAUD_RATE=115200
Environment=DB_PATH=/opt/sim7600-gateway/sms.db

[Install]
WantedBy=multi-user.target
EOF

# 5. Start
systemctl daemon-reload
systemctl enable sms-gateway
systemctl restart sms-gateway

sleep 2
echo ""
echo "=== Status: $(systemctl is-active sms-gateway) ==="
echo ""
echo "Web UI:  http://$(hostname -I | awk '{print $1}'):8080/"
echo "Logs:    journalctl -u sms-gateway -f"
echo ""
echo "API test (send SMS):"
echo "  curl -u sms:carnation -X POST http://localhost:8080/message \\"
echo "       -H 'Content-Type: application/json' \\"
echo "       -d '{\"message\":\"Hello!\",\"phoneNumbers\":[\"+16173197748\"]}'"

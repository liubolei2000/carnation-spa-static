# 🌸 Carnation Spa — 树莓派部署指南

## 硬件要求
- Raspberry Pi 5（推荐 4GB 或 8GB 内存）
- MicroSD 卡（32GB+，建议用好一点的品牌如 SanDisk）
- 系统：Raspberry Pi OS 64-bit（Bookworm）

---

## 整体架构

```
外网用户
   ↓ HTTPS
Cloudflare（免费CDN + SSL + 隐藏真实IP）
   ↓ Tunnel（加密隧道，无需开放路由器端口）
树莓派 Pi 5
   ├── Next.js 3000端口（PM2守护）
   └── PostgreSQL 5432端口（本地）
```

**优点：**
- 完全免费（只有Twilio短信费用）
- 无需公网IP，无需配置路由器
- HTTPS自动由Cloudflare处理
- 数据完全在本地

---

## 第一步：准备 Cloudflare

> 需要一个域名。没有的话可以在 Cloudflare 买，.com 约 $10/年

1. 注册 [cloudflare.com](https://cloudflare.com)（免费）
2. 添加你的域名，按提示把 DNS 服务器改成 Cloudflare 的
3. 等待生效（通常 5-30 分钟）

---

## 第二步：SSH 进入树莓派

在你的电脑上：

```bash
ssh pi@树莓派IP地址
# 默认密码是 raspberry 或你设置的密码
```

查看树莓派 IP：

```bash
# 在树莓派上运行
hostname -I
```

---

## 第三步：上传项目代码

**方法A：U盘复制**
把整个 `carnation-spa` 文件夹复制到U盘，插入树莓派后：
```bash
cp -r /media/pi/你的U盘名/carnation-spa /home/pi/
```

**方法B：GitHub（推荐）**
```bash
# 先把代码推到GitHub，然后在树莓派上：
git clone https://github.com/你的用户名/carnation-spa.git /home/pi/carnation-spa
```

**方法C：SCP 从电脑直接传**
```bash
# 在你的电脑上运行：
scp -r ./carnation-spa pi@树莓派IP:/home/pi/
```

---

## 第四步：运行部署脚本

```bash
cd /home/pi/carnation-spa

# 给脚本执行权限
chmod +x deploy.sh setup-tunnel.sh update.sh

# 运行部署（全程约 10-15 分钟）
bash deploy.sh
```

脚本会自动：
- 安装 Node.js 20、PostgreSQL 15、PM2
- 创建数据库和用户
- 生成随机密钥
- 让你输入 Twilio 账号信息
- 构建项目
- 配置开机自启

---

## 第五步：配置 Cloudflare Tunnel

```bash
# 1. 登录 Cloudflare（会打开浏览器链接）
cloudflared tunnel login

# 2. 创建 tunnel
cloudflared tunnel create carnation-spa

# 3. 绑定域名（把 carnation.yourdomain.com 改成你的）
cloudflared tunnel route dns carnation-spa carnation.yourdomain.com

# 4. 运行 tunnel 配置脚本
bash setup-tunnel.sh
```

配置完成后编辑配置文件改域名：
```bash
nano /home/pi/.cloudflared/config.yml
# 把 carnation.yourdomain.com 改成你的真实域名
sudo systemctl restart cloudflared
```

---

## 第六步：验证部署

```bash
# 查看应用状态
pm2 status

# 查看实时日志
pm2 logs

# 本地测试
curl http://localhost:3000

# 查看 Tunnel 状态
sudo systemctl status cloudflared
```

打开浏览器访问你的域名，应该能看到 Carnation Spa 首页！

---

## 日常维护

### 更新代码
```bash
cd /home/pi/carnation-spa
bash update.sh
```

### 常用命令
```bash
pm2 status              # 进程状态
pm2 logs                # 实时日志
pm2 logs --lines 100    # 查看最近100行日志
pm2 restart all         # 重启
pm2 monit               # 可视化监控面板

# 数据库
sudo -u postgres psql carnation_spa   # 进入数据库
\dt                                    # 查看所有表
\q                                     # 退出

# 备份数据库
pg_dump -U carnation carnation_spa > backup-$(date +%Y%m%d).sql

# 查看磁盘占用
df -h
du -sh /home/pi/carnation-uploads/    # 图片占用
```

### 查看日志
```bash
tail -f /home/pi/logs/carnation-out.log   # 应用日志
tail -f /home/pi/logs/carnation-err.log   # 错误日志
tail -f /home/pi/logs/cron.log            # 定时任务日志
```

---

## 数据库备份（建议每天自动备份）

```bash
# 添加每日自动备份（凌晨3点）
crontab -e

# 加入这行：
0 3 * * * pg_dump -U carnation carnation_spa > /home/pi/backups/backup-$(date +\%Y\%m\%d).sql 2>&1

# 创建备份目录
mkdir -p /home/pi/backups
```

---

## 资源占用参考（Pi 5）

| 资源 | 占用 |
|------|------|
| CPU（空闲） | < 5% |
| CPU（访问时） | 10-30% |
| 内存（运行中） | ~300-500MB |
| 磁盘（系统+应用） | ~3GB |
| 功耗 | 约 5-8W |

Pi 5 跑这套绰绰有余，甚至同时开多个应用都没问题。

---

## 常见问题

**Q: 树莓派重启后网站无法访问**
```bash
pm2 resurrect          # 恢复PM2进程
sudo systemctl start cloudflared
```

**Q: 数据库连接失败**
```bash
sudo systemctl status postgresql
sudo systemctl restart postgresql
```

**Q: 构建时内存不足**
```bash
export NODE_OPTIONS="--max-old-space-size=2048"
npm run build
```

**Q: 忘记数据库密码**
```bash
cat /home/pi/.carnation_db_pass
```

**Q: 想重置重新部署**
```bash
pm2 delete all
sudo -u postgres dropdb carnation_spa
sudo -u postgres dropuser carnation
rm -rf /home/pi/carnation-spa
# 然后重新运行 deploy.sh
```

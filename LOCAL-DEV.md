# 🚀 本地开发快速启动（Windows）

## 一次性准备（只做一次）

### 1. 启动 Docker 数据库

打开 PowerShell 或 CMD：

```bash
docker run -d \
  --name carnation-postgres \
  -e POSTGRES_USER=carnation \
  -e POSTGRES_PASSWORD=carnation123 \
  -e POSTGRES_DB=carnation_spa \
  -p 5432:5432 \
  --restart unless-stopped \
  postgres:15
```

验证：
```bash
docker ps
# 看到 carnation-postgres Up 就行
```

### 2. 创建 Next.js 项目

```bash
npx create-next-app@latest carnation-spa --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd carnation-spa
```

### 3. 安装依赖

```bash
npm install prisma @prisma/client bcryptjs jsonwebtoken twilio
npm install -D @types/bcryptjs @types/jsonwebtoken ts-node
npx prisma init
```

### 4. 把所有代码文件按路径复制进去

（把本文件夹里的 src/ prisma/ 等内容全部覆盖进 carnation-spa/）

### 5. 把 .env.local 放到项目根目录

### 6. 初始化数据库

```bash
npx prisma db push
npm run db:seed
```

看到以下输出说明成功：
```
🌸 Seeding Carnation Spa database...
✅ Owner account created
✅ Service created: Classic Full Body
✅ Therapist created: Mei Lin
...
🌸 Seeding complete!
```

---

## 每次开发

### 启动数据库（如果 Docker 停了）

```bash
docker start carnation-postgres
```

### 启动开发服务器

```bash
cd carnation-spa
npm run dev
```

打开：
- 顾客端：http://localhost:3000
- 管理控制台：http://localhost:3000/admin

---

## 默认登录账号

| 账号       | 手机号           | 密码        | 角色 |
|-----------|-----------------|-------------|------|
| Admin     | +19783300895    | admin123    | 店主 |
| Mei Lin   | +16175550201    | meilin123   | 技师 |
| Sarah Chen| +17815550334    | sarah123    | 技师 |
| David Park| +13395550189    | david123    | 技师 |

---

## 开发模式下的短信

**不需要 Twilio！** 开发模式下短信内容直接打印到 VS Code 终端：

```
────────────────────────────────────────────────────────────
📱 [DEV SMS]
   To: +16175550142
   Body:
   [Carnation Spa] Booking confirmed!
   Service: Classic Full Body
   ...
────────────────────────────────────────────────────────────

🔑 [DEV] 验证码: 123456  (开发模式固定值)
```

顾客端预约时，验证码固定是 **123456**。

---

## 常用调试命令

```bash
# 查看数据库内容（可视化界面）
npx prisma studio
# 打开 http://localhost:5555

# 重置数据库（清空重来）
npx prisma migrate reset

# 查看 Docker 日志
docker logs carnation-postgres

# 进入数据库
docker exec -it carnation-postgres psql -U carnation -d carnation_spa
```

---

## 文件结构完整版

```
carnation-spa/
├── .env.local                          ← 环境变量（不提交 git）
├── next.config.js
├── tsconfig.json
├── package.json
├── vercel.json                         ← Cron 配置
├── prisma/
│   ├── schema.prisma                   ← 数据库模型
│   └── seed.ts                         ← 初始数据
└── src/
    ├── middleware.ts                    ← 路由保护
    ├── app/
    │   ├── layout.tsx
    │   ├── admin/
    │   │   ├── layout.tsx              ← 侧边栏 + Auth
    │   │   ├── page.tsx               ← 重定向
    │   │   ├── login/page.tsx
    │   │   ├── dashboard/page.tsx
    │   │   ├── appointments/page.tsx
    │   │   ├── services/page.tsx
    │   │   ├── therapists/page.tsx     ← (下一步)
    │   │   ├── accounts/page.tsx       ← (下一步)
    │   │   ├── calendar/page.tsx       ← (下一步)
    │   │   └── settings/page.tsx       ← (下一步)
    │   └── api/
    │       ├── auth/login/route.ts
    │       ├── auth/logout/route.ts
    │       ├── auth/me/route.ts
    │       ├── sms/send/route.ts
    │       ├── sms/verify/route.ts
    │       ├── availability/route.ts
    │       ├── appointments/route.ts
    │       ├── appointments/[id]/route.ts
    │       ├── appointments/token/[token]/route.ts
    │       ├── services/route.ts
    │       ├── services/[id]/route.ts
    │       ├── therapists/route.ts
    │       ├── accounts/route.ts
    │       ├── accounts/[id]/route.ts
    │       ├── site-config/route.ts
    │       └── cron/remind/route.ts
    └── lib/
        ├── prisma.ts
        ├── auth.ts
        ├── availability.ts
        └── sms.ts
```

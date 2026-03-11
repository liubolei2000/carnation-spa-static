# 🌸 Carnation Spa — Booking System

Full-stack appointment booking system for Carnation Spa, Burlington MA.

## Tech Stack
- **Next.js 14** (App Router) + TypeScript
- **Prisma** ORM + PostgreSQL
- **Twilio** SMS (dev mode: prints to terminal)
- **JWT** authentication (httpOnly cookie)
- Deployable on **Raspberry Pi 5** via Cloudflare Tunnel

---

## Local Development (Windows + Docker)

### 1. Start PostgreSQL

```bash
docker run -d --name carnation-postgres \
  -e POSTGRES_USER=carnation \
  -e POSTGRES_PASSWORD=carnation123 \
  -e POSTGRES_DB=carnation_spa \
  -p 5432:5432 postgres:15
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create `.env` file (same folder as package.json)

```env
DATABASE_URL="postgresql://carnation:carnation123@localhost:5432/carnation_spa"
JWT_SECRET="local-dev-secret-change-in-production-32chars"
ADMIN_PHONE="+19783300895"
ADMIN_PASSWORD="admin123"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Also create `.env.local` with the same content.

### 4. Push schema + seed

```bash
npx prisma db push

# Windows (run from project root):
set ADMIN_PASSWORD=admin123 && npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" prisma/seed.ts
```

### 5. Start dev server

```bash
npm run dev
```

- Customer site: http://localhost:3000
- Admin console: http://localhost:3000/admin

---

## Default Login Credentials

| Account    | Phone           | Password    | Role      |
|------------|-----------------|-------------|-----------|
| Admin      | +19783300895    | admin123    | OWNER     |
| Mei Lin    | +16175550201    | meilin123   | THERAPIST |
| Sarah Chen | +17815550334    | sarah123    | THERAPIST |
| David Park | +13395550189    | david123    | THERAPIST |

> ⚠️ Change all passwords after first login!

---

## Fix Login Issues (if needed)

If login fails after seeding, reset the admin password:

```bash
node fix-password.mjs
```

---

## Features

### Customer Site (`/`)
- Full-page hero with booking CTA
- Service showcase with pricing
- Therapist profiles
- 4-step booking drawer:
  1. Select service
  2. Choose date, therapist & time
  3. Enter name, phone, verify SMS code
  4. Booking confirmed + manage link via SMS

### Customer Manage (`/manage/[token]`)
- View booking details
- Reschedule (shows real-time availability)
- Cancel (sends SMS confirmation)

### Admin Console (`/admin`)
- **Dashboard** — Today's stats + appointment list + status actions
- **Calendar** — Month view with appointment dots + day detail view
- **Appointments** — Full list with search/filter, status management
- **New Booking** — Manual entry for phone/walk-in bookings
- **Services** — Add/edit/enable/disable massage services
- **Therapists** — Add/edit therapist profiles, buffer time settings
- **Accounts** — Create staff/therapist accounts, assign roles
- **Settings** — Edit all website copy (hero, about, social links, hours)
- **My Schedule** (THERAPIST) — Day/week view of own appointments

### Permission System
| Feature              | OWNER | STAFF | THERAPIST |
|----------------------|-------|-------|-----------|
| View all bookings    | ✅    | ✅    | ❌        |
| View own bookings    | ✅    | ✅    | ✅        |
| Create/edit bookings | ✅    | ✅    | ❌        |
| Manage services      | ✅    | ❌    | ❌        |
| Manage therapists    | ✅    | ❌    | ❌        |
| Create accounts      | ✅    | ❌    | ❌        |
| Edit site content    | ✅    | ❌    | ❌        |

---

## Raspberry Pi 5 Deployment

See `RASPBERRY-PI.md` for full deployment guide with PM2 + Cloudflare Tunnel.

---

## Production Environment Variables

```env
DATABASE_URL="postgresql://carnation:yourpassword@localhost:5432/carnation_spa"
JWT_SECRET="your-very-long-random-secret-here"
ADMIN_PHONE="+19783300895"
ADMIN_PASSWORD="your-secure-admin-password"
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
TWILIO_ACCOUNT_SID="ACxxxx"
TWILIO_AUTH_TOKEN="xxxx"
TWILIO_PHONE_NUMBER="+1xxxxxxxxxx"
```

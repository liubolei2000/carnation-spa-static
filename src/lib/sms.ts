// src/lib/sms.ts
// 开发模式：验证码打印到终端，DB 存储
// 生产模式：Twilio Verify API（代码/发送/验证全部由 Twilio 处理）

import { prisma } from './prisma'
import { SmsCodePurpose } from '@prisma/client'

const IS_DEV = process.env.NODE_ENV === 'development'
const VERIFY_SID = process.env.TWILIO_VERIFY_SERVICE_SID
// Use Twilio Verify whenever the service SID is configured (even in dev for testing)
const USE_TWILIO_VERIFY = !!VERIFY_SID

function getTwilioClient() {
  const twilio = require('twilio')
  return twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  if (raw.startsWith('+')) return `+${digits}`
  throw new Error('INVALID_PHONE')
}

// ── Android SMS Gateway ──────────────────────────────
// 用于发送预约确认、修改通知、提醒等业务短信
// 验证码仍走 Twilio Verify（见 sendVerificationCode）
async function sendSmsGateway(to: string, message: string): Promise<boolean> {
  const baseUrl = process.env.SMS_GATEWAY_URL   // e.g. http://192.168.0.111:8080
  const user    = process.env.SMS_GATEWAY_USER  // sms
  const pass    = process.env.SMS_GATEWAY_PASS  // iOBsi7HF
  if (!baseUrl || !user || !pass) return false

  const credentials = Buffer.from(`${user}:${pass}`).toString('base64')
  try {
    const res = await fetch(`${baseUrl}/message`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${credentials}`,
      },
      body: JSON.stringify({ message, phoneNumbers: [to] }),
    })
    if (!res.ok) {
      console.error('[SMS Gateway Error]', res.status, await res.text())
      return false
    }
    return true
  } catch (err) {
    console.error('[SMS Gateway Error]', err)
    return false
  }
}


// ── AWS SNS SMS ──────────────────────────────────────
async function sendSnsSms(to: string, message: string): Promise<boolean> {
  const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns")
  const client = new SNSClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
  try {
    await client.send(new PublishCommand({
      PhoneNumber: to,
      Message: message,
      MessageAttributes: {
        "AWS.SNS.SMS.SMSType": { DataType: "String", StringValue: "Transactional" },
      },
    }))
    return true
  } catch (err) {
    console.error("[SNS SMS Error]", err)
    return false
  }
}

export async function sendSms(to: string, body: string): Promise<boolean> {
  // 优先使用 Android SMS Gateway（dev/prod 都发）
  if (process.env.SMS_GATEWAY_URL) {
    if (IS_DEV) console.log(`📱 [SMS Gateway] To: ${to}\n${body}`)
    const ok = await sendSmsGateway(to, body)
    if (ok) return true
    console.warn("[SMS] Gateway failed, falling back to SNS")
  }
  if (process.env.AWS_ACCESS_KEY_ID) {
    return sendSnsSms(to, body)
  }
  if (IS_DEV) {
    console.log('\n' + '─'.repeat(60))
    console.log('📱 [DEV SMS]')
    console.log(`   To: ${to}`)
    console.log(`   Body:\n${body.split('\n').map(l => '   ' + l).join('\n')}`)
    console.log('─'.repeat(60) + '\n')
    return true
  }
  // 回退：Twilio 发送（需配置 TWILIO_PHONE_NUMBER）
  try {
    const client = getTwilioClient()
    await client.messages.create({ from: process.env.TWILIO_PHONE_NUMBER!, to, body })
    return true
  } catch (err) {
    console.error('[SMS Error]', err)
    return false
  }
}

export async function sendVerificationCode(
  phone: string, purpose: SmsCodePurpose
): Promise<{ success: boolean; error?: string }> {
  // ── Twilio Verify（配置了 SID 就使用）──────────────────
  if (USE_TWILIO_VERIFY) {
    const client = getTwilioClient()
    // Fire-and-forget: return immediately, Twilio sends in background
    client.verify.v2.services(VERIFY_SID).verifications.create({ to: phone, channel: 'sms' })
      .catch((err: any) => console.error('[Twilio Verify Send]', err))
    return { success: true }
  }

  // ── DB 验证码 + SMS 发送 ──────────────────────────────
  const tenMinutesAgo = new Date(Date.now() - 10 * 60_000)
  const recent = await prisma.smsCode.count({
    where: { phone, purpose, createdAt: { gte: tenMinutesAgo } },
  })
  if (recent >= 3) return { success: false, error: 'RATE_LIMITED' }

  await prisma.smsCode.updateMany({ where: { phone, purpose, used: false }, data: { used: true } })

  const code = IS_DEV ? '123456' : String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + 10 * 60_000)
  await prisma.smsCode.create({ data: { phone, code, purpose, expiresAt } })

  if (IS_DEV) {
    console.log(`\n🔑 [DEV] 验证码: ${code}  (开发模式固定值)\n`)
  } else {
    // Fire-and-forget: return immediately after DB record is created,
    // SMS delivery happens in background to eliminate response latency
    sendSms(phone, `[Carnation Spa] Your verification code is: ${code}  (valid 10 min)`)
      .then(ok => { if (!ok) console.error('[SMS Code] Failed to send to', phone) })
      .catch(err => console.error('[SMS Code] Error sending to', phone, err))
  }
  return { success: true }
}

export async function verifyCode(
  phone: string, code: string, purpose: SmsCodePurpose
): Promise<{ valid: boolean; error?: string }> {
  // ── Twilio Verify Check（配置了 SID 就使用）────────────
  if (USE_TWILIO_VERIFY) {
    try {
      const client = getTwilioClient()
      const check = await client.verify.v2.services(VERIFY_SID).verificationChecks.create({
        to: phone,
        code,
      })
      console.log('[Twilio Verify Check] status:', check.status, 'phone:', phone, 'code:', code)
      if (check.status === 'approved') return { valid: true }
      return { valid: false, error: 'WRONG_CODE' }
    } catch (err: any) {
      console.error('[Twilio Verify Check] error:', err?.code, err?.message)
      if (err?.code === 20404) return { valid: false, error: 'CODE_NOT_FOUND' }
      return { valid: false, error: 'WRONG_CODE' }
    }
  }

  // ── 开发：DB 验证码 ───────────────────────────────────
  const record = await prisma.smsCode.findFirst({
    where: { phone, purpose, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  if (!record) return { valid: false, error: 'CODE_NOT_FOUND' }
  if (record.attempts >= 5) {
    await prisma.smsCode.update({ where: { id: record.id }, data: { used: true } })
    return { valid: false, error: 'MAX_ATTEMPTS' }
  }
  if (record.code !== code) {
    await prisma.smsCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } })
    return { valid: false, error: 'WRONG_CODE' }
  }
  await prisma.smsCode.update({ where: { id: record.id }, data: { used: true } })
  return { valid: true }
}

interface BookingInfo {
  customerPhone: string; customerName: string; serviceName: string
  therapistName: string; appointmentAt: Date; manageToken: string
  notes?: string | null
}

const MAPS_URL = 'https://maps.google.com/?q=120+Cambridge+St+STE+8+Burlington+MA+01803'

function fmt(d: Date) {
  return d.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
}
function fmtTime(d: Date) {
  return d.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true })
}
function manageUrl(token: string) { return `${process.env.NEXT_PUBLIC_APP_URL}/manage/${token}` }

const OWNER = '+19783300895'

export async function sendBookingConfirmation(info: BookingInfo) {
  await sendSms(info.customerPhone,
    `[Carnation Spa] Booking confirmed!\nService: ${info.serviceName}\nTime: ${fmt(info.appointmentAt)}\nTherapist: ${info.therapistName}\nAddress: 120 Cambridge St, Suite 8, Burlington MA\nDirections: ${MAPS_URL}\nManage: ${manageUrl(info.manageToken)}`)
  await sendSms(OWNER,
    `【新预约】${info.customerName}\n项目：${info.serviceName}\n时间：${fmt(info.appointmentAt)}\n技师：${info.therapistName}\n电话：${info.customerPhone}${info.notes ? `\n备注：${info.notes}` : ''}`)
}
export async function sendReminder24h(info: BookingInfo): Promise<boolean> {
  return sendSms(info.customerPhone,
    `[Carnation Spa] Reminder: Tomorrow at ${fmtTime(info.appointmentAt)} with ${info.therapistName}.\nDirections: ${MAPS_URL}\nReschedule: ${manageUrl(info.manageToken)}`)
}
export async function sendReminder2h(info: BookingInfo): Promise<boolean> {
  return sendSms(info.customerPhone,
    `[Carnation Spa] See you in ~2 hours! Today at ${fmtTime(info.appointmentAt)} · ${info.therapistName}\nDirections: ${MAPS_URL}`)
}
export async function sendRescheduleConfirmation(info: BookingInfo) {
  await sendSms(info.customerPhone,
    `[Carnation Spa] Your appointment has been rescheduled!\nService: ${info.serviceName}\nNew time: ${fmt(info.appointmentAt)}\nTherapist: ${info.therapistName}\nAddress: 120 Cambridge St, Suite 8, Burlington MA\nManage: ${manageUrl(info.manageToken)}`)
  await sendSms(OWNER,
    `【改期】${info.customerName}\n项目：${info.serviceName}\n新时间：${fmt(info.appointmentAt)}\n技师：${info.therapistName}\n电话：${info.customerPhone}`)
}
export async function sendCancellationNotice(info: BookingInfo) {
  await sendSms(info.customerPhone,
    `[Carnation Spa] Your booking on ${fmt(info.appointmentAt)} with ${info.therapistName} has been cancelled.\nBook again: ${process.env.NEXT_PUBLIC_APP_URL}`)
  await sendSms(OWNER,
    `【取消】${info.customerName}\n项目：${info.serviceName}\n时间：${fmt(info.appointmentAt)}\n技师：${info.therapistName}\n电话：${info.customerPhone}`)
}

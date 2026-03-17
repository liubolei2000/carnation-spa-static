// src/lib/availability.ts
// Therapist availability engine
// — detects conflicts including buffer time between sessions
// — generates available time slots for a given date

import { prisma } from './prisma'
import { AppointmentStatus } from '@prisma/client'

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export interface TimeSlot {
  time:      string   // "09:00"
  available: boolean
  reason?:   'booked' | 'buffer' | 'outside_hours'
}

export interface AvailabilityResult {
  therapistId:   string
  therapistName: string
  date:          string  // "2025-03-07"
  slots:         TimeSlot[]
}

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

const BUSINESS_START = 9   // 9:00 AM  (fallback when no work hours set)
const BUSINESS_END   = 21  // 9:00 PM  (fallback)
const SLOT_INTERVAL  = 30  // minutes between slots

// ─────────────────────────────────────────
// Fetch therapist work hours for a given day of week
// Returns { start, end } in hours (as numbers) or null if day off
// ─────────────────────────────────────────

async function getTherapistHours(
  therapistId: string,
  date: Date
): Promise<{ start: number; startMin: number; end: number; endMin: number } | null> {
  const dow = date.getDay()  // 0=Sun … 6=Sat
  const row = await prisma.therapistWorkHours.findUnique({
    where: { therapistId_dayOfWeek: { therapistId, dayOfWeek: dow } },
    select: { isWorkday: true, openTime: true, closeTime: true },
  })

  // No row → use global defaults (treat as workday 9-21)
  if (!row) {
    return { start: BUSINESS_START, startMin: 0, end: BUSINESS_END, endMin: 0 }
  }
  if (!row.isWorkday) return null  // day off

  const [startH, startM] = row.openTime.split(':').map(Number)
  const [endH,   endM  ] = row.closeTime.split(':').map(Number)
  return { start: startH, startMin: startM, end: endH, endMin: endM }
}

// ─────────────────────────────────────────
// Core conflict check
// Checks if a new appointment overlaps with existing ones
// including buffer time on both sides
// ─────────────────────────────────────────

export async function isTherapistAvailable(
  therapistId:  string,
  newStart:     Date,
  durationMins: number,
  excludeId?:   string   // exclude this appointment (for rescheduling)
): Promise<boolean> {
  const therapist = await prisma.therapist.findUnique({
    where:  { id: therapistId },
    select: { bufferMins: true },
  })
  const buffer = therapist?.bufferMins ?? 15

  const newEnd = new Date(newStart.getTime() + durationMins * 60_000)

  // Fetch all active appointments for this therapist on the same day
  const dayStart = new Date(newStart)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(newStart)
  dayEnd.setHours(23, 59, 59, 999)

  const existing = await prisma.appointment.findMany({
    where: {
      therapistId,
      status:        { notIn: [AppointmentStatus.CANCELLED] },
      appointmentAt: { gte: dayStart, lte: dayEnd },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { appointmentAt: true, endsAt: true },
  })

  // Overlap condition (including buffer zones):
  // Existing blocked window:  [existStart - buffer, existEnd + buffer)
  // New blocked window:       [newStart - buffer, newEnd + buffer)
  // Overlap if: existStart - buffer < newEnd + buffer
  //         AND existEnd + buffer > newStart - buffer
  //
  // Simplified (buffer on both means we just need buffer between sessions):
  // Conflict if: existStart < newEnd + buffer AND existEnd + buffer > newStart

  for (const appt of existing) {
    const existStart = appt.appointmentAt
    const existEnd   = appt.endsAt

    const newEndWithBuffer    = new Date(newEnd.getTime()   + buffer * 60_000)
    const existEndWithBuffer  = new Date(existEnd.getTime() + buffer * 60_000)

    if (existStart < newEndWithBuffer && existEndWithBuffer > newStart) {
      return false  // conflict
    }
  }

  return true
}

// ─────────────────────────────────────────
// Get all slots for a therapist on a date
// Returns each 30-min slot with availability status
// ─────────────────────────────────────────

export async function getAvailableSlots(
  therapistId:  string,
  date:         Date,      // any time within the target day
  durationMins: number,
  excludeId?:   string
): Promise<TimeSlot[]> {
  const therapist = await prisma.therapist.findUnique({
    where:  { id: therapistId },
    select: { bufferMins: true },
  })
  const buffer = therapist?.bufferMins ?? 15

  // Get therapist's work hours for this day
  const hours = await getTherapistHours(therapistId, date)

  // Fetch existing appointments for the day
  const dayStart = new Date(date)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(date)
  dayEnd.setHours(23, 59, 59, 999)

  const existing = await prisma.appointment.findMany({
    where: {
      therapistId,
      status:        { notIn: [AppointmentStatus.CANCELLED] },
      appointmentAt: { gte: dayStart, lte: dayEnd },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { appointmentAt: true, endsAt: true },
  })

  const slots: TimeSlot[] = []

  // Determine slot range
  const rangeStart = hours ? hours.start * 60 + hours.startMin : BUSINESS_START * 60
  const rangeEnd   = hours ? hours.end   * 60 + hours.endMin   : BUSINESS_END   * 60

  // Iterate each 30-min slot within the day
  for (let totalMin = rangeStart; totalMin < rangeEnd; totalMin += SLOT_INTERVAL) {
    const hour = Math.floor(totalMin / 60)
    const min  = totalMin % 60

    const slotStart = new Date(date)
    slotStart.setHours(hour, min, 0, 0)

    const slotEnd = new Date(slotStart.getTime() + durationMins * 60_000)

    // Day off — mark all as outside_hours
    if (!hours) {
      slots.push({ time: formatTime(hour, min), available: false, reason: 'outside_hours' })
      continue
    }

    // Skip slots that are already in the past
    const now = new Date()
    if (slotStart <= now) {
      slots.push({ time: formatTime(hour, min), available: false, reason: 'outside_hours' })
      continue
    }

    // Check if session would end after work hours
    const workClose = new Date(date)
    workClose.setHours(hours.end, hours.endMin, 0, 0)

    if (slotEnd > workClose) {
      slots.push({ time: formatTime(hour, min), available: false, reason: 'outside_hours' })
      continue
    }

    // Check for conflicts
    let conflict = false
    let reason: TimeSlot['reason'] = 'booked'

    for (const appt of existing) {
      const existStart = appt.appointmentAt
      const existEnd   = appt.endsAt

      const slotEndWithBuffer   = new Date(slotEnd.getTime()   + buffer * 60_000)
      const existEndWithBuffer  = new Date(existEnd.getTime()  + buffer * 60_000)

      if (existStart < slotEndWithBuffer && existEndWithBuffer > slotStart) {
        conflict = true
        if (existStart <= slotStart && slotStart < existEnd) {
          reason = 'booked'
        } else {
          reason = 'buffer'
        }
        break
      }
    }

    slots.push({
      time:      formatTime(hour, min),
      available: !conflict,
      reason:    conflict ? reason : undefined,
    })
  }

  return slots
}

// ─────────────────────────────────────────
// Get availability for ALL active therapists
// for a given date and service duration
// ─────────────────────────────────────────

export async function getAllTherapistsAvailability(
  date:         Date,
  durationMins: number
): Promise<AvailabilityResult[]> {
  const therapists = await prisma.therapist.findMany({
    where:   { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select:  { id: true, name: true },
  })

  const results = await Promise.all(
    therapists.map(async (t) => ({
      therapistId:   t.id,
      therapistName: t.name,
      date:          date.toISOString().split('T')[0],
      slots:         await getAvailableSlots(t.id, date, durationMins),
    }))
  )

  return results
}

// ─────────────────────────────────────────
// Safe appointment creation with race-condition guard
// Checks availability INSIDE a transaction before writing
// ─────────────────────────────────────────

export async function createAppointmentSafe(params: {
  serviceId:     string
  therapistId:   string
  customerName:  string
  customerPhone: string
  appointmentAt: Date
  durationMins:  number
  notes?:        string
  source?:       'ONLINE' | 'MANUAL'
  createdById?:  string
}) {
  return prisma.$transaction(async (tx) => {
    // Re-check availability inside transaction
    const therapist = await tx.therapist.findUnique({
      where:  { id: params.therapistId },
      select: { bufferMins: true, isActive: true },
    })

    if (!therapist?.isActive) {
      throw new Error('THERAPIST_UNAVAILABLE')
    }

    const buffer = therapist.bufferMins
    const newEnd = new Date(params.appointmentAt.getTime() + params.durationMins * 60_000)

    const dayStart = new Date(params.appointmentAt)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(params.appointmentAt)
    dayEnd.setHours(23, 59, 59, 999)

    const conflicts = await tx.appointment.findMany({
      where: {
        therapistId: params.therapistId,
        status:      { notIn: [AppointmentStatus.CANCELLED] },
        appointmentAt: { gte: dayStart, lte: dayEnd },
      },
      select: { appointmentAt: true, endsAt: true, id: true },
    })

    for (const c of conflicts) {
      const existEndWithBuffer = new Date(c.endsAt.getTime() + buffer * 60_000)
      const newEndWithBuffer   = new Date(newEnd.getTime()   + buffer * 60_000)

      if (c.appointmentAt < newEndWithBuffer && existEndWithBuffer > params.appointmentAt) {
        throw new Error('TIME_SLOT_TAKEN')
      }
    }

    // Work hours check (per therapist, falls back to global 9-21)
    const hours = await getTherapistHours(params.therapistId, params.appointmentAt)
    if (!hours) throw new Error('OUTSIDE_BUSINESS_HOURS')
    const workClose = new Date(params.appointmentAt)
    workClose.setHours(hours.end, hours.endMin, 0, 0)
    const workOpen = new Date(params.appointmentAt)
    workOpen.setHours(hours.start, hours.startMin, 0, 0)
    if (params.appointmentAt < workOpen || newEnd > workClose) {
      throw new Error('OUTSIDE_BUSINESS_HOURS')
    }

    // Generate manage token (7 days expiry)
    const tokenExpiresAt = new Date()
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7)

    // Create the appointment
    return tx.appointment.create({
      data: {
        serviceId:     params.serviceId,
        therapistId:   params.therapistId,
        customerName:  params.customerName,
        customerPhone: params.customerPhone,
        appointmentAt: params.appointmentAt,
        endsAt:        newEnd,
        notes:         params.notes,
        source:        params.source as any ?? 'ONLINE',
        status:        'PENDING',
        tokenExpiresAt,
        createdById:   params.createdById,
      },
      include: {
        service:   { select: { name: true, durationMin: true, price: true } },
        therapist: { select: { name: true } },
      },
    })
  })
}

// ─────────────────────────────────────────
// Reschedule existing appointment
// ─────────────────────────────────────────

export async function rescheduleAppointment(
  appointmentId: string,
  newStart:      Date,
  durationMins:  number
) {
  return prisma.$transaction(async (tx) => {
    const appt = await tx.appointment.findUnique({
      where:  { id: appointmentId },
      select: { therapistId: true, status: true },
    })

    if (!appt) throw new Error('NOT_FOUND')
    if (appt.status === 'CANCELLED') throw new Error('ALREADY_CANCELLED')

    const buffer = (await tx.therapist.findUnique({
      where:  { id: appt.therapistId },
      select: { bufferMins: true },
    }))?.bufferMins ?? 15

    const newEnd = new Date(newStart.getTime() + durationMins * 60_000)

    const dayStart = new Date(newStart); dayStart.setHours(0, 0, 0, 0)
    const dayEnd   = new Date(newStart); dayEnd.setHours(23, 59, 59, 999)

    // 事务内重新检测冲突，防止竞态
    const conflicts = await tx.appointment.findMany({
      where: {
        therapistId:   appt.therapistId,
        status:        { notIn: [AppointmentStatus.CANCELLED] },
        appointmentAt: { gte: dayStart, lte: dayEnd },
        id:            { not: appointmentId },
      },
      select: { appointmentAt: true, endsAt: true },
    })

    for (const c of conflicts) {
      const newEndWithBuf  = new Date(newEnd.getTime()   + buffer * 60_000)
      const cEndWithBuf    = new Date(c.endsAt.getTime() + buffer * 60_000)
      if (c.appointmentAt < newEndWithBuf && cEndWithBuf > newStart) {
        throw new Error('TIME_SLOT_TAKEN')
      }
    }

    return tx.appointment.update({
      where: { id: appointmentId },
      data:  {
        appointmentAt: newStart,
        endsAt:        newEnd,
        reminded24h:   false,
        reminded2h:    false,
      },
    })
  })
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function formatTime(hour: number, min: number): string {
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export function parseTimeToDate(date: Date, timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number)
  const result = new Date(date)
  result.setHours(h, m, 0, 0)
  return result
}

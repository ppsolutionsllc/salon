export interface PublicSalon {
  id: number
  name: string
  address?: string | null
  timezone: string
}

export interface PublicService {
  id: number
  name: string
  description?: string | null
  duration_minutes: number
  price: number
  category_id?: number | null
}

export interface PublicStaff {
  id: number
  first_name: string
  last_name: string
  phone?: string | null
}

export interface PublicSlot {
  staff_id: number
  staff_name: string
  start_time: string
  end_time: string
  available: boolean
}

export interface PublicBookingCreated {
  booking_id: number
  status: string
  salon_id: number
  otp_expires_at: string
  manage_token: string
  confirm_url: string
  cancel_url: string
  reschedule_url: string
  otp_code_dev?: string
}

export interface PublicBookingDetails {
  booking_id: number
  salon_id: number
  salon_name: string
  service_name: string
  staff_name: string
  client_name: string
  client_phone: string
  start_time: string
  end_time: string
  status: "NEW" | "CONFIRMED" | "CANCELED" | "RESCHEDULED" | "COMPLETED" | "NO_SHOW"
  notes?: string | null
  manage_token: string
  otp_expires_at?: string | null
}

function resolveApiBase() {
  const fallback = "/api/v1"
  const raw = (process.env.NEXT_PUBLIC_API_URL || fallback).trim().replace(/\/+$/, "")
  if (!raw) return fallback

  if (typeof window === "undefined") {
    return raw
  }

  if (raw.startsWith("/")) {
    return raw
  }

  try {
    const parsed = new URL(raw, window.location.origin)
    const blockedHosts = new Set(["api", "localhost", "127.0.0.1", "0.0.0.0"])

    if (blockedHosts.has(parsed.hostname) || parsed.host === "api:8000") {
      return fallback
    }

    if (parsed.origin !== window.location.origin) {
      return fallback
    }

    return parsed.pathname.replace(/\/+$/, "") || fallback
  } catch {
    return fallback
  }
}

const base = resolveApiBase()

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const safePath = path.startsWith("/") ? path : `/${path}`
  const res = await fetch(`${base}${safePath}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }

  return res.json()
}

export function getPublicSalons() {
  return request<PublicSalon[]>("/public/salons")
}

export function getPublicServices(salonId: number) {
  return request<PublicService[]>(`/public/salons/${salonId}/services`)
}

export function getPublicStaff(salonId: number, serviceId?: number) {
  const query = serviceId ? `?service_id=${serviceId}` : ""
  return request<PublicStaff[]>(`/public/salons/${salonId}/staff${query}`)
}

export function getPublicSlots(
  salonId: number,
  payload: { service_id: number; date: string; staff_id?: number }
) {
  return request<PublicSlot[]>(`/public/salons/${salonId}/slots`, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function createPublicBooking(payload: {
  salon_id: number
  service_id: number
  staff_id?: number
  start_time: string
  first_name: string
  last_name?: string
  phone: string
  email?: string
  notes?: string
}) {
  return request<PublicBookingCreated>("/public/bookings", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export function confirmPublicBooking(bookingId: number, otp_code: string) {
  return request<PublicBookingDetails>(`/public/bookings/${bookingId}/confirm`, {
    method: "POST",
    body: JSON.stringify({ otp_code }),
  })
}

export function getBookingByToken(token: string) {
  return request<PublicBookingDetails>(`/public/bookings/manage/${token}`)
}

export function confirmBookingByToken(token: string, otp_code: string) {
  return request<PublicBookingDetails>(`/public/bookings/manage/${token}/confirm`, {
    method: "POST",
    body: JSON.stringify({ otp_code }),
  })
}

export function confirmBookingByLink(token: string) {
  return request<PublicBookingDetails>(`/public/bookings/manage/${token}/confirm-link`, {
    method: "POST",
  })
}

export function cancelBookingByToken(token: string, reason = "client_request") {
  return request<PublicBookingDetails>(`/public/bookings/manage/${token}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
}

export function rescheduleBookingByToken(token: string, new_start_time: string) {
  return request<PublicBookingCreated>(`/public/bookings/manage/${token}/reschedule`, {
    method: "POST",
    body: JSON.stringify({ new_start_time }),
  })
}

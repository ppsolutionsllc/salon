"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { CalendarPlus, CheckCircle, ChevronRight, Clock, Loader2, ChevronLeft } from "lucide-react"
import apiFetch from "@/lib/api"
import Link from "next/link"

interface Salon { id: number; name: string; address: string }
interface Service { id: number; name: string; duration_minutes: number; price: number }
interface StaffMember { id: number; first_name: string; last_name: string }
interface Slot { start_time: string; end_time: string; available: boolean }

const STEPS = ["Салон", "Послуга", "Майстер", "Дата/Час", "Підтвердження"]

export default function ClientBookPage() {
    const { data: session } = useSession()
    const token = (session as any)?.accessToken as string | undefined

    const [step, setStep] = useState(0)
    const [loading, setLoading] = useState(false)
    const [booking, setBooking] = useState<{
        salon: Salon | null
        service: Service | null
        staff: StaffMember | null
        slot: Slot | null
    }>({ salon: null, service: null, staff: null, slot: null })

    const [salons, setSalons] = useState<Salon[]>([])
    const [services, setServices] = useState<Service[]>([])
    const [staffList, setStaffList] = useState<StaffMember[]>([])
    const [slots, setSlots] = useState<Slot[]>([])
    const [selectedDate, setSelectedDate] = useState("")
    const [otp, setOtp] = useState("")
    const [created, setCreated] = useState<{ id: number; otp_code: string } | null>(null)
    const [confirmed, setConfirmed] = useState(false)
    const [otpError, setOtpError] = useState("")

    useEffect(() => {
        if (!token) return
        apiFetch("/salons/", { token }).then(setSalons)
    }, [token])

    useEffect(() => {
        if (!token || !booking.salon) return
        setLoading(true)
        apiFetch(`/salons/${booking.salon.id}/services`, { token }).finally(() => setLoading(false)).then(setServices)
    }, [token, booking.salon])

    useEffect(() => {
        if (!token || !booking.salon) return
        apiFetch(`/salons/${booking.salon.id}/staff`, { token }).then(setStaffList)
    }, [token, booking.salon])

    const loadSlots = useCallback(async () => {
        if (!token || !booking.salon || !booking.service || !booking.staff || !selectedDate) return
        setLoading(true)
        try {
            const data = await apiFetch(`/salons/${booking.salon.id}/appointments/slots`, {
                method: "POST",
                token,
                body: { staff_id: booking.staff.id, service_id: booking.service.id, date: selectedDate }
            })
            setSlots(data.filter((s: Slot) => s.available))
        } finally { setLoading(false) }
    }, [token, booking, selectedDate])

    useEffect(() => { if (step === 3) loadSlots() }, [step, loadSlots])

    const handleBook = async () => {
        if (!booking.salon || !booking.service || !booking.staff || !booking.slot || !token) return
        setLoading(true)
        try {
            // Need client_id – get from session or me endpoint
            const me = await apiFetch("/me", { token })
            // Find client record for this salon
            const clients = await apiFetch(`/salons/${booking.salon.id}/clients`, { token })
            const myClient = clients.find((c: any) => c.user_id === me.id || c.email === me.email)
            if (!myClient) throw new Error("Профіль клієнта не знайдено. Зверніться до адміна.")

            const result = await apiFetch(`/salons/${booking.salon.id}/appointments`, {
                method: "POST", token,
                body: {
                    client_id: myClient.id,
                    staff_id: booking.staff.id,
                    service_id: booking.service.id,
                    start_time: booking.slot.start_time
                }
            })
            setCreated({ id: result.id, otp_code: result.otp_code })
            setStep(4)
        } catch (e: any) {
            if (e.message !== "NO_TOKEN") alert(e.message)
        }
        finally { setLoading(false) }
    }

    const handleConfirm = async () => {
        if (!created || !token || !booking.salon) return
        setOtpError("")
        setLoading(true)
        try {
            await apiFetch(`/salons/${booking.salon.id}/appointments/${created.id}/confirm`, {
                method: "POST", token, body: { otp_code: otp }
            })
            setConfirmed(true)
        } catch (e: any) { setOtpError("Невірний код підтвердження") }
        finally { setLoading(false) }
    }

    const prog = (step / (STEPS.length - 1)) * 100

    if (confirmed) return (
        <div className="mob-page">
            <div className="mob-hero mob-hero-client" style={{ alignItems: "center", textAlign: "center" }}>
                <CheckCircle size={48} style={{ color: "#10b981", margin: "0 auto 12px" }} />
                <div className="mob-hero-title">Запис підтверджено!</div>
                <div className="mob-hero-sub" style={{ marginTop: 8 }}>Чекаємо вас!</div>
            </div>
            <Link href="/client/bookings" className="mob-btn-primary" style={{ background: "linear-gradient(135deg,#8b5cf6,#6d28d9)" }}>
                Мої записи
            </Link>
            <Link href="/client/dashboard" className="mob-btn-secondary">На головну</Link>
        </div>
    )

    return (
        <div className="mob-page">
            {/* Progress bar */}
            <div>
                <div className="flex justify-between mb-1">
                    {STEPS.map((s, i) => (
                        <span key={s} style={{ fontSize: 9, color: i === step ? "#8b5cf6" : "var(--mob-muted)", fontWeight: i === step ? 700 : 400 }}>{s}</span>
                    ))}
                </div>
                <div style={{ height: 3, background: "var(--mob-border)", borderRadius: 4 }}>
                    <div style={{ height: "100%", width: `${prog}%`, background: "linear-gradient(90deg,#8b5cf6,#a78bfa)", borderRadius: 4, transition: "width 0.3s" }} />
                </div>
            </div>

            {/* Step 0: Choose Salon */}
            {step === 0 && (
                <div className="mob-card">
                    <div className="mob-section-title">Оберіть салон</div>
                    {salons.map(s => (
                        <button key={s.id} className="mob-list-row" style={{ background: booking.salon?.id === s.id ? "rgba(139,92,246,0.1)" : "transparent", border: "none", cursor: "pointer", width: "100%", textAlign: "left", borderRadius: 12 }}
                            onClick={() => { setBooking(b => ({ ...b, salon: s, service: null, staff: null, slot: null })); setStep(1) }}>
                            <div className="mob-list-icon" style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)", fontSize: 20 }}>💆</div>
                            <div>
                                <div className="mob-list-title">{s.name}</div>
                                <div className="mob-list-sub">{s.address}</div>
                            </div>
                            <ChevronRight size={14} style={{ color: "var(--mob-muted)", marginLeft: "auto" }} />
                        </button>
                    ))}
                </div>
            )}

            {/* Step 1: Choose Service */}
            {step === 1 && (
                <div className="mob-card">
                    <div className="mob-section-title">Оберіть послугу</div>
                    {loading ? <div className="mob-empty"><Loader2 size={20} style={{ color: "var(--mob-muted)" }} className="animate-spin" /></div> :
                        services.map(s => (
                            <button key={s.id} className="mob-list-row" style={{ background: "transparent", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
                                onClick={() => { setBooking(b => ({ ...b, service: s })); setStep(2) }}>
                                <div className="mob-list-icon" style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)", fontSize: 18 }}>✂️</div>
                                <div>
                                    <div className="mob-list-title">{s.name}</div>
                                    <div className="mob-list-sub"><Clock size={10} /> {s.duration_minutes} хв</div>
                                </div>
                                <div className="mob-list-right">
                                    <div style={{ fontSize: 15, fontWeight: 700, color: "#f43f5e" }}>{s.price} ₴</div>
                                </div>
                            </button>
                        ))
                    }
                </div>
            )}

            {/* Step 2: Choose Staff */}
            {step === 2 && (
                <div className="mob-card">
                    <div className="mob-section-title">Оберіть майстра</div>
                    <button className="mob-list-row" style={{ background: "transparent", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
                        onClick={() => { setBooking(b => ({ ...b, staff: null })); setStep(3) }}>
                        <div className="mob-list-icon" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", fontSize: 18 }}>✨</div>
                        <div><div className="mob-list-title">Будь-який вільний</div><div className="mob-list-sub">Автоматичний вибір</div></div>
                    </button>
                    {staffList.map(s => (
                        <button key={s.id} className="mob-list-row" style={{ background: "transparent", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}
                            onClick={() => { setBooking(b => ({ ...b, staff: s })); setStep(3) }}>
                            <div className="mob-list-icon" style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)", fontSize: 18, fontWeight: 700, color: "#a78bfa" }}>{s.first_name[0]}</div>
                            <div><div className="mob-list-title">{s.first_name} {s.last_name}</div></div>
                        </button>
                    ))}
                </div>
            )}

            {/* Step 3: Choose Date/Time */}
            {step === 3 && (
                <div className="mob-card">
                    <div className="mob-section-title">Оберіть дату та час</div>
                    <input type="date" className="crm-input"
                        min={new Date().toISOString().split("T")[0]}
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                        style={{ marginBottom: 12 }} />
                    {loading ? <div className="mob-empty"><Loader2 size={20} className="animate-spin" style={{ color: "var(--mob-muted)" }} /></div> :
                        slots.length === 0 && selectedDate ? <div className="mob-empty"><div className="mob-empty-title">Немає вільних слотів</div><div className="mob-empty-sub">Спробуйте іншу дату</div></div> :
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                                {slots.map(sl => (
                                    <button key={sl.start_time}
                                        onClick={() => { setBooking(b => ({ ...b, slot: sl })) }}
                                        style={{
                                            padding: "10px 4px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer",
                                            background: booking.slot?.start_time === sl.start_time ? "linear-gradient(135deg,#8b5cf6,#6d28d9)" : "var(--mob-card)",
                                            color: booking.slot?.start_time === sl.start_time ? "white" : "var(--mob-text)",
                                            border: booking.slot?.start_time === sl.start_time ? "none" : "1px solid var(--mob-border)"
                                        }}>
                                        {new Date(sl.start_time).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}
                                    </button>
                                ))}
                            </div>
                    }
                    {booking.slot && (
                        <button className="mob-btn-primary" style={{ marginTop: 16, background: "linear-gradient(135deg,#8b5cf6,#6d28d9)" }} onClick={handleBook} disabled={loading}>
                            {loading ? <Loader2 size={16} className="animate-spin" /> : <><CalendarPlus size={16} />Записатись</>}
                        </button>
                    )}
                </div>
            )}

            {/* Step 4: OTP Confirmation */}
            {step === 4 && created && (
                <div className="mob-card" style={{ alignItems: "center", textAlign: "center" }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>📲</div>
                    <div className="mob-list-title">Підтвердіть запис</div>
                    <div className="mob-list-sub" style={{ marginBottom: 16 }}>Введіть 6-значний код підтвердження</div>
                    {created.otp_code && (
                        <div style={{ padding: "8px 16px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, marginBottom: 12, fontSize: 13, color: "#10b981" }}>
                            DEV: ваш код — <strong>{created.otp_code}</strong>
                        </div>
                    )}
                    <input
                        type="text" inputMode="numeric" maxLength={6}
                        value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                        placeholder="000000"
                        style={{ textAlign: "center", fontSize: 28, letterSpacing: "0.3em", padding: "12px 16px", background: "var(--mob-surface)", border: "1px solid var(--mob-border)", borderRadius: 12, color: "var(--mob-text)", width: "100%", marginBottom: 8 }}
                    />
                    {otpError && <div style={{ color: "#f43f5e", fontSize: 12, marginBottom: 8 }}>{otpError}</div>}
                    <button className="mob-btn-primary" style={{ background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", marginTop: 8 }} onClick={handleConfirm} disabled={otp.length !== 6 || loading}>
                        {loading ? <Loader2 size={16} className="animate-spin" /> : "Підтвердити"}
                    </button>
                </div>
            )}

            {/* Back button */}
            {step > 0 && step < 4 && (
                <button className="mob-btn-secondary" onClick={() => setStep(s => s - 1)}>
                    <ChevronLeft size={16} />Назад
                </button>
            )}
        </div>
    )
}

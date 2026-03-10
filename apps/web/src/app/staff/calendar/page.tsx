"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { CheckCircle, XCircle, Clock, Loader2, RotateCcw } from "lucide-react"
import apiFetch from "@/lib/api"

interface Appointment {
    id: number
    start_time: string
    end_time: string
    status: string
    client_name: string | null
    service_name: string | null
    notes: string | null
    salon_id: number
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
    NEW: { label: "Новий", color: "#f59e0b", icon: Clock },
    CONFIRMED: { label: "Підтверджено", color: "#10b981", icon: CheckCircle },
    COMPLETED: { label: "Завершено", color: "#6b7280", icon: CheckCircle },
    CANCELED: { label: "Скасовано", color: "#ef4444", icon: XCircle },
    RESCHEDULED: { label: "Перенесено", color: "#8b5cf6", icon: RotateCcw },
    NO_SHOW: { label: "Не з'явився", color: "#f43f5e", icon: XCircle },
}

const DAYS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]

function getDates(offset: number = 0) {
    const today = new Date()
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today)
        d.setDate(today.getDate() + i + offset)
        return d
    })
}

export default function StaffCalendarPage() {
    const { data: session } = useSession()
    const token = (session as any)?.accessToken as string | undefined

    const [weekOffset, setWeekOffset] = useState(0)
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0])
    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [loading, setLoading] = useState(false)
    const [salonId, setSalonId] = useState<number | null>(null)
    const [actioning, setActioning] = useState<number | null>(null)

    const dates = getDates(weekOffset)

    useEffect(() => {
        if (!token) return
        apiFetch("/salons/", { token }).then((salons: any[]) => {
            if (salons.length > 0) setSalonId(salons[0].id)
        })
    }, [token])

    const fetchDay = useCallback(async () => {
        if (!token || !salonId) return
        setLoading(true)
        try {
            const start = new Date(selectedDate + "T00:00:00Z")
            const end = new Date(selectedDate + "T23:59:59Z")
            const data = await apiFetch(
                `/salons/${salonId}/appointments?start_date=${start.toISOString()}&end_date=${end.toISOString()}`,
                { token }
            )
            setAppointments(data)
        } finally { setLoading(false) }
    }, [token, salonId, selectedDate])

    useEffect(() => { fetchDay() }, [fetchDay])

    const changeStatus = async (appt: Appointment, newStatus: string) => {
        if (!salonId || !token) return
        setActioning(appt.id)
        try {
            await apiFetch(`/salons/${salonId}/appointments/${appt.id}/status`, {
                method: "POST", token, body: { status: newStatus }
            })
            fetchDay()
        } finally { setActioning(null) }
    }

    const fmt = (dt: string) => new Date(dt).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })

    return (
        <div className="mob-page">
            {/* Week strip */}
            <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <button onClick={() => setWeekOffset(w => w - 7)} style={{ background: "none", border: "1px solid var(--mob-border)", borderRadius: 8, padding: "4px 10px", color: "var(--mob-muted)", cursor: "pointer", fontSize: 12 }}>← Назад</button>
                    <span style={{ fontSize: 12, color: "var(--mob-muted)", alignSelf: "center" }}>Тиждень</span>
                    <button onClick={() => setWeekOffset(w => w + 7)} style={{ background: "none", border: "1px solid var(--mob-border)", borderRadius: 8, padding: "4px 10px", color: "var(--mob-muted)", cursor: "pointer", fontSize: 12 }}>Вперед →</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
                    {dates.map(d => {
                        const iso = d.toISOString().split("T")[0]
                        const isSelected = iso === selectedDate
                        const isToday = iso === new Date().toISOString().split("T")[0]
                        return (
                            <button key={iso} onClick={() => setSelectedDate(iso)}
                                style={{
                                    padding: "8px 0", borderRadius: 10, border: "1px solid var(--mob-border)", cursor: "pointer", textAlign: "center",
                                    background: isSelected ? "linear-gradient(135deg,#8b5cf6,#6d28d9)" : "var(--mob-card)",
                                    color: isSelected ? "white" : isToday ? "#8b5cf6" : "var(--mob-text)"
                                }}>
                                <div style={{ fontSize: 9, fontWeight: 600, marginBottom: 2 }}>{DAYS[d.getDay()]}</div>
                                <div style={{ fontSize: 14, fontWeight: 700 }}>{d.getDate()}</div>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Appointments for day */}
            <div className="mob-section-title" style={{ marginTop: 4 }}>
                {new Date(selectedDate).toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" })}
                {" — "}{loading ? "..." : `${appointments.length} записів`}
            </div>

            {loading ? (
                <div className="mob-empty"><Loader2 size={22} className="animate-spin" style={{ color: "var(--mob-muted)" }} /></div>
            ) : appointments.length === 0 ? (
                <div className="mob-empty">
                    <div className="mob-empty-icon">📅</div>
                    <div className="mob-empty-title">Записів немає</div>
                    <div className="mob-empty-sub">На цей день вільно</div>
                </div>
            ) : (
                appointments.map(a => {
                    const st = STATUS_MAP[a.status] ?? { label: a.status, color: "#fff", icon: Clock }
                    const Icon = st.icon
                    return (
                        <div key={a.id} className="mob-card" style={{ borderLeft: `3px solid ${st.color}`, gap: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--mob-text)" }}>
                                    {fmt(a.start_time)} – {fmt(a.end_time)}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: st.color, fontWeight: 600 }}>
                                    <Icon size={12} />{st.label}
                                </div>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--mob-text)" }}>👤 {a.client_name ?? "Клієнт"}</div>
                            <div style={{ fontSize: 12, color: "var(--mob-muted)" }}>✂️ {a.service_name ?? "Послуга"}</div>
                            {a.notes && <div style={{ fontSize: 11, color: "var(--mob-muted)", fontStyle: "italic" }}>📝 {a.notes}</div>}

                            {/* Action buttons */}
                            {a.status === "CONFIRMED" && (
                                <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                                    <button onClick={() => changeStatus(a, "COMPLETED")} disabled={actioning === a.id}
                                        style={{ flex: 1, padding: "7px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "rgba(16,185,129,0.15)", color: "#10b981" }}>
                                        {actioning === a.id ? <Loader2 size={12} className="animate-spin" /> : "✓ Завершити"}
                                    </button>
                                    <button onClick={() => changeStatus(a, "NO_SHOW")} disabled={actioning === a.id}
                                        style={{ flex: 1, padding: "7px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "rgba(244,63,94,0.1)", color: "#f43f5e" }}>
                                        Не з'явився
                                    </button>
                                </div>
                            )}
                            {a.status === "NEW" && (
                                <button onClick={() => changeStatus(a, "CONFIRMED")} disabled={actioning === a.id}
                                    style={{ padding: "7px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>
                                    Підтвердити запис
                                </button>
                            )}
                        </div>
                    )
                })
            )}
        </div>
    )
}

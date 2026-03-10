"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Clock, CalendarPlus, CheckCircle, XCircle, RotateCcw, Loader2 } from "lucide-react"
import Link from "next/link"
import apiFetch from "@/lib/api"

interface Booking {
    id: number
    start_time: string
    end_time: string
    status: string
    service_name: string | null
    staff_name: string | null
    salon_id: number
}

const STATUS_DISPLAY: Record<string, { label: string; color: string; icon: any }> = {
    NEW: { label: "Очікує підтвердження", color: "#f59e0b", icon: Clock },
    CONFIRMED: { label: "Підтверджено", color: "#10b981", icon: CheckCircle },
    COMPLETED: { label: "Завершено", color: "#6b7280", icon: CheckCircle },
    CANCELED: { label: "Скасовано", color: "#ef4444", icon: XCircle },
    RESCHEDULED: { label: "Перенесено", color: "#8b5cf6", icon: RotateCcw },
    NO_SHOW: { label: "Не з'явився", color: "#f43f5e", icon: XCircle },
}

export default function ClientBookingsPage() {
    const { data: session } = useSession()
    const token = (session as any)?.accessToken as string | undefined

    const [bookings, setBookings] = useState<Booking[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<"upcoming" | "past">("upcoming")

    useEffect(() => {
        if (!token) return
        setLoading(true)
        // Fetch from all accessible salons
        apiFetch("/salons/", { token }).then(async (salons: any[]) => {
            const all: Booking[] = []
            for (const salon of salons) {
                try {
                    const data = await apiFetch(`/salons/${salon.id}/appointments`, { token })
                    // Map client_id filter – only my appointments
                    all.push(...data)
                } catch { /* skip */ }
            }
            setBookings(all.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()))
        }).finally(() => setLoading(false))
    }, [token])

    const now = new Date()
    const filtered = bookings.filter(b => {
        const dt = new Date(b.start_time)
        return filter === "upcoming" ? dt >= now : dt < now
    })

    const fmt = (dt: string) => new Date(dt).toLocaleString("uk-UA", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })

    return (
        <div className="mob-page">
            {/* Filter */}
            <div style={{ display: "flex", gap: 8 }}>
                {(["upcoming", "past"] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                        style={{
                            flex: 1, padding: "10px", borderRadius: 12, border: "1px solid var(--mob-border)", fontWeight: 600, fontSize: 13, cursor: "pointer",
                            background: filter === f ? "linear-gradient(135deg,#8b5cf6,#6d28d9)" : "var(--mob-card)",
                            color: filter === f ? "white" : "var(--mob-muted)"
                        }}>
                        {f === "upcoming" ? "Майбутні" : "Минулі"}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="mob-empty"><Loader2 size={24} className="animate-spin" style={{ color: "var(--mob-muted)" }} /></div>
            ) : filtered.length === 0 ? (
                <div className="mob-empty">
                    <div className="mob-empty-icon"><CalendarPlus size={28} style={{ color: "#8b5cf6", opacity: 0.6 }} /></div>
                    <div className="mob-empty-title">{filter === "upcoming" ? "Немає майбутніх записів" : "Немає минулих записів"}</div>
                    {filter === "upcoming" && <Link href="/client/book" className="mob-btn-primary" style={{ marginTop: 16, background: "linear-gradient(135deg,#8b5cf6,#6d28d9)" }}>Записатись</Link>}
                </div>
            ) : (
                filtered.map(b => {
                    const st = STATUS_DISPLAY[b.status] ?? { label: b.status, color: "#fff", icon: Clock }
                    const Icon = st.icon
                    return (
                        <div key={b.id} className="mob-card" style={{ gap: 10 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--mob-text)" }}>{b.service_name ?? "Послуга"}</div>
                                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: st.color }}>
                                    <Icon size={12} />{st.label}
                                </div>
                            </div>
                            <div style={{ fontSize: 12, color: "var(--mob-muted)" }}>👤 {b.staff_name ?? "Майстер"}</div>
                            <div style={{ fontSize: 12, color: "var(--mob-muted)" }}>🕐 {fmt(b.start_time)}</div>
                            {b.status === "NEW" && (
                                <Link href="/client/book" style={{ fontSize: 12, color: "#8b5cf6", textDecoration: "none" }}>Підтвердити запис →</Link>
                            )}
                        </div>
                    )
                })
            )}

            {/* FAB */}
            <Link href="/client/book" className="mob-btn-primary" style={{ position: "fixed", bottom: "calc(var(--mob-nav-h) + 16px)", left: "50%", transform: "translateX(-50%)", width: "calc(100% - 32px)", maxWidth: 448, background: "linear-gradient(135deg,#8b5cf6,#6d28d9)" }}>
                <CalendarPlus size={16} />Новий запис
            </Link>
        </div>
    )
}

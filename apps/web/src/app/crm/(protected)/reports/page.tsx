"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { BarChart2, TrendingUp, Users, Calendar, CreditCard, Loader2 } from "lucide-react"
import apiFetch from "@/lib/api"

interface Salon { id: number; name: string }

interface Stats {
    total_appointments: number
    confirmed: number
    completed: number
    canceled: number
    no_show: number
    total_revenue: number
    avg_check: number
    new_clients: number
}

export default function ReportsPage() {
    const { data: session } = useSession()
    const token = (session as any)?.accessToken as string | undefined

    const [salons, setSalons] = useState<Salon[]>([])
    const [salonId, setSalonId] = useState<number | null>(null)
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(false)
    const [period, setPeriod] = useState<"week" | "month" | "year">("month")

    useEffect(() => {
        if (!token) return
        apiFetch("/salons/", { token }).then((s: Salon[]) => {
            setSalons(s)
            if (s.length > 0) setSalonId(s[0].id)
        })
    }, [token])

    useEffect(() => {
        if (!token || !salonId) return
        setLoading(true)
        // Build date range
        const now = new Date()
        const start = new Date(now)
        if (period === "week") start.setDate(now.getDate() - 7)
        else if (period === "month") start.setMonth(now.getMonth() - 1)
        else start.setFullYear(now.getFullYear() - 1)

        // Fetch appointments and compute stats client-side
        apiFetch(`/salons/${salonId}/appointments?start_date=${start.toISOString()}&end_date=${now.toISOString()}`, { token })
            .then((appts: any[]) => {
                const completed = appts.filter(a => a.status === "COMPLETED")
                const revenue = completed.reduce((s: number, a: any) => s + (a.service_price ?? 0), 0)
                setStats({
                    total_appointments: appts.length,
                    confirmed: appts.filter(a => a.status === "CONFIRMED").length,
                    completed: completed.length,
                    canceled: appts.filter(a => a.status === "CANCELED").length,
                    no_show: appts.filter(a => a.status === "NO_SHOW").length,
                    total_revenue: revenue,
                    avg_check: completed.length > 0 ? revenue / completed.length : 0,
                    new_clients: new Set(appts.map(a => a.client_id)).size,
                })
            })
            .finally(() => setLoading(false))
    }, [token, salonId, period])

    const kpis = stats ? [
        { label: "Усього записів", value: stats.total_appointments, icon: Calendar, color: "#8b5cf6" },
        { label: "Завершено", value: stats.completed, icon: TrendingUp, color: "#10b981" },
        { label: "Скасовано", value: stats.canceled, icon: BarChart2, color: "#f43f5e" },
        { label: "Не з'явились", value: stats.no_show, icon: Users, color: "#f59e0b" },
        { label: "Виручка", value: `${stats.total_revenue.toFixed(0)} ₴`, icon: CreditCard, color: "#3b82f6" },
        { label: "Середній чек", value: `${stats.avg_check.toFixed(0)} ₴`, icon: CreditCard, color: "#06b6d4" },
        { label: "Унікальних клієнтів", value: stats.new_clients, icon: Users, color: "#ec4899" },
        { label: "Підтверджено", value: stats.confirmed, icon: TrendingUp, color: "#8b5cf6" },
    ] : []

    const convRate = stats && stats.total_appointments > 0
        ? ((stats.completed / stats.total_appointments) * 100).toFixed(1)
        : "0"
    const cancelRate = stats && stats.total_appointments > 0
        ? ((stats.canceled / stats.total_appointments) * 100).toFixed(1)
        : "0"

    return (
        <div className="crm-page">
            <div className="crm-page-header">
                <div>
                    <h1 className="crm-page-title">Звіти та аналітика</h1>
                    <p className="crm-page-sub">Ключові показники бізнесу</p>
                </div>
                <div className="flex items-center gap-3">
                    {salons.length > 1 && (
                        <select className="crm-input" style={{ padding: "7px 12px", width: "auto" }}
                            value={salonId ?? ""} onChange={e => setSalonId(Number(e.target.value))}>
                            {salons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    )}
                    <div className="flex gap-1" style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: 3 }}>
                        {(["week", "month", "year"] as const).map(p => (
                            <button key={p} onClick={() => setPeriod(p)}
                                style={{
                                    padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                                    background: period === p ? "rgba(139,92,246,0.3)" : "transparent",
                                    color: period === p ? "#c4b5fd" : "rgba(255,255,255,0.4)"
                                }}>
                                {p === "week" ? "Тиждень" : p === "month" ? "Місяць" : "Рік"}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20 text-white/30">
                    <Loader2 size={20} className="animate-spin mr-2" />Завантаження...
                </div>
            ) : (
                <>
                    {/* KPI grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {kpis.map(k => {
                            const Icon = k.icon
                            return (
                                <div key={k.label} className="crm-card" style={{ gap: 8 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${k.color}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <Icon size={16} style={{ color: k.color }} />
                                        </div>
                                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{k.label}</span>
                                    </div>
                                    <div style={{ fontSize: 24, fontWeight: 800, color: "white" }}>{k.value}</div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Conversion metrics */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="crm-card" style={{ gap: 10 }}>
                            <div className="crm-card-label">Конверсія запис → завершення</div>
                            <div style={{ fontSize: 36, fontWeight: 800, color: "#10b981" }}>{convRate}%</div>
                            <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 4 }}>
                                <div style={{ height: "100%", width: `${convRate}%`, background: "linear-gradient(90deg,#10b981,#059669)", borderRadius: 4, transition: "width 0.8s" }} />
                            </div>
                        </div>
                        <div className="crm-card" style={{ gap: 10 }}>
                            <div className="crm-card-label">Рівень скасувань</div>
                            <div style={{ fontSize: 36, fontWeight: 800, color: "#f43f5e" }}>{cancelRate}%</div>
                            <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 4 }}>
                                <div style={{ height: "100%", width: `${cancelRate}%`, background: "linear-gradient(90deg,#f43f5e,#e11d48)", borderRadius: 4, transition: "width 0.8s" }} />
                            </div>
                        </div>
                    </div>

                    {/* Status breakdown */}
                    {stats && (
                        <div className="crm-card" style={{ gap: 12 }}>
                            <div className="crm-card-label">Розподіл за статусом</div>
                            {[
                                { label: "Завершено", value: stats.completed, color: "#10b981" },
                                { label: "Підтверджено", value: stats.confirmed, color: "#8b5cf6" },
                                { label: "Скасовано", value: stats.canceled, color: "#f43f5e" },
                                { label: "Не з'явився", value: stats.no_show, color: "#f59e0b" },
                            ].map(row => (
                                <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <div style={{ width: 100, fontSize: 12, color: "rgba(255,255,255,0.5)", flexShrink: 0 }}>{row.label}</div>
                                    <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4 }}>
                                        <div style={{ height: "100%", width: stats.total_appointments > 0 ? `${(row.value / stats.total_appointments) * 100}%` : "0%", background: row.color, borderRadius: 4, transition: "width 0.8s" }} />
                                    </div>
                                    <div style={{ width: 32, fontSize: 13, fontWeight: 700, color: "white", textAlign: "right" }}>{row.value}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

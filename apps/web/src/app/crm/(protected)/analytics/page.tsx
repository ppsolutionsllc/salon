"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { BarChart3, TrendingUp, Users, Scissors, DollarSign, Loader2 } from "lucide-react"
import apiFetch from "@/lib/api"

interface Salon { id: number; name: string }
interface Appointment {
    id: number; status: string; start_time: string
    client_id: number; staff_id: number; service_id: number
}
interface StaffMember { id: number; first_name: string; last_name: string }
interface Client { id: number; first_name: string; last_name: string | null }

export default function AnalyticsPage() {
    const { data: session } = useSession()
    const token = (session as any)?.accessToken as string | undefined

    const [salons, setSalons] = useState<Salon[]>([])
    const [salonId, setSalonId] = useState<number | null>(null)
    const [appts, setAppts] = useState<Appointment[]>([])
    const [staff, setStaff] = useState<StaffMember[]>([])
    const [clients, setClients] = useState<Client[]>([])
    const [loading, setLoading] = useState(false)
    const [period, setPeriod] = useState<"week" | "month">("month")

    const fetchSalons = useCallback(async () => {
        if (!token) return
        const data = await apiFetch("/salons/", { token })
        setSalons(data)
        if (data.length > 0) setSalonId(data[0].id)
    }, [token])

    const fetchData = useCallback(async () => {
        if (!token || !salonId) return
        setLoading(true)
        try {
            const now = new Date()
            const start = new Date(now)
            if (period === "week") start.setDate(start.getDate() - 7)
            else start.setDate(start.getDate() - 30)
            start.setHours(0, 0, 0, 0)
            now.setHours(23, 59, 59, 999)

            const [apptsData, staffData, clientsData] = await Promise.all([
                apiFetch(`/salons/${salonId}/appointments?start_date=${start.toISOString()}&end_date=${now.toISOString()}`, { token })
                    .catch(() => []),
                apiFetch(`/salons/${salonId}/staff`, { token }).catch(() => []),
                apiFetch(`/salons/${salonId}/clients`, { token }).catch(() => []),
            ])
            setAppts(apptsData)
            setStaff(staffData)
            setClients(clientsData)
        } finally { setLoading(false) }
    }, [token, salonId, period])

    useEffect(() => { fetchSalons() }, [fetchSalons])
    useEffect(() => { if (salonId) fetchData() }, [salonId, period, fetchData])

    // Computed stats
    const total = appts.length
    const confirmed = appts.filter(a => a.status === "CONFIRMED").length
    const completed = appts.filter(a => a.status === "COMPLETED").length
    const canceled = appts.filter(a => a.status === "CANCELED").length
    const conversionRate = total > 0 ? Math.round((completed / total) * 100) : 0

    // Top master by appointments
    const staffCounts: Record<number, number> = {}
    appts.forEach(a => { staffCounts[a.staff_id] = (staffCounts[a.staff_id] ?? 0) + 1 })
    const topStaffId = Object.entries(staffCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
    const topStaff = staff.find(s => s.id === Number(topStaffId))

    const uniqueClients = new Set(appts.map(a => a.client_id)).size

    const KPI = [
        { icon: BarChart3, label: "Всього записів", value: total, color: "#f43f5e", sub: `+${confirmed} підтверджено` },
        { icon: TrendingUp, label: "Конверсія", value: `${conversionRate}%`, color: "#10b981", sub: `${completed} завершено` },
        { icon: Users, label: "Унікальних клієнтів", value: uniqueClients, color: "#8b5cf6", sub: `з ${clients.length} у базі` },
        { icon: Scissors, label: "Скасовано", value: canceled, color: "#f59e0b", sub: `${total > 0 ? Math.round((canceled / total) * 100) : 0}% від загалу` },
    ]

    return (
        <div className="crm-page">
            <div className="crm-page-header">
                <div>
                    <h1 className="crm-page-title">Аналітика</h1>
                    <p className="crm-page-sub">Показники ефективності</p>
                </div>
                <div className="flex items-center gap-3">
                    {salons.length > 1 && (
                        <select className="crm-input" style={{ padding: "7px 12px", width: "auto" }}
                            value={salonId ?? ""} onChange={e => setSalonId(Number(e.target.value))}>
                            {salons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    )}
                    <div className="flex rounded-lg overflow-hidden border border-white/10">
                        {(["week", "month"] as const).map(p => (
                            <button key={p} onClick={() => setPeriod(p)}
                                className={`px-3 py-1.5 text-xs font-medium transition-colors ${period === p ? "bg-rose-500/20 text-rose-400" : "text-white/40 hover:text-white/70"}`}>
                                {p === "week" ? "7 днів" : "30 днів"}
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
                    {/* KPI Grid */}
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                        {KPI.map((k, i) => (
                            <div key={i} className="crm-card" style={{ gap: 8 }}>
                                <div className="flex items-center justify-between">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                                        style={{ background: `${k.color}20`, border: `1px solid ${k.color}30` }}>
                                        <k.icon size={16} style={{ color: k.color }} />
                                    </div>
                                    <TrendingUp size={12} className="text-white/20" />
                                </div>
                                <div className="text-2xl font-bold text-white">{k.value}</div>
                                <div className="text-xs font-medium text-white/50">{k.label}</div>
                                <div className="text-xs text-white/25">{k.sub}</div>
                            </div>
                        ))}
                    </div>

                    {/* Summary cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Status breakdown */}
                        <div className="crm-card">
                            <div className="text-sm font-semibold text-white mb-3">Статуси записів</div>
                            {[
                                { status: "CONFIRMED", label: "Підтверджено", val: confirmed },
                                { status: "COMPLETED", label: "Завершено", val: completed },
                                { status: "CANCELED", label: "Скасовано", val: canceled },
                                { status: "NEW", label: "Нові", val: appts.filter(a => a.status === "NEW").length },
                            ].map(row => (
                                <div key={row.status} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                                    <span className="text-white/60 text-sm">{row.label}</span>
                                    <div className="flex items-center gap-3">
                                        <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-rose-500 rounded-full"
                                                style={{ width: total > 0 ? `${Math.round((row.val / total) * 100)}%` : "0%" }} />
                                        </div>
                                        <span className="text-white font-semibold text-sm w-6 text-right">{row.val}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Team summary */}
                        <div className="crm-card">
                            <div className="text-sm font-semibold text-white mb-3">Команда</div>
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-white/50 text-sm">Всього майстрів</span>
                                    <span className="text-white font-semibold">{staff.length}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-white/50 text-sm">Всього клієнтів у базі</span>
                                    <span className="text-white font-semibold">{clients.length}</span>
                                </div>
                                {topStaff && (
                                    <div className="mt-2 pt-3 border-t border-white/5">
                                        <div className="text-xs text-white/30 mb-1">Найбільше записів</div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-xs font-bold text-rose-400">
                                                {topStaff.first_name[0]}{topStaff.last_name[0]}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-white">{topStaff.first_name} {topStaff.last_name}</div>
                                                <div className="text-xs text-white/30">{staffCounts[Number(topStaffId)]} записів</div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {!topStaff && staff.length === 0 && (
                                    <div className="text-center py-4 text-white/20 text-xs">Додайте майстрів у розділі Персонал</div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

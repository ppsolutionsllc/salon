"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { ArrowLeft, Calendar, Phone, Mail, FileText, Tag, Clock } from "lucide-react"
import Link from "next/link"
import apiFetch from "@/lib/api"
import { useParams } from "next/navigation"

interface Client {
    id: number; first_name: string; last_name: string | null
    phone: string; email: string | null; notes: string | null; created_at: string
    tags?: { tag: { name: string; color: string } }[]
}
interface Appointment {
    id: number; start_time: string; status: string; service_name: string | null; staff_name: string | null; service_price: number | null
}

const STATUS_MAP: Record<string, string> = {
    NEW: "#f59e0b", CONFIRMED: "#10b981", COMPLETED: "#6b7280",
    CANCELED: "#ef4444", RESCHEDULED: "#8b5cf6", NO_SHOW: "#f43f5e"
}
const STATUS_LABEL: Record<string, string> = {
    NEW: "Новий", CONFIRMED: "Підтверджено", COMPLETED: "Завершено",
    CANCELED: "Скасовано", RESCHEDULED: "Перенесено", NO_SHOW: "Не з'явився"
}

export default function ClientDetailPage() {
    const { data: session } = useSession()
    const token = (session as any)?.accessToken as string | undefined
    const params = useParams()
    const clientId = params?.id as string
    const [salonId, setSalonId] = useState<number | null>(null)
    const [client, setClient] = useState<Client | null>(null)
    const [appts, setAppts] = useState<Appointment[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!token) return
        apiFetch("/salons/", { token }).then((salons: any[]) => {
            if (salons.length > 0) setSalonId(salons[0].id)
        })
    }, [token])

    useEffect(() => {
        if (!token || !salonId || !clientId) return
        setLoading(true)
        Promise.all([
            apiFetch(`/salons/${salonId}/clients/${clientId}`, { token }),
            apiFetch(`/salons/${salonId}/appointments`, { token })
        ]).then(([clientData, allAppts]) => {
            setClient(clientData)
            setAppts(allAppts.filter((a: any) => a.client_id === parseInt(clientId)))
        }).finally(() => setLoading(false))
    }, [token, salonId, clientId])

    const totalRevenue = appts.filter(a => a.status === "COMPLETED").reduce((s, a) => s + (a.service_price ?? 0), 0)
    const visitCount = appts.filter(a => a.status === "COMPLETED").length

    if (loading) return <div className="crm-page"><div className="flex items-center justify-center py-20 text-white/30"><div className="animate-spin mr-2">⏳</div>Завантаження...</div></div>
    if (!client) return <div className="crm-page"><div className="crm-card text-white/40 text-center py-20">Клієнта не знайдено</div></div>

    return (
        <div className="crm-page">
            <div className="crm-page-header">
                <div className="flex items-center gap-3">
                    <Link href="/crm/clients" className="crm-icon-btn"><ArrowLeft size={16} /></Link>
                    <div>
                        <h1 className="crm-page-title">{client.first_name} {client.last_name ?? ""}</h1>
                        <p className="crm-page-sub">Профіль клієнта</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Left: info */}
                <div className="md:col-span-1 flex flex-col gap-4">
                    {/* Avatar card */}
                    <div className="crm-card items-center text-center" style={{ gap: 10 }}>
                        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800, color: "white" }}>
                            {client.first_name[0]}
                        </div>
                        <div className="font-bold text-white">{client.first_name} {client.last_name ?? ""}</div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <div className="crm-kpi" style={{ flex: 1 }}>
                                <div className="crm-kpi-value" style={{ fontSize: 18 }}>{visitCount}</div>
                                <div className="crm-kpi-label">Візитів</div>
                            </div>
                            <div className="crm-kpi" style={{ flex: 1 }}>
                                <div className="crm-kpi-value" style={{ fontSize: 18 }}>{totalRevenue.toFixed(0)} ₴</div>
                                <div className="crm-kpi-label">Виручка</div>
                            </div>
                        </div>
                    </div>
                    {/* Contact */}
                    <div className="crm-card" style={{ gap: 10 }}>
                        <div className="crm-card-label">Контакти</div>
                        <div className="flex items-center gap-2 text-sm text-white/70"><Phone size={14} className="text-white/30" />{client.phone}</div>
                        {client.email && <div className="flex items-center gap-2 text-sm text-white/70"><Mail size={14} className="text-white/30" />{client.email}</div>}
                        <div className="flex items-center gap-2 text-sm text-white/40"><Calendar size={14} />Клієнт з {new Date(client.created_at).toLocaleDateString("uk-UA")}</div>
                    </div>
                    {/* Notes */}
                    {client.notes && (
                        <div className="crm-card" style={{ gap: 8 }}>
                            <div className="crm-card-label flex items-center gap-2"><FileText size={12} />Нотатки</div>
                            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{client.notes}</div>
                        </div>
                    )}
                </div>

                {/* Right: appointments */}
                <div className="md:col-span-2 flex flex-col gap-4">
                    <div className="crm-page-title" style={{ fontSize: 14 }}>Записи ({appts.length})</div>
                    {appts.length === 0 ? (
                        <div className="crm-card items-center py-12 text-center">
                            <Clock size={28} className="opacity-20 mb-2" />
                            <div className="text-white/40 text-sm">Записів ще немає</div>
                        </div>
                    ) : appts.map(a => (
                        <div key={a.id} className="crm-card" style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                            <div style={{ width: 4, height: 40, borderRadius: 4, background: STATUS_MAP[a.status] ?? "#888", flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="font-semibold text-white text-sm">{a.service_name ?? "Послуга"}</div>
                                <div className="text-xs text-white/40 mt-0.5">👤 {a.staff_name} · {new Date(a.start_time).toLocaleDateString("uk-UA")}</div>
                            </div>
                            <div className="text-right" style={{ flexShrink: 0 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: STATUS_MAP[a.status] }}>{STATUS_LABEL[a.status]}</div>
                                {a.service_price && <div className="text-xs text-white/40 mt-0.5">{a.service_price} ₴</div>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

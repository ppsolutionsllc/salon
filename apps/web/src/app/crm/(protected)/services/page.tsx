"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Plus, Scissors, Clock, DollarSign, Loader2, X, Search } from "lucide-react"
import apiFetch from "@/lib/api"

interface Salon { id: number; name: string }
interface Service {
    id: number; salon_id: number; name: string
    description: string | null; duration_minutes: number
    price: number; buffer_before: number; buffer_after: number
    category_id: number | null
}

const PASTEL = ["#f43f5e", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#06b6d4"]
const pc = (i: number) => PASTEL[i % PASTEL.length]

export default function ServicesPage() {
    const { data: session } = useSession()
    const token = (session as any)?.accessToken as string | undefined

    const [salons, setSalons] = useState<Salon[]>([])
    const [salonId, setSalonId] = useState<number | null>(null)
    const [services, setServices] = useState<Service[]>([])
    const [loading, setLoading] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState({ name: "", description: "", duration_minutes: 60, price: 0, buffer_before: 0, buffer_after: 0 })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [search, setSearch] = useState("")

    const fetchSalons = useCallback(async () => {
        if (!token) return
        const data = await apiFetch("/salons/", { token })
        setSalons(data)
        if (data.length > 0) setSalonId(data[0].id)
    }, [token])

    const fetchServices = useCallback(async () => {
        if (!token || !salonId) return
        setLoading(true)
        try {
            const data = await apiFetch(`/salons/${salonId}/services`, { token })
            setServices(data)
        } finally { setLoading(false) }
    }, [token, salonId])

    useEffect(() => { fetchSalons() }, [fetchSalons])
    useEffect(() => { if (salonId) fetchServices() }, [salonId, fetchServices])

    const handleSave = async () => {
        setSaving(true); setError("")
        try {
            await apiFetch(`/salons/${salonId}/services`, {
                method: "POST",
                body: { ...form, duration_minutes: Number(form.duration_minutes), price: Number(form.price) },
                token
            })
            setModalOpen(false)
            setForm({ name: "", description: "", duration_minutes: 60, price: 0, buffer_before: 0, buffer_after: 0 })
            fetchServices()
        } catch (e: any) { setError(e.message) }
        finally { setSaving(false) }
    }

    const filtered = services.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))

    const formatDuration = (mins: number) => {
        if (mins < 60) return `${mins} хв`
        return `${Math.floor(mins / 60)} год ${mins % 60 > 0 ? `${mins % 60} хв` : ""}`
    }

    return (
        <div className="crm-page">
            <div className="crm-page-header">
                <div>
                    <h1 className="crm-page-title">Послуги</h1>
                    <p className="crm-page-sub">Каталог послуг салону</p>
                </div>
                <div className="flex items-center gap-3">
                    {salons.length > 1 && (
                        <select className="crm-input" style={{ padding: "7px 12px", width: "auto" }}
                            value={salonId ?? ""} onChange={e => setSalonId(Number(e.target.value))}>
                            {salons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    )}
                    <button onClick={() => { setModalOpen(true); setError("") }} className="crm-btn-primary-sm">
                        <Plus size={14} className="inline mr-1" />Додати послугу
                    </button>
                </div>
            </div>

            <div className="relative max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                <input className="crm-input" style={{ paddingLeft: 32 }} placeholder="Пошук послуги..."
                    value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20 text-white/30">
                    <Loader2 size={20} className="animate-spin mr-2" />Завантаження...
                </div>
            ) : !salonId ? (
                <div className="crm-card items-center justify-center py-16 text-center">
                    <div className="text-white/40 text-sm">Спочатку створіть салон</div>
                </div>
            ) : (
                <>
                    {/* Summary bar */}
                    <div className="flex items-center gap-4 text-xs text-white/40">
                        <span>{filtered.length} послуг</span>
                        {filtered.length > 0 && (
                            <span>Середня ціна: ₴ {Math.round(filtered.reduce((s, v) => s + v.price, 0) / filtered.length).toLocaleString()}</span>
                        )}
                    </div>

                    <div className="crm-card" style={{ gap: 0 }}>
                        <div className="crm-table">
                            <div className="crm-table-head" style={{ gridTemplateColumns: "1fr 100px 100px 120px" }}>
                                <div>Послуга</div><div>Тривалість</div><div>Ціна</div><div>Буфер до/після</div>
                            </div>
                            {filtered.length === 0 && (
                                <div className="text-center py-12">
                                    <Scissors size={32} className="opacity-20 mb-2 mx-auto" />
                                    <div className="text-white/40 text-sm">{search ? "Нічого не знайдено" : "Додайте першу послугу"}</div>
                                </div>
                            )}
                            {filtered.map((s, i) => (
                                <div key={s.id} className="crm-table-row" style={{ gridTemplateColumns: "1fr 100px 100px 120px" }}>
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                            style={{ background: `${pc(i)}22`, border: `1px solid ${pc(i)}44` }}>
                                            <Scissors size={12} style={{ color: pc(i) }} />
                                        </div>
                                        <div>
                                            <div className="crm-table-strong">{s.name}</div>
                                            {s.description && <div className="text-xs text-white/30 truncate max-w-[200px]">{s.description}</div>}
                                        </div>
                                    </div>
                                    <div className="crm-table-muted flex items-center gap-1">
                                        <Clock size={11} />{formatDuration(s.duration_minutes)}
                                    </div>
                                    <div className="text-emerald-400 font-semibold text-sm flex items-center gap-1">
                                        <DollarSign size={11} />₴ {s.price.toLocaleString()}
                                    </div>
                                    <div className="crm-table-muted text-xs">
                                        {s.buffer_before}хв / {s.buffer_after}хв
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {modalOpen && (
                <div className="crm-modal-overlay" onClick={() => setModalOpen(false)}>
                    <div className="crm-modal" onClick={e => e.stopPropagation()}>
                        <div className="crm-modal-header">
                            <div className="flex items-center gap-2"><Scissors size={15} />Нова послуга</div>
                            <button className="crm-icon-btn" onClick={() => setModalOpen(false)} style={{ width: 28, height: 28 }}><X size={14} /></button>
                        </div>
                        <div className="crm-modal-body">
                            {error && <div className="p-3 mb-3 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg">{error}</div>}
                            <label className="crm-field-label">Назва *</label>
                            <input className="crm-input mb-4" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Стрижка + укладка" />
                            <label className="crm-field-label">Опис</label>
                            <input className="crm-input mb-4" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Короткий опис..." />
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div>
                                    <label className="crm-field-label">Тривалість (хв)</label>
                                    <input type="number" className="crm-input" value={form.duration_minutes} min={5} step={5}
                                        onChange={e => setForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))} />
                                </div>
                                <div>
                                    <label className="crm-field-label">Ціна (₴)</label>
                                    <input type="number" className="crm-input" value={form.price} min={0}
                                        onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="crm-field-label">Буфер до (хв)</label>
                                    <input type="number" className="crm-input" value={form.buffer_before} min={0} step={5}
                                        onChange={e => setForm(f => ({ ...f, buffer_before: Number(e.target.value) }))} />
                                </div>
                                <div>
                                    <label className="crm-field-label">Буфер після (хв)</label>
                                    <input type="number" className="crm-input" value={form.buffer_after} min={0} step={5}
                                        onChange={e => setForm(f => ({ ...f, buffer_after: Number(e.target.value) }))} />
                                </div>
                            </div>
                        </div>
                        <div className="crm-modal-footer">
                            <button className="crm-btn-ghost" onClick={() => setModalOpen(false)}>Скасувати</button>
                            <button className="crm-btn-primary-sm" onClick={handleSave} disabled={saving || !form.name}>
                                {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}Додати
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

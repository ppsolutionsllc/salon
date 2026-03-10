"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Plus, Building2, MapPin, Clock, Loader2, X, Store } from "lucide-react"
import apiFetch from "@/lib/api"

interface Salon {
    id: number
    name: string
    address: string | null
    timezone: string
}

export default function SalonsPage() {
    const { data: session } = useSession()
    const token = (session as any)?.accessToken as string | undefined

    const [salons, setSalons] = useState<Salon[]>([])
    const [loading, setLoading] = useState(true)
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState({ name: "", address: "", timezone: "Europe/Kiev" })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")

    const fetchSalons = useCallback(async () => {
        if (!token) return
        setLoading(true)
        try {
            const data = await apiFetch("/salons/", { token })
            setSalons(data)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }, [token])

    useEffect(() => { fetchSalons() }, [fetchSalons])

    const handleSave = async () => {
        setSaving(true)
        setError("")
        try {
            await apiFetch("/salons/", { method: "POST", body: form, token })
            setModalOpen(false)
            setForm({ name: "", address: "", timezone: "Europe/Kiev" })
            fetchSalons()
        } catch (e: any) {
            setError(e.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="crm-page">
            <div className="crm-page-header">
                <div>
                    <h1 className="crm-page-title">Салони</h1>
                    <p className="crm-page-sub">Мережа салонів краси</p>
                </div>
                <button onClick={() => { setModalOpen(true); setError("") }} className="crm-btn-primary-sm">
                    <Plus size={14} className="inline mr-1" />Додати салон
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20 text-white/30">
                    <Loader2 size={20} className="animate-spin mr-2" />Завантаження...
                </div>
            ) : salons.length === 0 ? (
                <div className="crm-card items-center justify-center py-16 text-center">
                    <Store size={36} className="opacity-20 mb-3 mx-auto" />
                    <div className="text-white/40 text-sm">Ще немає жодного салону</div>
                    <button onClick={() => setModalOpen(true)} className="crm-btn-primary-sm mt-4">
                        Додати перший салон
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {salons.map(s => (
                        <div key={s.id} className="crm-card" style={{ gap: 12 }}>
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-600/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
                                    <Building2 size={18} className="text-rose-400" />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-semibold text-white text-sm">{s.name}</div>
                                    <div className="text-xs text-white/40 flex items-center gap-1 mt-0.5">
                                        <MapPin size={10} />{s.address ?? "Адреса не вказана"}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-white/30 border-t border-white/5 pt-3">
                                <Clock size={11} />{s.timezone}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modalOpen && (
                <div className="crm-modal-overlay" onClick={() => setModalOpen(false)}>
                    <div className="crm-modal" onClick={e => e.stopPropagation()}>
                        <div className="crm-modal-header">
                            <div className="flex items-center gap-2"><Building2 size={15} />Новий Салон</div>
                            <button className="crm-icon-btn" onClick={() => setModalOpen(false)} style={{ width: 28, height: 28 }}><X size={14} /></button>
                        </div>
                        <div className="crm-modal-body">
                            {error && <div className="p-3 mb-3 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg">{error}</div>}
                            <label className="crm-field-label">Назва</label>
                            <input className="crm-input mb-4" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Salon Beauty" />
                            <label className="crm-field-label">Адреса</label>
                            <input className="crm-input mb-4" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="вул. Хрещатик, 1" />
                            <label className="crm-field-label">Часовий пояс</label>
                            <select className="crm-input" value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}>
                                <option value="Europe/Kiev">Europe/Kiev (UTC+2/3)</option>
                                <option value="Europe/Warsaw">Europe/Warsaw</option>
                                <option value="Europe/London">Europe/London</option>
                                <option value="UTC">UTC</option>
                            </select>
                        </div>
                        <div className="crm-modal-footer">
                            <button className="crm-btn-ghost" onClick={() => setModalOpen(false)}>Скасувати</button>
                            <button className="crm-btn-primary-sm" onClick={handleSave} disabled={saving || !form.name}>
                                {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}Створити
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

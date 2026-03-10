"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Plus, UserCheck, Phone, Loader2, X, Search, Scissors } from "lucide-react"
import apiFetch from "@/lib/api"

interface Salon { id: number; name: string }
interface StaffMember { id: number; salon_id: number; first_name: string; last_name: string; phone: string | null; user_id: number | null; user_email: string | null }

const AVATAR_COLORS = ["#f43f5e", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#06b6d4"]
const avatarColor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length]

export default function StaffPage() {
    const { data: session } = useSession()
    const token = (session as any)?.accessToken as string | undefined

    const [salons, setSalons] = useState<Salon[]>([])
    const [salonId, setSalonId] = useState<number | null>(null)
    const [staff, setStaff] = useState<StaffMember[]>([])
    const [loading, setLoading] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", email: "", password: "" })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [search, setSearch] = useState("")

    const fetchSalons = useCallback(async () => {
        if (!token) return
        const data = await apiFetch("/salons/", { token })
        setSalons(data)
        if (data.length > 0) setSalonId(data[0].id)
    }, [token])

    const fetchStaff = useCallback(async () => {
        if (!token || !salonId) return
        setLoading(true)
        try {
            const data = await apiFetch(`/salons/${salonId}/staff`, { token })
            setStaff(data)
        } finally { setLoading(false) }
    }, [token, salonId])

    useEffect(() => { fetchSalons() }, [fetchSalons])
    useEffect(() => { if (salonId) fetchStaff() }, [salonId, fetchStaff])

    const handleSave = async () => {
        setSaving(true); setError("")
        try {
            const body: any = { first_name: form.first_name, last_name: form.last_name, phone: form.phone }
            if (form.email && form.password) {
                body.email = form.email
                body.password = form.password
            }
            await apiFetch(`/salons/${salonId}/staff`, { method: "POST", body, token })
            setModalOpen(false)
            setForm({ first_name: "", last_name: "", phone: "", email: "", password: "" })
            fetchStaff()
        } catch (e: any) { setError(e.message) }
        finally { setSaving(false) }
    }

    const filtered = staff.filter(s =>
        `${s.first_name} ${s.last_name} ${s.phone ?? ""}`.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="crm-page">
            <div className="crm-page-header">
                <div>
                    <h1 className="crm-page-title">Персонал</h1>
                    <p className="crm-page-sub">Майстри та співробітники</p>
                </div>
                <div className="flex items-center gap-3">
                    {salons.length > 1 && (
                        <select className="crm-input" style={{ padding: "7px 12px", width: "auto" }}
                            value={salonId ?? ""} onChange={e => setSalonId(Number(e.target.value))}>
                            {salons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    )}
                    <button onClick={() => { setModalOpen(true); setError("") }} className="crm-btn-primary-sm">
                        <Plus size={14} className="inline mr-1" />Додати майстра
                    </button>
                </div>
            </div>

            <div className="relative max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                <input className="crm-input" style={{ paddingLeft: 32 }} placeholder="Пошук майстра..."
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
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.length === 0 ? (
                        <div className="col-span-3 crm-card items-center justify-center py-16 text-center">
                            <Scissors size={32} className="opacity-20 mb-2 mx-auto" />
                            <div className="text-white/40 text-sm">{search ? "Нічого не знайдено" : "Ще немає майстрів. Додайте першого!"}</div>
                        </div>
                    ) : filtered.map(s => (
                        <div key={s.id} className="crm-card" style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
                                style={{ background: `linear-gradient(135deg, ${avatarColor(s.id)}33, ${avatarColor(s.id)}22)`, border: `1px solid ${avatarColor(s.id)}44`, color: avatarColor(s.id) }}>
                                {s.first_name[0]}{s.last_name[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="font-semibold text-white text-sm">{s.first_name} {s.last_name}</div>
                                {s.phone && (
                                    <div className="text-xs text-white/40 flex items-center gap-1 mt-0.5">
                                        <Phone size={10} />{s.phone}
                                    </div>
                                )}
                                {s.user_email ? (
                                    <div className="text-xs mt-1 flex items-center gap-1">
                                        <span className="crm-tag" style={{ fontSize: 9, padding: "1px 6px", background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>✓ Акаунт</span>
                                        <span className="text-white/30 truncate">{s.user_email}</span>
                                    </div>
                                ) : (
                                    <div className="text-xs mt-1">
                                        <span className="crm-tag" style={{ fontSize: 9, padding: "1px 6px", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}>Без акаунту</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modalOpen && (
                <div className="crm-modal-overlay" onClick={() => setModalOpen(false)}>
                    <div className="crm-modal" onClick={e => e.stopPropagation()}>
                        <div className="crm-modal-header">
                            <div className="flex items-center gap-2"><UserCheck size={15} />Новий майстер</div>
                            <button className="crm-icon-btn" onClick={() => setModalOpen(false)} style={{ width: 28, height: 28 }}><X size={14} /></button>
                        </div>
                        <div className="crm-modal-body">
                            {error && <div className="p-3 mb-3 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg">{error}</div>}
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                    <label className="crm-field-label">Ім'я *</label>
                                    <input className="crm-input" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Марина" />
                                </div>
                                <div>
                                    <label className="crm-field-label">Прізвище *</label>
                                    <input className="crm-input" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Коваль" />
                                </div>
                            </div>
                            <label className="crm-field-label">Телефон</label>
                            <input className="crm-input mb-3" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+380 50 123 45 67" />
                            <div className="border-t border-white/5 pt-3 mt-1">
                                <div className="text-xs text-white/40 mb-2">🔐 Доступ до кабінету /staff (необов'язково)</div>
                                <label className="crm-field-label">Email для входу</label>
                                <input className="crm-input mb-3" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="master@salon.local" />
                                <label className="crm-field-label">Пароль</label>
                                <input className="crm-input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Мінімум 8 символів" />
                            </div>
                        </div>
                        <div className="crm-modal-footer">
                            <button className="crm-btn-ghost" onClick={() => setModalOpen(false)}>Скасувати</button>
                            <button className="crm-btn-primary-sm" onClick={handleSave} disabled={saving || !form.first_name || !form.last_name}>
                                {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}Додати
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Plus, Users, Phone, Mail, Loader2, X, StickyNote, Search, ChevronRight } from "lucide-react"
import Link from "next/link"
import apiFetch from "@/lib/api"

interface Salon { id: number; name: string }
interface Client {
    id: number; salon_id: number
    first_name: string; last_name: string | null
    phone: string; email: string | null; notes: string | null
}

export default function ClientsPage() {
    const { data: session } = useSession()
    const token = (session as any)?.accessToken as string | undefined

    const [salons, setSalons] = useState<Salon[]>([])
    const [salonId, setSalonId] = useState<number | null>(null)
    const [clients, setClients] = useState<Client[]>([])
    const [loading, setLoading] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", email: "", notes: "" })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [search, setSearch] = useState("")

    const fetchSalons = useCallback(async () => {
        if (!token) return
        const data = await apiFetch("/salons/", { token })
        setSalons(data)
        if (data.length > 0) setSalonId(data[0].id)
    }, [token])

    const fetchClients = useCallback(async () => {
        if (!token || !salonId) return
        setLoading(true)
        try {
            const data = await apiFetch(`/salons/${salonId}/clients`, { token })
            setClients(data)
        } finally {
            setLoading(false)
        }
    }, [token, salonId])

    useEffect(() => { fetchSalons() }, [fetchSalons])
    useEffect(() => { if (salonId) fetchClients() }, [salonId, fetchClients])

    const handleSave = async () => {
        setSaving(true); setError("")
        try {
            const body = { ...form, salon_id: salonId }
            await apiFetch(`/salons/${salonId}/clients`, { method: "POST", body: { ...form }, token })
            setModalOpen(false)
            setForm({ first_name: "", last_name: "", phone: "", email: "", notes: "" })
            fetchClients()
        } catch (e: any) {
            setError(e.message)
        } finally { setSaving(false) }
    }

    const filtered = clients.filter(c =>
        [c.first_name, c.last_name, c.phone, c.email].join(" ").toLowerCase().includes(search.toLowerCase())
    )

    const initials = (c: Client) => `${c.first_name[0]}${c.last_name?.[0] ?? ""}`.toUpperCase()

    return (
        <div className="crm-page">
            <div className="crm-page-header">
                <div>
                    <h1 className="crm-page-title">Клієнти</h1>
                    <p className="crm-page-sub">База клієнтів салону</p>
                </div>
                <div className="flex items-center gap-3">
                    {salons.length > 1 && (
                        <select className="crm-input" style={{ padding: "7px 12px", width: "auto" }}
                            value={salonId ?? ""} onChange={e => setSalonId(Number(e.target.value))}>
                            {salons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    )}
                    <button onClick={() => { setModalOpen(true); setError("") }} className="crm-btn-primary-sm">
                        <Plus size={14} className="inline mr-1" />Додати клієнта
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                <input className="crm-input" style={{ paddingLeft: 32 }} placeholder="Пошук клієнта..."
                    value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {/* Table */}
            <div className="crm-card" style={{ gap: 0 }}>
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-white/30">
                        <Loader2 size={20} className="animate-spin mr-2" />Завантаження...
                    </div>
                ) : !salonId ? (
                    <div className="text-center py-12 text-white/30 text-sm">Спочатку створіть салон у розділі Салони</div>
                ) : (
                    <div className="crm-table">
                        <div className="crm-table-head" style={{ gridTemplateColumns: "1fr 130px 170px 1fr" }}>
                            <div>Клієнт</div><div>Телефон</div><div>Email</div><div>Нотатки</div>
                        </div>
                        {filtered.length === 0 && (
                            <div className="text-center py-12">
                                <Users size={32} className="opacity-20 mb-2 mx-auto" />
                                <div className="text-white/40 text-sm">{search ? "Нічого не знайдено" : "Немає клієнтів. Додайте першого!"}</div>
                            </div>
                        )}
                        {filtered.map(c => (
                            <Link key={c.id} href={`/crm/clients/${c.id}`} className="crm-table-row" style={{ gridTemplateColumns: "1fr 130px 170px 1fr auto", textDecoration: "none", cursor: "pointer" }}>
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/20 flex items-center justify-center text-xs font-bold text-violet-300 flex-shrink-0">
                                        {initials(c)}
                                    </div>
                                    <span className="crm-table-strong">{c.first_name} {c.last_name ?? ""}</span>
                                </div>
                                <div className="crm-table-muted flex items-center gap-1">
                                    <Phone size={11} />{c.phone}
                                </div>
                                <div className="crm-table-muted flex items-center gap-1 truncate">
                                    {c.email ? <><Mail size={11} /><span className="truncate">{c.email}</span></> : "—"}
                                </div>
                                <div className="crm-table-muted flex items-center gap-1 truncate">
                                    {c.notes ? <><StickyNote size={11} /><span className="truncate">{c.notes}</span></> : "—"}
                                </div>
                                <ChevronRight size={14} className="text-white/20" />
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {modalOpen && (
                <div className="crm-modal-overlay" onClick={() => setModalOpen(false)}>
                    <div className="crm-modal" onClick={e => e.stopPropagation()}>
                        <div className="crm-modal-header">
                            <div className="flex items-center gap-2"><Users size={15} />Новий клієнт</div>
                            <button className="crm-icon-btn" onClick={() => setModalOpen(false)} style={{ width: 28, height: 28 }}><X size={14} /></button>
                        </div>
                        <div className="crm-modal-body">
                            {error && <div className="p-3 mb-3 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg">{error}</div>}
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div>
                                    <label className="crm-field-label">Ім'я *</label>
                                    <input className="crm-input" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Олена" />
                                </div>
                                <div>
                                    <label className="crm-field-label">Прізвище</label>
                                    <input className="crm-input" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Коваль" />
                                </div>
                            </div>
                            <label className="crm-field-label">Телефон *</label>
                            <input className="crm-input mb-4" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+380 50 123 45 67" />
                            <label className="crm-field-label">Email</label>
                            <input className="crm-input mb-4" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@example.com" />
                            <label className="crm-field-label">Нотатки</label>
                            <textarea className="crm-input" rows={2} value={form.notes}
                                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                placeholder="Алергії, побажання..." style={{ resize: "none" }} />
                        </div>
                        <div className="crm-modal-footer">
                            <button className="crm-btn-ghost" onClick={() => setModalOpen(false)}>Скасувати</button>
                            <button className="crm-btn-primary-sm" onClick={handleSave} disabled={saving || !form.first_name || !form.phone}>
                                {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}Додати
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

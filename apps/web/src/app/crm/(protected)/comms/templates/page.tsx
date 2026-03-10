"use client"

import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { MessageSquare, Plus, Loader2, X, Send, Mail, Smartphone } from "lucide-react"
import apiFetch from "@/lib/api"

interface Salon { id: number; name: string }
interface Template { id: number; name: string; channel: string; content: string }

export default function CommsTemplatesPage() {
    const { data: session } = useSession()
    const token = (session as any)?.accessToken as string | undefined

    const [salons, setSalons] = useState<Salon[]>([])
    const [salonId, setSalonId] = useState<number | null>(null)
    const [templates, setTemplates] = useState<Template[]>([])
    const [loading, setLoading] = useState(false)
    const [modalOpen, setModalOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [form, setForm] = useState({ name: "", channel: "SMS", content: "" })

    useEffect(() => {
        if (!token) return
        apiFetch("/salons/", { token }).then((s: Salon[]) => {
            setSalons(s)
            if (s.length > 0) setSalonId(s[0].id)
        })
    }, [token])

    const fetchTemplates = useCallback(async () => {
        if (!token || !salonId) return
        setLoading(true)
        try {
            const data = await apiFetch(`/salons/${salonId}/messages/templates`, { token })
            setTemplates(data)
        } finally { setLoading(false) }
    }, [token, salonId])

    useEffect(() => { fetchTemplates() }, [fetchTemplates])

    const handleSave = async () => {
        setSaving(true); setError("")
        try {
            await apiFetch(`/salons/${salonId}/messages/templates`, { method: "POST", token, body: form })
            setModalOpen(false)
            setForm({ name: "", channel: "SMS", content: "" })
            fetchTemplates()
        } catch (e: any) { setError(e.message) }
        finally { setSaving(false) }
    }

    const VARS = ["{client_name}", "{service}", "{date}", "{time}", "{staff_name}"]
    const CHANNEL_ICONS: Record<string, any> = { SMS: Smartphone, EMAIL: Mail }

    return (
        <div className="crm-page">
            <div className="crm-page-header">
                <div>
                    <h1 className="crm-page-title">Шаблони повідомлень</h1>
                    <p className="crm-page-sub">SMS та Email для клієнтів</p>
                </div>
                <div className="flex items-center gap-3">
                    {salons.length > 1 && (
                        <select className="crm-input" style={{ padding: "7px 12px", width: "auto" }}
                            value={salonId ?? ""} onChange={e => setSalonId(Number(e.target.value))}>
                            {salons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    )}
                    <button className="crm-btn-primary-sm" onClick={() => { setModalOpen(true); setError("") }}>
                        <Plus size={14} className="inline mr-1" />Новий шаблон
                    </button>
                </div>
            </div>

            {/* Info banner */}
            <div className="crm-card" style={{ flexDirection: "row", gap: 12, alignItems: "center", background: "rgba(139,92,246,0.06)", borderColor: "rgba(139,92,246,0.15)" }}>
                <MessageSquare size={16} style={{ color: "#8b5cf6", flexShrink: 0 }} />
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                    Доступні змінні у шаблонах: {VARS.map(v => (
                        <code key={v} style={{ background: "rgba(139,92,246,0.15)", borderRadius: 4, padding: "1px 5px", marginRight: 4, fontSize: 11 }}>{v}</code>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16 text-white/30">
                    <Loader2 size={20} className="animate-spin mr-2" />Завантаження...
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templates.length === 0 ? (
                        <div className="col-span-2 crm-card py-16 text-center">
                            <MessageSquare size={32} className="opacity-20 mb-2 mx-auto" />
                            <div className="text-white/40 text-sm">Шаблонів ще немає. Додайте перший!</div>
                        </div>
                    ) : templates.map(t => {
                        const Icon = CHANNEL_ICONS[t.channel] ?? MessageSquare
                        const color = t.channel === "SMS" ? "#10b981" : "#3b82f6"
                        return (
                            <div key={t.id} className="crm-card" style={{ gap: 10 }}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}18`, border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                            <Icon size={14} style={{ color }} />
                                        </div>
                                        <span className="font-semibold text-sm text-white">{t.name}</span>
                                    </div>
                                    <span className="crm-tag" style={{ fontSize: 10, background: `${color}15`, color, borderColor: `${color}33` }}>{t.channel}</span>
                                </div>
                                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.03)", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", lineHeight: 1.6 }}>
                                    {t.content}
                                </div>
                                <button className="crm-btn-ghost" style={{ alignSelf: "flex-start", fontSize: 11, padding: "4px 10px" }}>
                                    <Send size={11} />Надіслати тест
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}

            {modalOpen && (
                <div className="crm-modal-overlay" onClick={() => setModalOpen(false)}>
                    <div className="crm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
                        <div className="crm-modal-header">
                            <div className="flex items-center gap-2"><MessageSquare size={15} />Новий шаблон</div>
                            <button className="crm-icon-btn" onClick={() => setModalOpen(false)} style={{ width: 28, height: 28 }}><X size={14} /></button>
                        </div>
                        <div className="crm-modal-body">
                            {error && <div className="p-3 mb-3 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg">{error}</div>}
                            <label className="crm-field-label">Назва шаблону *</label>
                            <input className="crm-input mb-3" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Підтвердження запису" />
                            <label className="crm-field-label">Канал *</label>
                            <select className="crm-input mb-3" value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
                                <option value="SMS">SMS</option>
                                <option value="EMAIL">Email</option>
                            </select>
                            <label className="crm-field-label">Текст повідомлення * <span style={{ fontWeight: 400, color: "rgba(255,255,255,0.3)" }}>(використовуйте змінні вище)</span></label>
                            <textarea className="crm-input" rows={5} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                                placeholder="Шановний {client_name}, ваш запис на {service} {date} о {time} підтверджено." />
                        </div>
                        <div className="crm-modal-footer">
                            <button className="crm-btn-ghost" onClick={() => setModalOpen(false)}>Скасувати</button>
                            <button className="crm-btn-primary-sm" onClick={handleSave} disabled={saving || !form.name || !form.content}>
                                {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}Створити
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

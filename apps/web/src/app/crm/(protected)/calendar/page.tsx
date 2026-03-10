"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Calendar, Loader2, ChevronLeft, ChevronRight, Plus, X, User, Scissors, Clock } from "lucide-react"
import apiFetch from "@/lib/api"

interface Salon { id: number; name: string }
interface Client { id: number; first_name: string; last_name: string | null; phone: string }
interface StaffMember { id: number; first_name: string; last_name: string | null }
interface Service { id: number; name: string; duration_minutes: number; price: number }
interface Appointment {
    id: number
    client_id: number; staff_id: number; service_id: number
    start_time: string; end_time: string
    status: string; notes: string | null
    client_name: string | null
    staff_name: string | null
    service_name: string | null
    service_price: number | null
}

const STATUS_LABEL: Record<string, string> = {
    NEW: "Новий", CONFIRMED: "Підтверджено", CANCELED: "Скасовано",
    COMPLETED: "Завершено", NO_SHOW: "Не з'явився", RESCHEDULED: "Перенесено"
}
const STATUS_COLOR: Record<string, string> = {
    NEW: "#f59e0b", CONFIRMED: "#10b981", CANCELED: "#ef4444",
    COMPLETED: "#8b5cf6", NO_SHOW: "#f43f5e", RESCHEDULED: "#3b82f6"
}

function fmtTime(dt: string) {
    return new Date(dt).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })
}

export default function CalendarPage() {
    const { data: session } = useSession()
    const token = (session as any)?.accessToken as string | undefined

    const [salons, setSalons] = useState<Salon[]>([])
    const [salonId, setSalonId] = useState<number | null>(null)
    const [appointments, setAppointments] = useState<Appointment[]>([])
    const [loading, setLoading] = useState(false)
    const [date, setDate] = useState(new Date().toISOString().split("T")[0])

    // data for modal
    const [clients, setClients] = useState<Client[]>([])
    const [staffList, setStaffList] = useState<StaffMember[]>([])
    const [services, setServices] = useState<Service[]>([])

    // modal state
    const [modalOpen, setModalOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState("")
    const [form, setForm] = useState({
        client_id: "",
        staff_id: "",
        service_id: "",
        start_time: "",   // "HH:mm"
        notes: ""
    })

    // ─── load salons ───────────────────────────────────────────
    useEffect(() => {
        if (!token) return
        apiFetch("/salons/", { token }).then((data: Salon[]) => {
            setSalons(data)
            if (data.length > 0) setSalonId(data[0].id)
        })
    }, [token])

    // ─── load appointments for selected date ──────────────────
    const fetchAppointments = useCallback(async () => {
        if (!token || !salonId) return
        setLoading(true)
        try {
            const start = new Date(date); start.setHours(0, 0, 0, 0)
            const end = new Date(date); end.setHours(23, 59, 59, 999)
            const data = await apiFetch(
                `/salons/${salonId}/appointments?start_date=${start.toISOString()}&end_date=${end.toISOString()}`,
                { token }
            )
            setAppointments(data)
        } catch { setAppointments([]) }
        finally { setLoading(false) }
    }, [token, salonId, date])

    useEffect(() => { fetchAppointments() }, [fetchAppointments])

    // ─── load modal data when salon changes ───────────────────
    useEffect(() => {
        if (!token || !salonId) return
        Promise.all([
            apiFetch(`/salons/${salonId}/clients`, { token }),
            apiFetch(`/salons/${salonId}/staff`, { token }),
            apiFetch(`/salons/${salonId}/services`, { token }),
        ]).then(([c, s, sv]) => {
            setClients(c)
            setStaffList(s)
            setServices(sv)
        })
    }, [token, salonId])

    // ─── navigation ──────────────────────────────────────────
    const prevDay = () => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d.toISOString().split("T")[0]) }
    const nextDay = () => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d.toISOString().split("T")[0]) }
    const isToday = date === new Date().toISOString().split("T")[0]
    const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" })

    // ─── open modal with date pre-filled ──────────────────────
    const openModal = () => {
        setForm({ client_id: "", staff_id: "", service_id: "", start_time: "10:00", notes: "" })
        setSaveError("")
        setModalOpen(true)
    }

    // ─── save appointment ─────────────────────────────────────
    const handleSave = async () => {
        if (!salonId || !form.client_id || !form.staff_id || !form.service_id || !form.start_time) {
            setSaveError("Заповніть усі обов'язкові поля")
            return
        }
        setSaving(true); setSaveError("")
        try {
            // combine selected date + time into ISO
            const startISO = new Date(`${date}T${form.start_time}:00`).toISOString()
            await apiFetch(`/salons/${salonId}/appointments`, {
                method: "POST", token,
                body: {
                    client_id: parseInt(form.client_id),
                    staff_id: parseInt(form.staff_id),
                    service_id: parseInt(form.service_id),
                    start_time: startISO,
                    notes: form.notes || null
                }
            })
            setModalOpen(false)
            fetchAppointments()
        } catch (e: any) {
            setSaveError(e.message ?? "Помилка при збереженні")
        } finally { setSaving(false) }
    }

    // ─── status pill ──────────────────────────────────────────
    const StatusPill = ({ status }: { status: string }) => (
        <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, fontWeight: 600, padding: "3px 8px",
            borderRadius: 20, color: STATUS_COLOR[status] ?? "#fff",
            background: `${STATUS_COLOR[status] ?? "#888"}18`,
            border: `1px solid ${STATUS_COLOR[status] ?? "#888"}33`
        }}>{STATUS_LABEL[status] ?? status}</span>
    )

    return (
        <div className="crm-page">
            {/* Header */}
            <div className="crm-page-header">
                <div>
                    <h1 className="crm-page-title">Календар</h1>
                    <p className="crm-page-sub">Розклад записів</p>
                </div>
                <div className="flex items-center gap-3">
                    {salons.length > 1 && (
                        <select className="crm-input" style={{ padding: "7px 12px", width: "auto" }}
                            value={salonId ?? ""} onChange={e => setSalonId(Number(e.target.value))}>
                            {salons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    )}
                    <button className="crm-btn-primary-sm" onClick={openModal} disabled={!salonId}>
                        <Plus size={14} className="inline mr-1" />Додати запис
                    </button>
                </div>
            </div>

            {/* Date nav */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <button className="crm-icon-btn" onClick={prevDay} style={{ width: 32, height: 32 }}><ChevronLeft size={16} /></button>
                    <input type="date" className="crm-input" value={date} onChange={e => setDate(e.target.value)}
                        style={{ padding: "6px 10px", width: "auto", cursor: "pointer" }} />
                    <button className="crm-icon-btn" onClick={nextDay} style={{ width: 32, height: 32 }}><ChevronRight size={16} /></button>
                </div>
                <div className="text-sm font-medium text-white/70 capitalize">{dateLabel}</div>
                {!isToday && (
                    <button className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                        onClick={() => setDate(new Date().toISOString().split("T")[0])}>
                        Сьогодні
                    </button>
                )}
                <div className="ml-auto text-xs text-white/30">
                    {loading ? "" : `${appointments.length} записів`}
                </div>
            </div>

            {/* Table */}
            <div className="crm-card" style={{ gap: 0 }}>
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-white/30">
                        <Loader2 size={20} className="animate-spin mr-2" />Завантаження...
                    </div>
                ) : !salonId ? (
                    <div className="text-center py-12 text-white/30 text-sm">Спочатку створіть салон</div>
                ) : appointments.length === 0 ? (
                    <div className="text-center py-16">
                        <Calendar size={36} className="opacity-20 mb-3 mx-auto" />
                        <div className="text-white/40 text-sm mb-4">Немає записів на цей день</div>
                        <button className="crm-btn-primary-sm mx-auto" onClick={openModal}>
                            <Plus size={13} className="inline mr-1" />Додати перший запис
                        </button>
                    </div>
                ) : (
                    <div className="crm-table">
                        <div className="crm-table-head" style={{ gridTemplateColumns: "70px 1fr 1fr 1fr 90px 130px" }}>
                            <div>Час</div>
                            <div>Клієнт</div>
                            <div>Майстер</div>
                            <div>Послуга</div>
                            <div>Ціна</div>
                            <div>Статус</div>
                        </div>
                        {appointments.map(a => (
                            <div key={a.id} className="crm-table-row" style={{ gridTemplateColumns: "70px 1fr 1fr 1fr 90px 130px" }}>
                                <div className="font-mono text-sm font-semibold" style={{ color: "#f59e0b" }}>
                                    {fmtTime(a.start_time)}
                                </div>
                                <div className="crm-table-muted flex items-center gap-1">
                                    <User size={11} />{a.client_name ?? `#${a.client_id}`}
                                </div>
                                <div className="crm-table-muted flex items-center gap-1">
                                    <User size={11} />{a.staff_name ?? `#${a.staff_id}`}
                                </div>
                                <div className="crm-table-muted flex items-center gap-1">
                                    <Scissors size={11} />{a.service_name ?? `#${a.service_id}`}
                                </div>
                                <div className="crm-table-muted">
                                    {a.service_price != null ? `${a.service_price} ₴` : "—"}
                                </div>
                                <div><StatusPill status={a.status} /></div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ─── Add Appointment Modal ─── */}
            {modalOpen && (
                <div className="crm-modal-overlay" onClick={() => setModalOpen(false)}>
                    <div className="crm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="crm-modal-header">
                            <div className="flex items-center gap-2">
                                <Calendar size={15} />
                                Новий запис на {new Date(date + "T12:00:00").toLocaleDateString("uk-UA", { day: "numeric", month: "long" })}
                            </div>
                            <button className="crm-icon-btn" onClick={() => setModalOpen(false)} style={{ width: 28, height: 28 }}>
                                <X size={14} />
                            </button>
                        </div>

                        <div className="crm-modal-body">
                            {saveError && (
                                <div className="p-3 mb-3 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                                    {saveError}
                                </div>
                            )}

                            {/* Client */}
                            <label className="crm-field-label flex items-center gap-1">
                                <User size={12} />Клієнт *
                            </label>
                            <select className="crm-input mb-3"
                                value={form.client_id}
                                onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}>
                                <option value="">— Оберіть клієнта —</option>
                                {clients.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.first_name} {c.last_name ?? ""} ({c.phone})
                                    </option>
                                ))}
                            </select>

                            {/* Staff */}
                            <label className="crm-field-label flex items-center gap-1">
                                <User size={12} />Майстер *
                            </label>
                            <select className="crm-input mb-3"
                                value={form.staff_id}
                                onChange={e => setForm(f => ({ ...f, staff_id: e.target.value }))}>
                                <option value="">— Оберіть майстра —</option>
                                {staffList.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.first_name} {s.last_name ?? ""}
                                    </option>
                                ))}
                            </select>

                            {/* Service */}
                            <label className="crm-field-label flex items-center gap-1">
                                <Scissors size={12} />Послуга *
                            </label>
                            <select className="crm-input mb-3"
                                value={form.service_id}
                                onChange={e => setForm(f => ({ ...f, service_id: e.target.value }))}>
                                <option value="">— Оберіть послугу —</option>
                                {services.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} ({s.duration_minutes} хв · {s.price} ₴)
                                    </option>
                                ))}
                            </select>

                            {/* Time */}
                            <label className="crm-field-label flex items-center gap-1">
                                <Clock size={12} />Час початку *
                            </label>
                            <input type="time" className="crm-input mb-3"
                                value={form.start_time}
                                onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />

                            {/* Notes */}
                            <label className="crm-field-label">Нотатки</label>
                            <textarea className="crm-input" rows={2}
                                style={{ resize: "none" }}
                                value={form.notes}
                                placeholder="Побажання, алергії..."
                                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                        </div>

                        <div className="crm-modal-footer">
                            <button className="crm-btn-ghost" onClick={() => setModalOpen(false)}>
                                Скасувати
                            </button>
                            <button className="crm-btn-primary-sm" onClick={handleSave}
                                disabled={saving || !form.client_id || !form.staff_id || !form.service_id || !form.start_time}>
                                {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                                Створити запис
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

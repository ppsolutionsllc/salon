"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Loader2, Plus, Pencil, Trash2, UserCheck, X, Shield } from "lucide-react"

type Role = "NETWORK_ADMIN" | "SALON_ADMIN" | "OPERATOR" | "STAFF" | "CLIENT"

interface User {
    id: number
    email: string
    global_role: Role
    is_active: boolean
}

const ROLES: { value: Role; label: string; color: string }[] = [
    { value: "NETWORK_ADMIN", label: "Мережевий адмін", color: "#f43f5e" },
    { value: "SALON_ADMIN", label: "Адмін салону", color: "#8b5cf6" },
    { value: "OPERATOR", label: "Оператор", color: "#3b82f6" },
    { value: "STAFF", label: "Персонал", color: "#10b981" },
    { value: "CLIENT", label: "Клієнт", color: "#f59e0b" },
]

const roleColor = (role: Role) => ROLES.find(r => r.value === role)?.color ?? "#888"
const roleLabel = (role: Role) => ROLES.find(r => r.value === role)?.label ?? role

export default function UsersPage() {
    const { data: session } = useSession()
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [modalOpen, setModalOpen] = useState(false)
    const [editUser, setEditUser] = useState<User | null>(null)
    const [form, setForm] = useState({ email: "", password: "", global_role: "STAFF" as Role, is_active: true })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [deleteId, setDeleteId] = useState<number | null>(null)

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1"

    const fetchUsers = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`${apiUrl}/users/`, {
                headers: { Authorization: `Bearer ${(session as any)?.accessToken}` }
            })
            if (res.ok) setUsers(await res.json())
        } finally {
            setLoading(false)
        }
    }, [apiUrl, session])

    useEffect(() => {
        if (session) fetchUsers()
    }, [session, fetchUsers])

    const openCreate = () => {
        setEditUser(null)
        setForm({ email: "", password: "", global_role: "STAFF", is_active: true })
        setError("")
        setModalOpen(true)
    }

    const openEdit = (u: User) => {
        setEditUser(u)
        setForm({ email: u.email, password: "", global_role: u.global_role, is_active: u.is_active })
        setError("")
        setModalOpen(true)
    }

    const handleSave = async () => {
        setSaving(true)
        setError("")
        try {
            const body: any = { email: form.email, global_role: form.global_role, is_active: form.is_active }
            if (form.password) body.password = form.password

            const url = editUser ? `${apiUrl}/users/${editUser.id}` : `${apiUrl}/users/`
            const method = editUser ? "PATCH" : "POST"
            if (!editUser) body.password = form.password

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${(session as any)?.accessToken}` },
                body: JSON.stringify(body)
            })

            if (!res.ok) {
                const err = await res.json()
                setError(err.detail ?? "Помилка збереження")
            } else {
                setModalOpen(false)
                fetchUsers()
            }
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: number) => {
        await fetch(`${apiUrl}/users/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${(session as any)?.accessToken}` }
        })
        setDeleteId(null)
        fetchUsers()
    }

    return (
        <div className="crm-page">
            {/* Header */}
            <div className="crm-page-header">
                <div>
                    <h1 className="crm-page-title">Користувачі</h1>
                    <p className="crm-page-sub">Управління доступом до системи</p>
                </div>
                <button onClick={openCreate} className="crm-btn-primary-sm">
                    <Plus size={14} className="inline mr-1" />Додати користувача
                </button>
            </div>

            {/* Table */}
            <div className="crm-card" style={{ gap: 0 }}>
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-white/30">
                        <Loader2 size={20} className="animate-spin mr-2" />Завантаження...
                    </div>
                ) : (
                    <div className="crm-table">
                        <div className="crm-table-head" style={{ gridTemplateColumns: "1fr 180px 100px 100px" }}>
                            <div>Логін / Пошта</div>
                            <div>Роль</div>
                            <div>Статус</div>
                            <div>Дії</div>
                        </div>
                        {users.length === 0 && (
                            <div className="text-center py-12 text-white/30 text-sm">Немає користувачів</div>
                        )}
                        {users.map(u => (
                            <div key={u.id} className="crm-table-row" style={{ gridTemplateColumns: "1fr 180px 100px 100px" }}>
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                                        style={{ background: roleColor(u.global_role) }}>
                                        {u.email.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="crm-table-strong">{u.email}</span>
                                </div>
                                <div>
                                    <span className="crm-tag" style={{
                                        background: roleColor(u.global_role) + "20",
                                        color: roleColor(u.global_role),
                                        border: `1px solid ${roleColor(u.global_role)}30`
                                    }}>
                                        {roleLabel(u.global_role)}
                                    </span>
                                </div>
                                <div>
                                    <span className={`crm-tag ${u.is_active ? "crm-tag-green" : "crm-tag-red"}`}>
                                        {u.is_active ? "Активний" : "Неактивний"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => openEdit(u)} className="crm-icon-btn" title="Редагувати" style={{ width: 28, height: 28 }}>
                                        <Pencil size={12} />
                                    </button>
                                    <button
                                        onClick={() => setDeleteId(u.id)}
                                        className="crm-icon-btn"
                                        title="Видалити"
                                        style={{ width: 28, height: 28, color: "#f43f5e" }}
                                        disabled={u.email === "admin"}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {modalOpen && (
                <div className="crm-modal-overlay" onClick={() => setModalOpen(false)}>
                    <div className="crm-modal" onClick={e => e.stopPropagation()}>
                        <div className="crm-modal-header">
                            <div className="flex items-center gap-2">
                                <Shield size={16} className="text-primary" style={{ color: "#f43f5e" }} />
                                <span>{editUser ? "Редагувати користувача" : "Новий користувач"}</span>
                            </div>
                            <button className="crm-icon-btn" onClick={() => setModalOpen(false)} style={{ width: 28, height: 28 }}>
                                <X size={14} />
                            </button>
                        </div>

                        <div className="crm-modal-body">
                            {error && (
                                <div className="p-3 mb-3 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg">{error}</div>
                            )}

                            <label className="crm-field-label">Логін / Пошта</label>
                            <input
                                className="crm-input mb-4"
                                type="text"
                                value={form.email}
                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                placeholder="mylogin або email@example.com"
                            />

                            <label className="crm-field-label">{editUser ? "Новий пароль (залиш порожнім)" : "Пароль"}</label>
                            <input
                                className="crm-input mb-4"
                                type="password"
                                value={form.password}
                                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                placeholder="••••••••"
                            />

                            <label className="crm-field-label">Роль</label>
                            <select
                                className="crm-input mb-4"
                                value={form.global_role}
                                onChange={e => setForm(f => ({ ...f, global_role: e.target.value as Role }))}
                            >
                                {ROLES.map(r => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                            </select>

                            <label className="crm-field-label">Статус</label>
                            <div className="flex items-center gap-3 mb-2">
                                <button
                                    type="button"
                                    onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                                    className={`w-10 h-5 rounded-full relative transition-colors ${form.is_active ? "bg-emerald-500" : "bg-white/10"}`}
                                >
                                    <div className={`absolute w-4 h-4 rounded-full bg-white top-0.5 transition-all ${form.is_active ? "left-5" : "left-0.5"}`} />
                                </button>
                                <span className="text-sm text-white/60">{form.is_active ? "Активний" : "Неактивний"}</span>
                            </div>
                        </div>

                        <div className="crm-modal-footer">
                            <button className="crm-btn-ghost" onClick={() => setModalOpen(false)}>Скасувати</button>
                            <button className="crm-btn-primary-sm" onClick={handleSave} disabled={saving}>
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                                {editUser ? "Зберегти" : "Створити"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete confirmation */}
            {deleteId && (
                <div className="crm-modal-overlay" onClick={() => setDeleteId(null)}>
                    <div className="crm-modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
                        <div className="crm-modal-header">
                            <span className="text-rose-400">Видалити користувача?</span>
                            <button className="crm-icon-btn" onClick={() => setDeleteId(null)} style={{ width: 28, height: 28 }}>
                                <X size={14} />
                            </button>
                        </div>
                        <div className="crm-modal-body text-sm text-white/50">
                            Цю дію неможливо скасувати. Обліковий запис буде видалено назавжди.
                        </div>
                        <div className="crm-modal-footer">
                            <button className="crm-btn-ghost" onClick={() => setDeleteId(null)}>Скасувати</button>
                            <button className="crm-btn-danger" onClick={() => handleDelete(deleteId)}>Видалити</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

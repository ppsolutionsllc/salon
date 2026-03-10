"use client"

import { useSession, signOut } from "next-auth/react"
import { User, Mail, Shield, LogOut, Edit } from "lucide-react"

export default function ClientProfilePage() {
    const { data: session } = useSession()
    const email = session?.user?.email ?? ""
    const name = email.split("@")[0]
    const role = (session as any)?.global_role ?? "CLIENT"

    return (
        <div className="mob-page">
            {/* Avatar hero */}
            <div className="mob-hero mob-hero-client" style={{ alignItems: "center", textAlign: "center" }}>
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg,#8b5cf6,#6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: "white", margin: "0 auto 12px" }}>
                    {name.charAt(0).toUpperCase()}
                </div>
                <div className="mob-hero-title">{name}</div>
                <div className="mob-hero-sub">{email}</div>
            </div>

            {/* Info */}
            <div className="mob-card">
                <div className="mob-section-title">Профіль</div>
                <div className="mob-list-row">
                    <div className="mob-list-icon" style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)" }}><User size={16} style={{ color: "#a78bfa" }} /></div>
                    <div><div className="mob-list-title">Ім'я</div><div className="mob-list-sub">{name}</div></div>
                </div>
                <div className="mob-list-row">
                    <div className="mob-list-icon" style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.2)" }}><Mail size={16} style={{ color: "#60a5fa" }} /></div>
                    <div><div className="mob-list-title">Email</div><div className="mob-list-sub">{email}</div></div>
                </div>
                <div className="mob-list-row">
                    <div className="mob-list-icon" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.2)" }}><Shield size={16} style={{ color: "#10b981" }} /></div>
                    <div><div className="mob-list-title">Роль</div><div className="mob-list-sub">{role}</div></div>
                </div>
            </div>

            {/* Actions */}
            <div className="mob-card">
                <div className="mob-section-title">Дії</div>
                <button className="mob-btn-secondary" style={{ justifyContent: "flex-start", gap: 10 }}>
                    <Edit size={16} />Редагувати профіль
                </button>
            </div>

            {/* Sign out */}
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="mob-btn-secondary" style={{ borderColor: "rgba(244,63,94,0.2)", color: "#f43f5e" }}>
                <LogOut size={16} />Вийти з акаунту
            </button>

            <div style={{ textAlign: "center", fontSize: 11, color: "var(--mob-muted)" }}>Aesthetic Prime · v1.0.0 · 2026</div>
        </div>
    )
}

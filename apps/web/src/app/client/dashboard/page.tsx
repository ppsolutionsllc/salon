import { auth } from "@/auth"
import Link from "next/link"
import { CalendarPlus, Clock, Star, Gift } from "lucide-react"

export default async function ClientDashboard() {
    const session = await auth()
    const name = session?.user?.email?.split("@")[0] ?? "Клієнт"
    const today = new Date().toLocaleDateString("uk-UA", { weekday: "short", day: "numeric", month: "short" })

    const quickActions = [
        { icon: "✂️", label: "Стрижка", color: "#f43f5e" },
        { icon: "💅", label: "Манікюр", color: "#8b5cf6" },
        { icon: "🧖", label: "Масаж", color: "#3b82f6" },
        { icon: "💆", label: "Бьюті", color: "#10b981" },
    ]

    return (
        <div className="mob-page">
            {/* Hero */}
            <div className="mob-hero mob-hero-client">
                <div className="mob-hero-glow" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.3), transparent 70%)" }} />
                <div className="mob-hero-sub" style={{ color: "rgba(167,139,250,0.8)", marginBottom: 6 }}>{today}</div>
                <div className="mob-hero-title">Вітаємо,<br />{name}! 💜</div>
                <div className="mob-hero-sub" style={{ marginTop: 8 }}>Готові до нового візиту?</div>
            </div>

            {/* Book CTA */}
            <Link href="/client/book" className="mob-btn-primary" style={{ background: "linear-gradient(135deg, #8b5cf6, #6d28d9)" }}>
                <CalendarPlus size={18} />
                Записатись зараз
            </Link>

            {/* Quick service picker */}
            <div className="mob-card">
                <div className="mob-section-title">Популярні послуги</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {quickActions.map(a => (
                        <Link key={a.label} href="/client/book"
                            style={{
                                background: `${a.color}12`,
                                border: `1px solid ${a.color}25`,
                                borderRadius: 14,
                                padding: "14px 12px",
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                                textDecoration: "none"
                            }}>
                            <span style={{ fontSize: 24 }}>{a.icon}</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--mob-text)" }}>{a.label}</span>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Next appointment */}
            <div className="mob-card">
                <div className="mob-section-title">Наступний запис</div>
                <div className="mob-empty">
                    <div className="mob-empty-icon">
                        <Clock size={28} style={{ color: "#8b5cf6", opacity: 0.6 }} />
                    </div>
                    <div className="mob-empty-title">Немає записів</div>
                    <div className="mob-empty-sub">Запишіться на послугу прямо зараз</div>
                </div>
            </div>

            {/* Loyalty/bonuses teaser */}
            <div className="mob-card" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.1), rgba(13,13,20,0.8))", borderColor: "rgba(245,158,11,0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="mob-list-icon" style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)", width: 44, height: 44, borderRadius: 14 }}>
                        <Gift size={20} style={{ color: "#fbbf24" }} />
                    </div>
                    <div>
                        <div className="mob-list-title">Програма лояльності</div>
                        <div className="mob-list-sub">Бонуси за кожен візит</div>
                    </div>
                    <Star size={16} style={{ color: "#fbbf24", marginLeft: "auto" }} />
                </div>
            </div>
        </div>
    )
}

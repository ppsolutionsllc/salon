import { auth } from "@/auth"
import { Calendar, Clock, Scissors } from "lucide-react"

export default async function StaffDashboard() {
    const session = await auth()
    const today = new Date().toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" })

    return (
        <div className="mob-page">
            {/* Hero */}
            <div className="mob-hero">
                <div className="mob-hero-glow" />
                <div className="mob-hero-title">
                    Добрий день! ✂️
                </div>
                <div className="mob-hero-sub">{today.charAt(0).toUpperCase() + today.slice(1)}</div>
                <div className="mob-hero-sub" style={{ marginTop: 8, fontSize: 12, opacity: 0.6 }}>
                    {session?.user?.email}
                </div>
            </div>

            {/* KPI */}
            <div className="mob-kpi-row">
                <div className="mob-kpi">
                    <div className="mob-kpi-val">0</div>
                    <div className="mob-kpi-label">Клієнтів сьогодні</div>
                </div>
                <div className="mob-kpi">
                    <div className="mob-kpi-val" style={{ color: "#10b981" }}>0 ₴</div>
                    <div className="mob-kpi-label">Очікуваний дохід</div>
                </div>
            </div>

            {/* Today's schedule */}
            <div className="mob-card">
                <div className="mob-section-title">Розклад на сьогодні</div>
                <div className="mob-empty">
                    <div className="mob-empty-icon">
                        <Calendar size={28} style={{ color: "#f43f5e", opacity: 0.6 }} />
                    </div>
                    <div className="mob-empty-title">Немає записів</div>
                    <div className="mob-empty-sub">На сьогодні нічого не заплановано 🎉</div>
                </div>
            </div>

            {/* Quick stats */}
            <div className="mob-card">
                <div className="mob-section-title">Цього тижня</div>
                <div className="mob-list-row">
                    <div className="mob-list-icon" style={{ background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.2)" }}>
                        <Scissors size={18} style={{ color: "#f43f5e" }} />
                    </div>
                    <div>
                        <div className="mob-list-title">Виконано послуг</div>
                        <div className="mob-list-sub">Всього за тиждень</div>
                    </div>
                    <div className="mob-list-right">
                        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--mob-text)" }}>0</div>
                    </div>
                </div>
                <div className="mob-list-row">
                    <div className="mob-list-icon" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.2)" }}>
                        <Clock size={18} style={{ color: "#10b981" }} />
                    </div>
                    <div>
                        <div className="mob-list-title">Відпрацьовано годин</div>
                        <div className="mob-list-sub">Поточний тиждень</div>
                    </div>
                    <div className="mob-list-right">
                        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--mob-text)" }}>0</div>
                    </div>
                </div>
            </div>
        </div>
    )
}

import { TrendingUp, TrendingDown, Calendar, Users, DollarSign, Clock } from "lucide-react"

const stats = [
    {
        label: "Записів сьогодні",
        value: "12",
        sub: "+3 порівняно з вчора",
        trend: "up",
        icon: Calendar,
        color: "from-blue-500/20 to-blue-600/5",
        iconColor: "text-blue-400",
    },
    {
        label: "Дохід за сьогодні",
        value: "₴ 14 500",
        sub: "+12% від плану",
        trend: "up",
        icon: DollarSign,
        color: "from-emerald-500/20 to-emerald-600/5",
        iconColor: "text-emerald-400",
    },
    {
        label: "Активних клієнтів",
        value: "248",
        sub: "+5 за цей тиждень",
        trend: "up",
        icon: Users,
        color: "from-violet-500/20 to-violet-600/5",
        iconColor: "text-violet-400",
    },
    {
        label: "Середній чек",
        value: "₴ 1 208",
        sub: "-2% від минулого тижня",
        trend: "down",
        icon: TrendingUp,
        color: "from-rose-500/20 to-rose-600/5",
        iconColor: "text-rose-400",
    },
]

const upcoming = [
    { time: "10:00", client: "Олена Коваль", service: "Стрижка + укладка", master: "Марина К.", status: "confirmed" },
    { time: "11:30", client: "Вікторія Лисенко", service: "Маніюр + педикюр", master: "Аліна Р.", status: "waiting" },
    { time: "12:00", client: "Катерина Поліщук", service: "Фарбування", master: "Тетяна В.", status: "confirmed" },
    { time: "14:00", client: "Олена Савченко", service: "Брови та вії", master: "Марина К.", status: "new" },
    { time: "15:30", client: "Юлія Мороз", service: "Масаж обличчя", master: "Ірина Д.", status: "confirmed" },
]

const statusTag: Record<string, { label: string; className: string }> = {
    confirmed: { label: "Підтверджено", className: "crm-tag-green" },
    waiting: { label: "Очікує", className: "crm-tag-yellow" },
    new: { label: "Новий", className: "crm-tag-blue" },
}

export default function CRMDashboard() {
    const today = new Date().toLocaleDateString("uk-UA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })

    return (
        <div className="crm-page">
            {/* Page header */}
            <div className="crm-page-header">
                <div>
                    <h1 className="crm-page-title">Дашборд</h1>
                    <p className="crm-page-sub">{today}</p>
                </div>
                <button className="crm-btn-primary-sm">
                    + Новий запис
                </button>
            </div>

            {/* Stats */}
            <div className="crm-stats-grid">
                {stats.map((s) => (
                    <div key={s.label} className="crm-stat-card">
                        <div className="crm-stat-top">
                            <div className={`crm-stat-icon-wrap bg-gradient-to-br ${s.color}`}>
                                <s.icon size={16} className={s.iconColor} />
                            </div>
                            {s.trend === "up"
                                ? <TrendingUp size={13} className="text-emerald-400" />
                                : <TrendingDown size={13} className="text-rose-400" />
                            }
                        </div>
                        <div className="crm-stat-value">{s.value}</div>
                        <div className="crm-stat-label">{s.label}</div>
                        <div className={`crm-stat-sub ${s.trend === "up" ? "text-emerald-400" : "text-rose-400"}`}>{s.sub}</div>
                    </div>
                ))}
            </div>

            {/* Grid: upcoming + quick actions */}
            <div className="crm-dash-grid">
                {/* Upcoming */}
                <div className="crm-card">
                    <div className="crm-card-header">
                        <div className="crm-card-title">
                            <Clock size={15} className="text-primary" />
                            Найближчі записи
                        </div>
                        <a href="/crm/calendar" className="crm-card-link">Всі →</a>
                    </div>
                    <div className="crm-table">
                        <div className="crm-table-head">
                            <div>Час</div><div>Клієнт</div><div>Послуга</div><div>Майстер</div><div>Статус</div>
                        </div>
                        {upcoming.map((row, i) => (
                            <div key={i} className="crm-table-row">
                                <div className="crm-table-time">{row.time}</div>
                                <div className="crm-table-strong">{row.client}</div>
                                <div className="crm-table-muted">{row.service}</div>
                                <div className="crm-table-muted">{row.master}</div>
                                <div>
                                    <span className={`crm-tag ${statusTag[row.status].className}`}>
                                        {statusTag[row.status].label}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick actions */}
                <div className="crm-card">
                    <div className="crm-card-header">
                        <div className="crm-card-title">Швидкі дії</div>
                    </div>
                    <div className="flex flex-col gap-2">
                        {[
                            { label: "➕ Додати клієнта", href: "/crm/clients/new" },
                            { label: "📋 Записати клієнта", href: "/crm/calendar/new" },
                            { label: "✂️ Додати послугу", href: "/crm/services" },
                            { label: "👤 Додати майстра", href: "/crm/staff" },
                            { label: "📊 Звіт за місяць", href: "/crm/analytics" },
                        ].map(a => (
                            <a key={a.href} href={a.href} className="crm-quick-action">{a.label}</a>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

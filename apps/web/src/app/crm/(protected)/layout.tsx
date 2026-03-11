import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { signOut } from "@/auth"
import {
    LayoutDashboard,
    Calendar,
    Users,
    Scissors,
    UserCheck,
    BarChart3,
    Settings,
    LogOut,
    ChevronRight,
    Bell,
    Search,
    Sparkles,
    Store,
    Shield,
    MessageSquare,
    TrendingUp,
    PanelsTopLeft,
} from "lucide-react"

const navItems = [
    {
        title: "Головне",
        items: [
            { icon: LayoutDashboard, label: "Дашборд", href: "/crm/dashboard" },
            { icon: Calendar, label: "Календар", href: "/crm/calendar" },
            { icon: TrendingUp, label: "Звіти", href: "/crm/reports" },
        ]
    },
    {
        title: "Управління",
        items: [
            { icon: Users, label: "Клієнти", href: "/crm/clients" },
            { icon: UserCheck, label: "Персонал", href: "/crm/staff" },
            { icon: Scissors, label: "Послуги", href: "/crm/services" },
            { icon: Store, label: "Салони", href: "/crm/salons" },
            { icon: PanelsTopLeft, label: "Редактор сайту", href: "/crm/site/pages" },
        ]
    },
    {
        title: "Комунікації",
        items: [
            { icon: MessageSquare, label: "Шаблони", href: "/crm/comms/templates" },
            { icon: BarChart3, label: "Аналітика", href: "/crm/analytics" },
        ]
    },
    {
        title: "Система",
        items: [
            { icon: Shield, label: "Користувачі", href: "/crm/users" },
            { icon: Settings, label: "Налаштування", href: "/crm/settings" },
        ]
    }
]

export default async function CRMLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()

    if (!session || !["NETWORK_ADMIN", "SALON_ADMIN", "OPERATOR"].includes(session.user?.global_role ?? "")) {
        redirect("/login")
    }

    const roleLabel: Record<string, string> = {
        NETWORK_ADMIN: "Мережевий Адмін",
        SALON_ADMIN: "Адмін Салону",
        OPERATOR: "Оператор",
    }

    return (
        <div className="crm-shell">
            {/* Sidebar */}
            <aside className="crm-sidebar">
                {/* Logo */}
                <div className="crm-sidebar-logo">
                    <div className="crm-logo-icon">
                        <Sparkles size={18} />
                    </div>
                    <div>
                        <div className="crm-logo-title">Aesthetic Prime</div>
                        <div className="crm-logo-sub">CRM Panel</div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="crm-nav">
                    {navItems.map(group => (
                        <div key={group.title} className="crm-nav-group">
                            <div className="crm-nav-group-title">{group.title}</div>
                            {group.items.map(item => (
                                <Link key={item.href} href={item.href} className="crm-nav-link">
                                    <item.icon size={16} />
                                    <span>{item.label}</span>
                                    <ChevronRight size={12} className="crm-nav-chevron" />
                                </Link>
                            ))}
                        </div>
                    ))}
                </nav>

                {/* User */}
                <div className="crm-sidebar-footer">
                    <div className="crm-user-card">
                        <div className="crm-user-avatar">
                            {(session.user?.email ?? "A").charAt(0).toUpperCase()}
                        </div>
                        <div className="crm-user-info">
                            <div className="crm-user-name">{session.user?.email}</div>
                            <div className="crm-user-role">{roleLabel[session.user?.global_role ?? ""] ?? session.user?.global_role}</div>
                        </div>
                    </div>
                    <form action={async () => {
                        "use server"
                        await signOut({ redirectTo: "/crm/login" })
                    }}>
                        <button type="submit" className="crm-logout-btn" title="Вийти">
                            <LogOut size={15} />
                        </button>
                    </form>
                </div>
            </aside>

            {/* Main */}
            <div className="crm-main">
                {/* Topbar */}
                <header className="crm-topbar">
                    <div className="crm-search-wrap">
                        <Search size={14} className="crm-search-icon" />
                        <input type="text" placeholder="Пошук..." className="crm-search-input" />
                    </div>
                    <div className="crm-topbar-actions">
                        <button className="crm-icon-btn" title="Повідомлення">
                            <Bell size={16} />
                            <span className="crm-badge">3</span>
                        </button>
                    </div>
                </header>

                {/* Content */}
                <main className="crm-content">
                    {children}
                </main>
            </div>

            {/* Mobile bottom nav (visible on small screens only) */}
            <nav className="crm-mobile-nav">
                <a href="/crm/dashboard"><LayoutDashboard size={20} /><span>Дашборд</span></a>
                <a href="/crm/clients"><Users size={20} /><span>Клієнти</span></a>
                <a href="/crm/calendar"><Calendar size={20} /><span>Календар</span></a>
                <a href="/crm/salons"><Store size={20} /><span>Салони</span></a>
                <a href="/crm/settings"><Settings size={20} /><span>Більше</span></a>
            </nav>
        </div>
    )
}

import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Home, Calendar, History, User, LogOut } from "lucide-react"

export default async function StaffLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()

    if (!session || !["NETWORK_ADMIN", "SALON_ADMIN", "OPERATOR", "STAFF"].includes(session.user?.global_role ?? "")) {
        redirect("/login")
    }

    const navItems = [
        { icon: Home, label: "Сьогодні", href: "/staff/dashboard" },
        { icon: Calendar, label: "Графік", href: "/staff/calendar" },
        { icon: History, label: "Записи", href: "/staff/appointments" },
        { icon: User, label: "Профіль", href: "/staff/profile" },
    ]

    return (
        <div className="mob-shell">
            {/* Status bar safe area */}
            <div className="mob-status-bar" />

            {/* Header */}
            <header className="mob-header">
                <div className="mob-header-inner">
                    <div>
                        <div className="mob-header-title">Aesthetic Prime</div>
                        <div className="mob-header-sub">Майстер</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="mob-avatar">{(session.user?.email ?? "M").charAt(0).toUpperCase()}</div>
                        <form action={async () => {
                            "use server"
                            await signOut({ redirectTo: "/login" })
                        }}>
                            <button type="submit" className="mob-icon-btn">
                                <LogOut size={16} />
                            </button>
                        </form>
                    </div>
                </div>
            </header>

            {/* Scrollable content */}
            <main className="mob-content">
                {children}
            </main>

            {/* Bottom navigation */}
            <nav className="mob-bottom-nav">
                {navItems.map(item => (
                    <Link key={item.href} href={item.href} className="mob-nav-item">
                        <item.icon size={22} />
                        <span>{item.label}</span>
                    </Link>
                ))}
            </nav>
        </div>
    )
}

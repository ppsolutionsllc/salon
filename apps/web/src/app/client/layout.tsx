import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Home, CalendarPlus, Clock, User, LogOut } from "lucide-react"

export default async function ClientLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await auth()
    if (!session) redirect("/login")

    const navItems = [
        { icon: Home, label: "Головна", href: "/client/dashboard" },
        { icon: CalendarPlus, label: "Запис", href: "/client/book" },
        { icon: Clock, label: "Записи", href: "/client/bookings" },
        { icon: User, label: "Профіль", href: "/client/profile" },
    ]

    const name = session.user?.email?.split("@")[0] ?? "Клієнт"

    return (
        <div className="mob-shell">
            <div className="mob-status-bar" />

            {/* Gradient header specific to client */}
            <header className="mob-header mob-header-client">
                <div className="mob-header-inner">
                    <div>
                        <div className="mob-header-title">Вітаємо, {name}!</div>
                        <div className="mob-header-sub">Aesthetic Prime</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="mob-avatar mob-avatar-client">{name.charAt(0).toUpperCase()}</div>
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

            <main className="mob-content">
                {children}
            </main>

            <nav className="mob-bottom-nav mob-bottom-nav-client">
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

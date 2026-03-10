"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function CRMLogin() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setLoading(true)

        const res = await signIn("credentials", {
            email,
            password,
            redirect: false,
        })

        setLoading(false)
        if (res?.error) {
            setError("Невірний логін або пароль")
        } else {
            router.push("/crm/dashboard")
        }
    }

    return (
        <div className="crm-login-bg min-h-screen flex items-center justify-center p-4">
            {/* Decorative blobs */}
            <div className="crm-blob crm-blob-1" />
            <div className="crm-blob crm-blob-2" />

            <div className="relative z-10 w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-[0_0_40px_rgba(244,63,94,0.4)] mb-4">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Aesthetic Prime</h1>
                    <p className="text-sm text-white/40 mt-1">Панель управління</p>
                </div>

                {/* Card */}
                <div className="crm-login-card p-8 rounded-2xl">
                    <h2 className="text-lg font-semibold text-white mb-1">Вхід до системи</h2>
                    <p className="text-sm text-white/40 mb-6">Введіть ваші облікові дані</p>

                    {error && (
                        <div className="flex items-center gap-2 p-3 mb-4 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Логін</label>
                            <input
                                type="text"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="admin"
                                className="crm-input"
                                required
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Пароль</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="crm-input"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="crm-btn-primary mt-2"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                                    Вхід...
                                </span>
                            ) : "Увійти"}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-white/20 mt-6">© 2026 Aesthetic Prime CRM Зроблено з ❤️ by Max Poliakov</p>
            </div>
        </div>
    )
}

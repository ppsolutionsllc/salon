"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function StaffLogin() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")

        const res = await signIn("credentials", {
            email,
            password,
            redirect: false,
        })

        if (res?.error) {
            setError("Невірний email або пароль")
        } else {
            router.push("/staff/dashboard")
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-muted/50">
            <div className="glass p-8 rounded-2xl w-full max-w-sm">
                <h2 className="text-2xl font-bold mb-6 text-center text-primary">Кабінет Майстра</h2>

                {error && <div className="p-3 mb-4 text-sm text-destructive bg-destructive/10 rounded-lg">{error}</div>}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium">Логін або Email</label>
                        <input
                            type="text"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="border border-border/50 rounded-lg p-2 bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            required
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-sm font-medium">Пароль</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="border border-border/50 rounded-lg p-2 bg-background/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                            required
                        />
                    </div>
                    <button type="submit" className="bg-primary text-primary-foreground p-2 rounded-lg font-medium mt-2 hover:bg-primary/90 transition-colors">
                        Увійти
                    </button>
                </form>

                <div className="mt-8 text-center text-sm">
                    <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                        ← На головну
                    </Link>
                </div>
            </div>
        </div>
    )
}

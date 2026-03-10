// Shared API utility for CRM/Staff/Client pages
// Handles fetch with auth token from NextAuth session

export interface ApiOptions {
    method?: string
    body?: unknown
    token?: string
}

async function apiFetch(path: string, opts: ApiOptions = {}) {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001/api/v1"

    // Don't make authenticated requests without a token — prevents 401 on mount
    if (opts.token === undefined || opts.token === "" || opts.token === null) {
        throw new Error("NO_TOKEN")
    }

    const res = await fetch(`${base}${path}`, {
        method: opts.method ?? "GET",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${opts.token}`,
        },
        body: opts.body ? JSON.stringify(opts.body) : undefined,
    })

    if (!res.ok) {
        if (res.status === 401) {
            if (typeof window !== "undefined") {
                const { signOut } = await import("next-auth/react")
                await signOut({ callbackUrl: "/login" })
            }
        }
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
        throw new Error(err.detail ?? `HTTP ${res.status}`)
    }
    if (res.status === 204) return null
    return res.json()
}

export default apiFetch

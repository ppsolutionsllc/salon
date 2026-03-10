// Shared API utility for CRM/Staff/Client pages
// Handles fetch with auth token from NextAuth session

export interface ApiOptions {
    method?: string
    body?: unknown
    token?: string
}

function resolveApiBase() {
    const fallback = "/api"
    const raw = (process.env.NEXT_PUBLIC_API_URL || fallback).trim().replace(/\/+$/, "")
    if (!raw) return fallback

    if (typeof window === "undefined") {
        return raw
    }

    if (raw.startsWith("/")) {
        return raw
    }

    try {
        const parsed = new URL(raw, window.location.origin)
        const blockedHosts = new Set(["api", "localhost", "127.0.0.1", "0.0.0.0"])

        // Never expose docker-internal/private hosts to browser-side fetch.
        if (blockedHosts.has(parsed.hostname) || parsed.host === "api:8000") {
            return fallback
        }

        // Enforce same-origin API usage on client.
        if (parsed.origin !== window.location.origin) {
            return fallback
        }

        return parsed.pathname.replace(/\/+$/, "") || fallback
    } catch {
        return fallback
    }
}

function withApiVersion(base: string, path: string) {
    if (base.endsWith("/v1")) {
        return `${base}${path}`
    }
    return `${base}/v1${path}`
}

async function apiFetch(path: string, opts: ApiOptions = {}) {
    const base = resolveApiBase()
    const safePath = path.startsWith("/") ? path : `/${path}`

    // Don't make authenticated requests without a token — prevents 401 on mount
    if (opts.token === undefined || opts.token === "" || opts.token === null) {
        throw new Error("NO_TOKEN")
    }

    const res = await fetch(withApiVersion(base, safePath), {
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

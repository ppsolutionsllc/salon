"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"

import { PageRenderer } from "@/components/site/page-renderer"
import type { SiteBlock } from "@/lib/site-editor/types"

type PreviewPayload = {
    slug: string
    title: string
    seo_title?: string | null
    seo_description?: string | null
    og_image_file_id?: number | null
    content_json: SiteBlock[]
    salon_id?: number | null
    preview: boolean
    preview_expires_at?: string | null
}

export default function PreviewPage() {
    const params = useParams<{ slug: string }>()
    const slug = params?.slug || ""
    const search = useSearchParams()
    const token = search.get("token") || ""
    const [data, setData] = useState<PreviewPayload | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!token) {
            setError("Токен preview не вказано")
            return
        }
        fetch(`/api/v1/site/preview/${slug}?token=${encodeURIComponent(token)}`)
            .then(async (res) => {
                if (!res.ok) {
                    const payload = await res.json().catch(() => ({}))
                    throw new Error(payload?.detail || `HTTP ${res.status}`)
                }
                return res.json()
            })
            .then((payload) => setData(payload))
            .catch((e: any) => setError(e?.message || "Не вдалося відкрити preview"))
    }, [slug, token])

    if (error) {
        return (
            <div className="min-h-screen bg-[#0f0f15] p-8 text-white">
                <div className="mx-auto max-w-3xl rounded-xl border border-rose-400/30 bg-rose-500/10 p-4">
                    <div className="text-lg font-semibold">Preview недоступний</div>
                    <div className="mt-1 text-sm text-white/80">{error}</div>
                    <Link href="/" className="mt-4 inline-block text-sm text-primary">На головну</Link>
                </div>
            </div>
        )
    }

    if (!data) {
        return <div className="min-h-screen bg-[#0f0f15] p-8 text-sm text-white/70">Завантаження preview...</div>
    }

    return (
        <div className="min-h-screen bg-[#0f0f15] px-4 py-8 text-white">
            <div className="mx-auto max-w-6xl space-y-4">
                <div className="rounded-xl border border-amber-400/30 bg-amber-500/15 p-3 text-sm">
                    PREVIEW: {data.title} {data.preview_expires_at ? `• дійсний до ${new Date(data.preview_expires_at).toLocaleString("uk-UA")}` : ""}
                </div>
                <PageRenderer content={data.content_json || []} salonId={data.salon_id || undefined} previewBadge />
            </div>
        </div>
    )
}

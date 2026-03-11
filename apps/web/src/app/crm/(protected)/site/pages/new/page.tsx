"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { createSitePage } from "@/lib/site-editor/api"
import { createDefaultBlock } from "@/lib/site-editor/blocks"
import { useToast } from "@/hooks/use-toast"

export default function NewSitePagePage() {
    const router = useRouter()
    const params = useSearchParams()
    const salonId = Number(params.get("salon") || 0)
    const { data: session } = useSession()
    const token = (session as any)?.accessToken as string | undefined
    const role = (session as any)?.user?.global_role as string | undefined
    const canEdit = role === "NETWORK_ADMIN" || role === "SALON_ADMIN" || process.env.NEXT_PUBLIC_SITE_EDITOR_OPERATOR_WRITE === "true"
    const { toast } = useToast()

    const [title, setTitle] = useState("")
    const [slug, setSlug] = useState("")
    const [seoTitle, setSeoTitle] = useState("")
    const [seoDescription, setSeoDescription] = useState("")
    const [loading, setLoading] = useState(false)

    const initialContent = useMemo(() => [createDefaultBlock("hero"), createDefaultBlock("rich_text")], [])

    async function onCreate() {
        if (!token) return
        if (salonId === 0 && role !== "NETWORK_ADMIN") {
            toast({ title: "Помилка", description: "Global сторінки може створювати лише мережевий адміністратор", variant: "destructive" })
            return
        }
        if (!title.trim() || !slug.trim()) {
            toast({ title: "Помилка", description: "Заповніть назву і slug", variant: "destructive" })
            return
        }
        setLoading(true)
        try {
            const created = await createSitePage(salonId, token, {
                title,
                slug,
                seo_title: seoTitle || null,
                seo_description: seoDescription || null,
                content_json: initialContent,
                comment: "Створення сторінки",
            })
            toast({ title: "Створено", description: "Сторінку створено успішно" })
            router.push(`/crm/site/pages/${created.id}/edit?salon=${salonId}`)
        } catch (e: any) {
            toast({ title: "Помилка", description: e?.message ?? "Не вдалося створити сторінку", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="crm-page">
            <div className="crm-page-header">
                <div>
                    <h1 className="crm-page-title">Нова сторінка</h1>
                    <p className="crm-page-sub">Створіть сторінку і перейдіть до редактора блоків</p>
                </div>
            </div>

            <div className="mx-auto w-full max-w-2xl rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <div className="text-sm text-white/70">Scope: {salonId === 0 ? "Global" : `Салон #${salonId}`}</div>
                <Input placeholder="Назва сторінки" value={title} onChange={(e) => setTitle(e.target.value)} />
                <Input placeholder="slug (наприклад: home)" value={slug} onChange={(e) => setSlug(e.target.value)} />
                <Input placeholder="SEO title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
                <Textarea placeholder="SEO description" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
                <div className="flex items-center justify-end gap-2">
                    <Button asChild variant="outline"><Link href={`/crm/site/pages?salon=${salonId}`}>Скасувати</Link></Button>
                    <Button onClick={onCreate} disabled={!canEdit || loading}>{loading ? "Створення..." : "Створити"}</Button>
                </div>
            </div>
        </div>
    )
}

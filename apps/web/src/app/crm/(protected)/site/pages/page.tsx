"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Globe, Layers, Plus, Pencil, Image as ImageIcon } from "lucide-react"

import apiFetch from "@/lib/api"
import { siteEditorUk } from "@/lib/i18n/site-editor-uk"
import { listSitePages } from "@/lib/site-editor/api"
import type { SitePage } from "@/lib/site-editor/types"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

type SalonOption = { id: number; name: string }

export default function SitePagesPage() {
    const { data: session } = useSession()
    const token = (session as any)?.accessToken as string | undefined
    const role = (session as any)?.user?.global_role as string | undefined
    const canEdit = role === "NETWORK_ADMIN" || role === "SALON_ADMIN" || process.env.NEXT_PUBLIC_SITE_EDITOR_OPERATOR_WRITE === "true"
    const params = useSearchParams()
    const { toast } = useToast()

    const [salons, setSalons] = useState<SalonOption[]>([])
    const [selectedSalon, setSelectedSalon] = useState<number>(Number(params.get("salon") || 0))
    const [pages, setPages] = useState<SitePage[]>([])
    const [loading, setLoading] = useState(false)

    const scopeLabel = useMemo(() => (selectedSalon === 0 ? siteEditorUk.pages.global : siteEditorUk.pages.salon), [selectedSalon])

    useEffect(() => {
        if (!token) return
        apiFetch("/salons", { token })
            .then((rows) => {
                const normalized = Array.isArray(rows) ? rows : []
                setSalons(normalized)
                if (role !== "NETWORK_ADMIN" && selectedSalon === 0 && normalized.length > 0) {
                    setSelectedSalon(normalized[0].id)
                }
            })
            .catch(() => setSalons([]))
    }, [role, selectedSalon, token])

    useEffect(() => {
        if (!token) return
        if (role !== "NETWORK_ADMIN" && selectedSalon === 0) return
        setLoading(true)
        listSitePages(selectedSalon, token)
            .then(setPages)
            .catch((e: any) => {
                setPages([])
                toast({ title: "Помилка", description: e?.message ?? "Не вдалося завантажити сторінки", variant: "destructive" })
            })
            .finally(() => setLoading(false))
    }, [role, selectedSalon, token, toast])

    return (
        <div className="crm-page space-y-4">
            <div className="crm-page-header">
                <div>
                    <h1 className="crm-page-title">{siteEditorUk.pages.title}</h1>
                    <p className="crm-page-sub">{siteEditorUk.pages.subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button asChild variant="outline">
                        <Link href={`/crm/site/media?salon=${selectedSalon}`}><ImageIcon size={14} />{siteEditorUk.nav.media}</Link>
                    </Button>
                    <Button asChild disabled={!canEdit}>
                        <Link href={`/crm/site/pages/new?salon=${selectedSalon}`}><Plus size={14} />{siteEditorUk.pages.create}</Link>
                    </Button>
                </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm text-white/70">Область контенту:</div>
                    <Select
                        value={String(selectedSalon)}
                        onValueChange={(v) => setSelectedSalon(Number(v))}
                    >
                        <SelectTrigger className="w-[240px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {role === "NETWORK_ADMIN" ? <SelectItem value="0">Global (мережа)</SelectItem> : null}
                            {salons.map((salon) => (
                                <SelectItem key={salon.id} value={String(salon.id)}>
                                    {salon.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Badge variant="secondary">{scopeLabel}</Badge>
                </div>
            </div>

            <div className="grid gap-3">
                {loading ? <div className="text-sm text-white/60">Завантаження...</div> : null}
                {!loading && pages.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-6 text-center text-sm text-white/60">
                        {siteEditorUk.pages.noData}
                    </div>
                ) : null}

                {pages.map((page) => (
                    <div key={page.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="flex flex-wrap items-start gap-2">
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-base font-semibold text-white">{page.title}</h3>
                                    {page.salon_id ? <Badge variant="outline"><Layers size={12} className="mr-1" />Салон</Badge> : <Badge variant="secondary"><Globe size={12} className="mr-1" />Global</Badge>}
                                    <Badge variant={page.published_version_id ? "success" : "warning"}>
                                        {page.published_version_id ? "Опубліковано" : "Чернетка"}
                                    </Badge>
                                </div>
                                <div className="mt-1 text-sm text-white/60">/{page.slug}</div>
                            </div>
                            <Button asChild variant="secondary" size="sm">
                                <Link href={`/crm/site/pages/${page.id}/edit?salon=${selectedSalon}`}><Pencil size={13} />Редагувати</Link>
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

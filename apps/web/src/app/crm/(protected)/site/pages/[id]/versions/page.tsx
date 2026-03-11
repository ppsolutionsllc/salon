"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { RotateCcw, History, Eye } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { listSiteVersions, rollbackSitePage } from "@/lib/site-editor/api"
import type { SiteVersion } from "@/lib/site-editor/types"
import { useToast } from "@/hooks/use-toast"

export default function SitePageVersionsRoute() {
    const routeParams = useParams<{ id: string }>()
    const pageId = Number(routeParams?.id)
    const search = useSearchParams()
    const salonId = Number(search.get("salon") || 0)
    const { data: session } = useSession()
    const token = (session as any)?.accessToken as string | undefined
    const role = (session as any)?.user?.global_role as string | undefined
    const canEdit = role === "NETWORK_ADMIN" || role === "SALON_ADMIN" || process.env.NEXT_PUBLIC_SITE_EDITOR_OPERATOR_WRITE === "true"
    const { toast } = useToast()

    const [versions, setVersions] = useState<SiteVersion[]>([])
    const [loading, setLoading] = useState(false)
    const [rolling, setRolling] = useState<number | null>(null)

    useEffect(() => {
        if (!token || !pageId) return
        setLoading(true)
        listSiteVersions(salonId, pageId, token)
            .then(setVersions)
            .catch((e: any) => toast({ title: "Помилка", description: e?.message ?? "Не вдалося завантажити версії", variant: "destructive" }))
            .finally(() => setLoading(false))
    }, [token, pageId, salonId, toast])

    async function rollback(versionId: number) {
        if (!token || !canEdit) return
        setRolling(versionId)
        try {
            await rollbackSitePage(salonId, pageId, versionId, token)
            const next = await listSiteVersions(salonId, pageId, token)
            setVersions(next)
            toast({ title: "Готово", description: "Чернетку відкотили до обраної версії" })
        } catch (e: any) {
            toast({ title: "Помилка", description: e?.message ?? "Не вдалося відкотити", variant: "destructive" })
        } finally {
            setRolling(null)
        }
    }

    return (
        <div className="crm-page space-y-4">
            <div className="crm-page-header">
                <div>
                    <h1 className="crm-page-title">Історія версій</h1>
                    <p className="crm-page-sub">Сторінка #{pageId}</p>
                </div>
                <Button asChild variant="outline">
                    <Link href={`/crm/site/pages/${pageId}/edit?salon=${salonId}`}><Eye size={14} />До редактора</Link>
                </Button>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                {loading ? <div className="text-sm text-white/60">Завантаження...</div> : null}
                {versions.map((version) => (
                    <div key={version.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-black/10 p-3">
                        <History size={14} className="text-white/60" />
                        <div className="text-sm text-white/90">Версія #{version.id}</div>
                        {version.is_draft ? <Badge variant="warning">Чернетка</Badge> : null}
                        {version.is_published ? <Badge variant="success">Опублікована</Badge> : null}
                        <div className="text-xs text-white/50 ml-1">{version.comment || "Без коментаря"}</div>
                        <div className="text-xs text-white/40 ml-auto">{version.created_at ? new Date(version.created_at).toLocaleString("uk-UA") : "—"}</div>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => rollback(version.id)}
                            disabled={!canEdit || version.is_draft || rolling === version.id}
                        >
                            <RotateCcw size={13} />
                            {rolling === version.id ? "Відкат..." : "Відкотити"}
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    )
}

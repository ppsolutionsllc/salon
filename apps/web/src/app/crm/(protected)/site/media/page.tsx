"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import Image from "next/image"
import { UploadCloud } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { listMedia, patchMedia, uploadMedia } from "@/lib/site-editor/api"
import type { SiteMediaFile } from "@/lib/site-editor/types"
import { useToast } from "@/hooks/use-toast"

export default function SiteMediaPage() {
    const search = useSearchParams()
    const salonId = Number(search.get("salon") || 0)
    const { data: session } = useSession()
    const token = (session as any)?.accessToken as string | undefined
    const role = (session as any)?.user?.global_role as string | undefined
    const canEdit = role === "NETWORK_ADMIN" || role === "SALON_ADMIN" || process.env.NEXT_PUBLIC_SITE_EDITOR_OPERATOR_WRITE === "true"
    const { toast } = useToast()

    const [items, setItems] = useState<SiteMediaFile[]>([])
    const [loading, setLoading] = useState(false)
    const [titleById, setTitleById] = useState<Record<number, string>>({})
    const [uploading, setUploading] = useState(false)

    async function load() {
        if (!token) return
        if (salonId === 0 && role !== "NETWORK_ADMIN") {
            setItems([])
            return
        }
        setLoading(true)
        try {
            const data = await listMedia(salonId, token)
            setItems(data)
            const nextTitles: Record<number, string> = {}
            data.forEach((m) => {
                nextTitles[m.id] = m.title || ""
            })
            setTitleById(nextTitles)
        } catch (e: any) {
            toast({ title: "Помилка", description: e?.message ?? "Не вдалося завантажити медіа", variant: "destructive" })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [role, token, salonId])

    async function onUpload(file: File) {
        if (!token || !canEdit) return
        if (salonId === 0 && role !== "NETWORK_ADMIN") return
        setUploading(true)
        try {
            await uploadMedia(salonId, token, file, true, file.name)
            await load()
            toast({ title: "Завантажено", description: "Файл додано в бібліотеку" })
        } catch (e: any) {
            toast({ title: "Помилка", description: e?.message ?? "Не вдалося завантажити файл", variant: "destructive" })
        } finally {
            setUploading(false)
        }
    }

    async function saveItem(meta: SiteMediaFile) {
        if (!token || !canEdit) return
        try {
            await patchMedia(salonId, meta.id, token, {
                title: titleById[meta.id] ?? "",
                is_public: meta.is_public,
            })
            toast({ title: "Оновлено", description: "Метадані файлу збережено" })
        } catch (e: any) {
            toast({ title: "Помилка", description: e?.message ?? "Не вдалося зберегти", variant: "destructive" })
        }
    }

    async function togglePublic(meta: SiteMediaFile) {
        if (!token || !canEdit) return
        try {
            await patchMedia(salonId, meta.id, token, {
                title: titleById[meta.id] ?? "",
                is_public: !meta.is_public,
            })
            await load()
        } catch (e: any) {
            toast({ title: "Помилка", description: e?.message ?? "Не вдалося змінити доступ", variant: "destructive" })
        }
    }

    return (
        <div className="crm-page space-y-4">
            <div className="crm-page-header">
                <div>
                    <h1 className="crm-page-title">Медіа бібліотека</h1>
                    <p className="crm-page-sub">Scope: {salonId === 0 ? "Global" : `Салон #${salonId}`}</p>
                </div>
                <div className="flex items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/20 bg-white/[0.03] px-3 py-2 text-sm text-white hover:bg-white/[0.08]">
                        <UploadCloud size={14} />
                        {uploading ? "Завантаження..." : "Завантажити"}
                        <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
                    </label>
                    <Button asChild variant="outline"><Link href={`/crm/site/pages?salon=${salonId}`}>До сторінок</Link></Button>
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {loading ? <div className="text-sm text-white/60">Завантаження...</div> : null}
                {items.map((item) => (
                    <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
                        <div className="relative h-40 overflow-hidden rounded-md bg-black/20">
                            {item.is_public ? <Image src={`/api/v1/media/${item.id}`} alt={item.filename} fill className="object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-white/50">Приватний файл</div>}
                        </div>
                        <div className="text-xs text-white/50">{item.filename}</div>
                        <Input value={titleById[item.id] ?? ""} onChange={(e) => setTitleById((prev) => ({ ...prev, [item.id]: e.target.value }))} placeholder="Назва файлу" />
                        <div className="flex items-center gap-2">
                            <Badge variant={item.is_public ? "success" : "secondary"}>{item.is_public ? "Публічний" : "Приватний"}</Badge>
                            <Button size="sm" variant="secondary" onClick={() => togglePublic(item)} disabled={!canEdit}>
                                {item.is_public ? "Зробити приватним" : "Зробити публічним"}
                            </Button>
                            <Button size="sm" onClick={() => saveItem(item)} disabled={!canEdit}>Зберегти</Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

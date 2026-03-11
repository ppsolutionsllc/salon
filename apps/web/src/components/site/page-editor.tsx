"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { AnimatePresence, motion } from "framer-motion"
import {
    GripVertical,
    Plus,
    Save,
    Eye,
    History,
    UploadCloud,
    Trash2,
    Rocket,
    FileText,
    LayoutTemplate,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { siteEditorUk } from "@/lib/i18n/site-editor-uk"
import { createDefaultBlock, blockCatalog } from "@/lib/site-editor/blocks"
import { pageContentSchema } from "@/lib/site-editor/schema"
import type { BlockType, SiteBlock, SitePage } from "@/lib/site-editor/types"
import {
    createPreviewToken,
    getSitePage,
    listMedia,
    patchSitePage,
    publishSitePage,
    saveSitePage,
    uploadMedia,
} from "@/lib/site-editor/api"
import { PageRenderer } from "@/components/site/page-renderer"
import { RichTextEditor } from "@/components/site/rich-text-editor"
import { useToast } from "@/hooks/use-toast"

type Props = {
    pageId: number
    salonId: number
}

function SortableBlockRow({
    block,
    selected,
    onSelect,
    onRemove,
}: {
    block: SiteBlock
    selected: boolean
    onSelect: () => void
    onRemove: () => void
}) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id })
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center gap-2 rounded-lg border px-2 py-2 ${selected ? "border-primary bg-primary/10" : "border-white/10 bg-white/[0.02]"}`}
        >
            <button className="text-white/40" {...attributes} {...listeners}>
                <GripVertical size={16} />
            </button>
            <button className="flex-1 text-left text-sm text-white/90" onClick={onSelect}>
                {block.type}
            </button>
            <button className="text-rose-300/80 hover:text-rose-300" onClick={onRemove}>
                <Trash2 size={14} />
            </button>
        </div>
    )
}

export function PageEditor({ pageId, salonId }: Props) {
    const router = useRouter()
    const { data: session } = useSession()
    const token = (session as any)?.accessToken as string | undefined
    const role = (session as any)?.user?.global_role as string | undefined
    const canEdit = role === "NETWORK_ADMIN" || role === "SALON_ADMIN" || process.env.NEXT_PUBLIC_SITE_EDITOR_OPERATOR_WRITE === "true"
    const { toast } = useToast()

    const [page, setPage] = useState<SitePage | null>(null)
    const [title, setTitle] = useState("")
    const [slug, setSlug] = useState("")
    const [seoTitle, setSeoTitle] = useState("")
    const [seoDescription, setSeoDescription] = useState("")
    const [ogImageFileId, setOgImageFileId] = useState<string>("")
    const [blocks, setBlocks] = useState<SiteBlock[]>([])
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [publishing, setPublishing] = useState(false)
    const [searchBlock, setSearchBlock] = useState("")
    const [uploading, setUploading] = useState(false)
    const [mediaOpen, setMediaOpen] = useState(false)
    const [mediaItems, setMediaItems] = useState<Array<{ id: number; title?: string | null; filename: string; is_public: boolean }>>([])

    const selectedBlock = useMemo(() => blocks.find((b) => b.id === selectedBlockId) || null, [blocks, selectedBlockId])
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

    useEffect(() => {
        if (!token) return
        getSitePage(salonId, pageId, token)
            .then((data) => {
                setPage(data)
                setTitle(data.title)
                setSlug(data.slug)
                setSeoTitle(data.seo_title || "")
                setSeoDescription(data.seo_description || "")
                setOgImageFileId(data.og_image_file_id ? String(data.og_image_file_id) : "")
                const draft = Array.isArray(data.draft_content_json) ? data.draft_content_json : []
                setBlocks(draft)
                setSelectedBlockId(draft[0]?.id || null)
            })
            .catch((e: any) => {
                toast({ title: "Помилка", description: e?.message ?? "Не вдалося завантажити сторінку", variant: "destructive" })
            })
    }, [pageId, salonId, token, toast])

    useEffect(() => {
        if (!canEdit || !token || !page) return
        const timer = window.setInterval(() => {
            const parsed = pageContentSchema.safeParse(blocks)
            if (!parsed.success) return
            saveSitePage(salonId, page.id, token, { content_json: blocks, comment: "Автозбереження" }).catch(() => null)
        }, 60000)
        return () => window.clearInterval(timer)
    }, [blocks, canEdit, page, salonId, token])

    function onDragEnd(event: DragEndEvent) {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const oldIndex = blocks.findIndex((b) => b.id === active.id)
        const newIndex = blocks.findIndex((b) => b.id === over.id)
        if (oldIndex < 0 || newIndex < 0) return
        setBlocks((prev) => arrayMove(prev, oldIndex, newIndex))
    }

    function addBlock(type: BlockType) {
        if (!canEdit) return
        const next = createDefaultBlock(type)
        setBlocks((prev) => [...prev, next])
        setSelectedBlockId(next.id)
    }

    function removeBlock(blockId: string) {
        if (!canEdit) return
        setBlocks((prev) => prev.filter((b) => b.id !== blockId))
        if (selectedBlockId === blockId) setSelectedBlockId(null)
    }

    function updateSelectedProps(nextProps: Record<string, any>) {
        if (!selectedBlock || !canEdit) return
        setBlocks((prev) => prev.map((b) => (b.id === selectedBlock.id ? { ...b, props: { ...b.props, ...nextProps } } : b)))
    }

    async function saveNow(comment = "Збереження вручну") {
        if (!page || !token) return
        const parsed = pageContentSchema.safeParse(blocks)
        if (!parsed.success) {
            toast({ title: "Помилка", description: "Некоректна структура блоків", variant: "destructive" })
            return
        }
        setSaving(true)
        try {
            await patchSitePage(salonId, page.id, token, {
                title,
                slug,
                seo_title: seoTitle || null,
                seo_description: seoDescription || null,
                og_image_file_id: ogImageFileId ? Number(ogImageFileId) : null,
            })
            const updated = await saveSitePage(salonId, page.id, token, { content_json: blocks, comment })
            setPage(updated)
            toast({ title: "Збережено", description: "Чернетку оновлено" })
        } catch (e: any) {
            toast({ title: "Помилка", description: e?.message ?? "Не вдалося зберегти", variant: "destructive" })
        } finally {
            setSaving(false)
        }
    }

    async function publishNow() {
        if (!page || !token) return
        setPublishing(true)
        try {
            await saveNow("Підготовка до публікації")
            const updated = await publishSitePage(salonId, page.id, token)
            setPage(updated)
            toast({ title: "Опубліковано", description: "Поточна чернетка доступна на сайті" })
        } catch (e: any) {
            toast({ title: "Помилка", description: e?.message ?? "Не вдалося опублікувати", variant: "destructive" })
        } finally {
            setPublishing(false)
        }
    }

    async function openPreview() {
        if (!page || !token) return
        try {
            const data = await createPreviewToken(salonId, page.id, token, 24)
            window.open(data.preview_url, "_blank", "noopener,noreferrer")
        } catch (e: any) {
            toast({ title: "Помилка", description: e?.message ?? "Не вдалося створити preview", variant: "destructive" })
        }
    }

    async function handleUploadImage(file: File) {
        if (!token || !canEdit) return
        setUploading(true)
        try {
            const uploaded = await uploadMedia(salonId, token, file, true, file.name)
            updateSelectedProps({ backgroundImage: uploaded.id })
            toast({ title: "Завантажено", description: "Зображення додано в блок" })
        } catch (e: any) {
            toast({ title: "Помилка", description: e?.message ?? "Не вдалося завантажити файл", variant: "destructive" })
        } finally {
            setUploading(false)
        }
    }

    async function openMediaPicker() {
        if (!token) return
        try {
            const items = await listMedia(salonId, token)
            setMediaItems(items)
            setMediaOpen(true)
        } catch (e: any) {
            toast({ title: "Помилка", description: e?.message ?? "Не вдалося завантажити медіа", variant: "destructive" })
        }
    }

    const filteredCatalog = blockCatalog.filter((item) => item.title.toLowerCase().includes(searchBlock.toLowerCase()))

    return (
        <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md">
                <div className="flex flex-wrap items-center gap-2">
                    <LayoutTemplate size={18} className="text-primary" />
                    <h1 className="text-xl font-semibold text-white">{title || "Редактор сторінки"}</h1>
                    <Badge variant={page?.published_version_id ? "success" : "warning"}>{page?.published_version_id ? siteEditorUk.editor.published : siteEditorUk.editor.draft}</Badge>
                    {!canEdit ? <Badge variant="secondary">{siteEditorUk.editor.readonly}</Badge> : null}
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                        <Button variant="secondary" onClick={openPreview}><Eye size={14} />{siteEditorUk.editor.preview}</Button>
                        <Button asChild variant="outline"><Link href={`/crm/site/pages/${pageId}/versions?salon=${salonId}`}><History size={14} />{siteEditorUk.editor.versions}</Link></Button>
                        <Button variant="secondary" onClick={() => saveNow()} disabled={!canEdit || saving}><Save size={14} />{saving ? "Збереження..." : siteEditorUk.editor.save}</Button>
                        <Button onClick={publishNow} disabled={!canEdit || publishing}><Rocket size={14} />{publishing ? "Публікація..." : siteEditorUk.editor.publish}</Button>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[260px_1fr_340px]">
                <aside className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="mb-3 text-sm font-semibold text-white">{siteEditorUk.editor.blocks}</div>
                    <Input value={searchBlock} onChange={(e) => setSearchBlock(e.target.value)} placeholder="Пошук блоку..." />
                    <div className="mt-3 space-y-2">
                        {filteredCatalog.map((item) => (
                            <button
                                key={item.type}
                                className="w-full rounded-lg border border-white/10 bg-white/[0.02] p-2 text-left text-sm text-white/90 hover:bg-white/[0.06]"
                                onClick={() => addBlock(item.type)}
                                disabled={!canEdit}
                            >
                                <div className="flex items-center gap-2">
                                    <Plus size={12} className="text-primary" />
                                    <span>{item.title}</span>
                                </div>
                                <div className="mt-1 text-xs text-white/50">{item.description}</div>
                            </button>
                        ))}
                    </div>
                </aside>

                <section className="space-y-3 rounded-2xl border border-white/10 bg-[#15151f] p-4">
                    <div className="text-sm font-semibold text-white">{siteEditorUk.editor.canvas}</div>
                    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
                        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-2">
                                {blocks.map((block) => (
                                    <SortableBlockRow
                                        key={block.id}
                                        block={block}
                                        selected={selectedBlockId === block.id}
                                        onSelect={() => setSelectedBlockId(block.id)}
                                        onRemove={() => removeBlock(block.id)}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>

                    <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                        <PageRenderer content={blocks} salonId={salonId === 0 ? undefined : salonId} showUnknown previewBadge />
                    </div>
                </section>

                <aside className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                    <Tabs defaultValue="block">
                        <TabsList className="w-full">
                            <TabsTrigger value="block">{siteEditorUk.editor.settings}</TabsTrigger>
                            <TabsTrigger value="page">{siteEditorUk.editor.page}</TabsTrigger>
                            <TabsTrigger value="seo">{siteEditorUk.editor.seo}</TabsTrigger>
                        </TabsList>

                        <TabsContent value="block" className="space-y-3">
                            {selectedBlock ? (
                                <AnimatePresence mode="wait">
                                    <motion.div key={selectedBlock.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                                        <div className="text-xs text-white/50">Тип блоку</div>
                                        <div className="mb-3 mt-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-sm text-white/90">{selectedBlock.type}</div>

                                        {selectedBlock.type === "hero" ? (
                                            <div className="space-y-2">
                                                <Input value={selectedBlock.props?.title || ""} onChange={(e) => updateSelectedProps({ title: e.target.value })} placeholder="Заголовок" />
                                                <Textarea value={selectedBlock.props?.subtitle || ""} onChange={(e) => updateSelectedProps({ subtitle: e.target.value })} placeholder="Підзаголовок" />
                                                <Input value={selectedBlock.props?.primaryCtaLabel || ""} onChange={(e) => updateSelectedProps({ primaryCtaLabel: e.target.value })} placeholder="Текст кнопки" />
                                                <Input value={selectedBlock.props?.primaryCtaHref || ""} onChange={(e) => updateSelectedProps({ primaryCtaHref: e.target.value })} placeholder="Посилання кнопки" />
                                                <div className="rounded-md border border-white/10 p-2">
                                                    <div className="mb-2 text-xs text-white/50">Фон (media id)</div>
                                                    <Input value={String(selectedBlock.props?.backgroundImage || "")} onChange={(e) => updateSelectedProps({ backgroundImage: e.target.value ? Number(e.target.value) : null })} />
                                                    <div className="mt-2 flex items-center gap-2">
                                                        <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-white/70">
                                                            <UploadCloud size={14} />
                                                            {uploading ? "Завантаження..." : "Завантажити"}
                                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleUploadImage(e.target.files[0])} />
                                                        </label>
                                                        <Button type="button" size="sm" variant="outline" onClick={openMediaPicker}>
                                                            Обрати з бібліотеки
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null}

                                        {selectedBlock.type === "rich_text" ? (
                                            <RichTextEditor
                                                value={selectedBlock.props?.content}
                                                onChange={(next) => updateSelectedProps({ content: next })}
                                            />
                                        ) : null}

                                        {selectedBlock.type !== "hero" && selectedBlock.type !== "rich_text" ? (
                                            <div className="space-y-2">
                                                <div className="text-xs text-white/50">JSON props</div>
                                                <Textarea
                                                    rows={12}
                                                    value={JSON.stringify(selectedBlock.props ?? {}, null, 2)}
                                                    onChange={(e) => {
                                                        try {
                                                            const parsed = JSON.parse(e.target.value)
                                                            updateSelectedProps(parsed)
                                                        } catch {
                                                            // noop while typing invalid JSON
                                                        }
                                                    }}
                                                />
                                            </div>
                                        ) : null}
                                    </motion.div>
                                </AnimatePresence>
                            ) : (
                                <div className="rounded-md border border-dashed border-white/20 p-4 text-sm text-white/50">Оберіть блок для редагування</div>
                            )}
                        </TabsContent>

                        <TabsContent value="page" className="space-y-2">
                            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Назва сторінки" disabled={!canEdit} />
                            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug" disabled={!canEdit} />
                            <div className="text-xs text-white/50">OG зображення (media id)</div>
                            <Input value={ogImageFileId} onChange={(e) => setOgImageFileId(e.target.value)} placeholder="Напр. 12" disabled={!canEdit} />
                            <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.02] p-2 text-xs text-white/60">
                                <FileText size={14} /> Всі збереження створюють нову версію сторінки
                            </div>
                        </TabsContent>

                        <TabsContent value="seo" className="space-y-2">
                            <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="SEO title" disabled={!canEdit} />
                            <Textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} placeholder="SEO description" disabled={!canEdit} />
                            <div className="rounded-md border border-white/10 bg-white/[0.02] p-3">
                                <div className="text-xs text-white/50">Прев'ю SEO</div>
                                <div className="mt-1 text-sm font-semibold text-blue-300">{seoTitle || title || "Назва сторінки"}</div>
                                <div className="text-xs text-white/70">{seoDescription || "Опис сторінки для пошукових систем"}</div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </aside>
            </div>

            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="ghost" size="sm">Повернутись до списку</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Вийти з редактора?</DialogTitle>
                        <DialogDescription>Незбережені зміни можуть бути втрачені.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => saveNow("Швидке збереження перед виходом")}>Зберегти і вийти</Button>
                        <Button variant="secondary" onClick={() => router.push(`/crm/site/pages?salon=${salonId}`)}>Вийти без збереження</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={mediaOpen} onOpenChange={setMediaOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Медіа бібліотека</DialogTitle>
                        <DialogDescription>Оберіть зображення для Hero блоку</DialogDescription>
                    </DialogHeader>
                    <div className="grid max-h-[420px] gap-2 overflow-y-auto sm:grid-cols-2">
                        {mediaItems.map((item) => (
                            <button
                                key={item.id}
                                className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-left hover:bg-white/[0.06]"
                                onClick={() => {
                                    updateSelectedProps({ backgroundImage: item.id })
                                    setMediaOpen(false)
                                }}
                            >
                                <div className="text-sm font-medium text-white">{item.title || item.filename}</div>
                                <div className="text-xs text-white/50">ID: {item.id} • {item.is_public ? "public" : "private"}</div>
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

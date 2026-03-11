"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"

import type { SiteBlock } from "@/lib/site-editor/types"

type PublicService = {
    id: number
    name: string
    description?: string | null
    price: number
}

type PublicStaff = {
    id: number
    first_name: string
    last_name: string
}

type Props = {
    content: SiteBlock[]
    salonId?: number | null
    showUnknown?: boolean
    previewBadge?: boolean
}

function renderTiptapText(node: any): string {
    if (!node) return ""
    if (Array.isArray(node)) return node.map(renderTiptapText).join(" ")
    if (typeof node === "string") return node
    if (node.text) return String(node.text)
    if (node.content) return renderTiptapText(node.content)
    return ""
}

export function PageRenderer({ content, salonId, showUnknown = false, previewBadge = false }: Props) {
    const [services, setServices] = useState<PublicService[]>([])
    const [masters, setMasters] = useState<PublicStaff[]>([])

    const hasServicesTeaser = useMemo(() => content.some((b) => b.type === "services_teaser"), [content])
    const hasMastersTeaser = useMemo(() => content.some((b) => b.type === "masters_teaser"), [content])

    useEffect(() => {
        if (!salonId || !hasServicesTeaser) return
        fetch(`/api/v1/public/salons/${salonId}/services`)
            .then((r) => (r.ok ? r.json() : []))
            .then((rows) => setServices(Array.isArray(rows) ? rows : []))
            .catch(() => setServices([]))
    }, [hasServicesTeaser, salonId])

    useEffect(() => {
        if (!salonId || !hasMastersTeaser) return
        fetch(`/api/v1/public/salons/${salonId}/staff`)
            .then((r) => (r.ok ? r.json() : []))
            .then((rows) => setMasters(Array.isArray(rows) ? rows : []))
            .catch(() => setMasters([]))
    }, [hasMastersTeaser, salonId])

    return (
        <div className="space-y-6">
            {previewBadge && (
                <div className="sticky top-2 z-30 inline-flex rounded-full border border-amber-400/40 bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-200">
                    PREVIEW
                </div>
            )}

            {content.map((block, idx) => {
                const animation = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.2, delay: Math.min(idx * 0.03, 0.18) } }

                if (block.type === "hero") {
                    const bgId = block.props?.backgroundImage
                    return (
                        <motion.section key={block.id} {...animation} className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-rose-100/15 via-white/5 to-rose-200/10 p-8">
                            {bgId ? (
                                <Image src={`/api/v1/media/${bgId}`} alt="Hero" fill className="object-cover opacity-35" />
                            ) : null}
                            <div className="relative z-10 max-w-2xl">
                                <h1 className="text-4xl font-semibold tracking-tight text-white">{block.props?.title || "Hero"}</h1>
                                <p className="mt-2 text-white/80">{block.props?.subtitle}</p>
                                <div className="mt-5">
                                    <Link href={block.props?.primaryCtaHref || "/zapys"} className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">
                                        {block.props?.primaryCtaLabel || "Дія"}
                                    </Link>
                                </div>
                            </div>
                        </motion.section>
                    )
                }

                if (block.type === "rich_text") {
                    const text = renderTiptapText(block.props?.content) || "Порожній текстовий блок"
                    return (
                        <motion.section key={block.id} {...animation} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                            <p className="leading-7 text-white/90">{text}</p>
                        </motion.section>
                    )
                }

                if (block.type === "features") {
                    const items = Array.isArray(block.props?.items) ? block.props.items : []
                    return (
                        <motion.section key={block.id} {...animation} className="grid gap-3 md:grid-cols-3">
                            {items.map((item: any, i: number) => (
                                <div key={`${block.id}-${i}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                                    <div className="text-sm font-semibold text-white">{item.title || "Перевага"}</div>
                                    <div className="mt-1 text-sm text-white/70">{item.text}</div>
                                </div>
                            ))}
                        </motion.section>
                    )
                }

                if (block.type === "services_teaser") {
                    const limit = Number(block.props?.limit || 6)
                    const rows = services.slice(0, limit)
                    return (
                        <motion.section key={block.id} {...animation} className="space-y-3">
                            <div className="text-2xl font-semibold text-white">Послуги</div>
                            <div className="grid gap-3 md:grid-cols-3">
                                {rows.map((svc) => (
                                    <div key={svc.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                                        <div className="font-semibold text-white">{svc.name}</div>
                                        <div className="mt-1 text-sm text-white/70">{svc.description || "Преміум процедура"}</div>
                                        {block.props?.showPrices ? <div className="mt-2 text-sm text-white/90">від {svc.price} грн</div> : null}
                                    </div>
                                ))}
                            </div>
                        </motion.section>
                    )
                }

                if (block.type === "masters_teaser") {
                    const limit = Number(block.props?.limit || 6)
                    const rows = masters.slice(0, limit)
                    return (
                        <motion.section key={block.id} {...animation} className="space-y-3">
                            <div className="text-2xl font-semibold text-white">Наші майстри</div>
                            <div className="grid gap-3 md:grid-cols-3">
                                {rows.map((m) => (
                                    <div key={m.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                                        <div className="font-semibold text-white">{m.first_name} {m.last_name}</div>
                                    </div>
                                ))}
                            </div>
                        </motion.section>
                    )
                }

                if (block.type === "before_after") {
                    const pairs = Array.isArray(block.props?.pairs) ? block.props.pairs : []
                    return (
                        <motion.section key={block.id} {...animation} className="space-y-3">
                            <div className="text-2xl font-semibold text-white">До і Після</div>
                            <div className="grid gap-3 md:grid-cols-2">
                                {pairs.map((pair: any, i: number) => (
                                    <div key={`${block.id}-${i}`} className="grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                                        <div className="relative h-36 overflow-hidden rounded-lg bg-black/20">
                                            {pair.before_image ? <Image src={`/api/v1/media/${pair.before_image}`} alt="Before" fill className="object-cover" /> : null}
                                        </div>
                                        <div className="relative h-36 overflow-hidden rounded-lg bg-black/20">
                                            {pair.after_image ? <Image src={`/api/v1/media/${pair.after_image}`} alt="After" fill className="object-cover" /> : null}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.section>
                    )
                }

                if (block.type === "testimonials") {
                    const items = Array.isArray(block.props?.items) ? block.props.items : []
                    return (
                        <motion.section key={block.id} {...animation} className="space-y-3">
                            <div className="text-2xl font-semibold text-white">Відгуки</div>
                            <div className="grid gap-3 md:grid-cols-3">
                                {items.map((item: any, i: number) => (
                                    <div key={`${block.id}-${i}`} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                                        <div className="text-sm font-semibold text-white">{item.name || "Клієнт"}</div>
                                        <div className="mt-1 text-sm text-white/75">{item.text}</div>
                                    </div>
                                ))}
                            </div>
                        </motion.section>
                    )
                }

                if (block.type === "branches") {
                    return (
                        <motion.section key={block.id} {...animation} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="text-xl font-semibold text-white">Наші салони</div>
                            <p className="mt-2 text-sm text-white/75">Контакти та адреси підтягуються з CRM салонів.</p>
                        </motion.section>
                    )
                }

                if (block.type === "faq") {
                    const items = Array.isArray(block.props?.items) ? block.props.items : []
                    return (
                        <motion.section key={block.id} {...animation} className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="text-xl font-semibold text-white">FAQ</div>
                            {items.map((item: any, i: number) => (
                                <div key={`${block.id}-${i}`} className="rounded-lg border border-white/10 bg-black/10 p-3">
                                    <div className="text-sm font-semibold text-white">{item.question}</div>
                                    <div className="mt-1 text-sm text-white/75">{item.answer}</div>
                                </div>
                            ))}
                        </motion.section>
                    )
                }

                if (showUnknown) {
                    return (
                        <div key={block.id} className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
                            Unknown block: {block.type}
                        </div>
                    )
                }
                return null
            })}
        </div>
    )
}

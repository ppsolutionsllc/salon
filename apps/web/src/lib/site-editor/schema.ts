import { z } from "zod"

const blockTypeSchema = z.enum([
    "hero",
    "rich_text",
    "features",
    "services_teaser",
    "masters_teaser",
    "before_after",
    "testimonials",
    "branches",
    "faq",
])

export const siteBlockSchema = z.object({
    id: z.string().min(1),
    type: blockTypeSchema,
    props: z.record(z.any()),
})

export const pageContentSchema = z.array(siteBlockSchema)

export type SiteBlockInput = z.infer<typeof siteBlockSchema>

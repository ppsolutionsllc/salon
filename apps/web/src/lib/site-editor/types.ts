export type BlockType =
    | "hero"
    | "rich_text"
    | "features"
    | "services_teaser"
    | "masters_teaser"
    | "before_after"
    | "testimonials"
    | "branches"
    | "faq"

export type SiteBlock = {
    id: string
    type: BlockType
    props: Record<string, any>
}

export type SitePage = {
    id: number
    salon_id: number | null
    slug: string
    title: string
    seo_title?: string | null
    seo_description?: string | null
    og_image_file_id?: number | null
    draft_version_id?: number | null
    published_version_id?: number | null
    status: "draft" | "published"
    updated_at?: string | null
    draft_content_json?: SiteBlock[] | null
    published_content_json?: SiteBlock[] | null
}

export type SiteVersion = {
    id: number
    page_id: number
    created_by: number
    comment?: string | null
    created_at?: string | null
    is_draft: boolean
    is_published: boolean
}

export type SiteMediaFile = {
    id: number
    salon_id: number | null
    title?: string | null
    filename: string
    mime_type: string
    size_bytes: number
    is_public: boolean
    created_at?: string | null
    public_url?: string | null
    private_url: string
}

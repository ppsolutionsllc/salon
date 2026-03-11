import apiFetch from "@/lib/api"
import type { SiteMediaFile, SitePage, SiteVersion } from "@/lib/site-editor/types"

export async function listSitePages(salonId: number, token: string) {
    return apiFetch(`/salons/${salonId}/site/pages`, { token }) as Promise<SitePage[]>
}

export async function createSitePage(salonId: number, token: string, payload: any) {
    return apiFetch(`/salons/${salonId}/site/pages`, { method: "POST", token, body: payload }) as Promise<SitePage>
}

export async function getSitePage(salonId: number, pageId: number, token: string) {
    return apiFetch(`/salons/${salonId}/site/pages/${pageId}`, { token }) as Promise<SitePage>
}

export async function patchSitePage(salonId: number, pageId: number, token: string, payload: any) {
    return apiFetch(`/salons/${salonId}/site/pages/${pageId}`, { method: "PATCH", token, body: payload }) as Promise<SitePage>
}

export async function saveSitePage(salonId: number, pageId: number, token: string, payload: any) {
    return apiFetch(`/salons/${salonId}/site/pages/${pageId}/save`, { method: "POST", token, body: payload }) as Promise<SitePage>
}

export async function publishSitePage(salonId: number, pageId: number, token: string) {
    return apiFetch(`/salons/${salonId}/site/pages/${pageId}/publish`, { method: "POST", token, body: {} }) as Promise<SitePage>
}

export async function rollbackSitePage(salonId: number, pageId: number, versionId: number, token: string) {
    return apiFetch(`/salons/${salonId}/site/pages/${pageId}/rollback`, {
        method: "POST",
        token,
        body: { version_id: versionId },
    }) as Promise<SitePage>
}

export async function listSiteVersions(salonId: number, pageId: number, token: string) {
    return apiFetch(`/salons/${salonId}/site/pages/${pageId}/versions`, { token }) as Promise<SiteVersion[]>
}

export async function createPreviewToken(salonId: number, pageId: number, token: string, ttlHours = 24) {
    return apiFetch(`/salons/${salonId}/site/pages/${pageId}/preview-token`, {
        method: "POST",
        token,
        body: { ttl_hours: ttlHours },
    }) as Promise<{ preview_url: string; expires_at: string }>
}

export async function listMedia(salonId: number, token: string) {
    return apiFetch(`/salons/${salonId}/media/list`, { token }) as Promise<SiteMediaFile[]>
}

export async function patchMedia(salonId: number, mediaId: number, token: string, payload: any) {
    return apiFetch(`/salons/${salonId}/media/${mediaId}`, { method: "PATCH", token, body: payload }) as Promise<SiteMediaFile>
}

export async function uploadMedia(salonId: number, token: string, file: File, isPublic = true, title = "") {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("is_public", String(isPublic))
    formData.append("title", title)

    const endpoint = `/api/v1/salons/${salonId}/media/upload`

    const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
        throw new Error(err.detail ?? `HTTP ${res.status}`)
    }
    return (await res.json()) as SiteMediaFile
}

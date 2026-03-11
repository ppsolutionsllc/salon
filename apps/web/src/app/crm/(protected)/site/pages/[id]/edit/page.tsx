import { PageEditor } from "@/components/site/page-editor"

type Props = {
    params: { id: string }
    searchParams: { salon?: string }
}

export default function SitePageEditRoute({ params, searchParams }: Props) {
    const pageId = Number(params.id)
    const salonId = Number(searchParams.salon ?? "0")
    if (!Number.isFinite(pageId)) {
        return <div className="crm-page">Некоректний page id</div>
    }
    return (
        <div className="crm-page">
            <PageEditor pageId={pageId} salonId={Number.isFinite(salonId) ? salonId : 0} />
        </div>
    )
}

import { v4 as uuidv4 } from "@/lib/site-editor/uuid"
import type { BlockType, SiteBlock } from "@/lib/site-editor/types"

export const blockCatalog: Array<{
    type: BlockType
    title: string
    description: string
}> = [
    { type: "hero", title: "Hero", description: "Перший екран із CTA" },
    { type: "rich_text", title: "Текст", description: "Rich text блок (TipTap JSON)" },
    { type: "features", title: "Переваги", description: "Картки переваг" },
    { type: "services_teaser", title: "Вітрина послуг", description: "Дані із CRM каталогу" },
    { type: "masters_teaser", title: "Вітрина майстрів", description: "Дані майстрів із CRM" },
    { type: "before_after", title: "До/Після", description: "Пари зображень результату" },
    { type: "testimonials", title: "Відгуки", description: "Список відгуків" },
    { type: "branches", title: "Філії", description: "Контакти та салони мережі" },
    { type: "faq", title: "FAQ", description: "Питання та відповіді" },
]

export function createDefaultBlock(type: BlockType): SiteBlock {
    const id = uuidv4()
    switch (type) {
        case "hero":
            return {
                id,
                type,
                props: {
                    title: "Ваша краса — наша турбота",
                    subtitle: "Преміум догляд для вас",
                    backgroundImage: null,
                    primaryCtaLabel: "Записатися",
                    primaryCtaHref: "/zapys",
                    showBookingWidget: true,
                },
            }
        case "rich_text":
            return {
                id,
                type,
                props: {
                    content: {
                        type: "doc",
                        content: [{ type: "paragraph", content: [{ type: "text", text: "Додайте ваш текст..." }] }],
                    },
                },
            }
        case "features":
            return {
                id,
                type,
                props: {
                    items: [
                        { icon: "Sparkles", title: "Преміум догляд", text: "Сучасні методики та сервіс." },
                        { icon: "Shield", title: "Безпечно", text: "Сертифіковані матеріали та стерильність." },
                        { icon: "Heart", title: "Персонально", text: "Індивідуальний підбір процедур." },
                    ],
                },
            }
        case "services_teaser":
            return { id, type, props: { category_ids: [], limit: 6, showPrices: true, ctaLabel: "Детальніше" } }
        case "masters_teaser":
            return { id, type, props: { limit: 6, tags: [] } }
        case "before_after":
            return { id, type, props: { pairs: [] } }
        case "testimonials":
            return {
                id,
                type,
                props: {
                    items: [
                        { name: "Марина", text: "Дуже задоволена результатом.", rating: 5 },
                        { name: "Олена", text: "Атмосфера і сервіс на висоті.", rating: 5 },
                    ],
                },
            }
        case "branches":
            return { id, type, props: { showMapLink: true } }
        case "faq":
            return {
                id,
                type,
                props: {
                    items: [
                        { question: "Як записатися?", answer: "Оберіть послугу та зручний час у формі запису." },
                        { question: "Чи можна перенести візит?", answer: "Так, через кабінет клієнта або за посиланням керування." },
                    ],
                },
            }
    }
}

"use client"

import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import apiFetch from "@/lib/api"
import {
    Settings,
    User,
    Shield,
    Bell,
    Globe,
    Palette,
    Rocket,
    GitBranch,
    ExternalLink,
    Copy,
    CheckCircle2,
    AlertCircle,
    RefreshCcw,
    History,
    HardDrive,
    TerminalSquare,
} from "lucide-react"

const ROLE_LABEL: Record<string, string> = {
    NETWORK_ADMIN: "Мережевий Адміністратор",
    SALON_ADMIN: "Адміністратор Салону",
    OPERATOR: "Оператор",
    STAFF: "Персонал",
    CLIENT: "Клієнт",
}

type ReleaseLogItem = {
    timestamp: string
    action?: string | null
    ref?: string | null
    actor?: string | null
    status?: string | null
    message?: string | null
}

type UpdateStatus = {
    environment: string
    state_file: string
    releases_log_file: string
    current_ref?: string | null
    previous_ref?: string | null
    last_deploy_at?: string | null
    last_status?: string | null
    last_error?: string | null
    last_action?: string | null
    last_actor?: string | null
    releases: ReleaseLogItem[]
}

export default function SettingsPage() {
    const { data: session } = useSession()
    const token = (session as any)?.accessToken as string | undefined
    const role = (session as any)?.user?.global_role as string | undefined

    const [copiedKey, setCopiedKey] = useState<string | null>(null)
    const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null)
    const [loadingStatus, setLoadingStatus] = useState(false)
    const [statusError, setStatusError] = useState<string | null>(null)

    const sections = [
        {
            icon: User,
            title: "Профіль",
            color: "#8b5cf6",
            items: [
                { label: "Логін / Пошта", value: session?.user?.email ?? "—" },
                { label: "Роль у системі", value: ROLE_LABEL[role ?? ""] ?? role ?? "—" },
                { label: "Статус", value: "Активний" },
            ]
        },
        {
            icon: Shield,
            title: "Безпека",
            color: "#f43f5e",
            items: [
                { label: "Двофакторна аутентифікація", value: "Вимкнено" },
                { label: "Активні сесії", value: "1" },
                { label: "Версія API", value: "v1" },
            ]
        },
        {
            icon: Globe,
            title: "Регіон та мова",
            color: "#3b82f6",
            items: [
                { label: "Мова інтерфейсу", value: "Українська" },
                { label: "Часовий пояс", value: "Europe/Kiev (UTC+2)" },
                { label: "Формат дати", value: "DD.MM.YYYY" },
            ]
        },
        {
            icon: Bell,
            title: "Сповіщення",
            color: "#10b981",
            items: [
                { label: "Email-сповіщення", value: "Увімкнено" },
                { label: "SMS-нагадування", value: "Вимкнено" },
                { label: "Браузер-сповіщення", value: "Вимкнено" },
            ]
        },
    ]

    const updateSystem = (process.env.NEXT_PUBLIC_UPDATE_SYSTEM ?? "github_actions").trim()
    const deployBranch = (process.env.NEXT_PUBLIC_DEPLOY_BRANCH ?? "main").trim()
    const autoDeploy = (process.env.NEXT_PUBLIC_AUTO_DEPLOY_ON_PUSH ?? "true").trim().toLowerCase() !== "false"
    const actionsUrl = (process.env.NEXT_PUBLIC_GITHUB_ACTIONS_URL ?? "").trim()
    const workflowName = (process.env.NEXT_PUBLIC_DEPLOY_WORKFLOW_NAME ?? "Deploy To Server").trim()
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim()
    const dbBackupKeep = process.env.NEXT_PUBLIC_DB_BACKUP_KEEP ?? "20"
    const uploadsBackupKeep = process.env.NEXT_PUBLIC_UPLOADS_BACKUP_KEEP ?? "10"

    const updateChecklist = [
        "1. Зміни вносяться у GitHub (гілка main або release-тег).",
        "2. Запускається workflow Deploy To Server (push або manual dispatch).",
        "3. На сервері зберігається PREVIOUS_REF та створюється backup БД.",
        "4. Після docker compose up -d --build застосовуються alembic міграції.",
        "5. Виконуються healthcheck + smoke. Якщо fail — авто rollback.",
        "6. Результат фіксується у .deploy/state.env та .deploy/releases.log.",
    ].join("\n")

    const deployCmd = "APP_DIR=/opt/salon ENVIRONMENT=production bash scripts/deploy_server.sh --ref main"
    const rollbackCmd = "APP_DIR=/opt/salon ENVIRONMENT=production bash scripts/rollback_server.sh --previous --no-migrations"
    const statusCmd = "APP_DIR=/opt/salon ENVIRONMENT=production bash scripts/status_server.sh"

    const fetchUpdateStatus = async () => {
        if (!token) return
        setLoadingStatus(true)
        setStatusError(null)
        try {
            const data = await apiFetch("/system/update-status", { token })
            setUpdateStatus(data)
        } catch (e: any) {
            if (e?.message !== "NO_TOKEN") {
                setStatusError(e?.message ?? "Не вдалося отримати стан оновлень")
            }
        } finally {
            setLoadingStatus(false)
        }
    }

    useEffect(() => {
        fetchUpdateStatus()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token])

    const lastStatusColor = useMemo(() => {
        const value = (updateStatus?.last_status ?? "").toUpperCase()
        if (value.includes("SUCCESS")) return "#10b981"
        if (value.includes("FAIL")) return "#f43f5e"
        if (value.includes("IN_PROGRESS")) return "#f59e0b"
        return "#94a3b8"
    }, [updateStatus?.last_status])

    const copyText = async (key: string, text: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopiedKey(key)
            setTimeout(() => setCopiedKey(null), 1500)
        } catch {
            setCopiedKey(null)
        }
    }

    return (
        <div className="crm-page">
            <div className="crm-page-header">
                <div>
                    <h1 className="crm-page-title">Налаштування</h1>
                    <p className="crm-page-sub">Конфігурація системи, безпеки та оновлень</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sections.map((sec) => (
                    <div key={sec.title} className="crm-card">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ background: `${sec.color}20`, border: `1px solid ${sec.color}30` }}>
                                <sec.icon size={15} style={{ color: sec.color }} />
                            </div>
                            <span className="font-semibold text-white text-sm">{sec.title}</span>
                        </div>
                        <div className="flex flex-col gap-0">
                            {sec.items.map((item, i) => (
                                <div key={i} className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
                                    <span className="text-sm text-white/50">{item.label}</span>
                                    <span className="text-sm text-white/80 font-medium">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Update system base config */}
            <div className="crm-card" style={{ gap: 14 }}>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
                        <Rocket size={15} style={{ color: "#10b981" }} />
                    </div>
                    <span className="font-semibold text-white text-sm">Центр оновлень</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                        <div className="text-xs text-white/40 mb-1">Режим оновлення</div>
                        <div className="text-sm font-medium text-white/85">
                            {updateSystem === "github_actions"
                                ? "GitHub Actions -> SSH -> Deploy Script"
                                : updateSystem}
                        </div>
                    </div>
                    <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                        <div className="text-xs text-white/40 mb-1 flex items-center gap-1">
                            <GitBranch size={12} />Гілка деплою за замовчуванням
                        </div>
                        <div className="text-sm font-medium text-white/85">{deployBranch}</div>
                    </div>
                    <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                        <div className="text-xs text-white/40 mb-1">Автооновлення після push</div>
                        <div className="text-sm font-medium flex items-center gap-1"
                            style={{ color: autoDeploy ? "#10b981" : "#f59e0b" }}>
                            {autoDeploy ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                            {autoDeploy ? "Увімкнено" : "Вимкнено"}
                        </div>
                    </div>
                    <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                        <div className="text-xs text-white/40 mb-1">Публічна адреса системи</div>
                        <div className="text-sm font-medium text-white/85">{appUrl || "Не вказано у NEXT_PUBLIC_APP_URL"}</div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => copyText("checklist", updateChecklist)}
                        className="crm-btn-ghost"
                        style={{ fontSize: 12, padding: "6px 10px" }}
                    >
                        <Copy size={13} />
                        {copiedKey === "checklist" ? "Скопійовано" : "Скопіювати чекліст"}
                    </button>

                    {actionsUrl ? (
                        <a
                            href={actionsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="crm-btn-primary-sm"
                            style={{ fontSize: 12, padding: "6px 10px", textDecoration: "none" }}
                        >
                            <ExternalLink size={13} />
                            Відкрити {workflowName}
                        </a>
                    ) : (
                        <span className="text-xs text-white/40">
                            Додайте `NEXT_PUBLIC_GITHUB_ACTIONS_URL`, щоб відкрити workflow з інтерфейсу.
                        </span>
                    )}
                </div>
            </div>

            {/* Live deploy state */}
            <div className="crm-card" style={{ gap: 14 }}>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)" }}>
                            <Settings size={15} style={{ color: "#3b82f6" }} />
                        </div>
                        <span className="font-semibold text-white text-sm">Стан deploy/rollback (live)</span>
                    </div>
                    <button
                        type="button"
                        onClick={fetchUpdateStatus}
                        className="crm-btn-ghost"
                        style={{ fontSize: 12, padding: "6px 10px" }}
                        disabled={loadingStatus}
                    >
                        <RefreshCcw size={13} />
                        {loadingStatus ? "Оновлення..." : "Оновити"}
                    </button>
                </div>

                {statusError && (
                    <div className="text-sm" style={{ color: "#f59e0b" }}>
                        {statusError}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                        <div className="text-xs text-white/40 mb-1">Поточний реліз (CURRENT_REF)</div>
                        <div className="text-sm font-medium text-white/85 break-all">{updateStatus?.current_ref || "—"}</div>
                    </div>
                    <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                        <div className="text-xs text-white/40 mb-1">Попередній реліз (PREVIOUS_REF)</div>
                        <div className="text-sm font-medium text-white/85 break-all">{updateStatus?.previous_ref || "—"}</div>
                    </div>
                    <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                        <div className="text-xs text-white/40 mb-1">Останній статус</div>
                        <div className="text-sm font-medium" style={{ color: lastStatusColor }}>
                            {updateStatus?.last_status || "—"}
                        </div>
                    </div>
                    <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                        <div className="text-xs text-white/40 mb-1">Останній деплой</div>
                        <div className="text-sm font-medium text-white/85">{updateStatus?.last_deploy_at || "—"}</div>
                    </div>
                    <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                        <div className="text-xs text-white/40 mb-1">Остання дія / ініціатор</div>
                        <div className="text-sm font-medium text-white/85">
                            {(updateStatus?.last_action || "—")} / {(updateStatus?.last_actor || "—")}
                        </div>
                    </div>
                    <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                        <div className="text-xs text-white/40 mb-1">Середовище (API)</div>
                        <div className="text-sm font-medium text-white/85">{updateStatus?.environment || "—"}</div>
                    </div>
                </div>

                {updateStatus?.last_error && (
                    <div className="p-3 rounded-lg" style={{ border: "1px solid rgba(244,63,94,0.35)", background: "rgba(244,63,94,0.08)" }}>
                        <div className="text-xs text-white/40 mb-1">Остання помилка</div>
                        <div className="text-sm text-white/85 break-words">{updateStatus.last_error}</div>
                    </div>
                )}
            </div>

            {/* Release history */}
            <div className="crm-card" style={{ gap: 12 }}>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
                        <History size={15} style={{ color: "#8b5cf6" }} />
                    </div>
                    <span className="font-semibold text-white text-sm">Історія релізів</span>
                </div>

                {updateStatus?.releases?.length ? (
                    <div className="flex flex-col gap-2">
                        {updateStatus.releases.map((entry, idx) => (
                            <div key={`${entry.timestamp}-${idx}`} className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                                <div className="text-xs text-white/40 mb-1">{entry.timestamp}</div>
                                <div className="text-sm text-white/85">
                                    {entry.action || "—"} | {entry.status || "—"} | {entry.actor || "—"}
                                </div>
                                <div className="text-xs text-white/50 break-all mt-1">{entry.ref || "—"}</div>
                                {entry.message && <div className="text-xs text-white/40 mt-1">{entry.message}</div>}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-sm text-white/45">Лог релізів поки порожній.</div>
                )}
            </div>

            {/* Backups and policy */}
            <div className="crm-card" style={{ gap: 12 }}>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}>
                        <HardDrive size={15} style={{ color: "#f59e0b" }} />
                    </div>
                    <span className="font-semibold text-white text-sm">Backup та rollback-політика</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                        <div className="text-xs text-white/40 mb-1">Backup БД перед міграціями</div>
                        <div className="text-sm text-white/85">Увімкнено (retain: {dbBackupKeep})</div>
                    </div>
                    <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                        <div className="text-xs text-white/40 mb-1">Backup uploads</div>
                        <div className="text-sm text-white/85">Опційно у deploy (retain: {uploadsBackupKeep})</div>
                    </div>
                </div>

                <div className="text-xs text-white/45 leading-5">
                    Rollback за замовчуванням не робить downgrade БД. Стратегія: backward-compatible міграції мінімум 1 реліз.
                </div>
            </div>

            {/* Server commands */}
            <div className="crm-card" style={{ gap: 12 }}>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}>
                        <TerminalSquare size={15} style={{ color: "#10b981" }} />
                    </div>
                    <span className="font-semibold text-white text-sm">Команди серверного оновлення</span>
                </div>

                {[{ key: "deploy", title: "Deploy", cmd: deployCmd },
                { key: "rollback", title: "Rollback", cmd: rollbackCmd },
                { key: "status", title: "Status", cmd: statusCmd }].map(item => (
                    <div key={item.key} className="p-3 rounded-lg border border-white/10 bg-black/30">
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="text-xs text-white/40">{item.title}</div>
                            <button
                                type="button"
                                onClick={() => copyText(item.key, item.cmd)}
                                className="crm-btn-ghost"
                                style={{ fontSize: 11, padding: "4px 8px" }}
                            >
                                <Copy size={12} />
                                {copiedKey === item.key ? "Скопійовано" : "Копія"}
                            </button>
                        </div>
                        <pre className="text-xs text-white/80 whitespace-pre-wrap break-all m-0">{item.cmd}</pre>
                    </div>
                ))}
            </div>

            {/* Footer info */}
            <div className="crm-card" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div className="flex items-center gap-2">
                    <Palette size={14} className="text-white/20" />
                    <span className="text-xs text-white/30">© 2026 Aesthetic Prime CRM Зроблено з любов'ю</span>
                </div>
                <span className="text-xs text-white/20">v1.1.0</span>
            </div>
        </div>
    )
}

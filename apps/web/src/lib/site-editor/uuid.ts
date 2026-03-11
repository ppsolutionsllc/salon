export function v4() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID()
    }
    return `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

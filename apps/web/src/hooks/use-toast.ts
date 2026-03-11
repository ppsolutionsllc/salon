"use client"

import * as React from "react"

import type { ToastActionElement, ToastProps } from "@/components/ui/toast"

const TOAST_LIMIT = 3
const TOAST_REMOVE_DELAY = 3500

type ToasterToast = ToastProps & {
    id: string
    title?: React.ReactNode
    description?: React.ReactNode
    action?: ToastActionElement
}

const listeners: Array<(state: { toasts: ToasterToast[] }) => void> = []
let memoryState: { toasts: ToasterToast[] } = { toasts: [] }

function dispatch(state: { toasts: ToasterToast[] }) {
    memoryState = state
    listeners.forEach((listener) => listener(state))
}

function removeToast(id: string) {
    dispatch({ toasts: memoryState.toasts.filter((t) => t.id !== id) })
}

function toast({ ...props }: Omit<ToasterToast, "id">) {
    const id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const newToast: ToasterToast = { id, ...props, open: true }
    dispatch({ toasts: [newToast, ...memoryState.toasts].slice(0, TOAST_LIMIT) })
    window.setTimeout(() => removeToast(id), TOAST_REMOVE_DELAY)
    return {
        id,
        dismiss: () => removeToast(id),
    }
}

function useToast() {
    const [state, setState] = React.useState(memoryState)
    React.useEffect(() => {
        listeners.push(setState)
        return () => {
            const idx = listeners.indexOf(setState)
            if (idx > -1) listeners.splice(idx, 1)
        }
    }, [state])

    return {
        ...state,
        toast,
        dismiss: (toastId?: string) => {
            if (toastId) removeToast(toastId)
            else dispatch({ toasts: [] })
        },
    }
}

export { useToast, toast }

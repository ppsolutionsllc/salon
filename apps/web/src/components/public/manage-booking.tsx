"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { CheckCircle2, Clock3 } from "lucide-react"

import {
  cancelBookingByToken,
  confirmBookingByLink,
  confirmBookingByToken,
  getBookingByToken,
  PublicBookingCreated,
  PublicBookingDetails,
  rescheduleBookingByToken,
} from "@/lib/public-api"

const motionCfg = { duration: 0.2 }

export default function ManageBooking({ token }: { token: string }) {
  const query = useSearchParams()
  const action = query.get("action")

  const [details, setDetails] = useState<PublicBookingDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [otp, setOtp] = useState("")
  const [rescheduleAt, setRescheduleAt] = useState("")
  const [rescheduled, setRescheduled] = useState<PublicBookingCreated | null>(null)

  useEffect(() => {
    getBookingByToken(token)
      .then(setDetails)
      .catch((e) => setError(e?.message || "Не вдалося завантажити запис"))
  }, [token])

  const statusLabel = useMemo(() => {
    if (!details) return ""
    const labels: Record<string, string> = {
      NEW: "Очікує підтвердження",
      CONFIRMED: "Підтверджено",
      CANCELED: "Скасовано",
      RESCHEDULED: "Потрібне повторне підтвердження",
      COMPLETED: "Завершено",
      NO_SHOW: "Неявка",
    }
    return labels[details.status] || details.status
  }, [details])

  async function runConfirmByLink() {
    setLoading(true)
    setError(null)
    try {
      const result = await confirmBookingByLink(token)
      setDetails(result)
      setMessage("Запис підтверджено за посиланням")
    } catch (e: any) {
      setError(e?.message || "Не вдалося підтвердити")
    } finally {
      setLoading(false)
    }
  }

  async function runConfirmOtp() {
    if (!otp) return setError("Введіть OTP")
    setLoading(true)
    setError(null)
    try {
      const result = await confirmBookingByToken(token, otp)
      setDetails(result)
      setMessage("Запис підтверджено")
      setRescheduled(null)
    } catch (e: any) {
      setError(e?.message || "Помилка підтвердження")
    } finally {
      setLoading(false)
    }
  }

  async function runCancel() {
    setLoading(true)
    setError(null)
    try {
      const result = await cancelBookingByToken(token, "client_request")
      setDetails(result)
      setMessage("Запис скасовано")
    } catch (e: any) {
      setError(e?.message || "Не вдалося скасувати запис")
    } finally {
      setLoading(false)
    }
  }

  async function runReschedule() {
    if (!rescheduleAt) return setError("Оберіть нову дату та час")
    setLoading(true)
    setError(null)

    try {
      const iso = new Date(rescheduleAt).toISOString()
      const result = await rescheduleBookingByToken(token, iso)
      setRescheduled(result)
      setMessage("Запис перенесено. Потрібне повторне підтвердження.")
      setOtp(result.otp_code_dev || "")

      const refresh = await getBookingByToken(token)
      setDetails(refresh)
    } catch (e: any) {
      setError(e?.message || "Не вдалося перенести запис")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="prime-booking-page">
      <div className="prime-booking-container">
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={motionCfg} className="prime-step-card is-active">
          <div className="prime-step-head">
            <span><Clock3 size={16} /> Управління записом</span>
            <span>{statusLabel}</span>
          </div>

          <div className="prime-step-body">
            {error && <div className="prime-booking-error">{error}</div>}
            {message && <div className="prime-booking-success">{message}</div>}

            {details ? (
              <>
                <div className="prime-manage-summary">
                  <h2>{details.salon_name}</h2>
                  <p>{details.service_name} | {details.staff_name}</p>
                  <p>{new Date(details.start_time).toLocaleString("uk-UA")}</p>
                  <p>{details.client_name} ({details.client_phone})</p>
                </div>

                <div className="prime-manage-actions">
                  {(action === "confirm" || details.status === "NEW" || details.status === "RESCHEDULED") && (
                    <button type="button" className="prime-next-btn" onClick={runConfirmByLink} disabled={loading}>
                      Підтвердити за посиланням
                    </button>
                  )}

                  {(details.status === "NEW" || details.status === "RESCHEDULED") && (
                    <div className="prime-inline-form">
                      <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="OTP-код" />
                      <button type="button" onClick={runConfirmOtp} disabled={loading}>Підтвердити OTP</button>
                    </div>
                  )}

                  {(action === "reschedule" || details.status === "CONFIRMED") && (
                    <div className="prime-inline-form">
                      <input type="datetime-local" value={rescheduleAt} onChange={(e) => setRescheduleAt(e.target.value)} />
                      <button type="button" onClick={runReschedule} disabled={loading}>Перенести</button>
                    </div>
                  )}

                  {action === "cancel" && (
                    <button type="button" className="prime-next-btn danger" onClick={runCancel} disabled={loading}>
                      Скасувати запис
                    </button>
                  )}
                </div>

                {rescheduled && (
                  <div className="prime-rescheduled-note">
                    <CheckCircle2 size={18} />
                    <span>
                      Новий OTP: <strong>{rescheduled.otp_code_dev || "(надіслано в повідомленні)"}</strong>
                    </span>
                  </div>
                )}
              </>
            ) : (
              <p>Завантаження...</p>
            )}

            <div className="prime-success-actions">
              <Link href="/zapys">Новий запис</Link>
              <Link href="/">На головну</Link>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  )
}

"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { CalendarDays, CheckCircle2, Clock3, MapPin, UserRound, Phone } from "lucide-react"

import {
  confirmPublicBooking,
  createPublicBooking,
  getPublicSalons,
  getPublicServices,
  getPublicSlots,
  getPublicStaff,
  PublicBookingCreated,
  PublicBookingDetails,
  PublicSalon,
  PublicService,
  PublicSlot,
  PublicStaff,
} from "@/lib/public-api"
import { uk } from "@/lib/i18n/uk"

const motionCfg = { duration: 0.2 }
const STORAGE_KEY = "ap_selected_salon"

export default function ZapysFlow() {
  const params = useSearchParams()
  const salonFromQuery = Number(params.get("salon") || "")
  const serviceFromQuery = Number(params.get("service") || "")

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [salons, setSalons] = useState<PublicSalon[]>([])
  const [services, setServices] = useState<PublicService[]>([])
  const [staff, setStaff] = useState<PublicStaff[]>([])
  const [slots, setSlots] = useState<PublicSlot[]>([])

  const [salonId, setSalonId] = useState<number | null>(null)
  const [serviceId, setServiceId] = useState<number | null>(null)
  const [staffId, setStaffId] = useState<number | null>(null)
  const [date, setDate] = useState("")
  const [slot, setSlot] = useState<PublicSlot | null>(null)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [notes, setNotes] = useState("")

  const [created, setCreated] = useState<PublicBookingCreated | null>(null)
  const [otp, setOtp] = useState("")
  const [confirmed, setConfirmed] = useState<PublicBookingDetails | null>(null)

  useEffect(() => {
    getPublicSalons()
      .then((data) => {
        setSalons(data)
        if (!data.length) return

        const saved = Number(localStorage.getItem(STORAGE_KEY) || "")
        const fallbackId = data[0].id
        const chosen =
          data.find((item) => item.id === salonFromQuery)?.id ||
          data.find((item) => item.id === saved)?.id ||
          fallbackId

        setSalonId(chosen)
      })
      .catch(() => setError("Не вдалося завантажити салони"))
  }, [salonFromQuery])

  useEffect(() => {
    if (!salonId) return
    localStorage.setItem(STORAGE_KEY, String(salonId))
    document.cookie = `ap_salon=${salonId}; path=/; max-age=2592000`

    getPublicServices(salonId)
      .then((data) => {
        setServices(data)
        if (serviceFromQuery && data.find((item) => item.id === serviceFromQuery)) {
          setServiceId(serviceFromQuery)
        }
      })
      .catch(() => setServices([]))

    setStaff([])
    setStaffId(null)
    setDate("")
    setSlot(null)
    setSlots([])
  }, [salonId, serviceFromQuery])

  useEffect(() => {
    if (!salonId || !serviceId) return
    getPublicStaff(salonId, serviceId)
      .then(setStaff)
      .catch(() => setStaff([]))

    setStaffId(null)
    setDate("")
    setSlot(null)
    setSlots([])
  }, [salonId, serviceId])

  useEffect(() => {
    if (!salonId || !serviceId || !date) return
    const payload = {
      service_id: serviceId,
      date,
      ...(staffId ? { staff_id: staffId } : {}),
    }

    getPublicSlots(salonId, payload)
      .then((items) => {
        setSlots(items.filter((it) => it.available))
      })
      .catch(() => {
        setSlots([])
      })
  }, [salonId, serviceId, staffId, date])

  const selectedSalon = useMemo(
    () => salons.find((item) => item.id === salonId) || null,
    [salons, salonId]
  )

  const selectedService = useMemo(
    () => services.find((item) => item.id === serviceId) || null,
    [services, serviceId]
  )

  const selectedStaff = useMemo(() => {
    if (slot) {
      const fromSlot = staff.find((item) => item.id === slot.staff_id)
      if (fromSlot) return fromSlot
    }
    return staff.find((item) => item.id === staffId) || null
  }, [staff, staffId, slot])

  async function submitBooking() {
    if (!salonId || !serviceId || !slot || !firstName || !phone) {
      setError("Заповніть обов'язкові поля")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await createPublicBooking({
        salon_id: salonId,
        service_id: serviceId,
        staff_id: slot.staff_id,
        start_time: slot.start_time,
        first_name: firstName,
        last_name: lastName || undefined,
        phone,
        email: email || undefined,
        notes: notes || undefined,
      })

      setCreated(result)
      setOtp(result.otp_code_dev || "")
      setStep(6)
    } catch (e: any) {
      setError(e?.message || "Не вдалося створити запис")
    } finally {
      setLoading(false)
    }
  }

  async function submitConfirm() {
    if (!created || !otp) {
      setError("Введіть OTP-код")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await confirmPublicBooking(created.booking_id, otp)
      setConfirmed(result)
      setStep(7)
    } catch (e: any) {
      setError(e?.message || "Помилка підтвердження")
    } finally {
      setLoading(false)
    }
  }

  function nextFromStep(current: number) {
    if (current === 1 && salonId) return setStep(2)
    if (current === 2 && serviceId) return setStep(3)
    if (current === 3) return setStep(4)
    if (current === 4 && slot) return setStep(5)
  }

  return (
    <div className="prime-booking-page">
      <div className="prime-booking-container">
        <header className="prime-booking-header">
          <h1>{uk.booking.title}</h1>
          <p>{selectedSalon?.name || "Оберіть салон та запишіться онлайн"}</p>
        </header>

        {error && <div className="prime-booking-error">{error}</div>}

        <AnimatePresence mode="wait">
          {step <= 5 && (
            <motion.div key={`steps-${step}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={motionCfg}>
              <section className={`prime-step-card ${step === 1 ? "is-active" : ""}`}>
                <button type="button" className="prime-step-head" onClick={() => setStep(1)}>
                  <span><MapPin size={16} /> 1. {uk.booking.stepSalon}</span>
                  <span>{selectedSalon?.name || "-"}</span>
                </button>
                {step === 1 && (
                  <div className="prime-step-body">
                    <div className="prime-choice-list">
                      {salons.map((salon) => (
                        <button
                          type="button"
                          key={salon.id}
                          className={`prime-choice ${salonId === salon.id ? "active" : ""}`}
                          onClick={() => setSalonId(salon.id)}
                        >
                          <strong>{salon.name}</strong>
                          <span>{salon.address || "Київ"}</span>
                        </button>
                      ))}
                    </div>
                    <button type="button" className="prime-next-btn" onClick={() => nextFromStep(1)}>
                      Далі
                    </button>
                  </div>
                )}
              </section>

              <section className={`prime-step-card ${step === 2 ? "is-active" : ""}`}>
                <button type="button" className="prime-step-head" onClick={() => setStep(2)}>
                  <span><UserRound size={16} /> 2. {uk.booking.stepService}</span>
                  <span>{selectedService?.name || "-"}</span>
                </button>
                {step === 2 && (
                  <div className="prime-step-body">
                    <div className="prime-choice-list">
                      {services.map((service) => (
                        <button
                          type="button"
                          key={service.id}
                          className={`prime-choice ${serviceId === service.id ? "active" : ""}`}
                          onClick={() => setServiceId(service.id)}
                        >
                          <strong>{service.name}</strong>
                          <span>від {Math.round(service.price)} грн | {service.duration_minutes} хв</span>
                        </button>
                      ))}
                    </div>
                    <button type="button" className="prime-next-btn" onClick={() => nextFromStep(2)}>
                      Далі
                    </button>
                  </div>
                )}
              </section>

              <section className={`prime-step-card ${step === 3 ? "is-active" : ""}`}>
                <button type="button" className="prime-step-head" onClick={() => setStep(3)}>
                  <span><UserRound size={16} /> 3. {uk.booking.stepStaff}</span>
                  <span>{selectedStaff ? `${selectedStaff.first_name} ${selectedStaff.last_name}` : uk.booking.anyStaff}</span>
                </button>
                {step === 3 && (
                  <div className="prime-step-body">
                    <div className="prime-choice-list">
                      <button
                        type="button"
                        className={`prime-choice ${staffId === null ? "active" : ""}`}
                        onClick={() => setStaffId(null)}
                      >
                        <strong>{uk.booking.anyStaff}</strong>
                        <span>Підберемо найкращий вільний час</span>
                      </button>

                      {staff.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          className={`prime-choice ${staffId === item.id ? "active" : ""}`}
                          onClick={() => setStaffId(item.id)}
                        >
                          <strong>{item.first_name} {item.last_name}</strong>
                          <span>{item.phone || "Преміум спеціаліст"}</span>
                        </button>
                      ))}
                    </div>
                    <button type="button" className="prime-next-btn" onClick={() => nextFromStep(3)}>
                      Далі
                    </button>
                  </div>
                )}
              </section>

              <section className={`prime-step-card ${step === 4 ? "is-active" : ""}`}>
                <button type="button" className="prime-step-head" onClick={() => setStep(4)}>
                  <span><CalendarDays size={16} /> 4. {uk.booking.stepDate}</span>
                  <span>{slot ? new Date(slot.start_time).toLocaleString("uk-UA") : "-"}</span>
                </button>
                {step === 4 && (
                  <div className="prime-step-body">
                    <label className="prime-label">
                      Дата
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </label>

                    <div className="prime-slots-grid">
                      {slots.map((item) => (
                        <button
                          type="button"
                          key={`${item.staff_id}-${item.start_time}`}
                          className={`prime-slot ${slot?.start_time === item.start_time ? "active" : ""}`}
                          onClick={() => setSlot(item)}
                        >
                          <Clock3 size={14} />
                          <span>{new Date(item.start_time).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}</span>
                          <small>{item.staff_name}</small>
                        </button>
                      ))}
                    </div>

                    <button type="button" className="prime-next-btn" onClick={() => nextFromStep(4)}>
                      Далі
                    </button>
                  </div>
                )}
              </section>

              <section className={`prime-step-card ${step === 5 ? "is-active" : ""}`}>
                <button type="button" className="prime-step-head" onClick={() => setStep(5)}>
                  <span><Phone size={16} /> 5. {uk.booking.stepContacts}</span>
                  <span>{firstName || "-"}</span>
                </button>
                {step === 5 && (
                  <div className="prime-step-body">
                    <div className="prime-form-grid">
                      <label className="prime-label">
                        {uk.booking.firstName}*
                        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                      </label>
                      <label className="prime-label">
                        {uk.booking.lastName}
                        <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                      </label>
                      <label className="prime-label">
                        {uk.booking.phone}*
                        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+380..." />
                      </label>
                      <label className="prime-label">
                        {uk.booking.email}
                        <input value={email} onChange={(e) => setEmail(e.target.value)} />
                      </label>
                    </div>
                    <label className="prime-label">
                      {uk.booking.notes}
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                    </label>

                    <button type="button" className="prime-next-btn" onClick={submitBooking} disabled={loading}>
                      {loading ? "Зберігаємо..." : uk.booking.submit}
                    </button>
                  </div>
                )}
              </section>
            </motion.div>
          )}

          {step === 6 && created && (
            <motion.section key="confirm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={motionCfg} className="prime-confirm-card">
              <h2>{uk.booking.confirmTitle}</h2>
              <p>{uk.booking.confirmHint}</p>
              <label className="prime-label">
                OTP
                <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6 цифр" />
              </label>

              <button type="button" className="prime-next-btn" onClick={submitConfirm} disabled={loading}>
                {loading ? "Підтверджуємо..." : uk.booking.confirm}
              </button>

              <small>
                Booking ID: {created.booking_id} | OTP дійсний до {new Date(created.otp_expires_at).toLocaleString("uk-UA")}
              </small>
            </motion.section>
          )}

          {step === 7 && confirmed && (
            <motion.section key="success" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={motionCfg} className="prime-success-card">
              <CheckCircle2 size={28} />
              <h2>{uk.booking.successTitle}</h2>
              <p>
                {confirmed.service_name} | {confirmed.staff_name} | {new Date(confirmed.start_time).toLocaleString("uk-UA")}
              </p>

              <div className="prime-success-actions">
                <Link href={`/zapys/manage/${confirmed.manage_token}?action=cancel`}>{uk.booking.cancel}</Link>
                <Link href={`/zapys/manage/${confirmed.manage_token}?action=reschedule`}>{uk.booking.reschedule}</Link>
                <Link href="/">На головну</Link>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

import { Suspense } from "react"
import ManageBooking from "@/components/public/manage-booking"

export const dynamic = "force-dynamic"

export default function ManageBookingPage({ params }: { params: { token: string } }) {
  return (
    <Suspense fallback={<div className="prime-booking-page"><div className="prime-booking-container">Завантаження...</div></div>}>
      <ManageBooking token={params.token} />
    </Suspense>
  )
}

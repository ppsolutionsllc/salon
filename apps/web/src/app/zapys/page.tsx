import { Suspense } from "react"
import ZapysFlow from "@/components/public/zapys-flow"

export const dynamic = "force-dynamic"

export default function ZapysPage() {
  return (
    <Suspense fallback={<div className="prime-booking-page"><div className="prime-booking-container">Завантаження...</div></div>}>
      <ZapysFlow />
    </Suspense>
  )
}

import { redirect } from "next/navigation"
import { auth } from "@/auth"

export default async function StaffIndexPage() {
  const session = await auth()
  const role = session?.user?.global_role || ""

  if (["NETWORK_ADMIN", "SALON_ADMIN", "OPERATOR", "STAFF"].includes(role)) {
    redirect("/staff/dashboard")
  }

  redirect("/staff/login")
}

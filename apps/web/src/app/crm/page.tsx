import { redirect } from "next/navigation"
import { auth } from "@/auth"

export default async function CRMIndexPage() {
  const session = await auth()
  const role = session?.user?.global_role || ""

  if (["NETWORK_ADMIN", "SALON_ADMIN", "OPERATOR"].includes(role)) {
    redirect("/crm/dashboard")
  }

  redirect("/crm/login")
}

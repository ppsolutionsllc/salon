import { redirect } from "next/navigation"
import { auth } from "@/auth"

export default async function ClientIndexPage() {
  const session = await auth()
  if (!session) {
    redirect("/login")
  }

  redirect("/client/dashboard")
}

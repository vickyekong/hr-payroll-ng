import { redirect } from "next/navigation";

/** Employee self-service portal removed — staff are managed by HR / Super Admin. */
export default function MyPortalRedirect() {
  redirect("/dashboard");
}

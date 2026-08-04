import { redirect } from "next/navigation";

export default function AttendanceRedirectPage() {
  redirect("/employees?tab=attendance");
}

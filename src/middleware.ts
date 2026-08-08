import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/employees/:path*",
    "/payroll/:path*",
    "/leave/:path*",
    "/reports/:path*",
    "/audit-log/:path*",
    "/hr-desk/:path*",
    "/hr-ask/:path*",
    "/my/:path*",
    "/settings/:path*",
    "/onboarding",
    "/onboarding/:path*",
  ],
};

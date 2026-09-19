import { cookies } from "next/headers";
import AdminLayout from "../admin/layout";

/**
 * Admins get the full admin shell (sidebar, notifications) around the till, so
 * they can reach every other feature without leaving POS. Other staff get the
 * till on its own. The role comes from the cookie set at sign-in, read on the
 * server so the shell is there on first paint instead of swapping in later.
 * (The cookie only picks the layout; every API call is still authorised server-side.)
 */
export default async function PosLayout({ children }: { children: React.ReactNode }) {
  const role = (await cookies()).get("gts_user_role")?.value;
  if (role === "admin") return <AdminLayout>{children}</AdminLayout>;
  return <div className="h-screen">{children}</div>;
}

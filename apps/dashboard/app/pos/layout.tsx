import AdminLayout from "../admin/layout";

/**
 * All staff members (admins, cashiers, inventory staff) get the shared dashboard shell
 * (collapsible sidebar with permission-gated navigation and profile).
 */
export default function PosLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}

import AdminLayout from "../admin/layout";

/**
 * Wraps /profile in the shared dashboard shell (collapsible sidebar with permission-gated navigation).
 */
export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}

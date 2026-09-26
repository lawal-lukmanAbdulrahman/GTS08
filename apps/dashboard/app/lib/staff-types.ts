/** Shapes returned by the staff API, as the dashboard uses them. Amounts are kobo. */

export interface Tally {
  count: number;
  total: number;
}

export interface SalesSummaryView {
  sales: Tally & { average: number };
  by_payment_method: { cash: Tally; pos_terminal: Tally };
  by_channel: { walk_in: Tally; whatsapp: Tally };
  voided: Tally;
  discounts_given: Tally;
}

export interface RecentSaleView {
  order_number: string;
  channel: string;
  status: string;
  payment_method: string;
  amount: number;
  created_at: string;
}

export type SalesRangeId = "today" | "week" | "month";

export interface SalesRecordView {
  range: SalesRangeId;
  since: string;
  summary: SalesSummaryView;
  recent: RecentSaleView[];
}

export interface ActivityEntryView {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  changes: Record<string, unknown> | null;
  created_at: string;
}

export interface PermissionsView {
  can_process_pos: boolean;
  can_manage_inventory: boolean;
  can_view_all_orders: boolean;
  can_manage_products: boolean;
  can_handle_tickets: boolean;
  can_void_orders: boolean;
  can_apply_discounts: boolean;
  can_manage_broadcasts: boolean;
}

export interface StaffProfileView {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: string;
  is_admin: boolean;
  /** The one admin who can add people. */
  is_super_admin?: boolean;
  /** Signed in with a one-time password that must be replaced first. */
  must_change_password?: boolean;
  permissions: PermissionsView;
}

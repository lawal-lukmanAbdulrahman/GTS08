export interface CustomerSummary {
  id: string;
  userId: string | null;
  customerId: string | null;
  fullName: string;
  email: string;
  phone: string | null;
  isDisabled: boolean;
  disabledReason: string | null;
  disabledAt: string | null;
  deletedAt: string | null;
  deletionReason: string | null;
  daysRemaining: number | null;
  createdAt: string;
  totalOrders: number;
  totalSpentKobo: number;
  totalSpentNgn: number;
  totalProfitKobo: number;
  totalProfitNgn: number;
  profitMarginPct: number;
}

export interface CustomerOrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPriceKobo: number;
  unitPriceNgn: number;
  lineTotalKobo: number;
  lineTotalNgn: number;
  profitKobo: number;
  profitNgn: number;
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalKobo: number;
  totalNgn: number;
  profitKobo: number;
  profitNgn: number;
  createdAt: string;
  itemCount: number;
  items: CustomerOrderItem[];
}

export interface CustomerInquiry {
  id: string;
  reference: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
}

export interface CustomerDetailData {
  customer: {
    id: string;
    userId: string | null;
    customerId: string | null;
    fullName: string;
    email: string;
    phone: string | null;
    isDisabled: boolean;
    disabledReason: string | null;
    disabledAt: string | null;
    deletedAt: string | null;
    deletionReason: string | null;
    daysRemaining: number | null;
    createdAt: string;
  };
  stats: {
    totalOrders: number;
    totalSpentKobo: number;
    totalSpentNgn: number;
    totalProfitKobo: number;
    totalProfitNgn: number;
    profitMarginPct: number;
  };
  orders: CustomerOrder[];
  inquiries: CustomerInquiry[];
}

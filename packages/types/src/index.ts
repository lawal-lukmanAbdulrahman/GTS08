import { z } from "zod";

// --- API Response Shapes (backend spec Part 1) ---

export interface ApiSuccessResponse<T> {
  data: T;
}

export interface ApiListResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
}

export interface ApiErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

// --- Enums ---

export const OrderStatus = {
  PENDING_PAYMENT: "pending_payment",
  PAID: "paid",
  PROCESSING: "processing",
  READY_FOR_PICKUP: "ready_for_pickup",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const UserRole = {
  CUSTOMER: "customer",
  CASHIER: "cashier",
  INVENTORY_STAFF: "inventory_staff",
  ADMIN: "admin",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// --- Zod Schemas ---

export const orderStatusSchema = z.enum([
  "pending_payment",
  "paid",
  "processing",
  "ready_for_pickup",
  "completed",
  "cancelled",
]);

export const userRoleSchema = z.enum([
  "customer",
  "cashier",
  "inventory_staff",
  "admin",
]);

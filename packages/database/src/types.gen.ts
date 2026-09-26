export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          phone: string | null
          role: 'customer' | 'cashier' | 'inventory_staff' | 'admin'
          avatar_cloudinary_id: string | null
          is_anonymous: boolean
          is_blocked: boolean
          email_marketing_opt_out: boolean
          email_verified_at: string | null
          total_orders: number
          total_spent: number
          last_order_at: string | null
          last_sign_in_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          phone?: string | null
          role?: 'customer' | 'cashier' | 'inventory_staff' | 'admin'
          avatar_cloudinary_id?: string | null
          is_anonymous?: boolean
          is_blocked?: boolean
          email_marketing_opt_out?: boolean
          email_verified_at?: string | null
          total_orders?: number
          total_spent?: number
          last_order_at?: string | null
          last_sign_in_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          phone?: string | null
          role?: 'customer' | 'cashier' | 'inventory_staff' | 'admin'
          avatar_cloudinary_id?: string | null
          is_anonymous?: boolean
          is_blocked?: boolean
          email_marketing_opt_out?: boolean
          email_verified_at?: string | null
          total_orders?: number
          total_spent?: number
          last_order_at?: string | null
          last_sign_in_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      employee_permissions: {
        Row: {
          id: string
          user_id: string
          can_process_pos: boolean
          can_void_orders: boolean
          can_apply_discounts: boolean
          can_manage_inventory: boolean
          can_view_all_orders: boolean
          can_manage_products: boolean
          can_handle_tickets: boolean
          can_manage_broadcasts: boolean
          granted_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          can_process_pos?: boolean
          can_void_orders?: boolean
          can_apply_discounts?: boolean
          can_manage_inventory?: boolean
          can_view_all_orders?: boolean
          can_manage_products?: boolean
          can_handle_tickets?: boolean
          can_manage_broadcasts?: boolean
          granted_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          can_process_pos?: boolean
          can_void_orders?: boolean
          can_apply_discounts?: boolean
          can_manage_inventory?: boolean
          can_view_all_orders?: boolean
          can_manage_products?: boolean
          can_handle_tickets?: boolean
          can_manage_broadcasts?: boolean
          granted_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          banner_cloudinary_id: string | null
          mobile_banner_cloudinary_id: string | null
          parent_id: string | null
          sort_order: number
          is_active: boolean
          seo_title: string | null
          seo_description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          banner_cloudinary_id?: string | null
          mobile_banner_cloudinary_id?: string | null
          parent_id?: string | null
          sort_order?: number
          is_active?: boolean
          seo_title?: string | null
          seo_description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          banner_cloudinary_id?: string | null
          mobile_banner_cloudinary_id?: string | null
          parent_id?: string | null
          sort_order?: number
          is_active?: boolean
          seo_title?: string | null
          seo_description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          slug: string
          sku: string | null
          short_description: string | null
          description: string | null
          fit_notes: string | null
          fabric_care: string | null
          material: string | null
          category_id: string | null
          base_price: number
          compare_at_price: number | null
          cost_price: number | null
          status: 'active' | 'draft' | 'archived'
          is_featured: boolean
          tags: string[] | null
          total_sold: number
          average_rating: number | null
          review_count: number
          seo_title: string | null
          seo_description: string | null
          weight_grams: number | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          sku?: string | null
          short_description?: string | null
          description?: string | null
          fit_notes?: string | null
          fabric_care?: string | null
          material?: string | null
          category_id?: string | null
          base_price: number
          compare_at_price?: number | null
          cost_price?: number | null
          status?: 'active' | 'draft' | 'archived'
          is_featured?: boolean
          tags?: string[] | null
          total_sold?: number
          average_rating?: number | null
          review_count?: number
          seo_title?: string | null
          seo_description?: string | null
          weight_grams?: number | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          sku?: string | null
          short_description?: string | null
          description?: string | null
          fit_notes?: string | null
          fabric_care?: string | null
          material?: string | null
          category_id?: string | null
          base_price?: number
          compare_at_price?: number | null
          cost_price?: number | null
          status?: 'active' | 'draft' | 'archived'
          is_featured?: boolean
          tags?: string[] | null
          total_sold?: number
          average_rating?: number | null
          review_count?: number
          seo_title?: string | null
          seo_description?: string | null
          weight_grams?: number | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      product_variants: {
        Row: {
          id: string
          product_id: string
          size: string | null
          color: string | null
          color_hex: string | null
          sku: string | null
          barcode: string | null
          price_modifier: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          size?: string | null
          color?: string | null
          color_hex?: string | null
          sku?: string | null
          barcode?: string | null
          price_modifier?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          size?: string | null
          color?: string | null
          color_hex?: string | null
          sku?: string | null
          barcode?: string | null
          price_modifier?: number
          is_active?: boolean
          created_at?: string
        }
      }
      product_images: {
        Row: {
          id: string
          product_id: string
          variant_id: string | null
          cloudinary_public_id: string
          alt_text: string | null
          sort_order: number
          is_primary: boolean
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          variant_id?: string | null
          cloudinary_public_id: string
          alt_text?: string | null
          sort_order?: number
          is_primary?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          variant_id?: string | null
          cloudinary_public_id?: string
          alt_text?: string | null
          sort_order?: number
          is_primary?: boolean
          created_at?: string
        }
      }
      inventory: {
        Row: {
          id: string
          variant_id: string
          quantity: number
          reserved_quantity: number
          low_stock_threshold: number
          last_restocked_at: string | null
          last_sold_at: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          variant_id: string
          quantity?: number
          reserved_quantity?: number
          low_stock_threshold?: number
          last_restocked_at?: string | null
          last_sold_at?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          variant_id?: string
          quantity?: number
          reserved_quantity?: number
          low_stock_threshold?: number
          last_restocked_at?: string | null
          last_sold_at?: string | null
          updated_at?: string
        }
      }
      stock_movements: {
        Row: {
          id: string
          variant_id: string
          delta: number
          reason: string
          order_id: string | null
          actor_id: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          variant_id: string
          delta: number
          reason: string
          order_id?: string | null
          actor_id?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          variant_id?: string
          delta?: number
          reason?: string
          order_id?: string | null
          actor_id?: string | null
          notes?: string | null
          created_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          order_number: string
          channel: 'online' | 'walk_in'
          status: 'pending_payment' | 'paid' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'completed' | 'voided'
          customer_id: string | null
          address_id: string | null
          delivery_option_id: string | null
          promo_code: string | null
          subtotal: number
          delivery_fee: number
          discount_amount: number
          total: number
          ip_address: string | null
          session_id: string | null
          cashier_id: string | null
          internal_notes: string | null
          carrier_name: string | null
          tracking_number: string | null
          carrier_tracking_url: string | null
          paid_at: string | null
          shipped_at: string | null
          delivered_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_number?: string
          channel?: 'online' | 'walk_in'
          status?: 'pending_payment' | 'paid' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'completed' | 'voided'
          customer_id?: string | null
          address_id?: string | null
          delivery_option_id?: string | null
          promo_code?: string | null
          subtotal: number
          delivery_fee?: number
          discount_amount?: number
          total: number
          ip_address?: string | null
          session_id?: string | null
          cashier_id?: string | null
          internal_notes?: string | null
          carrier_name?: string | null
          tracking_number?: string | null
          carrier_tracking_url?: string | null
          paid_at?: string | null
          shipped_at?: string | null
          delivered_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_number?: string
          channel?: 'online' | 'walk_in'
          status?: 'pending_payment' | 'paid' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'completed' | 'voided'
          customer_id?: string | null
          address_id?: string | null
          delivery_option_id?: string | null
          promo_code?: string | null
          subtotal?: number
          delivery_fee?: number
          discount_amount?: number
          total?: number
          ip_address?: string | null
          session_id?: string | null
          cashier_id?: string | null
          internal_notes?: string | null
          carrier_name?: string | null
          tracking_number?: string | null
          carrier_tracking_url?: string | null
          paid_at?: string | null
          shipped_at?: string | null
          delivered_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          variant_id: string | null
          quantity: number
          unit_price: number
          line_total: number
          product_snapshot: Json
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          variant_id?: string | null
          quantity: number
          unit_price: number
          line_total: number
          product_snapshot: Json
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          variant_id?: string | null
          quantity?: number
          unit_price?: number
          line_total?: number
          product_snapshot?: Json
          created_at?: string
        }
      }
      settings: {
        Row: {
          id: string
          store_name: string
          support_email: string
          support_phone: string | null
          whatsapp_number: string | null
          currency: string
          free_shipping_threshold: number | null
          default_low_stock_threshold: number
          tax_rate: number
          updated_at: string
        }
        Insert: {
          id?: string
          store_name?: string
          support_email?: string
          support_phone?: string | null
          whatsapp_number?: string | null
          currency?: string
          free_shipping_threshold?: number | null
          default_low_stock_threshold?: number
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          id?: string
          store_name?: string
          support_email?: string
          support_phone?: string | null
          whatsapp_number?: string | null
          currency?: string
          free_shipping_threshold?: number | null
          default_low_stock_threshold?: number
          tax_rate?: number
          updated_at?: string
        }
      }
    }
  }
}

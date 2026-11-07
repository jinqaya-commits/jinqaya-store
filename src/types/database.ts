export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
        }
        Relationships: []
      }
      after_sales_case_events: {
        Row: {
          case_id: string
          created_at: string
          created_by: string | null
          description: string
          event_type: string
          id: string
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by?: string | null
          description: string
          event_type: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          event_type?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "after_sales_case_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "after_sales_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      after_sales_cases: {
        Row: {
          case_number: string
          created_at: string
          customer_description: string
          customer_id: string
          evidence_urls: string[]
          id: string
          issue_type: string
          order_id: string
          refund_amount: number | null
          refund_confirmed_at: string | null
          refund_reference: string | null
          refund_status: string
          resolution: string | null
          resolved_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          case_number: string
          created_at?: string
          customer_description: string
          customer_id: string
          evidence_urls?: string[]
          id?: string
          issue_type?: string
          order_id: string
          refund_amount?: number | null
          refund_confirmed_at?: string | null
          refund_reference?: string | null
          refund_status?: string
          resolution?: string | null
          resolved_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          case_number?: string
          created_at?: string
          customer_description?: string
          customer_id?: string
          evidence_urls?: string[]
          id?: string
          issue_type?: string
          order_id?: string
          refund_amount?: number | null
          refund_confirmed_at?: string | null
          refund_reference?: string | null
          refund_status?: string
          resolution?: string | null
          resolved_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "after_sales_cases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "after_sales_cases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      after_sales_customer_sessions: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          order_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          order_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          order_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "after_sales_customer_sessions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      after_sales_email_challenges: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          email: string
          expires_at: string
          id: string
          order_id: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          order_id: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          order_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "after_sales_email_challenges_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      after_sales_upload_tickets: {
        Row: {
          consumed_at: string | null
          content_type: string
          created_at: string
          expected_size: number
          expires_at: string
          id: string
          object_key: string
          order_id: string
          token_hash: string
        }
        Insert: {
          consumed_at?: string | null
          content_type: string
          created_at?: string
          expected_size: number
          expires_at: string
          id?: string
          object_key: string
          order_id: string
          token_hash: string
        }
        Update: {
          consumed_at?: string | null
          content_type?: string
          created_at?: string
          expected_size?: number
          expires_at?: string
          id?: string
          object_key?: string
          order_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "after_sales_upload_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          quantity: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          quantity?: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          quantity?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          converted_at: string | null
          created_at: string
          currency: string
          customer_id: string
          expires_at: string | null
          id: string
          status: Database["public"]["Enums"]["cart_status"]
          updated_at: string
        }
        Insert: {
          converted_at?: string | null
          created_at?: string
          currency?: string
          customer_id: string
          expires_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["cart_status"]
          updated_at?: string
        }
        Update: {
          converted_at?: string | null
          created_at?: string
          currency?: string
          customer_id?: string
          expires_at?: string | null
          id?: string
          status?: Database["public"]["Enums"]["cart_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          is_active: boolean
          name: string
          parent_id: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name: string
          parent_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name?: string
          parent_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          is_active: boolean
          name: string
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name: string
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_active?: boolean
          name?: string
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          address_type: string
          city: string
          country: string
          country_code: string
          created_at: string
          customer_id: string
          id: string
          is_default_billing: boolean
          is_default_shipping: boolean
          phone: string | null
          postal_code: string | null
          recipient_name: string
          state_region: string | null
          updated_at: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          address_type?: string
          city: string
          country: string
          country_code: string
          created_at?: string
          customer_id: string
          id?: string
          is_default_billing?: boolean
          is_default_shipping?: boolean
          phone?: string | null
          postal_code?: string | null
          recipient_name: string
          state_region?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          address_type?: string
          city?: string
          country?: string
          country_code?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_default_billing?: boolean
          is_default_shipping?: boolean
          phone?: string | null
          postal_code?: string | null
          recipient_name?: string
          state_region?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_follow_ups: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          customer_id: string
          due_at: string
          id: string
          notes: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          customer_id: string
          due_at: string
          id?: string
          notes?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string
          due_at?: string
          id?: string
          notes?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_follow_ups_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          accepts_marketing: boolean
          auth_user_id: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          marketing_opt_in_at: string | null
          notes: string | null
          phone: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          accepts_marketing?: boolean
          auth_user_id?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          marketing_opt_in_at?: string | null
          notes?: string | null
          phone?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          accepts_marketing?: boolean
          auth_user_id?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          marketing_opt_in_at?: string | null
          notes?: string | null
          phone?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      goods_receipt_items: {
        Row: {
          created_at: string
          goods_receipt_id: string
          id: string
          notes: string | null
          purchase_order_item_id: string
          quantity_damaged: number
          quantity_received: number
        }
        Insert: {
          created_at?: string
          goods_receipt_id: string
          id?: string
          notes?: string | null
          purchase_order_item_id: string
          quantity_damaged?: number
          quantity_received: number
        }
        Update: {
          created_at?: string
          goods_receipt_id?: string
          id?: string
          notes?: string | null
          purchase_order_item_id?: string
          quantity_damaged?: number
          quantity_received?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_items_goods_receipt_id_fkey"
            columns: ["goods_receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_purchase_order_item_id_fkey"
            columns: ["purchase_order_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          posted_at: string | null
          purchase_order_id: string
          receipt_number: string
          received_at: string | null
          received_by: string | null
          status: Database["public"]["Enums"]["goods_receipt_status"]
          supplier_delivery_reference: string | null
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          posted_at?: string | null
          purchase_order_id: string
          receipt_number: string
          received_at?: string | null
          received_by?: string | null
          status?: Database["public"]["Enums"]["goods_receipt_status"]
          supplier_delivery_reference?: string | null
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          posted_at?: string | null
          purchase_order_id?: string
          receipt_number?: string
          received_at?: string | null
          received_by?: string | null
          status?: Database["public"]["Enums"]["goods_receipt_status"]
          supplier_delivery_reference?: string | null
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      homepage_media: {
        Row: {
          image_path: string | null
          media_key: string
          updated_at: string
        }
        Insert: {
          image_path?: string | null
          media_key: string
          updated_at?: string
        }
        Update: {
          image_path?: string | null
          media_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      import_job_rows: {
        Row: {
          created_at: string
          error_messages: Json
          id: string
          import_job_id: string
          imported_record_id: string | null
          normalized_data: Json | null
          processed_at: string | null
          raw_data: Json
          row_number: number
          status: string
        }
        Insert: {
          created_at?: string
          error_messages?: Json
          id?: string
          import_job_id: string
          imported_record_id?: string | null
          normalized_data?: Json | null
          processed_at?: string | null
          raw_data: Json
          row_number: number
          status?: string
        }
        Update: {
          created_at?: string
          error_messages?: Json
          id?: string
          import_job_id?: string
          imported_record_id?: string | null
          normalized_data?: Json | null
          processed_at?: string | null
          raw_data?: Json
          row_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_job_rows_import_job_id_fkey"
            columns: ["import_job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_summary: Json
          failed_rows: number
          id: string
          import_type: Database["public"]["Enums"]["import_type"]
          job_number: string
          original_filename: string
          processed_rows: number
          started_at: string | null
          status: Database["public"]["Enums"]["import_status"]
          storage_path: string
          successful_rows: number
          total_rows: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_summary?: Json
          failed_rows?: number
          id?: string
          import_type: Database["public"]["Enums"]["import_type"]
          job_number: string
          original_filename: string
          processed_rows?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          storage_path: string
          successful_rows?: number
          total_rows?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_summary?: Json
          failed_rows?: number
          id?: string
          import_type?: Database["public"]["Enums"]["import_type"]
          job_number?: string
          original_filename?: string
          processed_rows?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          storage_path?: string
          successful_rows?: number
          total_rows?: number
          updated_at?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          damaged: number
          id: string
          on_hand: number
          reorder_point: number
          reserved: number
          updated_at: string
          variant_id: string
          warehouse_id: string
        }
        Insert: {
          damaged?: number
          id?: string
          on_hand?: number
          reorder_point?: number
          reserved?: number
          updated_at?: string
          variant_id: string
          warehouse_id: string
        }
        Update: {
          damaged?: number
          id?: string
          on_hand?: number
          reorder_point?: number
          reserved?: number
          updated_at?: string
          variant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          damaged_change: number
          id: string
          movement_type: Database["public"]["Enums"]["inventory_movement_type"]
          notes: string | null
          quantity_change: number
          reference_id: string | null
          reference_type: string | null
          reserved_change: number
          variant_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          damaged_change?: number
          id?: string
          movement_type: Database["public"]["Enums"]["inventory_movement_type"]
          notes?: string | null
          quantity_change: number
          reference_id?: string | null
          reference_type?: string | null
          reserved_change?: number
          variant_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          damaged_change?: number
          id?: string
          movement_type?: Database["public"]["Enums"]["inventory_movement_type"]
          notes?: string | null
          quantity_change?: number
          reference_id?: string | null
          reference_type?: string | null
          reserved_change?: number
          variant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_inquiries: {
        Row: {
          assigned_to: string | null
          campaign: string | null
          city: string | null
          closed_at: string | null
          country: string | null
          country_code: string | null
          created_at: string
          customer_id: string | null
          email: string
          first_contacted_at: string | null
          full_name: string | null
          id: string
          inquiry_number: string
          internal_notes: string | null
          landing_page: string | null
          medium: string | null
          message: string
          phone: string | null
          product_id: string | null
          referrer_url: string | null
          session_id: string | null
          source: string | null
          status: string
          subject: string | null
          submitted_at: string
          updated_at: string
          variant_id: string | null
          visitor_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          campaign?: string | null
          city?: string | null
          closed_at?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          customer_id?: string | null
          email: string
          first_contacted_at?: string | null
          full_name?: string | null
          id?: string
          inquiry_number: string
          internal_notes?: string | null
          landing_page?: string | null
          medium?: string | null
          message: string
          phone?: string | null
          product_id?: string | null
          referrer_url?: string | null
          session_id?: string | null
          source?: string | null
          status?: string
          subject?: string | null
          submitted_at?: string
          updated_at?: string
          variant_id?: string | null
          visitor_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          campaign?: string | null
          city?: string | null
          closed_at?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string
          first_contacted_at?: string | null
          full_name?: string | null
          id?: string
          inquiry_number?: string
          internal_notes?: string | null
          landing_page?: string | null
          medium?: string | null
          message?: string
          phone?: string | null
          product_id?: string | null
          referrer_url?: string | null
          session_id?: string | null
          source?: string | null
          status?: string
          subject?: string | null
          submitted_at?: string
          updated_at?: string
          variant_id?: string | null
          visitor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_inquiries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_inquiries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_inquiries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "visitor_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_inquiries_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          discount_amount: number
          id: string
          line_total: number | null
          order_id: string
          product_id: string | null
          product_name: string
          product_snapshot: Json
          quantity: number
          selected_options: Json
          sku: string
          unit_price: number
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          created_at?: string
          discount_amount?: number
          id?: string
          line_total?: number | null
          order_id: string
          product_id?: string | null
          product_name: string
          product_snapshot?: Json
          quantity: number
          selected_options?: Json
          sku: string
          unit_price: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          created_at?: string
          discount_amount?: number
          id?: string
          line_total?: number | null
          order_id?: string
          product_id?: string | null
          product_name?: string
          product_snapshot?: Json
          quantity?: number
          selected_options?: Json
          sku?: string
          unit_price?: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_refund_attachments: {
        Row: {
          content_type: string
          created_at: string
          file_name: string
          file_size: number
          id: string
          object_key: string
          order_id: string
          refund_id: string
          uploaded_by: string | null
        }
        Insert: {
          content_type: string
          created_at?: string
          file_name: string
          file_size: number
          id?: string
          object_key: string
          order_id: string
          refund_id: string
          uploaded_by?: string | null
        }
        Update: {
          content_type?: string
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          object_key?: string
          order_id?: string
          refund_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_refund_attachments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refund_attachments_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "order_refunds"
            referencedColumns: ["id"]
          },
        ]
      }
      order_refund_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          description: string
          event_type: string
          id: string
          new_values: Json | null
          old_values: Json | null
          order_id: string
          refund_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          description: string
          event_type: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          order_id: string
          refund_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          description?: string
          event_type?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          order_id?: string
          refund_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_refund_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_refund_events_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "order_refunds"
            referencedColumns: ["id"]
          },
        ]
      }
      order_refunds: {
        Row: {
          amount: number
          confirmed_at: string
          created_at: string
          currency: string
          id: string
          order_id: string
          recorded_by: string | null
          reference: string | null
          refund_method: string | null
          source_id: string
          source_type: string
          transaction_number: string | null
        }
        Insert: {
          amount: number
          confirmed_at?: string
          created_at?: string
          currency: string
          id?: string
          order_id: string
          recorded_by?: string | null
          reference?: string | null
          refund_method?: string | null
          source_id: string
          source_type: string
          transaction_number?: string | null
        }
        Update: {
          amount?: number
          confirmed_at?: string
          created_at?: string
          currency?: string
          id?: string
          order_id?: string
          recorded_by?: string | null
          reference?: string | null
          refund_method?: string | null
          source_id?: string
          source_type?: string
          transaction_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["order_status"]
          note: string | null
          old_status: Database["public"]["Enums"]["order_status"] | null
          order_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["order_status"]
          note?: string | null
          old_status?: Database["public"]["Enums"]["order_status"] | null
          order_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["order_status"]
          note?: string | null
          old_status?: Database["public"]["Enums"]["order_status"] | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_email_outbox: {
        Row: {
          attempt_count: number
          created_at: string
          id: string
          last_error: string | null
          locked_until: string | null
          max_attempts: number
          next_attempt_at: string
          order_id: string
          payload: Json
          provider_message_id: string | null
          recipient_email: string
          recipient_type: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          locked_until?: string | null
          max_attempts?: number
          next_attempt_at?: string
          order_id: string
          payload: Json
          provider_message_id?: string | null
          recipient_email: string
          recipient_type: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          locked_until?: string | null
          max_attempts?: number
          next_attempt_at?: string
          order_id?: string
          payload?: Json
          provider_message_id?: string | null
          recipient_email?: string
          recipient_type?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_email_outbox_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address_snapshot: Json | null
          cancelled_at: string | null
          checkout_idempotency_key: string | null
          checkout_request_key: string | null
          created_at: string
          currency: string
          customer_email: string
          customer_id: string
          customer_note: string | null
          customer_phone: string | null
          delivered_at: string | null
          discount_amount: number
          discount_code: string | null
          id: string
          internal_note: string | null
          order_number: string
          paid_at: string | null
          placed_at: string
          shipping_address_snapshot: Json
          shipping_amount: number
          shipping_method_name: string | null
          shipping_quote_snapshot: Json | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          billing_address_snapshot?: Json | null
          cancelled_at?: string | null
          checkout_idempotency_key?: string | null
          checkout_request_key?: string | null
          created_at?: string
          currency?: string
          customer_email: string
          customer_id: string
          customer_note?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          discount_amount?: number
          discount_code?: string | null
          id?: string
          internal_note?: string | null
          order_number: string
          paid_at?: string | null
          placed_at?: string
          shipping_address_snapshot: Json
          shipping_amount?: number
          shipping_method_name?: string | null
          shipping_quote_snapshot?: Json | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          billing_address_snapshot?: Json | null
          cancelled_at?: string | null
          checkout_idempotency_key?: string | null
          checkout_request_key?: string | null
          created_at?: string
          currency?: string
          customer_email?: string
          customer_id?: string
          customer_note?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          discount_amount?: number
          discount_code?: string | null
          id?: string
          internal_note?: string | null
          order_number?: string
          paid_at?: string | null
          placed_at?: string
          shipping_address_snapshot?: Json
          shipping_amount?: number
          shipping_method_name?: string | null
          shipping_quote_snapshot?: Json | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          event_status: string | null
          event_type: string
          id: string
          payload: Json
          payment_id: string | null
          processed_at: string | null
          processing_error: string | null
          provider: string
          provider_event_id: string
        }
        Insert: {
          created_at?: string
          event_status?: string | null
          event_type: string
          id?: string
          payload?: Json
          payment_id?: string | null
          processed_at?: string | null
          processing_error?: string | null
          provider: string
          provider_event_id: string
        }
        Update: {
          created_at?: string
          event_status?: string | null
          event_type?: string
          id?: string
          payload?: Json
          payment_id?: string | null
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          provider_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          authorized_at: string | null
          created_at: string
          currency: string
          failed_at: string | null
          failure_code: string | null
          failure_message: string | null
          id: string
          idempotency_key: string | null
          order_id: string
          paid_at: string | null
          payment_method_type: string | null
          provider: string
          provider_payment_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          authorized_at?: string | null
          created_at?: string
          currency?: string
          failed_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string | null
          order_id: string
          paid_at?: string | null
          payment_method_type?: string | null
          provider: string
          provider_payment_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          authorized_at?: string | null
          created_at?: string
          currency?: string
          failed_at?: string | null
          failure_code?: string | null
          failure_message?: string | null
          id?: string
          idempotency_key?: string | null
          order_id?: string
          paid_at?: string | null
          payment_method_type?: string | null
          provider?: string
          provider_payment_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_attributes: {
        Row: {
          attribute_name: string
          attribute_value: Json
          created_at: string
          id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          attribute_name: string
          attribute_value: Json
          created_at?: string
          id?: string
          product_id: string
          sort_order?: number
        }
        Update: {
          attribute_name?: string
          attribute_value?: Json
          created_at?: string
          id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_attributes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          category_id: string
          created_at: string
          is_primary: boolean
          product_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          is_primary?: boolean
          product_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          is_primary?: boolean
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_collections: {
        Row: {
          collection_id: string
          created_at: string
          product_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          product_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_collections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_collections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          image_type: Database["public"]["Enums"]["image_kind"]
          is_primary: boolean
          product_id: string
          sort_order: number
          storage_path: string
          variant_id: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_type?: Database["public"]["Enums"]["image_kind"]
          is_primary?: boolean
          product_id: string
          sort_order?: number
          storage_path: string
          variant_id?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_type?: Database["public"]["Enums"]["image_kind"]
          is_primary?: boolean
          product_id?: string
          sort_order?: number
          storage_path?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tag_assignments: {
        Row: {
          product_id: string
          tag_id: string
        }
        Insert: {
          product_id: string
          tag_id: string
        }
        Update: {
          product_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tag_assignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "product_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          barcode: string | null
          color: string | null
          compare_at_price: number | null
          cost_price: number | null
          created_at: string
          currency: string
          height_cm: number | null
          id: string
          is_active: boolean
          length_cm: number | null
          material: string | null
          option_values: Json
          price: number | null
          product_id: string
          size: string | null
          sku: string
          updated_at: string
          variant_name: string | null
          weight_grams: number | null
          width_cm: number | null
        }
        Insert: {
          barcode?: string | null
          color?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          currency?: string
          height_cm?: number | null
          id?: string
          is_active?: boolean
          length_cm?: number | null
          material?: string | null
          option_values?: Json
          price?: number | null
          product_id: string
          size?: string | null
          sku: string
          updated_at?: string
          variant_name?: string | null
          weight_grams?: number | null
          width_cm?: number | null
        }
        Update: {
          barcode?: string | null
          color?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          currency?: string
          height_cm?: number | null
          id?: string
          is_active?: boolean
          length_cm?: number | null
          material?: string | null
          option_values?: Json
          price?: number | null
          product_id?: string
          size?: string | null
          sku?: string
          updated_at?: string
          variant_name?: string | null
          weight_grams?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_name: string
          care_instructions: string | null
          created_at: string
          description: string | null
          id: string
          is_featured: boolean
          is_new_arrival: boolean
          material: string | null
          name: string
          pet_type: string
          published_at: string | null
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          short_description: string | null
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          updated_at: string
        }
        Insert: {
          brand_name?: string
          care_instructions?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean
          is_new_arrival?: boolean
          material?: string | null
          name: string
          pet_type?: string
          published_at?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          short_description?: string | null
          slug: string
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
        }
        Update: {
          brand_name?: string
          care_instructions?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_featured?: boolean
          is_new_arrival?: boolean
          material?: string | null
          name?: string
          pet_type?: string
          published_at?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          short_description?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number | null
          notes: string | null
          purchase_order_id: string
          quantity_ordered: number
          quantity_received: number
          unit_cost: number
          updated_at: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number | null
          notes?: string | null
          purchase_order_id: string
          quantity_ordered: number
          quantity_received?: number
          unit_cost: number
          updated_at?: string
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number | null
          notes?: string | null
          purchase_order_id?: string
          quantity_ordered?: number
          quantity_received?: number
          unit_cost?: number
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          purchase_order_id: string
          reference_number: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method: string
          purchase_order_id: string
          reference_number?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          purchase_order_id?: string
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_payments_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          expected_date: string | null
          id: string
          notes: string | null
          order_date: string
          po_number: string
          shipping_cost: number
          status: Database["public"]["Enums"]["purchase_order_status"]
          submitted_at: string | null
          subtotal: number
          supplier_email_snapshot: string | null
          supplier_id: string
          supplier_name_snapshot: string | null
          supplier_phone_snapshot: string | null
          supplier_reference: string | null
          tax_amount: number
          total_amount: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number: string
          shipping_cost?: number
          status?: Database["public"]["Enums"]["purchase_order_status"]
          submitted_at?: string | null
          subtotal?: number
          supplier_email_snapshot?: string | null
          supplier_id: string
          supplier_name_snapshot?: string | null
          supplier_phone_snapshot?: string | null
          supplier_reference?: string | null
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number?: string
          shipping_cost?: number
          status?: Database["public"]["Enums"]["purchase_order_status"]
          submitted_at?: string | null
          subtotal?: number
          supplier_email_snapshot?: string | null
          supplier_id?: string
          supplier_name_snapshot?: string | null
          supplier_phone_snapshot?: string | null
          supplier_reference?: string | null
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string | null
          internal_note: string | null
          order_id: string
          payment_id: string
          processed_at: string | null
          provider_refund_id: string | null
          reason: string | null
          requested_by: string | null
          status: Database["public"]["Enums"]["refund_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          internal_note?: string | null
          order_id: string
          payment_id: string
          processed_at?: string | null
          provider_refund_id?: string | null
          reason?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          internal_note?: string | null
          order_id?: string
          payment_id?: string
          processed_at?: string | null
          provider_refund_id?: string | null
          reason?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      return_items: {
        Row: {
          condition_notes: string | null
          created_at: string
          id: string
          inspection_result: string | null
          order_item_id: string
          quantity_approved: number
          quantity_received: number
          quantity_requested: number
          restockable: boolean | null
          return_request_id: string
          updated_at: string
        }
        Insert: {
          condition_notes?: string | null
          created_at?: string
          id?: string
          inspection_result?: string | null
          order_item_id: string
          quantity_approved?: number
          quantity_received?: number
          quantity_requested: number
          restockable?: boolean | null
          return_request_id: string
          updated_at?: string
        }
        Update: {
          condition_notes?: string | null
          created_at?: string
          id?: string
          inspection_result?: string | null
          order_item_id?: string
          quantity_approved?: number
          quantity_received?: number
          quantity_requested?: number
          restockable?: boolean | null
          return_request_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_items_return_request_id_fkey"
            columns: ["return_request_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      return_requests: {
        Row: {
          approved_at: string | null
          completed_at: string | null
          created_at: string
          customer_id: string
          customer_message: string | null
          id: string
          inspected_at: string | null
          internal_note: string | null
          order_id: string
          reason: string
          received_at: string | null
          requested_at: string
          return_carrier: string | null
          return_number: string
          return_tracking_number: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["return_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id: string
          customer_message?: string | null
          id?: string
          inspected_at?: string | null
          internal_note?: string | null
          order_id: string
          reason: string
          received_at?: string | null
          requested_at?: string
          return_carrier?: string | null
          return_number: string
          return_tracking_number?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["return_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          customer_message?: string | null
          id?: string
          inspected_at?: string | null
          internal_note?: string | null
          order_id?: string
          reason?: string
          received_at?: string | null
          requested_at?: string
          return_carrier?: string | null
          return_number?: string
          return_tracking_number?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["return_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_issue_cases: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          issue_type: string
          order_id: string
          reason: string
          refund_amount: number | null
          refund_confirmed_at: string | null
          refund_reference: string | null
          replacement_shipment_id: string | null
          replacement_stock_quantity: number | null
          replacement_stock_source: string | null
          replacement_stock_warehouse_id: string | null
          resolution_action: string | null
          resolution_notes: string | null
          shipment_id: string
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          issue_type: string
          order_id: string
          reason: string
          refund_amount?: number | null
          refund_confirmed_at?: string | null
          refund_reference?: string | null
          replacement_shipment_id?: string | null
          replacement_stock_quantity?: number | null
          replacement_stock_source?: string | null
          replacement_stock_warehouse_id?: string | null
          resolution_action?: string | null
          resolution_notes?: string | null
          shipment_id: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          issue_type?: string
          order_id?: string
          reason?: string
          refund_amount?: number | null
          refund_confirmed_at?: string | null
          refund_reference?: string | null
          replacement_shipment_id?: string | null
          replacement_stock_quantity?: number | null
          replacement_stock_source?: string | null
          replacement_stock_warehouse_id?: string | null
          resolution_action?: string | null
          resolution_notes?: string | null
          shipment_id?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_issue_cases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_issue_cases_replacement_shipment_id_fkey"
            columns: ["replacement_shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_issue_cases_replacement_stock_warehouse_id_fkey"
            columns: ["replacement_stock_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_issue_cases_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_issue_events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          event_type: string
          id: string
          issue_id: string
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          event_type: string
          id?: string
          issue_id: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          event_type?: string
          id?: string
          issue_id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_issue_events_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "shipment_issue_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_items: {
        Row: {
          created_at: string
          id: string
          order_item_id: string
          quantity: number
          shipment_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_item_id: string
          quantity: number
          shipment_id: string
        }
        Update: {
          created_at?: string
          id?: string
          order_item_id?: string
          quantity?: number
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_return_receipts: {
        Row: {
          after_sales_case_id: string | null
          condition: string
          created_at: string
          created_by: string | null
          id: string
          inspected_at: string | null
          inspected_by: string | null
          inventory_posted_at: string | null
          issue_id: string | null
          notes: string | null
          order_item_id: string
          quantity_received: number
          warehouse_id: string
        }
        Insert: {
          after_sales_case_id?: string | null
          condition: string
          created_at?: string
          created_by?: string | null
          id?: string
          inspected_at?: string | null
          inspected_by?: string | null
          inventory_posted_at?: string | null
          issue_id?: string | null
          notes?: string | null
          order_item_id: string
          quantity_received: number
          warehouse_id: string
        }
        Update: {
          after_sales_case_id?: string | null
          condition?: string
          created_at?: string
          created_by?: string | null
          id?: string
          inspected_at?: string | null
          inspected_by?: string | null
          inventory_posted_at?: string | null
          issue_id?: string | null
          notes?: string | null
          order_item_id?: string
          quantity_received?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_return_receipts_after_sales_case_id_fkey"
            columns: ["after_sales_case_id"]
            isOneToOne: false
            referencedRelation: "after_sales_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_return_receipts_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "shipment_issue_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_return_receipts_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_return_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_status_events: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["shipment_status"]
          note: string | null
          old_status: Database["public"]["Enums"]["shipment_status"] | null
          shipment_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["shipment_status"]
          note?: string | null
          old_status?: Database["public"]["Enums"]["shipment_status"] | null
          shipment_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["shipment_status"]
          note?: string | null
          old_status?: Database["public"]["Enums"]["shipment_status"] | null
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_status_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier_name: string | null
          created_at: string
          currency: string
          delivered_at: string | null
          id: string
          notes: string | null
          order_id: string
          package_id: string | null
          service_name: string | null
          shipped_at: string | null
          shipped_by: string | null
          shipping_cost: number | null
          shipping_method_id: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          carrier_name?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          id?: string
          notes?: string | null
          order_id: string
          package_id?: string | null
          service_name?: string | null
          shipped_at?: string | null
          shipped_by?: string | null
          shipping_cost?: number | null
          shipping_method_id?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          carrier_name?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          package_id?: string | null
          service_name?: string | null
          shipped_at?: string | null
          shipped_by?: string | null
          shipping_cost?: number | null
          shipping_method_id?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "shipping_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_shipping_method_id_fkey"
            columns: ["shipping_method_id"]
            isOneToOne: false
            referencedRelation: "shipping_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_methods: {
        Row: {
          carrier_name: string | null
          code: string
          created_at: string
          description: string | null
          estimated_max_days: number | null
          estimated_min_days: number | null
          id: string
          is_active: boolean
          name: string
          service_name: string | null
          updated_at: string
        }
        Insert: {
          carrier_name?: string | null
          code: string
          created_at?: string
          description?: string | null
          estimated_max_days?: number | null
          estimated_min_days?: number | null
          id?: string
          is_active?: boolean
          name: string
          service_name?: string | null
          updated_at?: string
        }
        Update: {
          carrier_name?: string | null
          code?: string
          created_at?: string
          description?: string | null
          estimated_max_days?: number | null
          estimated_min_days?: number | null
          id?: string
          is_active?: boolean
          name?: string
          service_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shipping_packages: {
        Row: {
          created_at: string
          height_cm: number | null
          id: string
          length_cm: number | null
          order_id: string
          package_number: string
          package_type: string | null
          packed_at: string | null
          packed_by: string | null
          packing_notes: string | null
          weight_grams: number | null
          width_cm: number | null
        }
        Insert: {
          created_at?: string
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          order_id: string
          package_number: string
          package_type?: string | null
          packed_at?: string | null
          packed_by?: string | null
          packing_notes?: string | null
          weight_grams?: number | null
          width_cm?: number | null
        }
        Update: {
          created_at?: string
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          order_id?: string
          package_number?: string
          package_type?: string | null
          packed_at?: string | null
          packed_by?: string | null
          packing_notes?: string | null
          weight_grams?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_packages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_rates: {
        Row: {
          base_amount: number
          created_at: string
          currency: string
          id: string
          is_active: boolean
          max_order_amount: number | null
          max_shipping_amount: number | null
          max_weight_kg: number | null
          min_order_amount: number | null
          min_shipping_amount: number | null
          min_weight_kg: number | null
          per_item_amount: number
          per_kg_amount: number
          rate_type: Database["public"]["Enums"]["shipping_rate_type"]
          shipping_method_id: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
          zone_id: string
        }
        Insert: {
          base_amount?: number
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          max_order_amount?: number | null
          max_shipping_amount?: number | null
          max_weight_kg?: number | null
          min_order_amount?: number | null
          min_shipping_amount?: number | null
          min_weight_kg?: number | null
          per_item_amount?: number
          per_kg_amount?: number
          rate_type?: Database["public"]["Enums"]["shipping_rate_type"]
          shipping_method_id: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          zone_id: string
        }
        Update: {
          base_amount?: number
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          max_order_amount?: number | null
          max_shipping_amount?: number | null
          max_weight_kg?: number | null
          min_order_amount?: number | null
          min_shipping_amount?: number | null
          min_weight_kg?: number | null
          per_item_amount?: number
          per_kg_amount?: number
          rate_type?: Database["public"]["Enums"]["shipping_rate_type"]
          shipping_method_id?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rates_shipping_method_id_fkey"
            columns: ["shipping_method_id"]
            isOneToOne: false
            referencedRelation: "shipping_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_rates_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_zone_countries: {
        Row: {
          country_code: string
          created_at: string
          id: string
          region_code: string | null
          zone_id: string
        }
        Insert: {
          country_code: string
          created_at?: string
          id?: string
          region_code?: string | null
          zone_id: string
        }
        Update: {
          country_code?: string
          created_at?: string
          id?: string
          region_code?: string | null
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_zone_countries_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_zones: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_adjustment_items: {
        Row: {
          adjustment_id: string
          counted_quantity: number
          created_at: string
          expected_quantity: number
          id: string
          quantity_difference: number | null
          reason: string | null
          variant_id: string
        }
        Insert: {
          adjustment_id: string
          counted_quantity: number
          created_at?: string
          expected_quantity: number
          id?: string
          quantity_difference?: number | null
          reason?: string | null
          variant_id: string
        }
        Update: {
          adjustment_id?: string
          counted_quantity?: number
          created_at?: string
          expected_quantity?: number
          id?: string
          quantity_difference?: number | null
          reason?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustment_items_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "stock_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          adjustment_number: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          posted_at: string | null
          reason: string
          status: Database["public"]["Enums"]["stock_adjustment_status"]
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          adjustment_number: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          posted_at?: string | null
          reason: string
          status?: Database["public"]["Enums"]["stock_adjustment_status"]
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          adjustment_number?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          posted_at?: string | null
          reason?: string
          status?: Database["public"]["Enums"]["stock_adjustment_status"]
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reservations: {
        Row: {
          committed_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          order_id: string
          quantity: number
          released_at: string | null
          status: string
          updated_at: string
          variant_id: string
          warehouse_id: string
        }
        Insert: {
          committed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          order_id: string
          quantity: number
          released_at?: string | null
          status?: string
          updated_at?: string
          variant_id: string
          warehouse_id: string
        }
        Update: {
          committed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          order_id?: string
          quantity?: number
          released_at?: string | null
          status?: string
          updated_at?: string
          variant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_reservations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reservations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          city: string | null
          company_name: string
          contact_name: string | null
          country: string | null
          created_at: string
          currency: string
          email: string | null
          id: string
          is_active: boolean
          notes: string | null
          payment_terms: string | null
          phone: string | null
          postal_code: string | null
          supplier_code: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_name: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          supplier_code?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_name?: string
          contact_name?: string | null
          country?: string | null
          created_at?: string
          currency?: string
          email?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          postal_code?: string | null
          supplier_code?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          attachments: Json
          created_at: string
          id: string
          is_internal: boolean
          message: string
          sender_type: string
          sender_user_id: string | null
          ticket_id: string
        }
        Insert: {
          attachments?: Json
          created_at?: string
          id?: string
          is_internal?: boolean
          message: string
          sender_type: string
          sender_user_id?: string | null
          ticket_id: string
        }
        Update: {
          attachments?: Json
          created_at?: string
          id?: string
          is_internal?: boolean
          message?: string
          sender_type?: string
          sender_user_id?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          id: string
          order_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          resolved_at: string | null
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          ticket_number: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          order_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          ticket_number: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          order_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          ticket_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_events: {
        Row: {
          created_at: string
          description: string | null
          event_code: string | null
          event_status: string
          event_time: string
          id: string
          location: string | null
          raw_payload: Json | null
          shipment_id: string
          source: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_code?: string | null
          event_status: string
          event_time: string
          id?: string
          location?: string | null
          raw_payload?: Json | null
          shipment_id: string
          source?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          event_code?: string | null
          event_status?: string
          event_time?: string
          id?: string
          location?: string | null
          raw_payload?: Json | null
          shipment_id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracking_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      visitor_events: {
        Row: {
          customer_id: string | null
          event_data: Json
          event_name: string
          id: string
          occurred_at: string
          page_path: string | null
          product_id: string | null
          session_id: string
          variant_id: string | null
          visitor_id: string
        }
        Insert: {
          customer_id?: string | null
          event_data?: Json
          event_name: string
          id?: string
          occurred_at?: string
          page_path?: string | null
          product_id?: string | null
          session_id: string
          variant_id?: string | null
          visitor_id: string
        }
        Update: {
          customer_id?: string | null
          event_data?: Json
          event_name?: string
          id?: string
          occurred_at?: string
          page_path?: string | null
          product_id?: string | null
          session_id?: string
          variant_id?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "visitor_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_events_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      visitor_identity_links: {
        Row: {
          customer_id: string
          id: string
          link_method: string
          linked_at: string
          visitor_id: string
        }
        Insert: {
          customer_id: string
          id?: string
          link_method?: string
          linked_at?: string
          visitor_id: string
        }
        Update: {
          customer_id?: string
          id?: string
          link_method?: string
          linked_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_identity_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      visitor_page_views: {
        Row: {
          customer_id: string | null
          duration_seconds: number | null
          id: string
          metadata: Json
          page_path: string
          page_title: string | null
          page_type: string | null
          product_id: string | null
          referrer_url: string | null
          session_id: string
          variant_id: string | null
          viewed_at: string
          visitor_id: string
        }
        Insert: {
          customer_id?: string | null
          duration_seconds?: number | null
          id?: string
          metadata?: Json
          page_path: string
          page_title?: string | null
          page_type?: string | null
          product_id?: string | null
          referrer_url?: string | null
          session_id: string
          variant_id?: string | null
          viewed_at?: string
          visitor_id: string
        }
        Update: {
          customer_id?: string | null
          duration_seconds?: number | null
          id?: string
          metadata?: Json
          page_path?: string
          page_title?: string | null
          page_type?: string | null
          product_id?: string | null
          referrer_url?: string | null
          session_id?: string
          variant_id?: string | null
          viewed_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_page_views_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_page_views_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_page_views_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "visitor_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_page_views_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      visitor_sessions: {
        Row: {
          browser: string | null
          campaign: string | null
          consent_status: string
          consent_updated_at: string | null
          content: string | null
          created_at: string
          customer_id: string | null
          device_type: string | null
          ended_at: string | null
          exit_page: string | null
          fbclid: string | null
          gclid: string | null
          id: string
          ip_address: unknown
          ip_anonymized_at: string | null
          ip_city: string | null
          ip_country: string | null
          ip_country_code: string | null
          ip_region: string | null
          landing_page: string | null
          last_seen_at: string
          medium: string | null
          operating_system: string | null
          referrer_url: string | null
          session_token_hash: string
          source: string | null
          started_at: string
          term: string | null
          user_agent: string | null
          visitor_id: string
        }
        Insert: {
          browser?: string | null
          campaign?: string | null
          consent_status?: string
          consent_updated_at?: string | null
          content?: string | null
          created_at?: string
          customer_id?: string | null
          device_type?: string | null
          ended_at?: string | null
          exit_page?: string | null
          fbclid?: string | null
          gclid?: string | null
          id?: string
          ip_address?: unknown
          ip_anonymized_at?: string | null
          ip_city?: string | null
          ip_country?: string | null
          ip_country_code?: string | null
          ip_region?: string | null
          landing_page?: string | null
          last_seen_at?: string
          medium?: string | null
          operating_system?: string | null
          referrer_url?: string | null
          session_token_hash: string
          source?: string | null
          started_at?: string
          term?: string | null
          user_agent?: string | null
          visitor_id: string
        }
        Update: {
          browser?: string | null
          campaign?: string | null
          consent_status?: string
          consent_updated_at?: string | null
          content?: string | null
          created_at?: string
          customer_id?: string | null
          device_type?: string | null
          ended_at?: string | null
          exit_page?: string | null
          fbclid?: string | null
          gclid?: string | null
          id?: string
          ip_address?: unknown
          ip_anonymized_at?: string | null
          ip_city?: string | null
          ip_country?: string | null
          ip_country_code?: string | null
          ip_region?: string | null
          landing_page?: string | null
          last_seen_at?: string
          medium?: string | null
          operating_system?: string | null
          referrer_url?: string | null
          session_token_hash?: string
          source?: string | null
          started_at?: string
          term?: string | null
          user_agent?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          code: string
          country: string | null
          country_code: string | null
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          notes: string | null
          postal_code: string | null
          state_region: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          code: string
          country?: string | null
          country_code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          notes?: string | null
          postal_code?: string | null
          state_region?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          code?: string
          country?: string | null
          country_code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          notes?: string | null
          postal_code?: string | null
          state_region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_add_product_image: {
        Args: {
          p_alt_text: string
          p_product_id: string
          p_storage_path: string
        }
        Returns: string
      }
      admin_adjust_inventory: {
        Args: {
          p_notes?: string
          p_on_hand: number
          p_reorder_point?: number
          p_variant_id: string
        }
        Returns: Json
      }
      admin_confirm_after_sales_refund: {
        Args: {
          p_case_id: string
          p_refund_amount: number
          p_refund_method?: string
          p_refund_reference?: string
          p_transaction_number?: string
        }
        Returns: Json
      }
      admin_create_purchase_order: {
        Args: {
          p_currency: string
          p_items: Json
          p_notes: string
          p_supplier_contact: string
          p_supplier_name: string
          p_supplier_reference: string
        }
        Returns: Json
      }
      admin_create_purchase_order_v2: {
        Args: {
          p_currency: string
          p_expected_date: string
          p_items: Json
          p_notes: string
          p_supplier_email: string
          p_supplier_name: string
          p_supplier_phone: string
          p_supplier_reference: string
        }
        Returns: Json
      }
      admin_create_purchase_order_v3: {
        Args: {
          p_currency: string
          p_expected_date: string
          p_items: Json
          p_notes: string
          p_save_supplier: boolean
          p_supplier_email: string
          p_supplier_id: string
          p_supplier_name: string
          p_supplier_phone: string
          p_supplier_reference: string
        }
        Returns: Json
      }
      admin_create_replacement_shipment: {
        Args: {
          p_carrier_name: string
          p_issue_id: string
          p_stock_source: string
          p_tracking_number: string
          p_tracking_url: string
        }
        Returns: string
      }
      admin_create_shipment_issue: {
        Args: { p_issue_type: string; p_reason: string; p_shipment_id: string }
        Returns: string
      }
      admin_delete_product_image: {
        Args: { p_image_id: string; p_product_id: string }
        Returns: string
      }
      admin_inspect_shipment_return: {
        Args: { p_condition: string; p_notes?: string; p_receipt_id: string }
        Returns: Json
      }
      admin_process_order: {
        Args: {
          p_action: string
          p_carrier_name?: string
          p_note?: string
          p_order_id: string
          p_shipping_amount?: number
          p_shipping_method?: string
          p_tracking_number?: string
          p_tracking_url?: string
        }
        Returns: Json
      }
      admin_receive_purchase_order_item: {
        Args: {
          p_item_id: string
          p_notes?: string
          p_purchase_order_id: string
          p_quantity: number
        }
        Returns: Json
      }
      admin_receive_purchase_order_line_v2: {
        Args: {
          p_damaged?: number
          p_notes?: string
          p_purchase_order_item_id: string
          p_quantity: number
          p_supplier_delivery_reference?: string
        }
        Returns: Json
      }
      admin_record_after_sales_return: {
        Args: {
          p_case_id: string
          p_notes?: string
          p_order_item_id: string
          p_quantity: number
          p_warehouse_id: string
        }
        Returns: string
      }
      admin_record_inventory_movement: {
        Args: {
          p_movement_type: string
          p_notes?: string
          p_quantity: number
          p_variant_id: string
        }
        Returns: Json
      }
      admin_record_purchase_order_payment: {
        Args: {
          p_amount: number
          p_notes: string
          p_payment_date: string
          p_payment_method: string
          p_purchase_order_id: string
          p_reference_number: string
        }
        Returns: Json
      }
      admin_record_shipment_return: {
        Args: {
          p_condition: string
          p_issue_id: string
          p_notes?: string
          p_order_item_id: string
          p_quantity: number
          p_warehouse_id: string
        }
        Returns: string
      }
      admin_reorder_product_images: {
        Args: { p_image_ids: string[]; p_product_id: string }
        Returns: undefined
      }
      admin_submit_purchase_order_v2: {
        Args: { p_purchase_order_id: string }
        Returns: Json
      }
      admin_update_customer_crm: {
        Args: { p_customer_id: string; p_notes: string; p_tags: string[] }
        Returns: Json
      }
      admin_update_shipment_issue: {
        Args: {
          p_confirm_refund?: boolean
          p_issue_id: string
          p_refund_amount?: number
          p_refund_method?: string
          p_refund_reference?: string
          p_resolution_action: string
          p_resolution_notes: string
          p_status: string
          p_transaction_number?: string
        }
        Returns: Json
      }
      admin_update_shipment_status: {
        Args: {
          p_new_status: Database["public"]["Enums"]["shipment_status"]
          p_note?: string
          p_shipment_id: string
        }
        Returns: Json
      }
      can_manage_catalog: { Args: never; Returns: boolean }
      check_after_sales_customer_session: {
        Args: { p_order_id: string; p_token_hash: string }
        Returns: boolean
      }
      consume_after_sales_upload_tickets: {
        Args: {
          p_object_keys: string[]
          p_order_id: string
          p_token_hash: string
        }
        Returns: number
      }
      create_after_sales_email_challenge:
        | {
            Args: { p_code: string; p_email: string; p_order_id: string }
            Returns: boolean
          }
        | {
            Args: { p_code: string; p_email: string; p_order_number: string }
            Returns: boolean
          }
      create_guest_order_request: {
        Args: {
          p_address: Json
          p_checkout_key: string
          p_customer: Json
          p_customer_note?: string
          p_items: Json
        }
        Returns: Json
      }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      delete_after_sales_orphan_ticket_rows: {
        Args: { p_object_keys: string[] }
        Returns: number
      }
      has_role: {
        Args: { allowed_roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      is_staff: { Args: never; Returns: boolean }
      list_expired_after_sales_orphan_keys: {
        Args: { p_limit?: number }
        Returns: {
          object_key: string
        }[]
      }
      reserve_after_sales_upload: {
        Args: {
          p_content_type: string
          p_expected_size: number
          p_object_key: string
          p_order_id: string
          p_token_hash: string
        }
        Returns: boolean
      }
      submit_customer_after_sales_case: {
        Args: {
          p_description: string
          p_evidence_keys: string[]
          p_order_id: string
          p_token_hash: string
        }
        Returns: Json
      }
      submit_guest_order: {
        Args: {
          p_customer: Json
          p_customer_note?: string
          p_honeypot?: string
          p_idempotency_key: string
          p_items: Json
          p_shipping_address: Json
        }
        Returns: Json
      }
      validate_after_sales_upload_ticket: {
        Args: {
          p_actual_size: number
          p_content_type: string
          p_object_key: string
          p_order_id: string
          p_token_hash: string
        }
        Returns: boolean
      }
      verify_after_sales_email_code:
        | {
            Args: {
              p_code: string
              p_email: string
              p_order_id: string
              p_token_hash: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_code: string
              p_email: string
              p_order_number: string
              p_token_hash: string
            }
            Returns: string
          }
    }
    Enums: {
      app_role: "owner" | "admin" | "warehouse" | "customer_service"
      cart_status: "active" | "converted" | "abandoned" | "expired"
      goods_receipt_status: "draft" | "posted" | "cancelled"
      image_kind:
        | "main"
        | "gallery"
        | "detail"
        | "lifestyle"
        | "size_guide"
        | "other"
      import_status:
        | "uploaded"
        | "validating"
        | "ready"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      import_type: "products" | "variants" | "inventory" | "customers"
      inventory_movement_type:
        | "opening"
        | "purchase_receipt"
        | "sale"
        | "reservation"
        | "reservation_release"
        | "customer_return"
        | "supplier_return"
        | "adjustment"
        | "damage"
        | "transfer_in"
        | "transfer_out"
      order_status:
        | "pending_payment"
        | "paid"
        | "processing"
        | "partially_shipped"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "partially_refunded"
        | "refunded"
        | "on_hold"
      payment_status:
        | "pending"
        | "authorized"
        | "paid"
        | "failed"
        | "partially_refunded"
        | "refunded"
        | "cancelled"
      product_status: "draft" | "active" | "archived"
      purchase_order_status:
        | "draft"
        | "submitted"
        | "partially_received"
        | "received"
        | "cancelled"
      refund_status:
        | "requested"
        | "pending"
        | "succeeded"
        | "failed"
        | "cancelled"
      return_status:
        | "requested"
        | "approved"
        | "rejected"
        | "in_transit"
        | "received"
        | "inspected"
        | "refund_pending"
        | "completed"
        | "closed"
      shipment_status:
        | "pending"
        | "label_created"
        | "shipped"
        | "in_transit"
        | "delivered"
        | "exception"
        | "returned"
        | "cancelled"
      shipping_rate_type: "flat" | "per_weight" | "per_item" | "combined"
      stock_adjustment_status:
        | "draft"
        | "submitted"
        | "approved"
        | "rejected"
        | "posted"
        | "cancelled"
      ticket_priority: "low" | "normal" | "high" | "urgent"
      ticket_status:
        | "open"
        | "in_progress"
        | "waiting_customer"
        | "resolved"
        | "closed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "warehouse", "customer_service"],
      cart_status: ["active", "converted", "abandoned", "expired"],
      goods_receipt_status: ["draft", "posted", "cancelled"],
      image_kind: [
        "main",
        "gallery",
        "detail",
        "lifestyle",
        "size_guide",
        "other",
      ],
      import_status: [
        "uploaded",
        "validating",
        "ready",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      import_type: ["products", "variants", "inventory", "customers"],
      inventory_movement_type: [
        "opening",
        "purchase_receipt",
        "sale",
        "reservation",
        "reservation_release",
        "customer_return",
        "supplier_return",
        "adjustment",
        "damage",
        "transfer_in",
        "transfer_out",
      ],
      order_status: [
        "pending_payment",
        "paid",
        "processing",
        "partially_shipped",
        "shipped",
        "delivered",
        "cancelled",
        "partially_refunded",
        "refunded",
        "on_hold",
      ],
      payment_status: [
        "pending",
        "authorized",
        "paid",
        "failed",
        "partially_refunded",
        "refunded",
        "cancelled",
      ],
      product_status: ["draft", "active", "archived"],
      purchase_order_status: [
        "draft",
        "submitted",
        "partially_received",
        "received",
        "cancelled",
      ],
      refund_status: [
        "requested",
        "pending",
        "succeeded",
        "failed",
        "cancelled",
      ],
      return_status: [
        "requested",
        "approved",
        "rejected",
        "in_transit",
        "received",
        "inspected",
        "refund_pending",
        "completed",
        "closed",
      ],
      shipment_status: [
        "pending",
        "label_created",
        "shipped",
        "in_transit",
        "delivered",
        "exception",
        "returned",
        "cancelled",
      ],
      shipping_rate_type: ["flat", "per_weight", "per_item", "combined"],
      stock_adjustment_status: [
        "draft",
        "submitted",
        "approved",
        "rejected",
        "posted",
        "cancelled",
      ],
      ticket_priority: ["low", "normal", "high", "urgent"],
      ticket_status: [
        "open",
        "in_progress",
        "waiting_customer",
        "resolved",
        "closed",
      ],
    },
  },
} as const

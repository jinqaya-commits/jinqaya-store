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
      checkout_country_restrictions: {
        Row: {
          country_code: string
          country_name: string
          created_at: string
          is_active: boolean
          reason: string
          updated_at: string
        }
        Insert: {
          country_code: string
          country_name: string
          created_at?: string
          is_active?: boolean
          reason: string
          updated_at?: string
        }
        Update: {
          country_code?: string
          country_name?: string
          created_at?: string
          is_active?: boolean
          reason?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_order_status_sessions: {
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
            foreignKeyName: "customer_order_status_sessions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
          updated_by: string | null
        }
        Insert: {
          image_path?: string | null
          media_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          image_path?: string | null
          media_key?: string
          updated_at?: string
          updated_by?: string | null
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
      order_email_outbox: {
        Row: {
          attempt_count: number
          created_at: string
          event_type: string
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
          event_type?: string
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
          event_type?: string
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
          sku?: string
          unit_price?: number
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
      order_status_email_challenges: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          delivery_failed_at: string | null
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
          delivery_failed_at?: string | null
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
          delivery_failed_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          order_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_email_challenges_order_id_fkey"
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
      orders: {
        Row: {
          billing_address_snapshot: Json | null
          cancelled_at: string | null
          checkout_idempotency_key: string | null
          checkout_request_key: string | null
          created_at: string
          currency: string
          customer_email: string
          customer_id: string | null
          customer_note: string | null
          customer_phone: string | null
          delivered_at: string | null
          discount_amount: number
          id: string
          internal_note: string | null
          order_number: string
          paid_at: string | null
          placed_at: string
          shipping_address_snapshot: Json | null
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
          customer_id?: string | null
          customer_note?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          discount_amount?: number
          id?: string
          internal_note?: string | null
          order_number: string
          paid_at?: string | null
          placed_at?: string
          shipping_address_snapshot?: Json | null
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
          customer_id?: string | null
          customer_note?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          discount_amount?: number
          id?: string
          internal_note?: string | null
          order_number?: string
          paid_at?: string | null
          placed_at?: string
          shipping_address_snapshot?: Json | null
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
          provider_order_id: string | null
          provider_payment_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          stock_review_required: boolean
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
          provider_order_id?: string | null
          provider_payment_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stock_review_required?: boolean
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
          provider_order_id?: string | null
          provider_payment_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          stock_review_required?: boolean
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
      product_image_cleanup_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          locked_at: string | null
          next_attempt_at: string
          storage_path: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          next_attempt_at?: string
          storage_path: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          next_attempt_at?: string
          storage_path?: string
        }
        Relationships: []
      }
      product_image_upload_intents: {
        Row: {
          attempts: number
          created_at: string
          created_by: string
          expires_at: string
          id: string
          last_error: string | null
          locked_at: string | null
          next_attempt_at: string
          product_id: string
          status: string
          storage_path: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          next_attempt_at?: string
          product_id: string
          status?: string
          storage_path: string
        }
        Update: {
          attempts?: number
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          last_error?: string | null
          locked_at?: string | null
          next_attempt_at?: string
          product_id?: string
          status?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_image_upload_intents_product_id_fkey"
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
      shipments: {
        Row: {
          carrier_name: string | null
          created_at: string
          delivered_at: string | null
          id: string
          order_id: string
          shipped_at: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_number: string | null
          tracking_url: string | null
        }
        Insert: {
          carrier_name?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          order_id: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_number?: string | null
          tracking_url?: string | null
        }
        Update: {
          carrier_name?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          order_id?: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_number?: string | null
          tracking_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
      warehouses: {
        Row: {
          id: string
          is_active: boolean
          is_default: boolean
          name: string
        }
        Insert: {
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
        }
        Update: {
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
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
          p_reorder_point: number
          p_variant_id: string
        }
        Returns: undefined
      }
      admin_create_product_image_upload_intent: {
        Args: { p_product_id: string; p_storage_path: string }
        Returns: string
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
      admin_delete_product_image: {
        Args: { p_image_id: string; p_product_id: string }
        Returns: string
      }
      admin_enqueue_product_image_cleanup: {
        Args: { p_storage_path: string }
        Returns: undefined
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
      admin_record_inventory_movement: {
        Args: {
          p_movement_type: string
          p_notes: string
          p_quantity: number
          p_variant_id: string
        }
        Returns: undefined
      }
      admin_record_purchase_order_payment: {
        Args: {
          p_amount: number
          p_notes?: string
          p_payment_date: string
          p_payment_method: string
          p_purchase_order_id: string
          p_reference_number?: string
        }
        Returns: string
      }
      admin_reorder_product_images: {
        Args: { p_image_ids: string[]; p_product_id: string }
        Returns: undefined
      }
      admin_replace_product_image: {
        Args: {
          p_image_id: string
          p_product_id: string
          p_storage_path: string
        }
        Returns: string
      }
      admin_resolve_paid_order_stock_review: {
        Args: { p_note: string; p_order_id: string }
        Returns: Json
      }
      admin_save_product_catalog: {
        Args: {
          p_category_ids: string[]
          p_primary_category_id: string
          p_product: Json
          p_product_id: string
          p_variant?: Json
        }
        Returns: string
      }
      admin_submit_purchase_order_v2: {
        Args: { p_purchase_order_id: string }
        Returns: undefined
      }
      can_manage_catalog: { Args: never; Returns: boolean }
      claim_order_email_outbox: {
        Args: { p_limit?: number; p_order_id?: string }
        Returns: {
          attempt_count: number
          created_at: string
          event_type: string
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
        }[]
        SetofOptions: {
          from: "*"
          to: "order_email_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_product_image_cleanup: {
        Args: { p_limit?: number }
        Returns: {
          id: string
          storage_path: string
        }[]
      }
      claim_product_image_upload_cleanup: {
        Args: { p_limit?: number }
        Returns: {
          id: string
          storage_path: string
        }[]
      }
      complete_order_email_outbox: {
        Args: {
          p_error?: string
          p_id: string
          p_provider_message_id?: string
          p_retryable?: boolean
          p_success: boolean
        }
        Returns: undefined
      }
      complete_product_image_cleanup: {
        Args: { p_id: string }
        Returns: undefined
      }
      complete_product_image_upload_cleanup: {
        Args: { p_id: string }
        Returns: undefined
      }
      create_order_status_email_challenge: {
        Args: { p_code: string; p_email: string; p_order_number: string }
        Returns: boolean
      }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      fail_product_image_cleanup: {
        Args: { p_error: string; p_id: string }
        Returns: undefined
      }
      fail_product_image_upload_cleanup: {
        Args: { p_error: string; p_id: string }
        Returns: undefined
      }
      get_customer_order_status: {
        Args: { p_token_hash: string }
        Returns: Json
      }
      has_role: {
        Args: { allowed_roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      mark_order_status_email_challenge_delivery_failed: {
        Args: { p_email: string; p_order_number: string }
        Returns: boolean
      }
      record_paypal_order_payment: {
        Args: {
          p_amount: number
          p_capture_id: string
          p_currency: string
          p_order_id: string
          p_paypal_order_id: string
        }
        Returns: Json
      }
      release_expired_stock_reservations: {
        Args: { p_limit?: number }
        Returns: Json
      }
      revoke_customer_order_status_session: {
        Args: { p_token_hash: string }
        Returns: boolean
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
      verify_order_status_email_code: {
        Args: {
          p_code: string
          p_email: string
          p_order_number: string
          p_token_hash: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "warehouse" | "customer_service"
      goods_receipt_status: "draft" | "posted" | "cancelled"
      image_kind:
        | "main"
        | "gallery"
        | "detail"
        | "lifestyle"
        | "size_guide"
        | "other"
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
      shipment_status:
        | "pending"
        | "label_created"
        | "shipped"
        | "in_transit"
        | "delivered"
        | "exception"
        | "returned"
        | "cancelled"
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
      goods_receipt_status: ["draft", "posted", "cancelled"],
      image_kind: [
        "main",
        "gallery",
        "detail",
        "lifestyle",
        "size_guide",
        "other",
      ],
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
    },
  },
} as const

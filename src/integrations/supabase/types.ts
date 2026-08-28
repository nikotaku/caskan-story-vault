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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      advertising_costs: {
        Row: {
          clicks: number
          conversions: number
          cost: number
          created_at: string
          date: string
          id: string
          impressions: number
          platform: string
          store_id: string
        }
        Insert: {
          clicks?: number
          conversions?: number
          cost?: number
          created_at?: string
          date: string
          id?: string
          impressions?: number
          platform: string
          store_id?: string
        }
        Update: {
          clicks?: number
          conversions?: number
          cost?: number
          created_at?: string
          date?: string
          id?: string
          impressions?: number
          platform?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "advertising_costs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_connections: {
        Row: {
          browserbase_context_id: string | null
          configuration: Json
          created_at: string
          id: string
          last_error: string | null
          last_reconciled_at: string | null
          last_verified_at: string | null
          provider: string
          setup_session_id: string | null
          shop_id: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          browserbase_context_id?: string | null
          configuration?: Json
          created_at?: string
          id?: string
          last_error?: string | null
          last_reconciled_at?: string | null
          last_verified_at?: string | null
          provider?: string
          setup_session_id?: string | null
          shop_id?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          browserbase_context_id?: string | null
          configuration?: Json
          created_at?: string
          id?: string
          last_error?: string | null
          last_reconciled_at?: string | null
          last_verified_at?: string | null
          provider?: string
          setup_session_id?: string | null
          shop_id?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_connections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_jobs: {
        Row: {
          attempts: number
          available_at: string
          browserbase_session_id: string | null
          cast_id: string | null
          created_at: string
          dedupe_key: string
          error_message: string | null
          finished_at: string | null
          id: string
          job_type: string
          max_attempts: number
          payload: Json
          provider: string
          result: Json
          shift_id: string | null
          started_at: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          browserbase_session_id?: string | null
          cast_id?: string | null
          created_at?: string
          dedupe_key: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_type: string
          max_attempts?: number
          payload?: Json
          provider?: string
          result?: Json
          shift_id?: string | null
          started_at?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          browserbase_session_id?: string | null
          cast_id?: string | null
          created_at?: string
          dedupe_key?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_type?: string
          max_attempts?: number
          payload?: Json
          provider?: string
          result?: Json
          shift_id?: string | null
          started_at?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_jobs_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_jobs_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_jobs_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_jobs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      back_rates: {
        Row: {
          course_type: string
          created_at: string
          customer_price: number
          description: string | null
          display_order: number
          duration: number
          id: string
          is_visible: boolean
          shop_back: number
          store_id: string
          therapist_back: number
          updated_at: string
        }
        Insert: {
          course_type: string
          created_at?: string
          customer_price: number
          description?: string | null
          display_order?: number
          duration: number
          id?: string
          is_visible?: boolean
          shop_back?: number
          store_id?: string
          therapist_back?: number
          updated_at?: string
        }
        Update: {
          course_type?: string
          created_at?: string
          customer_price?: number
          description?: string | null
          display_order?: number
          duration?: number
          id?: string
          is_visible?: boolean
          shop_back?: number
          store_id?: string
          therapist_back?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "back_rates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      banners: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string
          is_active: boolean
          link_url: string | null
          store_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          is_active?: boolean
          link_url?: string | null
          store_id?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string | null
          store_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "banners_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      bios: {
        Row: {
          content: string
          created_at: string
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      board_posts: {
        Row: {
          author_name: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_pinned: boolean
          store_id: string
          title: string
        }
        Insert: {
          author_name?: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean
          store_id?: string
          title?: string
        }
        Update: {
          author_name?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean
          store_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_posts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      business_bank_accounts: {
        Row: {
          account_holder: string | null
          account_name: string
          account_number: string | null
          bank_name: string | null
          branch_name: string | null
          created_at: string | null
          id: string
          layout: Json
          notes: string | null
          purpose: string | null
          sort_order: number | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          account_holder?: string | null
          account_name: string
          account_number?: string | null
          bank_name?: string | null
          branch_name?: string | null
          created_at?: string | null
          id?: string
          layout?: Json
          notes?: string | null
          purpose?: string | null
          sort_order?: number | null
          store_id?: string
          updated_at?: string | null
        }
        Update: {
          account_holder?: string | null
          account_name?: string
          account_number?: string | null
          bank_name?: string | null
          branch_name?: string | null
          created_at?: string | null
          id?: string
          layout?: Json
          notes?: string | null
          purpose?: string | null
          sort_order?: number | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_bank_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      business_contracts: {
        Row: {
          cancellation_deadline: string | null
          contract_name: string
          counterparty: string | null
          created_at: string | null
          file_url: string | null
          id: string
          notes: string | null
          renewal_date: string | null
          sort_order: number | null
          start_date: string | null
          store_id: string
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          cancellation_deadline?: string | null
          contract_name: string
          counterparty?: string | null
          created_at?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          renewal_date?: string | null
          sort_order?: number | null
          start_date?: string | null
          store_id?: string
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          cancellation_deadline?: string | null
          contract_name?: string
          counterparty?: string | null
          created_at?: string | null
          file_url?: string | null
          id?: string
          notes?: string | null
          renewal_date?: string | null
          sort_order?: number | null
          start_date?: string | null
          store_id?: string
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_contracts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_contracts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "business_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      business_fixed_costs: {
        Row: {
          amount: number
          cancellation_method: string | null
          contract_holder: string | null
          created_at: string | null
          debit_account_id: string | null
          id: string
          item_name: string
          label: string | null
          label_color: string | null
          layout: Json
          notes: string | null
          payment_day: number | null
          payment_method: string | null
          renewal_date: string | null
          sort_order: number | null
          store_id: string
          transfer_account_id: string | null
          transfer_destination: string | null
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          amount?: number
          cancellation_method?: string | null
          contract_holder?: string | null
          created_at?: string | null
          debit_account_id?: string | null
          id?: string
          item_name: string
          label?: string | null
          label_color?: string | null
          layout?: Json
          notes?: string | null
          payment_day?: number | null
          payment_method?: string | null
          renewal_date?: string | null
          sort_order?: number | null
          store_id?: string
          transfer_account_id?: string | null
          transfer_destination?: string | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          amount?: number
          cancellation_method?: string | null
          contract_holder?: string | null
          created_at?: string | null
          debit_account_id?: string | null
          id?: string
          item_name?: string
          label?: string | null
          label_color?: string | null
          layout?: Json
          notes?: string | null
          payment_day?: number | null
          payment_method?: string | null
          renewal_date?: string | null
          sort_order?: number | null
          store_id?: string
          transfer_account_id?: string | null
          transfer_destination?: string | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_fixed_costs_debit_account_id_fkey"
            columns: ["debit_account_id"]
            isOneToOne: false
            referencedRelation: "business_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_fixed_costs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_fixed_costs_transfer_account_id_fkey"
            columns: ["transfer_account_id"]
            isOneToOne: false
            referencedRelation: "business_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_fixed_costs_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "business_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      business_flows: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          steps: Json
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          steps?: Json
          store_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          steps?: Json
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_flows_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      business_logins: {
        Row: {
          bank_account_id: string | null
          category: string | null
          contact_person: string | null
          created_at: string | null
          id: string
          layout: Json
          login_id: string | null
          login_url: string | null
          notes: string | null
          password: string | null
          registered_email: string | null
          service_name: string
          store_id: string
          two_factor_method: string | null
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          bank_account_id?: string | null
          category?: string | null
          contact_person?: string | null
          created_at?: string | null
          id?: string
          layout?: Json
          login_id?: string | null
          login_url?: string | null
          notes?: string | null
          password?: string | null
          registered_email?: string | null
          service_name: string
          store_id?: string
          two_factor_method?: string | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          bank_account_id?: string | null
          category?: string | null
          contact_person?: string | null
          created_at?: string | null
          id?: string
          layout?: Json
          login_id?: string | null
          login_url?: string | null
          notes?: string | null
          password?: string | null
          registered_email?: string | null
          service_name?: string
          store_id?: string
          two_factor_method?: string | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_logins_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "business_bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_logins_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_logins_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "business_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      business_vendors: {
        Row: {
          bank_info: string | null
          contact_name: string | null
          contract_status: string | null
          created_at: string | null
          email: string | null
          id: string
          industry: string | null
          line_id: string | null
          name: string
          notes: string | null
          payment_method: string | null
          phone: string | null
          sort_order: number | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          bank_info?: string | null
          contact_name?: string | null
          contract_status?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          line_id?: string | null
          name: string
          notes?: string | null
          payment_method?: string | null
          phone?: string | null
          sort_order?: number | null
          store_id?: string
          updated_at?: string | null
        }
        Update: {
          bank_info?: string | null
          contact_name?: string | null
          contract_status?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          line_id?: string | null
          name?: string
          notes?: string | null
          payment_method?: string | null
          phone?: string | null
          sort_order?: number | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_vendors_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cast_access_tokens: {
        Row: {
          access_token: string
          cast_id: string
          created_at: string
          store_id: string
          updated_at: string
        }
        Insert: {
          access_token: string
          cast_id: string
          created_at?: string
          store_id?: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          cast_id?: string
          created_at?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cast_access_tokens_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: true
            referencedRelation: "casts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cast_access_tokens_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: true
            referencedRelation: "casts_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cast_access_tokens_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cast_diaries: {
        Row: {
          body: string | null
          cast_id: string
          category: string | null
          display_order: number
          external_url: string | null
          fetched_at: string
          id: string
          image_url: string | null
          image_urls: string[] | null
          posted_at: string | null
          source_post_id: string | null
          title: string | null
        }
        Insert: {
          body?: string | null
          cast_id: string
          category?: string | null
          display_order?: number
          external_url?: string | null
          fetched_at?: string
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          posted_at?: string | null
          source_post_id?: string | null
          title?: string | null
        }
        Update: {
          body?: string | null
          cast_id?: string
          category?: string | null
          display_order?: number
          external_url?: string | null
          fetched_at?: string
          id?: string
          image_url?: string | null
          image_urls?: string[] | null
          posted_at?: string | null
          source_post_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cast_diaries_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cast_diaries_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cast_diaries_source_post_id_fkey"
            columns: ["source_post_id"]
            isOneToOne: false
            referencedRelation: "cast_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      cast_messages: {
        Row: {
          cast_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          sender_name: string
          store_id: string
        }
        Insert: {
          cast_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          sender_name: string
          store_id?: string
        }
        Update: {
          cast_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          sender_name?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cast_messages_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cast_messages_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cast_messages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cast_posts: {
        Row: {
          body: string
          cast_id: string
          created_at: string | null
          esutama_attempts: number
          esutama_error: string | null
          esutama_status: string | null
          hp_error: string | null
          hp_status: string
          id: string
          image_urls: string[] | null
          last_attempt_at: string | null
          o2_attempts: number
          o2_error: string | null
          o2_status: string | null
          posted_at: string | null
          ranking_error: string | null
          ranking_status: string | null
          status: string
          store_id: string
          title: string | null
        }
        Insert: {
          body: string
          cast_id: string
          created_at?: string | null
          esutama_attempts?: number
          esutama_error?: string | null
          esutama_status?: string | null
          hp_error?: string | null
          hp_status?: string
          id?: string
          image_urls?: string[] | null
          last_attempt_at?: string | null
          o2_attempts?: number
          o2_error?: string | null
          o2_status?: string | null
          posted_at?: string | null
          ranking_error?: string | null
          ranking_status?: string | null
          status?: string
          store_id?: string
          title?: string | null
        }
        Update: {
          body?: string
          cast_id?: string
          created_at?: string | null
          esutama_attempts?: number
          esutama_error?: string | null
          esutama_status?: string | null
          hp_error?: string | null
          hp_status?: string
          id?: string
          image_urls?: string[] | null
          last_attempt_at?: string | null
          o2_attempts?: number
          o2_error?: string | null
          o2_status?: string | null
          posted_at?: string | null
          ranking_error?: string | null
          ranking_status?: string | null
          status?: string
          store_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cast_posts_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cast_posts_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cast_posts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cast_reviews: {
        Row: {
          body: string
          cast_id: string
          course: string | null
          created_at: string
          id: string
          is_visible: boolean
          rating: number
          reviewer_name: string
          store_id: string
          visit_date: string | null
        }
        Insert: {
          body: string
          cast_id: string
          course?: string | null
          created_at?: string
          id?: string
          is_visible?: boolean
          rating?: number
          reviewer_name?: string
          store_id?: string
          visit_date?: string | null
        }
        Update: {
          body?: string
          cast_id?: string
          course?: string | null
          created_at?: string
          id?: string
          is_visible?: boolean
          rating?: number
          reviewer_name?: string
          store_id?: string
          visit_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cast_reviews_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cast_reviews_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cast_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cast_site_credentials: {
        Row: {
          cast_id: string
          created_at: string | null
          id: string
          login_id: string | null
          password: string | null
          site: string
          store_id: string
          updated_at: string | null
        }
        Insert: {
          cast_id: string
          created_at?: string | null
          id?: string
          login_id?: string | null
          password?: string | null
          site: string
          store_id?: string
          updated_at?: string | null
        }
        Update: {
          cast_id?: string
          created_at?: string | null
          id?: string
          login_id?: string | null
          password?: string | null
          site?: string
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cast_site_credentials_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cast_site_credentials_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cast_site_credentials_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cast_title_badges: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          label: string
          store_id: string
          style_key: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          label: string
          store_id?: string
          style_key?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          label?: string
          store_id?: string
          style_key?: string
        }
        Relationships: []
      }
      cast_training_records: {
        Row: {
          cast_id: string
          feedback: string | null
          id: string
          implemented_date: string | null
          improvement: string | null
          instructor: string | null
          module_id: string
          score: number | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          cast_id: string
          feedback?: string | null
          id?: string
          implemented_date?: string | null
          improvement?: string | null
          instructor?: string | null
          module_id: string
          score?: number | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Update: {
          cast_id?: string
          feedback?: string | null
          id?: string
          implemented_date?: string | null
          improvement?: string | null
          instructor?: string | null
          module_id?: string
          score?: number | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cast_training_records_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cast_training_records_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cast_training_records_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cast_training_records_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      casts: {
        Row: {
          access_token: string | null
          age: number | null
          birth_date: string | null
          blog_url: string | null
          blood_type: string | null
          body_size: string | null
          bust: number | null
          bust_size: string | null
          celebrity_like: string | null
          celebrity_lookalike: string | null
          created_at: string
          cup_size: string | null
          custom_fields: Json
          customer_base_memo: string | null
          day_off_activities: string | null
          dispatch_status: string | null
          display_order: number | null
          enrollment_period: string | null
          estama_auto_register: boolean
          estama_listed: boolean
          estama_profile_url: string | null
          esuran_listed: boolean
          execution_date_end: string | null
          execution_date_start: string | null
          favorite_food: string | null
          favorite_techniques: string | null
          features: string[] | null
          files: string[] | null
          follow_list: string | null
          format_type: string | null
          height: number | null
          hip: number | null
          hobbies: string | null
          hobby: string | null
          hometown: string | null
          hp_notice: string | null
          id: string
          ideal_partner: string | null
          ideal_type: string | null
          instagram_url: string | null
          interview_sheet_url: string | null
          is_active: boolean
          is_estama_dummy: boolean
          is_online: boolean
          is_visible: boolean
          join_date: string
          line_group_id: string | null
          line_url: string | null
          litlink_url: string | null
          management_photos: string[] | null
          marks: string[] | null
          media_registration: string[] | null
          memo: string | null
          message: string | null
          name: string
          name_en: string | null
          name_kana: string | null
          o2_created: boolean
          o2_linkage_requested: boolean
          o2_login_email: string | null
          o2_login_id: string | null
          o2_login_password: string | null
          o2_login_url: string | null
          o2_url: string | null
          photo: string | null
          photos: string[] | null
          profile: string | null
          profile_format: string | null
          ranking_cast_id: string | null
          real_name: string | null
          recent_dispatch_details: string | null
          referral_reward_id: string | null
          referral_route: string | null
          registration_sheet: string | null
          repeat_scheduled: boolean | null
          romaji_name: string | null
          room: string | null
          self_intro_tweeted: boolean
          shop_comment: string | null
          skebiy_url: string | null
          status: string
          store_id: string
          tags: string[]
          therapist_comment: string | null
          therapist_experience: string | null
          therapist_years: number | null
          title_badge_id: string | null
          total_points: number
          type: string
          updated_at: string
          upload_check: string | null
          uses_sns: boolean | null
          waist: number | null
          weight: number | null
          x_account: string | null
          x_created: boolean
          x_ff_completed: boolean
          x_list_added: boolean
        }
        Insert: {
          access_token?: string | null
          age?: number | null
          birth_date?: string | null
          blog_url?: string | null
          blood_type?: string | null
          body_size?: string | null
          bust?: number | null
          bust_size?: string | null
          celebrity_like?: string | null
          celebrity_lookalike?: string | null
          created_at?: string
          cup_size?: string | null
          custom_fields?: Json
          customer_base_memo?: string | null
          day_off_activities?: string | null
          dispatch_status?: string | null
          display_order?: number | null
          enrollment_period?: string | null
          estama_auto_register?: boolean
          estama_listed?: boolean
          estama_profile_url?: string | null
          esuran_listed?: boolean
          execution_date_end?: string | null
          execution_date_start?: string | null
          favorite_food?: string | null
          favorite_techniques?: string | null
          features?: string[] | null
          files?: string[] | null
          follow_list?: string | null
          format_type?: string | null
          height?: number | null
          hip?: number | null
          hobbies?: string | null
          hobby?: string | null
          hometown?: string | null
          hp_notice?: string | null
          id?: string
          ideal_partner?: string | null
          ideal_type?: string | null
          instagram_url?: string | null
          interview_sheet_url?: string | null
          is_active?: boolean
          is_estama_dummy?: boolean
          is_online?: boolean
          is_visible?: boolean
          join_date?: string
          line_group_id?: string | null
          line_url?: string | null
          litlink_url?: string | null
          management_photos?: string[] | null
          marks?: string[] | null
          media_registration?: string[] | null
          memo?: string | null
          message?: string | null
          name: string
          name_en?: string | null
          name_kana?: string | null
          o2_created?: boolean
          o2_linkage_requested?: boolean
          o2_login_email?: string | null
          o2_login_id?: string | null
          o2_login_password?: string | null
          o2_login_url?: string | null
          o2_url?: string | null
          photo?: string | null
          photos?: string[] | null
          profile?: string | null
          profile_format?: string | null
          ranking_cast_id?: string | null
          real_name?: string | null
          recent_dispatch_details?: string | null
          referral_reward_id?: string | null
          referral_route?: string | null
          registration_sheet?: string | null
          repeat_scheduled?: boolean | null
          romaji_name?: string | null
          room?: string | null
          self_intro_tweeted?: boolean
          shop_comment?: string | null
          skebiy_url?: string | null
          status?: string
          store_id?: string
          tags?: string[]
          therapist_comment?: string | null
          therapist_experience?: string | null
          therapist_years?: number | null
          title_badge_id?: string | null
          total_points?: number
          type?: string
          updated_at?: string
          upload_check?: string | null
          uses_sns?: boolean | null
          waist?: number | null
          weight?: number | null
          x_account?: string | null
          x_created?: boolean
          x_ff_completed?: boolean
          x_list_added?: boolean
        }
        Update: {
          access_token?: string | null
          age?: number | null
          birth_date?: string | null
          blog_url?: string | null
          blood_type?: string | null
          body_size?: string | null
          bust?: number | null
          bust_size?: string | null
          celebrity_like?: string | null
          celebrity_lookalike?: string | null
          created_at?: string
          cup_size?: string | null
          custom_fields?: Json
          customer_base_memo?: string | null
          day_off_activities?: string | null
          dispatch_status?: string | null
          display_order?: number | null
          enrollment_period?: string | null
          estama_auto_register?: boolean
          estama_listed?: boolean
          estama_profile_url?: string | null
          esuran_listed?: boolean
          execution_date_end?: string | null
          execution_date_start?: string | null
          favorite_food?: string | null
          favorite_techniques?: string | null
          features?: string[] | null
          files?: string[] | null
          follow_list?: string | null
          format_type?: string | null
          height?: number | null
          hip?: number | null
          hobbies?: string | null
          hobby?: string | null
          hometown?: string | null
          hp_notice?: string | null
          id?: string
          ideal_partner?: string | null
          ideal_type?: string | null
          instagram_url?: string | null
          interview_sheet_url?: string | null
          is_active?: boolean
          is_estama_dummy?: boolean
          is_online?: boolean
          is_visible?: boolean
          join_date?: string
          line_group_id?: string | null
          line_url?: string | null
          litlink_url?: string | null
          management_photos?: string[] | null
          marks?: string[] | null
          media_registration?: string[] | null
          memo?: string | null
          message?: string | null
          name?: string
          name_en?: string | null
          name_kana?: string | null
          o2_created?: boolean
          o2_linkage_requested?: boolean
          o2_login_email?: string | null
          o2_login_id?: string | null
          o2_login_password?: string | null
          o2_login_url?: string | null
          o2_url?: string | null
          photo?: string | null
          photos?: string[] | null
          profile?: string | null
          profile_format?: string | null
          ranking_cast_id?: string | null
          real_name?: string | null
          recent_dispatch_details?: string | null
          referral_reward_id?: string | null
          referral_route?: string | null
          registration_sheet?: string | null
          repeat_scheduled?: boolean | null
          romaji_name?: string | null
          room?: string | null
          self_intro_tweeted?: boolean
          shop_comment?: string | null
          skebiy_url?: string | null
          status?: string
          store_id?: string
          tags?: string[]
          therapist_comment?: string | null
          therapist_experience?: string | null
          therapist_years?: number | null
          title_badge_id?: string | null
          total_points?: number
          type?: string
          updated_at?: string
          upload_check?: string | null
          uses_sns?: boolean | null
          waist?: number | null
          weight?: number | null
          x_account?: string | null
          x_created?: boolean
          x_ff_completed?: boolean
          x_list_added?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "casts_referral_reward_id_fkey"
            columns: ["referral_reward_id"]
            isOneToOne: false
            referencedRelation: "referral_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casts_title_badge_id_fkey"
            columns: ["title_badge_id"]
            isOneToOne: false
            referencedRelation: "cast_title_badges"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaning_checklists: {
        Row: {
          cast_id: string | null
          created_at: string
          date: string
          equipment_checked: boolean
          id: string
          notes: string | null
          room_cleaned: boolean
          status: string
          store_id: string
          supplies_stocked: boolean
          trash_taken_out: boolean
        }
        Insert: {
          cast_id?: string | null
          created_at?: string
          date: string
          equipment_checked?: boolean
          id?: string
          notes?: string | null
          room_cleaned?: boolean
          status?: string
          store_id?: string
          supplies_stocked?: boolean
          trash_taken_out?: boolean
        }
        Update: {
          cast_id?: string | null
          created_at?: string
          date?: string
          equipment_checked?: boolean
          id?: string
          notes?: string | null
          room_cleaned?: boolean
          status?: string
          store_id?: string
          supplies_stocked?: boolean
          trash_taken_out?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cleaning_checklists_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_checklists_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cleaning_checklists_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      closings: {
        Row: {
          closed_at: string
          created_at: string
          deduction_amount: number
          expense_amount: number
          id: string
          notes: string | null
          period_date: string
          period_type: string
          store_id: string
          total_reservations: number
          total_sales: number
        }
        Insert: {
          closed_at?: string
          created_at?: string
          deduction_amount?: number
          expense_amount?: number
          id?: string
          notes?: string | null
          period_date: string
          period_type: string
          store_id?: string
          total_reservations?: number
          total_sales?: number
        }
        Update: {
          closed_at?: string
          created_at?: string
          deduction_amount?: number
          expense_amount?: number
          id?: string
          notes?: string | null
          period_date?: string
          period_type?: string
          store_id?: string
          total_reservations?: number
          total_sales?: number
        }
        Relationships: [
          {
            foreignKeyName: "closings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cti_calls: {
        Row: {
          call_sid: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          duration_seconds: number | null
          from_number: string
          id: string
          status: string
          store_id: string
          to_number: string | null
          updated_at: string
        }
        Insert: {
          call_sid?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          duration_seconds?: number | null
          from_number: string
          id?: string
          status?: string
          store_id?: string
          to_number?: string | null
          updated_at?: string
        }
        Update: {
          call_sid?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          duration_seconds?: number | null
          from_number?: string
          id?: string
          status?: string
          store_id?: string
          to_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cti_calls_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_followups: {
        Row: {
          completed_at: string | null
          content: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          followup_date: string
          id: string
          method: string | null
          next_action_date: string | null
          store_id: string
        }
        Insert: {
          completed_at?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          followup_date?: string
          id?: string
          method?: string | null
          next_action_date?: string | null
          store_id?: string
        }
        Update: {
          completed_at?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          followup_date?: string
          id?: string
          method?: string | null
          next_action_date?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_followups_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_followups_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_ng_casts: {
        Row: {
          cast_id: string
          created_at: string | null
          customer_id: string
          id: string
          reason: string | null
          store_id: string
        }
        Insert: {
          cast_id: string
          created_at?: string | null
          customer_id: string
          id?: string
          reason?: string | null
          store_id?: string
        }
        Update: {
          cast_id?: string
          created_at?: string | null
          customer_id?: string
          id?: string
          reason?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_ng_casts_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ng_casts_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ng_casts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ng_casts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_profiles: {
        Row: {
          concern_areas: string[] | null
          conversation_level: string | null
          created_at: string
          customer_id: string
          ng_items: string | null
          preference_notes: string | null
          preferred_pressure: string | null
          preferred_types: string[] | null
          store_id: string
          updated_at: string
        }
        Insert: {
          concern_areas?: string[] | null
          conversation_level?: string | null
          created_at?: string
          customer_id: string
          ng_items?: string | null
          preference_notes?: string | null
          preferred_pressure?: string | null
          preferred_types?: string[] | null
          store_id?: string
          updated_at?: string
        }
        Update: {
          concern_areas?: string[] | null
          conversation_level?: string | null
          created_at?: string
          customer_id?: string
          ng_items?: string | null
          preference_notes?: string | null
          preferred_pressure?: string | null
          preferred_types?: string[] | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_profiles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_reviews: {
        Row: {
          allow_publish: boolean
          created_at: string
          id: string
          is_published: boolean
          rating: number
          review_text: string
          review_title: string | null
          reviewed_at: string | null
          reviewer_name: string | null
          source_details: Json
          source_external_id: string | null
          source_provider: string | null
          source_url: string | null
          store_id: string
          synced_at: string | null
          therapist_name: string | null
        }
        Insert: {
          allow_publish?: boolean
          created_at?: string
          id?: string
          is_published?: boolean
          rating: number
          review_text: string
          review_title?: string | null
          reviewed_at?: string | null
          reviewer_name?: string | null
          source_details?: Json
          source_external_id?: string | null
          source_provider?: string | null
          source_url?: string | null
          store_id?: string
          synced_at?: string | null
          therapist_name?: string | null
        }
        Update: {
          allow_publish?: boolean
          created_at?: string
          id?: string
          is_published?: boolean
          rating?: number
          review_text?: string
          review_title?: string | null
          reviewed_at?: string | null
          reviewer_name?: string | null
          source_details?: Json
          source_external_id?: string | null
          source_provider?: string | null
          source_url?: string | null
          store_id?: string
          synced_at?: string | null
          therapist_name?: string | null
        }
        Relationships: []
      }
      customer_surveys: {
        Row: {
          created_at: string
          good_points: string | null
          id: string
          improvement_points: string | null
          rating: number
          store_id: string
          therapist_name: string | null
        }
        Insert: {
          created_at?: string
          good_points?: string | null
          id?: string
          improvement_points?: string | null
          rating: number
          store_id?: string
          therapist_name?: string | null
        }
        Update: {
          created_at?: string
          good_points?: string | null
          id?: string
          improvement_points?: string | null
          rating?: number
          store_id?: string
          therapist_name?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          ban_reason: string | null
          created_at: string
          email: string | null
          id: string
          is_banned: boolean | null
          kana: string | null
          last_cast_id: string | null
          last_visited: string | null
          name: string
          notes: string | null
          phone: string
          status: string
          store_id: string
          tags: string[] | null
          total_spent: number
          updated_at: string
          visit_count: number | null
        }
        Insert: {
          ban_reason?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_banned?: boolean | null
          kana?: string | null
          last_cast_id?: string | null
          last_visited?: string | null
          name: string
          notes?: string | null
          phone: string
          status?: string
          store_id?: string
          tags?: string[] | null
          total_spent?: number
          updated_at?: string
          visit_count?: number | null
        }
        Update: {
          ban_reason?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_banned?: boolean | null
          kana?: string | null
          last_cast_id?: string | null
          last_visited?: string | null
          name?: string
          notes?: string | null
          phone?: string
          status?: string
          store_id?: string
          tags?: string[] | null
          total_spent?: number
          updated_at?: string
          visit_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_last_cast_id_fkey"
            columns: ["last_cast_id"]
            isOneToOne: false
            referencedRelation: "casts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_last_cast_id_fkey"
            columns: ["last_cast_id"]
            isOneToOne: false
            referencedRelation: "casts_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_clearances: {
        Row: {
          accommodation_fee: number
          cast_id: string
          cleared_at: string | null
          created_at: string
          date: string
          id: string
          misc_expenses: number
          other_expenses: Json
          payout_amount: number
          payout_method: string | null
          points_awarded: number
          status: string
          store_id: string
          therapist_back: number
          total_sales: number
          transportation_fee: number
        }
        Insert: {
          accommodation_fee?: number
          cast_id: string
          cleared_at?: string | null
          created_at?: string
          date: string
          id?: string
          misc_expenses?: number
          other_expenses?: Json
          payout_amount?: number
          payout_method?: string | null
          points_awarded?: number
          status?: string
          store_id?: string
          therapist_back?: number
          total_sales?: number
          transportation_fee?: number
        }
        Update: {
          accommodation_fee?: number
          cast_id?: string
          cleared_at?: string | null
          created_at?: string
          date?: string
          id?: string
          misc_expenses?: number
          other_expenses?: Json
          payout_amount?: number
          payout_method?: string | null
          points_awarded?: number
          status?: string
          store_id?: string
          therapist_back?: number
          total_sales?: number
          transportation_fee?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_clearances_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_clearances_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_clearances_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_feedback: {
        Row: {
          cast_id: string | null
          created_at: string
          customer_feedback: string | null
          date: string
          good_points: string | null
          id: string
          improvement_points: string | null
          rating: number
          status: string
          store_id: string
        }
        Insert: {
          cast_id?: string | null
          created_at?: string
          customer_feedback?: string | null
          date: string
          good_points?: string | null
          id?: string
          improvement_points?: string | null
          rating?: number
          status?: string
          store_id?: string
        }
        Update: {
          cast_id?: string | null
          created_at?: string
          customer_feedback?: string | null
          date?: string
          good_points?: string | null
          id?: string
          improvement_points?: string | null
          rating?: number
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_feedback_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_feedback_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_feedback_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sales_records: {
        Row: {
          card_amount: number
          cash_amount: number
          cast_id: string | null
          created_at: string
          customer_count: number
          date: string
          id: string
          manual_adjustment: number
          notes: string | null
          paypay_amount: number
          status: string
          store_id: string
          submission_key: string | null
          total_amount: number
        }
        Insert: {
          card_amount?: number
          cash_amount?: number
          cast_id?: string | null
          created_at?: string
          customer_count?: number
          date: string
          id?: string
          manual_adjustment?: number
          notes?: string | null
          paypay_amount?: number
          status?: string
          store_id?: string
          submission_key?: string | null
          total_amount?: number
        }
        Update: {
          card_amount?: number
          cash_amount?: number
          cast_id?: string | null
          created_at?: string
          customer_count?: number
          date?: string
          id?: string
          manual_adjustment?: number
          notes?: string | null
          paypay_amount?: number
          status?: string
          store_id?: string
          submission_key?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_records_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_records_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_sales_records_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_registration_forms: {
        Row: {
          created_at: string
          is_active: boolean
          store_id: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          store_id: string
          token?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          store_id?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_registration_forms_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_registrations: {
        Row: {
          created_at: string
          dispatch_end: string
          dispatch_start: string
          entry_source: string
          form_id: string
          id: string
          name: string
          store_id: string
        }
        Insert: {
          created_at?: string
          dispatch_end: string
          dispatch_start: string
          entry_source: string
          form_id: string
          id?: string
          name: string
          store_id: string
        }
        Update: {
          created_at?: string
          dispatch_end?: string
          dispatch_start?: string
          entry_source?: string
          form_id?: string
          id?: string
          name?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_registrations_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "dispatch_registration_forms"
            referencedColumns: ["token"]
          },
          {
            foreignKeyName: "dispatch_registrations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      deductions: {
        Row: {
          amount: number
          created_at: string
          deduction_type: string
          id: string
          is_active: boolean
          name: string
          rule: string | null
          store_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          deduction_type: string
          id?: string
          is_active?: boolean
          name: string
          rule?: string | null
          store_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          deduction_type?: string
          id?: string
          is_active?: boolean
          name?: string
          rule?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deductions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      discounts: {
        Row: {
          badge_text: string | null
          code: string | null
          created_at: string
          discount_type: string
          discount_value: number
          display_order: number
          eligible_course_type: string | null
          eligible_duration: number | null
          id: string
          is_active: boolean
          min_advance_days: number
          name: string
          public_booking_enabled: boolean
          stackable: boolean
          store_id: string
          terms: string[]
        }
        Insert: {
          badge_text?: string | null
          code?: string | null
          created_at?: string
          discount_type?: string
          discount_value?: number
          display_order?: number
          eligible_course_type?: string | null
          eligible_duration?: number | null
          id?: string
          is_active?: boolean
          min_advance_days?: number
          name: string
          public_booking_enabled?: boolean
          stackable?: boolean
          store_id?: string
          terms?: string[]
        }
        Update: {
          badge_text?: string | null
          code?: string | null
          created_at?: string
          discount_type?: string
          discount_value?: number
          display_order?: number
          eligible_course_type?: string | null
          eligible_duration?: number | null
          id?: string
          is_active?: boolean
          min_advance_days?: number
          name?: string
          public_booking_enabled?: boolean
          stackable?: boolean
          store_id?: string
          terms?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "discounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      estama_sync_reports: {
        Row: {
          cast_names: string[]
          created_at: string
          evidence: Json
          fatal_error: string | null
          finished_at: string
          id: string
          missing_profiles: string[]
          results: Json
          shop_id: string | null
          started_at: string | null
          status: string
          store_id: string
          success_count: number
          summary: string
          total_count: number
        }
        Insert: {
          cast_names?: string[]
          created_at?: string
          evidence?: Json
          fatal_error?: string | null
          finished_at?: string
          id?: string
          missing_profiles?: string[]
          results?: Json
          shop_id?: string | null
          started_at?: string | null
          status: string
          store_id: string
          success_count?: number
          summary: string
          total_count?: number
        }
        Update: {
          cast_names?: string[]
          created_at?: string
          evidence?: Json
          fatal_error?: string | null
          finished_at?: string
          id?: string
          missing_profiles?: string[]
          results?: Json
          shop_id?: string | null
          started_at?: string | null
          status?: string
          store_id?: string
          success_count?: number
          summary?: string
          total_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "estama_sync_reports_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      estama_sync_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          purpose: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          purpose: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          purpose?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: []
      }
      expense_rates: {
        Row: {
          created_at: string
          expense_type: string
          id: string
          min_days: number | null
          shop_income: number
          store_id: string
          therapist_deduction: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          expense_type: string
          id?: string
          min_days?: number | null
          shop_income: number
          store_id?: string
          therapist_deduction: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          expense_type?: string
          id?: string
          min_days?: number | null
          shop_income?: number
          store_id?: string
          therapist_deduction?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_rates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          cast_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          expense_date: string
          expense_type: string
          id: string
          is_paid: boolean
          payment_method: string | null
          store_id: string
        }
        Insert: {
          amount?: number
          cast_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expense_date: string
          expense_type: string
          id?: string
          is_paid?: boolean
          payment_method?: string | null
          store_id?: string
        }
        Update: {
          amount?: number
          cast_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expense_date?: string
          expense_type?: string
          id?: string
          is_paid?: boolean
          payment_method?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      external_bookings: {
        Row: {
          course: string | null
          created_at: string
          customer_name: string
          customer_phone: string | null
          email_sent: boolean
          form_slug: string
          id: string
          notes: string | null
          options: string[] | null
          requested_date: string | null
          requested_time: string | null
          total_price: number | null
        }
        Insert: {
          course?: string | null
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          email_sent?: boolean
          form_slug: string
          id?: string
          notes?: string | null
          options?: string[] | null
          requested_date?: string | null
          requested_time?: string | null
          total_price?: number | null
        }
        Update: {
          course?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          email_sent?: boolean
          form_slug?: string
          id?: string
          notes?: string | null
          options?: string[] | null
          requested_date?: string | null
          requested_time?: string | null
          total_price?: number | null
        }
        Relationships: []
      }
      external_cast_profiles: {
        Row: {
          admin_edit_url: string | null
          cast_id: string
          created_at: string
          external_cast_id: string | null
          id: string
          last_error: string | null
          last_photo_count: number
          last_photo_hash: string | null
          last_profile_hash: string | null
          last_profile_sync_at: string | null
          last_shift_sync_at: string | null
          provider: string
          public_profile_url: string | null
          remote_name: string | null
          soul_account_email: string | null
          soul_login_url: string | null
          soul_status: string
          store_id: string
          sync_status: string
          updated_at: string
        }
        Insert: {
          admin_edit_url?: string | null
          cast_id: string
          created_at?: string
          external_cast_id?: string | null
          id?: string
          last_error?: string | null
          last_photo_count?: number
          last_photo_hash?: string | null
          last_profile_hash?: string | null
          last_profile_sync_at?: string | null
          last_shift_sync_at?: string | null
          provider?: string
          public_profile_url?: string | null
          remote_name?: string | null
          soul_account_email?: string | null
          soul_login_url?: string | null
          soul_status?: string
          store_id: string
          sync_status?: string
          updated_at?: string
        }
        Update: {
          admin_edit_url?: string | null
          cast_id?: string
          created_at?: string
          external_cast_id?: string | null
          id?: string
          last_error?: string | null
          last_photo_count?: number
          last_photo_hash?: string | null
          last_profile_hash?: string | null
          last_profile_sync_at?: string | null
          last_shift_sync_at?: string | null
          provider?: string
          public_profile_url?: string | null
          remote_name?: string | null
          soul_account_email?: string | null
          soul_login_url?: string | null
          soul_status?: string
          store_id?: string
          sync_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_cast_profiles_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_cast_profiles_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_cast_profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      estama_dummy_shifts: {
        Row: {
          cast_id: string
          created_at: string
          created_by: string | null
          end_time: string
          estama_registered: boolean
          id: string
          shift_date: string
          start_time: string
          store_id: string
          updated_at: string
        }
        Insert: {
          cast_id: string
          created_at?: string
          created_by?: string | null
          end_time: string
          estama_registered?: boolean
          id?: string
          shift_date: string
          start_time: string
          store_id: string
          updated_at?: string
        }
        Update: {
          cast_id?: string
          created_at?: string
          created_by?: string | null
          end_time?: string
          estama_registered?: boolean
          id?: string
          shift_date?: string
          start_time?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "estama_dummy_shifts_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estama_dummy_shifts_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estama_dummy_shifts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      external_daily_reports: {
        Row: {
          created_at: string
          external_store_id: string
          id: string
          imported_at: string
          inquiry_count: number
          page_views: number
          provider: string
          report_date: string
          source_message_id: string | null
          source_subject: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_store_id: string
          id?: string
          imported_at?: string
          inquiry_count?: number
          page_views?: number
          provider: string
          report_date: string
          source_message_id?: string | null
          source_subject?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_store_id?: string
          id?: string
          imported_at?: string
          inquiry_count?: number
          page_views?: number
          provider?: string
          report_date?: string
          source_message_id?: string | null
          source_subject?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_daily_reports_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_contracts: {
        Row: {
          address: string | null
          amount: number
          auto_lock: boolean | null
          contract_holder: string | null
          contract_status: string | null
          contract_terms: string | null
          contract_type: string
          created_at: string
          end_date: string | null
          floor_plan: string | null
          id: string
          internet_connection: string | null
          key_count: number | null
          login_id: string | null
          login_password: string | null
          mailbox_code: string | null
          management_company: string | null
          management_url: string | null
          name: string
          nominal_holder: string | null
          notes: string | null
          payment_method: string | null
          renewal_fee: number | null
          resident_manager: boolean | null
          start_date: string | null
          store_id: string
          tags: string[]
        }
        Insert: {
          address?: string | null
          amount?: number
          auto_lock?: boolean | null
          contract_holder?: string | null
          contract_status?: string | null
          contract_terms?: string | null
          contract_type: string
          created_at?: string
          end_date?: string | null
          floor_plan?: string | null
          id?: string
          internet_connection?: string | null
          key_count?: number | null
          login_id?: string | null
          login_password?: string | null
          mailbox_code?: string | null
          management_company?: string | null
          management_url?: string | null
          name: string
          nominal_holder?: string | null
          notes?: string | null
          payment_method?: string | null
          renewal_fee?: number | null
          resident_manager?: boolean | null
          start_date?: string | null
          store_id?: string
          tags?: string[]
        }
        Update: {
          address?: string | null
          amount?: number
          auto_lock?: boolean | null
          contract_holder?: string | null
          contract_status?: string | null
          contract_terms?: string | null
          contract_type?: string
          created_at?: string
          end_date?: string | null
          floor_plan?: string | null
          id?: string
          internet_connection?: string | null
          key_count?: number | null
          login_id?: string | null
          login_password?: string | null
          mailbox_code?: string | null
          management_company?: string | null
          management_url?: string | null
          name?: string
          nominal_holder?: string | null
          notes?: string | null
          payment_method?: string | null
          renewal_fee?: number | null
          resident_manager?: boolean | null
          start_date?: string | null
          store_id?: string
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "facility_contracts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_equipment: {
        Row: {
          created_at: string
          custom_fields: Json
          id: string
          item_type: string
          manual_images: string[]
          name: string
          notes: string | null
          quantity: number
          store_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_fields?: Json
          id?: string
          item_type?: string
          manual_images?: string[]
          name: string
          notes?: string | null
          quantity?: number
          store_id?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_fields?: Json
          id?: string
          item_type?: string
          manual_images?: string[]
          name?: string
          notes?: string | null
          quantity?: number
          store_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_equipment_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      houjin_companies: {
        Row: {
          address: string | null
          assignee: string | null
          attributes: Json
          capital: string | null
          corporate_number: string | null
          created_at: string
          email: string | null
          established_on: string | null
          homepage: string | null
          id: string
          name: string
          notion_created_time: string | null
          notion_id: string | null
          notion_url: string | null
          phone: string | null
          representative: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          assignee?: string | null
          attributes?: Json
          capital?: string | null
          corporate_number?: string | null
          created_at?: string
          email?: string | null
          established_on?: string | null
          homepage?: string | null
          id?: string
          name: string
          notion_created_time?: string | null
          notion_id?: string | null
          notion_url?: string | null
          phone?: string | null
          representative?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          assignee?: string | null
          attributes?: Json
          capital?: string | null
          corporate_number?: string | null
          created_at?: string
          email?: string | null
          established_on?: string | null
          homepage?: string | null
          id?: string
          name?: string
          notion_created_time?: string | null
          notion_id?: string | null
          notion_url?: string | null
          phone?: string | null
          representative?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      hp_analytics_daily: {
        Row: {
          date: string
          page_views: number
          store_id: string
          unique_visitors: number
          updated_at: string
          visits: number
        }
        Insert: {
          date: string
          page_views?: number
          store_id?: string
          unique_visitors?: number
          updated_at?: string
          visits?: number
        }
        Update: {
          date?: string
          page_views?: number
          store_id?: string
          unique_visitors?: number
          updated_at?: string
          visits?: number
        }
        Relationships: [
          {
            foreignKeyName: "hp_analytics_daily_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      hp_analytics_hourly: {
        Row: {
          date: string
          hour: number
          store_id: string
          visits: number
        }
        Insert: {
          date: string
          hour: number
          store_id?: string
          visits?: number
        }
        Update: {
          date?: string
          hour?: number
          store_id?: string
          visits?: number
        }
        Relationships: [
          {
            foreignKeyName: "hp_analytics_hourly_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      hp_analytics_pages: {
        Row: {
          date: string
          page_path: string
          store_id: string
          views: number
        }
        Insert: {
          date: string
          page_path: string
          store_id?: string
          views?: number
        }
        Update: {
          date?: string
          page_path?: string
          store_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "hp_analytics_pages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      hp_analytics_traffic: {
        Row: {
          campaign: string
          content: string
          date: string
          landing_path: string
          medium: string
          source: string
          store_id: string
          visits: number
        }
        Insert: {
          campaign?: string
          content?: string
          date: string
          landing_path?: string
          medium?: string
          source: string
          store_id?: string
          visits?: number
        }
        Update: {
          campaign?: string
          content?: string
          date?: string
          landing_path?: string
          medium?: string
          source?: string
          store_id?: string
          visits?: number
        }
        Relationships: [
          {
            foreignKeyName: "hp_analytics_traffic_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      hp_articles: {
        Row: {
          category: string | null
          content: string | null
          created_at: string
          id: string
          image_urls: string[]
          is_published: boolean
          slug: string | null
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_urls?: string[]
          is_published?: boolean
          slug?: string | null
          store_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_urls?: string[]
          is_published?: boolean
          slug?: string | null
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hp_articles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          channel: string
          created_at: string
          id: string
          inquired_at: string
          memo: string | null
          source: string
          store_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          inquired_at?: string
          memo?: string | null
          source?: string
          store_id?: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          inquired_at?: string
          memo?: string | null
          source?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      kintore_advice_deliveries: {
        Row: {
          advice_date: string | null
          content: string | null
          created_at: string
          error_message: string | null
          generation_source: string | null
          id: number
          is_test: boolean
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          advice_date?: string | null
          content?: string | null
          created_at?: string
          error_message?: string | null
          generation_source?: string | null
          id?: number
          is_test?: boolean
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          advice_date?: string | null
          content?: string | null
          created_at?: string
          error_message?: string | null
          generation_source?: string | null
          id?: number
          is_test?: boolean
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      kintore_profiles: {
        Row: {
          created_at: string
          goals: string[]
          notification_enabled: boolean
          notification_time: string
          timezone: string
          updated_at: string
          user_id: string
          weaknesses: string
        }
        Insert: {
          created_at?: string
          goals?: string[]
          notification_enabled?: boolean
          notification_time?: string
          timezone?: string
          updated_at?: string
          user_id: string
          weaknesses?: string
        }
        Update: {
          created_at?: string
          goals?: string[]
          notification_enabled?: boolean
          notification_time?: string
          timezone?: string
          updated_at?: string
          user_id?: string
          weaknesses?: string
        }
        Relationships: []
      }
      kintore_snapshots: {
        Row: {
          state: Json
          state_version: number
          synced_at: string
          user_id: string
        }
        Insert: {
          state?: Json
          state_version?: number
          synced_at?: string
          user_id: string
        }
        Update: {
          state?: Json
          state_version?: number
          synced_at?: string
          user_id?: string
        }
        Relationships: []
      }
      knowledge_articles: {
        Row: {
          category: string | null
          content: string | null
          created_at: string
          id: string
          is_pinned: boolean
          store_id: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean
          store_id?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: string | null
          created_at?: string
          id?: string
          is_pinned?: boolean
          store_id?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_articles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          content: string
          slug: string
          store_id: string
          updated_at: string
        }
        Insert: {
          content?: string
          slug: string
          store_id?: string
          updated_at?: string
        }
        Update: {
          content?: string
          slug?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      line_notification_destinations: {
        Row: {
          destination_key: string
          line_group_id: string
          store_id: string
          updated_at: string
        }
        Insert: {
          destination_key: string
          line_group_id: string
          store_id: string
          updated_at?: string
        }
        Update: {
          destination_key?: string
          line_group_id?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "line_notification_destinations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      media_settings: {
        Row: {
          catch_copy: string | null
          created_at: string
          description: string | null
          id: string
          login_id: string | null
          login_password: string | null
          main_color: string | null
          media_name: string
          memo: string | null
          plan: string | null
          shop_name: string | null
          sort_order: number
          store_id: string
          sub_color: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          catch_copy?: string | null
          created_at?: string
          description?: string | null
          id?: string
          login_id?: string | null
          login_password?: string | null
          main_color?: string | null
          media_name: string
          memo?: string | null
          plan?: string | null
          shop_name?: string | null
          sort_order?: number
          store_id?: string
          sub_color?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          catch_copy?: string | null
          created_at?: string
          description?: string | null
          id?: string
          login_id?: string | null
          login_password?: string | null
          main_color?: string | null
          media_name?: string
          memo?: string | null
          plan?: string | null
          shop_name?: string | null
          sort_order?: number
          store_id?: string
          sub_color?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_closings: {
        Row: {
          breakdown: Json
          card_sales: number
          cash_on_hand: number
          cash_remaining: number
          cash_sales: number
          closed_at: string
          expenses_total: number
          id: string
          month_date: string
          net_profit: number
          paypay_sales: number
          store_id: string
          therapist_paid: number
          total_sales: number
        }
        Insert: {
          breakdown?: Json
          card_sales?: number
          cash_on_hand?: number
          cash_remaining?: number
          cash_sales?: number
          closed_at?: string
          expenses_total?: number
          id?: string
          month_date: string
          net_profit?: number
          paypay_sales?: number
          store_id?: string
          therapist_paid?: number
          total_sales?: number
        }
        Update: {
          breakdown?: Json
          card_sales?: number
          cash_on_hand?: number
          cash_remaining?: number
          cash_sales?: number
          closed_at?: string
          expenses_total?: number
          id?: string
          month_date?: string
          net_profit?: number
          paypay_sales?: number
          store_id?: string
          therapist_paid?: number
          total_sales?: number
        }
        Relationships: []
      }
      monthly_reports: {
        Row: {
          created_at: string
          customer_count: number | null
          discount: number | null
          gross_profit: number | null
          month_date: string
          new_customers: number | null
          repeat_customers: number | null
          revenue: number | null
          session_count: number | null
          store_id: string
          therapist_pay: number | null
          transportation_fee: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_count?: number | null
          discount?: number | null
          gross_profit?: number | null
          month_date: string
          new_customers?: number | null
          repeat_customers?: number | null
          revenue?: number | null
          session_count?: number | null
          store_id?: string
          therapist_pay?: number | null
          transportation_fee?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_count?: number | null
          discount?: number | null
          gross_profit?: number | null
          month_date?: string
          new_customers?: number | null
          repeat_customers?: number | null
          revenue?: number | null
          session_count?: number | null
          store_id?: string
          therapist_pay?: number | null
          transportation_fee?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_reports_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sales_targets: {
        Row: {
          created_at: string
          store_id: string
          target_amount: number
          target_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          store_id: string
          target_amount?: number
          target_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          store_id?: string
          target_amount?: number
          target_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_targets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_sales_targets: {
        Row: {
          created_at: string
          month_date: string
          store_id: string
          target_revenue: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          month_date: string
          store_id?: string
          target_revenue?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          month_date?: string
          store_id?: string
          target_revenue?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_sales_targets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      nomination_rates: {
        Row: {
          created_at: string
          customer_price: number
          id: string
          nomination_type: string
          shop_back: number | null
          store_id: string
          therapist_back: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_price: number
          id?: string
          nomination_type: string
          shop_back?: number | null
          store_id?: string
          therapist_back?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_price?: number
          id?: string
          nomination_type?: string
          shop_back?: number | null
          store_id?: string
          therapist_back?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nomination_rates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      option_rates: {
        Row: {
          created_at: string
          customer_price: number
          display_order: number
          extension_minutes: number | null
          id: string
          is_visible: boolean
          option_name: string
          shop_back: number | null
          store_id: string
          therapist_back: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_price: number
          display_order?: number
          extension_minutes?: number | null
          id?: string
          is_visible?: boolean
          option_name: string
          shop_back?: number | null
          store_id?: string
          therapist_back?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_price?: number
          display_order?: number
          extension_minutes?: number | null
          id?: string
          is_visible?: boolean
          option_name?: string
          shop_back?: number | null
          store_id?: string
          therapist_back?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "option_rates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      password_entries: {
        Row: {
          category: string
          created_at: string
          email: string | null
          id: string
          login_id: string | null
          login_password: string | null
          name: string
          notes: string | null
          store_id: string
          updated_at: string
          url: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          email?: string | null
          id?: string
          login_id?: string | null
          login_password?: string | null
          name: string
          notes?: string | null
          store_id?: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          email?: string | null
          id?: string
          login_id?: string | null
          login_password?: string | null
          name?: string
          notes?: string | null
          store_id?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "password_entries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reminders: {
        Row: {
          active: boolean
          amount: number
          created_at: string
          day_of_month: number
          id: string
          memo: string | null
          store_id: string
          title: string
        }
        Insert: {
          active?: boolean
          amount?: number
          created_at?: string
          day_of_month: number
          id?: string
          memo?: string | null
          store_id?: string
          title: string
        }
        Update: {
          active?: boolean
          amount?: number
          created_at?: string
          day_of_month?: number
          id?: string
          memo?: string | null
          store_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_settings: {
        Row: {
          created_at: string
          fee_percentage: number
          id: string
          is_active: boolean
          payment_link: string | null
          payment_method: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fee_percentage?: number
          id?: string
          is_active?: boolean
          payment_link?: string | null
          payment_method: string
          store_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fee_percentage?: number
          id?: string
          is_active?: boolean
          payment_link?: string | null
          payment_method?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_plan_channels: {
        Row: {
          channel_key: string
          channel_label: string
          created_at: string
          id: string
          is_enabled: boolean
          placement_count: number
          plan_id: string
          size_spec: string | null
          sort_order: number
          store_id: string
          updated_at: string
        }
        Insert: {
          channel_key: string
          channel_label: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          placement_count?: number
          plan_id: string
          size_spec?: string | null
          sort_order?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          channel_key?: string
          channel_label?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          placement_count?: number
          plan_id?: string
          size_spec?: string | null
          sort_order?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_plan_channels_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "promotion_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_plan_channels_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_plan_tasks: {
        Row: {
          channel_key: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          group_label: string
          id: string
          is_completed: boolean
          label: string
          plan_id: string
          scheduled_on: string | null
          sort_order: number
          store_id: string
          task_key: string
          task_type: string
          updated_at: string
        }
        Insert: {
          channel_key?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          group_label: string
          id?: string
          is_completed?: boolean
          label: string
          plan_id: string
          scheduled_on?: string | null
          sort_order?: number
          store_id: string
          task_key: string
          task_type: string
          updated_at?: string
        }
        Update: {
          channel_key?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          group_label?: string
          id?: string
          is_completed?: boolean
          label?: string
          plan_id?: string
          scheduled_on?: string | null
          sort_order?: number
          store_id?: string
          task_key?: string
          task_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_plan_tasks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "promotion_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_plan_tasks_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      promotion_plans: {
        Row: {
          cast_ids: string[]
          created_at: string
          description: string | null
          ends_on: string | null
          id: string
          is_active: boolean
          plan_key: string
          starts_on: string | null
          store_id: string
          therapist_label: string
          title: string
          updated_at: string
        }
        Insert: {
          cast_ids?: string[]
          created_at?: string
          description?: string | null
          ends_on?: string | null
          id?: string
          is_active?: boolean
          plan_key: string
          starts_on?: string | null
          store_id: string
          therapist_label: string
          title: string
          updated_at?: string
        }
        Update: {
          cast_ids?: string[]
          created_at?: string
          description?: string | null
          ends_on?: string | null
          id?: string
          is_active?: boolean
          plan_key?: string
          starts_on?: string | null
          store_id?: string
          therapist_label?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_plans_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          last_ordered_at: string | null
          notes: string | null
          order_url: string | null
          payment_method: string | null
          product_name: string
          store_id: string
          supplier: string | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          last_ordered_at?: string | null
          notes?: string | null
          order_url?: string | null
          payment_method?: string | null
          product_name: string
          store_id: string
          supplier?: string | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          last_ordered_at?: string | null
          notes?: string | null
          order_url?: string | null
          payment_method?: string | null
          product_name?: string
          store_id?: string
          supplier?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_fee_adjustments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          month_date: string
          reason: string
          referral_reward_id: string
          store_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          month_date: string
          reason: string
          referral_reward_id: string
          store_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          month_date?: string
          reason?: string
          referral_reward_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_fee_adjustments_referral_reward_id_fkey"
            columns: ["referral_reward_id"]
            isOneToOne: false
            referencedRelation: "referral_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_fee_adjustments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_rewards: {
        Row: {
          amount: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          note: string | null
          store_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          note?: string | null
          store_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          note?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      recruit_lp_daily_metrics: {
        Row: {
          cta_clicks: number
          date: string
          experiment_id: string
          exposures: number
          store_id: string
          updated_at: string
          variant: "safety_first" | "freedom_first"
        }
        Insert: {
          cta_clicks?: number
          date: string
          experiment_id: string
          exposures?: number
          store_id: string
          updated_at?: string
          variant: "safety_first" | "freedom_first"
        }
        Update: {
          cta_clicks?: number
          date?: string
          experiment_id?: string
          exposures?: number
          store_id?: string
          updated_at?: string
          variant?: "safety_first" | "freedom_first"
        }
        Relationships: [
          {
            foreignKeyName: "recruit_lp_daily_metrics_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      recruit_lp_event_dedup: {
        Row: {
          created_at: string
          event_type: "exposure" | "cta_click"
          experiment_id: string
          first_seen_date: string
          store_id: string
          variant: "safety_first" | "freedom_first"
          visitor_hash: string
        }
        Insert: {
          created_at?: string
          event_type: "exposure" | "cta_click"
          experiment_id: string
          first_seen_date: string
          store_id: string
          variant: "safety_first" | "freedom_first"
          visitor_hash: string
        }
        Update: {
          created_at?: string
          event_type?: "exposure" | "cta_click"
          experiment_id?: string
          first_seen_date?: string
          store_id?: string
          variant?: "safety_first" | "freedom_first"
          visitor_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruit_lp_event_dedup_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      recruit_lp_event_rate_limits: {
        Row: {
          date: string
          experiment_id: string
          rate_hash: string
          request_count: number
          store_id: string
          updated_at: string
        }
        Insert: {
          date: string
          experiment_id: string
          rate_hash: string
          request_count?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          date?: string
          experiment_id?: string
          rate_hash?: string
          request_count?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruit_lp_event_rate_limits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      recruit_lp_experiments: {
        Row: {
          created_at: string
          ended_on: string | null
          experiment_id: string
          name: string
          started_on: string
          status: "active" | "paused" | "completed"
          store_id: string
        }
        Insert: {
          created_at?: string
          ended_on?: string | null
          experiment_id: string
          name: string
          started_on: string
          status?: "active" | "paused" | "completed"
          store_id: string
        }
        Update: {
          created_at?: string
          ended_on?: string | null
          experiment_id?: string
          name?: string
          started_on?: string
          status?: "active" | "paused" | "completed"
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recruit_lp_experiments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          booking_origin: string
          cast_id: string | null
          course_name: string
          course_type: string | null
          created_at: string
          created_by: string | null
          customer_email: string | null
          customer_furigana: string | null
          customer_name: string
          customer_phone: string
          discount: number
          discount_ids: string[] | null
          duration: number
          email_notification_sent_at: string | null
          email_notification_status: string
          id: string
          line_notification_sent_at: string | null
          line_notification_status: string
          nomination_type: string | null
          notes: string | null
          notification_attempt_count: number
          notification_last_attempt_at: string | null
          notification_last_error: string | null
          options: string[] | null
          payment_details: Json | null
          payment_fee: number
          payment_method: string | null
          payment_status: string
          price: number
          referral_source: string | null
          reservation_date: string
          room: string | null
          start_time: string
          status: string
          store_id: string
          updated_at: string
          web_booking_status: string | null
          web_booking_status_updated_at: string | null
          web_booking_status_updated_by: string | null
        }
        Insert: {
          booking_origin?: string
          cast_id?: string | null
          course_name?: string
          course_type?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_furigana?: string | null
          customer_name?: string
          customer_phone?: string
          discount?: number
          discount_ids?: string[] | null
          duration?: number
          email_notification_sent_at?: string | null
          email_notification_status?: string
          id?: string
          line_notification_sent_at?: string | null
          line_notification_status?: string
          nomination_type?: string | null
          notes?: string | null
          notification_attempt_count?: number
          notification_last_attempt_at?: string | null
          notification_last_error?: string | null
          options?: string[] | null
          payment_details?: Json | null
          payment_fee?: number
          payment_method?: string | null
          payment_status?: string
          price?: number
          referral_source?: string | null
          reservation_date: string
          room?: string | null
          start_time: string
          status?: string
          store_id?: string
          updated_at?: string
          web_booking_status?: string | null
          web_booking_status_updated_at?: string | null
          web_booking_status_updated_by?: string | null
        }
        Update: {
          booking_origin?: string
          cast_id?: string | null
          course_name?: string
          course_type?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_furigana?: string | null
          customer_name?: string
          customer_phone?: string
          discount?: number
          discount_ids?: string[] | null
          duration?: number
          email_notification_sent_at?: string | null
          email_notification_status?: string
          id?: string
          line_notification_sent_at?: string | null
          line_notification_status?: string
          nomination_type?: string | null
          notes?: string | null
          notification_attempt_count?: number
          notification_last_attempt_at?: string | null
          notification_last_error?: string | null
          options?: string[] | null
          payment_details?: Json | null
          payment_fee?: number
          payment_method?: string | null
          payment_status?: string
          price?: number
          referral_source?: string | null
          reservation_date?: string
          room?: string | null
          start_time?: string
          status?: string
          store_id?: string
          updated_at?: string
          web_booking_status?: string | null
          web_booking_status_updated_at?: string | null
          web_booking_status_updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      room_costumes: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          quantity: number
          room_id: string
          size: string | null
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          quantity?: number
          room_id: string
          size?: string | null
          store_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          quantity?: number
          room_id?: string
          size?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_costumes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_costumes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      room_equipment: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          quantity: number
          room_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          quantity?: number
          room_id: string
          store_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          quantity?: number
          room_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_equipment_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_equipment_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      room_supplies: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          notes: string | null
          quantity: number
          room_id: string
          store_id: string
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          quantity?: number
          room_id: string
          store_id?: string
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          quantity?: number
          room_id?: string
          store_id?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_supplies_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_supplies_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          access: string | null
          address: string | null
          amenities: string[] | null
          capacity: number | null
          cast_guide: string | null
          caution_text: string | null
          cleaning_manual: string | null
          created_at: string
          description: string | null
          display_name: string | null
          email_text: string | null
          entry_flow: string | null
          entry_photos: string[] | null
          equipment_costumes: string | null
          equipment_placement: string | null
          garbage_disposal: string | null
          id: string
          internal_notes: string | null
          is_active: boolean
          key_info: string | null
          key_number: string | null
          map_address: string | null
          map_url: string | null
          name: string
          reset_procedure: string | null
          room_photos: string[] | null
          room_type: string | null
          sms_text: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          access?: string | null
          address?: string | null
          amenities?: string[] | null
          capacity?: number | null
          cast_guide?: string | null
          caution_text?: string | null
          cleaning_manual?: string | null
          created_at?: string
          description?: string | null
          display_name?: string | null
          email_text?: string | null
          entry_flow?: string | null
          entry_photos?: string[] | null
          equipment_costumes?: string | null
          equipment_placement?: string | null
          garbage_disposal?: string | null
          id?: string
          internal_notes?: string | null
          is_active?: boolean
          key_info?: string | null
          key_number?: string | null
          map_address?: string | null
          map_url?: string | null
          name: string
          reset_procedure?: string | null
          room_photos?: string[] | null
          room_type?: string | null
          sms_text?: string | null
          store_id?: string
          updated_at?: string
        }
        Update: {
          access?: string | null
          address?: string | null
          amenities?: string[] | null
          capacity?: number | null
          cast_guide?: string | null
          caution_text?: string | null
          cleaning_manual?: string | null
          created_at?: string
          description?: string | null
          display_name?: string | null
          email_text?: string | null
          entry_flow?: string | null
          entry_photos?: string[] | null
          equipment_costumes?: string | null
          equipment_placement?: string | null
          garbage_disposal?: string | null
          id?: string
          internal_notes?: string | null
          is_active?: boolean
          key_info?: string | null
          key_number?: string | null
          map_address?: string | null
          map_url?: string | null
          name?: string
          reset_procedure?: string | null
          room_photos?: string[] | null
          room_type?: string | null
          sms_text?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          approval_comment: string | null
          approval_status: string
          cast_id: string
          created_at: string
          created_by: string | null
          end_time: string
          esran_registered: boolean
          estama_confirmed_at: string | null
          estama_confirmed_by: string | null
          estama_human_confirmed: boolean
          estama_registered: boolean
          id: string
          notes: string | null
          room: string | null
          shift_date: string
          start_time: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          approval_comment?: string | null
          approval_status?: string
          cast_id: string
          created_at?: string
          created_by?: string | null
          end_time: string
          esran_registered?: boolean
          estama_confirmed_at?: string | null
          estama_confirmed_by?: string | null
          estama_human_confirmed?: boolean
          estama_registered?: boolean
          id?: string
          notes?: string | null
          room?: string | null
          shift_date: string
          start_time: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Update: {
          approval_comment?: string | null
          approval_status?: string
          cast_id?: string
          created_at?: string
          created_by?: string | null
          end_time?: string
          esran_registered?: boolean
          estama_confirmed_at?: string | null
          estama_confirmed_by?: string | null
          estama_human_confirmed?: boolean
          estama_registered?: boolean
          id?: string
          notes?: string | null
          room?: string | null
          shift_date?: string
          start_time?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_settings: {
        Row: {
          business_day_start: string
          business_hours: string | null
          created_at: string | null
          description: string | null
          id: string
          line_reminder_enabled: boolean
          line_reminder_last_sent: string | null
          line_reminder_time: string
          logo_url: string | null
          reservation_interval_minutes: number
          shop_address: string | null
          shop_email: string | null
          shop_name: string
          shop_phone: string | null
          store_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          business_day_start?: string
          business_hours?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          line_reminder_enabled?: boolean
          line_reminder_last_sent?: string | null
          line_reminder_time?: string
          logo_url?: string | null
          reservation_interval_minutes?: number
          shop_address?: string | null
          shop_email?: string | null
          shop_name?: string
          shop_phone?: string | null
          store_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          business_day_start?: string
          business_hours?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          line_reminder_enabled?: boolean
          line_reminder_last_sent?: string | null
          line_reminder_time?: string
          logo_url?: string | null
          reservation_interval_minutes?: number
          shop_address?: string | null
          shop_email?: string | null
          shop_name?: string
          shop_phone?: string | null
          store_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      site_content: {
        Row: {
          key: string
          store_id: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          store_id?: string
          updated_at?: string
          value?: string
        }
        Update: {
          key?: string
          store_id?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_content_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_auto_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          message: string
          name: string
          store_id: string
          timing_minutes: number
          trigger: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          message: string
          name: string
          store_id?: string
          timing_minutes?: number
          trigger: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          message?: string
          name?: string
          store_id?: string
          timing_minutes?: number
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_auto_templates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sns_accounts: {
        Row: {
          category: string | null
          created_at: string
          email: string | null
          id: string
          login_id: string | null
          login_password: string | null
          management_url: string | null
          name: string
          profile_link: string | null
          published_to_hp: boolean | null
          store_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          email?: string | null
          id?: string
          login_id?: string | null
          login_password?: string | null
          management_url?: string | null
          name: string
          profile_link?: string | null
          published_to_hp?: boolean | null
          store_id?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          email?: string | null
          id?: string
          login_id?: string | null
          login_password?: string | null
          management_url?: string | null
          name?: string
          profile_link?: string | null
          published_to_hp?: boolean | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sns_accounts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_info: {
        Row: {
          address: string | null
          created_at: string
          description: string | null
          email: string | null
          holiday: string | null
          hours: string | null
          id: string
          lat: number | null
          line_url: string | null
          lng: number | null
          name: string
          phone: string | null
          store_id: string
          twitter_url: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          holiday?: string | null
          hours?: string | null
          id?: string
          lat?: number | null
          line_url?: string | null
          lng?: number | null
          name?: string
          phone?: string | null
          store_id?: string
          twitter_url?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          holiday?: string | null
          hours?: string | null
          id?: string
          lat?: number | null
          line_url?: string | null
          lng?: number | null
          name?: string
          phone?: string | null
          store_id?: string
          twitter_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stores: {
        Row: {
          created_at: string
          custom_domain: string | null
          id: string
          is_active: boolean
          is_default: boolean
          logo_url: string | null
          name: string
          settings: Json
          slug: string
          theme_color: string | null
        }
        Insert: {
          created_at?: string
          custom_domain?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          logo_url?: string | null
          name: string
          settings?: Json
          slug: string
          theme_color?: string | null
        }
        Update: {
          created_at?: string
          custom_domain?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          logo_url?: string | null
          name?: string
          settings?: Json
          slug?: string
          theme_color?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          is_done: boolean
          notes: string | null
          priority: string
          sort_order: number
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          is_done?: boolean
          notes?: string | null
          priority?: string
          sort_order?: number
          store_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          is_done?: boolean
          notes?: string | null
          priority?: string
          sort_order?: number
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      text_templates: {
        Row: {
          color: string
          content: string | null
          created_at: string
          display_order: number
          id: string
          is_folder: boolean
          label: string
          parent_id: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          content?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_folder?: boolean
          label: string
          parent_id?: string | null
          store_id?: string
          updated_at?: string
        }
        Update: {
          color?: string
          content?: string | null
          created_at?: string
          display_order?: number
          id?: string
          is_folder?: boolean
          label?: string
          parent_id?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "text_templates_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "text_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "text_templates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_clearance_reports: {
        Row: {
          admin_note: string | null
          cast_id: string
          created_at: string
          deduction_items: Json
          id: string
          orders_detail: string
          report_date: string
          reviewed_at: string | null
          status: string
          store_id: string
          total_deduction: number
        }
        Insert: {
          admin_note?: string | null
          cast_id: string
          created_at?: string
          deduction_items?: Json
          id?: string
          orders_detail?: string
          report_date?: string
          reviewed_at?: string | null
          status?: string
          store_id?: string
          total_deduction?: number
        }
        Update: {
          admin_note?: string | null
          cast_id?: string
          created_at?: string
          deduction_items?: Json
          id?: string
          orders_detail?: string
          report_date?: string
          reviewed_at?: string | null
          status?: string
          store_id?: string
          total_deduction?: number
        }
        Relationships: [
          {
            foreignKeyName: "therapist_clearance_reports_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_clearance_reports_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_clearance_reports_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_profiles: {
        Row: {
          age: number | null
          birthplace: string | null
          blood_type: string | null
          bust: number | null
          career_history: string | null
          cast_id: string
          comment: string | null
          created_at: string
          customer_age_range: string | null
          height: number | null
          hip: number | null
          hobbies: string | null
          id: string
          love_type: string | null
          massage_skills: string | null
          mbti: string | null
          preferred_type: string | null
          self_introduction: string | null
          sns_operation_notes: string | null
          special_skills: string | null
          store_id: string
          tags: string[]
          training_count: number | null
          updated_at: string
          waist: number | null
          weight: number | null
        }
        Insert: {
          age?: number | null
          birthplace?: string | null
          blood_type?: string | null
          bust?: number | null
          career_history?: string | null
          cast_id: string
          comment?: string | null
          created_at?: string
          customer_age_range?: string | null
          height?: number | null
          hip?: number | null
          hobbies?: string | null
          id?: string
          love_type?: string | null
          massage_skills?: string | null
          mbti?: string | null
          preferred_type?: string | null
          self_introduction?: string | null
          sns_operation_notes?: string | null
          special_skills?: string | null
          store_id?: string
          tags?: string[]
          training_count?: number | null
          updated_at?: string
          waist?: number | null
          weight?: number | null
        }
        Update: {
          age?: number | null
          birthplace?: string | null
          blood_type?: string | null
          bust?: number | null
          career_history?: string | null
          cast_id?: string
          comment?: string | null
          created_at?: string
          customer_age_range?: string | null
          height?: number | null
          hip?: number | null
          hobbies?: string | null
          id?: string
          love_type?: string | null
          massage_skills?: string | null
          mbti?: string | null
          preferred_type?: string | null
          self_introduction?: string | null
          sns_operation_notes?: string | null
          special_skills?: string | null
          store_id?: string
          tags?: string[]
          training_count?: number | null
          updated_at?: string
          waist?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "therapist_profiles_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: true
            referencedRelation: "casts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profiles_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: true
            referencedRelation: "casts_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      therapist_transport_expenses: {
        Row: {
          amount: number
          cast_id: string
          created_at: string
          expense_date: string
          id: string
          notes: string | null
          route: string | null
          status: string
          store_id: string
        }
        Insert: {
          amount: number
          cast_id: string
          created_at?: string
          expense_date: string
          id?: string
          notes?: string | null
          route?: string | null
          status?: string
          store_id?: string
        }
        Update: {
          amount?: number
          cast_id?: string
          created_at?: string
          expense_date?: string
          id?: string
          notes?: string | null
          route?: string | null
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "therapist_transport_expenses_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_transport_expenses_cast_id_fkey"
            columns: ["cast_id"]
            isOneToOne: false
            referencedRelation: "casts_admin_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "therapist_transport_expenses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      training_modules: {
        Row: {
          category: string
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          store_id: string
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          store_id?: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          store_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_modules_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stores: {
        Row: {
          created_at: string
          role: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      casts_admin_safe: {
        Row: {
          age: number | null
          birth_date: string | null
          blog_url: string | null
          blood_type: string | null
          body_size: string | null
          bust: number | null
          bust_size: string | null
          celebrity_like: string | null
          celebrity_lookalike: string | null
          created_at: string | null
          cup_size: string | null
          custom_fields: Json | null
          customer_base_memo: string | null
          day_off_activities: string | null
          dispatch_status: string | null
          display_order: number | null
          enrollment_period: string | null
          estama_auto_register: boolean | null
          estama_listed: boolean | null
          estama_profile_url: string | null
          esuran_listed: boolean | null
          execution_date_end: string | null
          execution_date_start: string | null
          favorite_food: string | null
          favorite_techniques: string | null
          features: string[] | null
          files: string[] | null
          follow_list: string | null
          format_type: string | null
          height: number | null
          hip: number | null
          hobbies: string | null
          hobby: string | null
          hometown: string | null
          hp_notice: string | null
          id: string | null
          ideal_partner: string | null
          ideal_type: string | null
          instagram_url: string | null
          interview_sheet_url: string | null
          is_active: boolean | null
          is_online: boolean | null
          is_visible: boolean | null
          join_date: string | null
          line_group_id: string | null
          line_url: string | null
          litlink_url: string | null
          management_photos: string[] | null
          marks: string[] | null
          media_registration: string[] | null
          memo: string | null
          message: string | null
          name: string | null
          name_en: string | null
          name_kana: string | null
          o2_created: boolean | null
          o2_linkage_requested: boolean | null
          o2_login_email: string | null
          o2_login_id: string | null
          o2_login_url: string | null
          o2_url: string | null
          photo: string | null
          photos: string[] | null
          profile: string | null
          profile_format: string | null
          ranking_cast_id: string | null
          real_name: string | null
          recent_dispatch_details: string | null
          referral_reward_id: string | null
          referral_route: string | null
          registration_sheet: string | null
          repeat_scheduled: boolean | null
          romaji_name: string | null
          room: string | null
          self_intro_tweeted: boolean | null
          shop_comment: string | null
          skebiy_url: string | null
          status: string | null
          store_id: string | null
          tags: string[] | null
          therapist_comment: string | null
          therapist_experience: string | null
          therapist_years: number | null
          title_badge_id: string | null
          total_points: number | null
          type: string | null
          updated_at: string | null
          upload_check: string | null
          uses_sns: boolean | null
          waist: number | null
          weight: number | null
          x_account: string | null
          x_created: boolean | null
          x_ff_completed: boolean | null
          x_list_added: boolean | null
        }
        Insert: {
          age?: number | null
          birth_date?: string | null
          blog_url?: string | null
          blood_type?: string | null
          body_size?: string | null
          bust?: number | null
          bust_size?: string | null
          celebrity_like?: string | null
          celebrity_lookalike?: string | null
          created_at?: string | null
          cup_size?: string | null
          custom_fields?: Json | null
          customer_base_memo?: string | null
          day_off_activities?: string | null
          dispatch_status?: string | null
          display_order?: number | null
          enrollment_period?: string | null
          estama_auto_register?: boolean | null
          estama_listed?: boolean | null
          estama_profile_url?: string | null
          esuran_listed?: boolean | null
          execution_date_end?: string | null
          execution_date_start?: string | null
          favorite_food?: string | null
          favorite_techniques?: string | null
          features?: string[] | null
          files?: string[] | null
          follow_list?: string | null
          format_type?: string | null
          height?: number | null
          hip?: number | null
          hobbies?: string | null
          hobby?: string | null
          hometown?: string | null
          hp_notice?: string | null
          id?: string | null
          ideal_partner?: string | null
          ideal_type?: string | null
          instagram_url?: string | null
          interview_sheet_url?: string | null
          is_active?: boolean | null
          is_online?: boolean | null
          is_visible?: boolean | null
          join_date?: string | null
          line_group_id?: string | null
          line_url?: string | null
          litlink_url?: string | null
          management_photos?: string[] | null
          marks?: string[] | null
          media_registration?: string[] | null
          memo?: string | null
          message?: string | null
          name?: string | null
          name_en?: string | null
          name_kana?: string | null
          o2_created?: boolean | null
          o2_linkage_requested?: boolean | null
          o2_login_email?: string | null
          o2_login_id?: string | null
          o2_login_url?: string | null
          o2_url?: string | null
          photo?: string | null
          photos?: string[] | null
          profile?: string | null
          profile_format?: string | null
          ranking_cast_id?: string | null
          real_name?: string | null
          recent_dispatch_details?: string | null
          referral_reward_id?: string | null
          referral_route?: string | null
          registration_sheet?: string | null
          repeat_scheduled?: boolean | null
          romaji_name?: string | null
          room?: string | null
          self_intro_tweeted?: boolean | null
          shop_comment?: string | null
          skebiy_url?: string | null
          status?: string | null
          store_id?: string | null
          tags?: string[] | null
          therapist_comment?: string | null
          therapist_experience?: string | null
          therapist_years?: number | null
          title_badge_id?: string | null
          total_points?: number | null
          type?: string | null
          updated_at?: string | null
          upload_check?: string | null
          uses_sns?: boolean | null
          waist?: number | null
          weight?: number | null
          x_account?: string | null
          x_created?: boolean | null
          x_ff_completed?: boolean | null
          x_list_added?: boolean | null
        }
        Update: {
          age?: number | null
          birth_date?: string | null
          blog_url?: string | null
          blood_type?: string | null
          body_size?: string | null
          bust?: number | null
          bust_size?: string | null
          celebrity_like?: string | null
          celebrity_lookalike?: string | null
          created_at?: string | null
          cup_size?: string | null
          custom_fields?: Json | null
          customer_base_memo?: string | null
          day_off_activities?: string | null
          dispatch_status?: string | null
          display_order?: number | null
          enrollment_period?: string | null
          estama_auto_register?: boolean | null
          estama_listed?: boolean | null
          estama_profile_url?: string | null
          esuran_listed?: boolean | null
          execution_date_end?: string | null
          execution_date_start?: string | null
          favorite_food?: string | null
          favorite_techniques?: string | null
          features?: string[] | null
          files?: string[] | null
          follow_list?: string | null
          format_type?: string | null
          height?: number | null
          hip?: number | null
          hobbies?: string | null
          hobby?: string | null
          hometown?: string | null
          hp_notice?: string | null
          id?: string | null
          ideal_partner?: string | null
          ideal_type?: string | null
          instagram_url?: string | null
          interview_sheet_url?: string | null
          is_active?: boolean | null
          is_online?: boolean | null
          is_visible?: boolean | null
          join_date?: string | null
          line_group_id?: string | null
          line_url?: string | null
          litlink_url?: string | null
          management_photos?: string[] | null
          marks?: string[] | null
          media_registration?: string[] | null
          memo?: string | null
          message?: string | null
          name?: string | null
          name_en?: string | null
          name_kana?: string | null
          o2_created?: boolean | null
          o2_linkage_requested?: boolean | null
          o2_login_email?: string | null
          o2_login_id?: string | null
          o2_login_url?: string | null
          o2_url?: string | null
          photo?: string | null
          photos?: string[] | null
          profile?: string | null
          profile_format?: string | null
          ranking_cast_id?: string | null
          real_name?: string | null
          recent_dispatch_details?: string | null
          referral_reward_id?: string | null
          referral_route?: string | null
          registration_sheet?: string | null
          repeat_scheduled?: boolean | null
          romaji_name?: string | null
          room?: string | null
          self_intro_tweeted?: boolean | null
          shop_comment?: string | null
          skebiy_url?: string | null
          status?: string | null
          store_id?: string | null
          tags?: string[] | null
          therapist_comment?: string | null
          therapist_experience?: string | null
          therapist_years?: number | null
          title_badge_id?: string | null
          total_points?: number | null
          type?: string | null
          updated_at?: string | null
          upload_check?: string | null
          uses_sns?: boolean | null
          waist?: number | null
          weight?: number | null
          x_account?: string | null
          x_created?: boolean | null
          x_ff_completed?: boolean | null
          x_list_added?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "casts_referral_reward_id_fkey"
            columns: ["referral_reward_id"]
            isOneToOne: false
            referencedRelation: "referral_rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casts_title_badge_id_fkey"
            columns: ["title_badge_id"]
            isOneToOne: false
            referencedRelation: "cast_title_badges"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_manage_store: { Args: { p_store_id: string }; Returns: boolean }
      check_repeat_nomination: {
        Args: { p_cast_id: string; p_phone: string }
        Returns: boolean
      }
      claim_estama_profile_worker_token: {
        Args: { p_token: string }
        Returns: boolean
      }
      claim_estama_worker_token: { Args: { p_token: string }; Returns: boolean }
      confirm_daily_sales_report: {
        Args: { p_report_id: string }
        Returns: number
      }
      create_admin_multi_post: {
        Args: {
          p_body: string
          p_cast_id: string
          p_image_urls?: string[]
          p_publish_hp?: boolean
          p_store_id: string
          p_title: string
        }
        Returns: string
      }
      create_therapist_post: {
        Args: {
          p_body: string
          p_image_urls?: string[]
          p_title: string
          p_token: string
        }
        Returns: string
      }
      cti_log_incoming: {
        Args: { p_call_sid: string; p_from: string; p_to: string }
        Returns: {
          customer_id: string
          customer_name: string
        }[]
      }
      current_store_ids: { Args: never; Returns: string[] }
      dispatch_estama_worker_continuation: {
        Args: { p_payload: Json; p_token: string }
        Returns: number
      }
      dispatch_estama_worker_request: {
        Args: { p_payload: Json }
        Returns: number
      }
      delete_admin_failed_cast_post: {
        Args: { p_post_id: string }
        Returns: boolean
      }
      delete_admin_failed_cast_post_with_assets: {
        Args: { p_post_id: string }
        Returns: {
          cast_id: string
          image_urls: string[]
          store_id: string
        }[]
      }
      submit_dispatch_registration: {
        Args: {
          p_dispatch_end: string
          p_dispatch_start: string
          p_entry_source: string
          p_name: string
          p_token: string
        }
        Returns: string
      }
      enqueue_estama_job: {
        Args: {
          p_cast_id: string
          p_dedupe_key: string
          p_job_type: string
          p_payload?: Json
          p_shift_id: string
          p_store_id: string
        }
        Returns: string
      }
      get_cast_access_tokens: {
        Args: never
        Returns: {
          access_token: string
          cast_id: string
        }[]
      }
      get_cast_by_access_token: {
        Args: { p_token: string }
        Returns: {
          id: string
          name: string
          photo: string
        }[]
      }
      get_customer_reservations: {
        Args: { p_customer_id: string }
        Returns: {
          cast_name: string
          course_name: string
          discount: number
          id: string
          nomination_type: string
          notes: string
          options: string[]
          price: number
          reservation_date: string
          start_time: string
          status: string
        }[]
      }
      get_customer_crm_metrics: {
        Args: { p_customer_ids: string[] }
        Returns: {
          cancellation_rate: number | null
          completed_visits_365d: number
          customer_id: string
          favorite_course: string | null
          future_booking_date: string | null
          identity_conflict: boolean
          latest_followup_date: string | null
          median_visit_interval_days: number | null
          next_action_date: string | null
          spend_365d: number
        }[]
      }
      get_o2_connection_overview: {
        Args: { p_store_id: string }
        Returns: {
          cast_id: string
          cast_name: string
          credential_configured: boolean
          last_o2_error: string
          last_o2_status: string
          last_posted_at: string
          o2_created: boolean
          o2_linkage_requested: boolean
          o2_url: string
          photo: string
        }[]
      }
      get_public_back_rates:
        | {
            Args: never
            Returns: {
              course_type: string
              customer_price: number
              duration: number
              id: string
            }[]
          }
        | {
            Args: { p_store_id: string }
            Returns: {
              course_type: string
              customer_price: number
              description: string
              duration: number
              id: string
            }[]
          }
      get_reservation_interval: { Args: never; Returns: number }
      get_reservation_slots: {
        Args: { p_cast_id?: string; p_date: string }
        Returns: {
          cast_id: string
          duration: number
          id: string
          reservation_date: string
          start_time: string
        }[]
      }
      get_site_connection_status_admin: {
        Args: { p_store_id: string }
        Returns: {
          cast_id: string
          site: string
        }[]
      }
      get_sns_connection_overview: {
        Args: { p_store_id: string }
        Returns: {
          cast_id: string
          cast_name: string
          credential_configured: boolean
          last_o2_error: string
          last_o2_status: string
          last_posted_at: string
          login_id: string
          o2_created: boolean
          o2_linkage_requested: boolean
          photo: string
          profile_url: string
        }[]
      }
      get_sns_connection_overview_v2: {
        Args: { p_store_id: string }
        Returns: {
          cast_id: string
          cast_name: string
          credential_configured: boolean
          last_o2_error: string
          last_o2_status: string
          last_posted_at: string
          login_id: string
          o2_created: boolean
          o2_linkage_requested: boolean
          photo: string
          profile_url: string
          x_credential_configured: boolean
          x_login_id: string
          x_profile_url: string
        }[]
      }
      get_sns_connection_overview_v3: {
        Args: { p_store_id: string }
        Returns: {
          cast_id: string
          cast_name: string
          credential_configured: boolean
          estama_credential_configured: boolean
          estama_login_id: string
          estama_profile_url: string
          last_o2_error: string
          last_o2_status: string
          last_posted_at: string
          login_id: string
          o2_created: boolean
          o2_linkage_requested: boolean
          photo: string
          profile_url: string
          x_credential_configured: boolean
          x_login_id: string
          x_profile_url: string
        }[]
      }
      get_sns_connection_overview_v4: {
        Args: { p_store_id: string }
        Returns: {
          cast_id: string
          cast_name: string
          credential_configured: boolean
          estama_credential_configured: boolean
          estama_profile_url: string
          last_o2_error: string
          last_o2_status: string
          last_posted_at: string
          login_id: string
          o2_created: boolean
          o2_linkage_requested: boolean
          o2_login_email: string
          photo: string
          profile_url: string
          x_credential_configured: boolean
          x_login_id: string
          x_profile_url: string
        }[]
      }
      get_sns_connection_overview_v5: {
        Args: { p_store_id: string }
        Returns: {
          cast_id: string
          cast_name: string
          credential_configured: boolean
          estama_credential_configured: boolean
          estama_login_id: string
          estama_profile_url: string
          last_o2_error: string
          last_o2_status: string
          last_posted_at: string
          login_id: string
          o2_created: boolean
          o2_linkage_requested: boolean
          o2_login_email: string
          photo: string
          profile_url: string
          x_credential_configured: boolean
          x_login_id: string
          x_profile_url: string
        }[]
      }
      get_therapist_customers: {
        Args: { p_token: string }
        Returns: {
          concern_areas: string[]
          conversation_level: string
          customer_id: string
          last_visited: string
          my_last_visit: string
          my_visit_count: number
          my_visit_dates: string[]
          name: string
          ng_items: string
          notes: string
          phone: string
          preference_notes: string
          preferred_pressure: string
          tags: string[]
          total_spent: number
          visit_count: number
        }[]
      }
      get_therapist_back_rates: {
        Args: { p_token: string }
        Returns: {
          course_type: string
          duration: number
          therapist_back: number
        }[]
      }
      get_therapist_daily_reservations: {
        Args: { p_date: string; p_token: string }
        Returns: {
          course_name: string
          course_type: string
          customer_name: string
          discount: number
          discount_ids: string[]
          duration: number
          id: string
          nomination_type: string
          options: string[]
          payment_details: Json
          payment_fee: number
          payment_method: string
          price: number
          reservation_date: string
          room: string
          start_time: string
          status: string
        }[]
      }
      get_therapist_daily_sales_submission: {
        Args: { p_date: string; p_token: string }
        Returns: {
          card_amount: number
          cash_amount: number
          customer_count: number
          id: string
          manual_adjustment: number
          notes: string
          paypay_amount: number
          status: string
          submitted_at: string
          total_amount: number
        }[]
      }
      get_therapist_monthly_settlements: {
        Args: { p_month: number; p_token: string; p_year: number }
        Returns: {
          course_name: string
          customer_price: number
          duration: number
          id: string
          reservation_date: string
          start_time: string
          status: string
          therapist_back: number
        }[]
      }
      get_therapist_promotion_channels: {
        Args: { p_token: string }
        Returns: {
          channel_key: string
          channel_label: string
          placement_count: number
          plan_id: string
          size_spec: string | null
          sort_order: number
        }[]
      }
      get_therapist_promotion_schedules: {
        Args: { p_token: string }
        Returns: {
          ends_on: string | null
          group_label: string | null
          is_completed: boolean | null
          plan_description: string | null
          plan_id: string
          plan_title: string
          scheduled_on: string | null
          sort_order: number | null
          starts_on: string | null
          task_id: string | null
          task_label: string | null
          task_type: string | null
          therapist_label: string
        }[]
      }
      get_therapist_post_connections: {
        Args: { p_token: string }
        Returns: {
          configured: boolean
          site: string
        }[]
      }
      get_therapist_posts_secure: {
        Args: { p_token: string }
        Returns: {
          body: string
          created_at: string
          esutama_error: string
          esutama_status: string
          hp_error: string
          hp_status: string
          id: string
          image_urls: string[]
          o2_error: string
          o2_status: string
          status: string
          title: string
        }[]
      }
      get_therapist_sales_masters: { Args: { p_token: string }; Returns: Json }
      get_therapist_shifts: {
        Args: { p_month: number; p_token: string; p_year: number }
        Returns: {
          approval_comment: string
          approval_status: string
          end_time: string
          id: string
          notes: string
          room: string
          shift_date: string
          start_time: string
        }[]
      }
      get_therapist_transport_expenses: {
        Args: { p_month: number; p_token: string; p_year: number }
        Returns: {
          amount: number
          expense_date: string
          id: string
          notes: string
          route: string
          status: string
        }[]
      }
      get_therapist_upcoming_reservations: {
        Args: { p_token: string }
        Returns: {
          course_name: string
          customer_name: string
          duration: number
          id: string
          nomination_type: string
          options: string[]
          reservation_date: string
          room: string
          start_time: string
          status: string
        }[]
      }
      increment_cast_points: {
        Args: { p_cast_id: string; p_points: number }
        Returns: undefined
      }
      norm_phone: { Args: { p: string }; Returns: string }
      record_recruit_lp_event: {
        Args: {
          p_event: "exposure" | "cta_click"
          p_experiment_id: string
          p_rate_hash: string
          p_store_id: string
          p_variant: "safety_first" | "freedom_first"
          p_visitor_hash: string
        }
        Returns: boolean
      }
      record_page_view: {
        Args: {
          p_is_new_daily_visitor?: boolean
          p_is_new_session?: boolean
          p_path: string
          p_referrer_host?: string
          p_store_id: string
          p_utm_campaign?: string
          p_utm_content?: string
          p_utm_medium?: string
          p_utm_source?: string
        }
        Returns: undefined
      }
      refresh_monthly_report:
        | { Args: { p_month: string }; Returns: undefined }
        | { Args: { p_month: string; p_store: string }; Returns: undefined }
      report_estama_shift_result: {
        Args: { p_job_id: string; p_result: Json; p_token: string }
        Returns: boolean
      }
      save_o2_soul_connection_admin_v1: {
        Args: {
          p_cast_id: string
          p_estama_profile_url: string
          p_login_id: string
          p_o2_created: boolean
          p_o2_linkage_requested: boolean
          p_o2_login_email: string
          p_password: string
          p_store_id: string
        }
        Returns: undefined
      }
      save_sns_connection_admin: {
        Args: {
          p_cast_id: string
          p_login_id: string
          p_o2_created: boolean
          p_o2_linkage_requested: boolean
          p_password: string
          p_profile_url: string
          p_store_id: string
        }
        Returns: undefined
      }
      save_sns_connection_admin_v2: {
        Args: {
          p_cast_id: string
          p_login_id: string
          p_o2_created: boolean
          p_o2_linkage_requested: boolean
          p_password: string
          p_store_id: string
          p_x_login_id: string
          p_x_password: string
        }
        Returns: undefined
      }
      save_sns_connection_admin_v3: {
        Args: {
          p_cast_id: string
          p_estama_login_id: string
          p_estama_password: string
          p_estama_profile_url: string
          p_login_id: string
          p_o2_created: boolean
          p_o2_linkage_requested: boolean
          p_password: string
          p_store_id: string
          p_x_login_id: string
          p_x_password: string
        }
        Returns: undefined
      }
      save_sns_connection_admin_v4: {
        Args: {
          p_cast_id: string
          p_estama_profile_url: string
          p_login_id: string
          p_o2_created: boolean
          p_o2_linkage_requested: boolean
          p_o2_login_email: string
          p_password: string
          p_store_id: string
          p_x_login_id: string
          p_x_password: string
        }
        Returns: undefined
      }
      save_sns_connection_admin_v5: {
        Args: {
          p_cast_id: string
          p_estama_login_id: string
          p_estama_password: string
          p_estama_profile_url: string
          p_login_id: string
          p_o2_created: boolean
          p_o2_linkage_requested: boolean
          p_o2_login_email: string
          p_password: string
          p_store_id: string
          p_x_login_id: string
          p_x_password: string
        }
        Returns: undefined
      }
      save_therapist_o2_credentials: {
        Args: {
          p_login_email: string
          p_login_id: string
          p_password: string
          p_token: string
        }
        Returns: undefined
      }
      save_therapist_site_credential: {
        Args: {
          p_login_id: string
          p_password: string
          p_site: string
          p_token: string
        }
        Returns: undefined
      }
      set_cast_access_token: {
        Args: { p_cast_id: string; p_token: string }
        Returns: undefined
      }
      submit_therapist_shifts: {
        Args: { p_shifts: Json; p_token: string }
        Returns: number
      }
      submit_therapist_transport_expense: {
        Args: {
          p_amount: number
          p_date: string
          p_notes: string
          p_route: string
          p_token: string
        }
        Returns: string
      }
      sync_customer_stats_for: {
        Args: { p_name: string; p_phone_raw: string; p_store: string }
        Returns: undefined
      }
      therapist_submit_daily_sales: {
        Args: {
          p_card_amount: number
          p_cash_amount: number
          p_customer_count: number
          p_date: string
          p_manual_adjustment: number
          p_notes?: string
          p_paypay_amount: number
          p_token: string
          p_total_amount: number
        }
        Returns: string
      }
      therapist_update_payment_method: {
        Args: {
          p_payment_method: string
          p_reservation_id: string
          p_token: string
        }
        Returns: undefined
      }
      therapist_update_reservation: {
        Args: {
          p_course_name: string
          p_course_type: string
          p_discount: number
          p_discount_ids: string[]
          p_duration: number
          p_nomination_type: string
          p_options: string[]
          p_payment_fee: number
          p_payment_method: string
          p_price: number
          p_reservation_id: string
          p_token: string
        }
        Returns: undefined
      }
      update_o2_linkage_admin: {
        Args: {
          p_cast_id: string
          p_o2_created: boolean
          p_o2_linkage_requested: boolean
          p_o2_url?: string
          p_store_id: string
        }
        Returns: undefined
      }
      update_therapist_customer_notes: {
        Args: { p_customer_id: string; p_notes: string; p_token: string }
        Returns: undefined
      }
      update_web_booking_status: {
        Args: {
          p_reservation_id: string
          p_status: string
          p_store_id: string
        }
        Returns: {
          id: string
          web_booking_status: string
          web_booking_status_updated_at: string
          web_booking_status_updated_by: string
        }[]
      }
      verify_kintore_cron_secret: {
        Args: { candidate: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

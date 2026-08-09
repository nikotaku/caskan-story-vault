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
            foreignKeyName: "cast_access_tokens_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
          esutama_error: string | null
          esutama_status: string | null
          id: string
          image_urls: string[] | null
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
          esutama_error?: string | null
          esutama_status?: string | null
          id?: string
          image_urls?: string[] | null
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
          esutama_error?: string | null
          esutama_status?: string | null
          id?: string
          image_urls?: string[] | null
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
            foreignKeyName: "cast_site_credentials_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
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
          esuran_listed: boolean
          estama_listed: boolean
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
          is_online: boolean
          is_visible: boolean
          join_date: string
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
          o2_url: string | null
          o2_created: boolean
          o2_linkage_requested: boolean
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
          esuran_listed?: boolean
          estama_listed?: boolean
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
          is_online?: boolean
          is_visible?: boolean
          join_date?: string
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
          o2_url?: string | null
          o2_created?: boolean
          o2_linkage_requested?: boolean
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
          esuran_listed?: boolean
          estama_listed?: boolean
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
          is_online?: boolean
          is_visible?: boolean
          join_date?: string
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
          o2_url?: string | null
          o2_created?: boolean
          o2_linkage_requested?: boolean
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
      customer_followups: {
        Row: {
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
          notes: string | null
          paypay_amount: number
          status: string
          store_id: string
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
          notes?: string | null
          paypay_amount?: number
          status?: string
          store_id?: string
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
          notes?: string | null
          paypay_amount?: number
          status?: string
          store_id?: string
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
            foreignKeyName: "daily_sales_records_store_id_fkey"
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
          created_at: string
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          name: string
          store_id: string
        }
        Insert: {
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          name: string
          store_id?: string
        }
        Update: {
          created_at?: string
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          name?: string
          store_id?: string
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
            foreignKeyName: "expenses_store_id_fkey"
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
      reservations: {
        Row: {
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
          id: string
          nomination_type: string | null
          notes: string | null
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
        }
        Insert: {
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
          id?: string
          nomination_type?: string | null
          notes?: string | null
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
        }
        Update: {
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
          id?: string
          nomination_type?: string | null
          notes?: string | null
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
      [_ in never]: never
    }
    Functions: {
      check_repeat_nomination: {
        Args: { p_cast_id: string; p_phone: string }
        Returns: boolean
      }
      current_store_ids: { Args: never; Returns: string[] }
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
      get_public_back_rates: {
        Args: never
        Returns: {
          course_type: string
          customer_price: number
          duration: number
          id: string
        }[]
      }
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
      get_therapist_customers: {
        Args: { p_token: string }
        Returns: {
          concern_areas: string[]
          conversation_level: string
          customer_id: string
          last_visited: string
          my_last_visit: string
          my_visit_count: number
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
      increment_cast_points: {
        Args: { p_cast_id: string; p_points: number }
        Returns: undefined
      }
      norm_phone: { Args: { p: string }; Returns: string }
      record_page_view: {
        Args: {
          p_is_new_daily_visitor?: boolean
          p_is_new_session?: boolean
          p_path: string
          p_referrer_host?: string | null
          p_store_id: string
          p_utm_campaign?: string | null
          p_utm_content?: string | null
          p_utm_medium?: string | null
          p_utm_source?: string | null
        }
        Returns: undefined
      }
      refresh_monthly_report:
        | { Args: { p_month: string }; Returns: undefined }
        | { Args: { p_month: string; p_store: string }; Returns: undefined }
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

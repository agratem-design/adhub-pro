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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      account_closures: {
        Row: {
          closure_date: string
          contract_id: number | null
          created_at: string | null
          id: number
          notes: string | null
          remaining_balance: number | null
          total_withdrawn: number | null
        }
        Insert: {
          closure_date: string
          contract_id?: number | null
          created_at?: string | null
          id?: number
          notes?: string | null
          remaining_balance?: number | null
          total_withdrawn?: number | null
        }
        Update: {
          closure_date?: string
          contract_id?: number | null
          created_at?: string | null
          id?: number
          notes?: string | null
          remaining_balance?: number | null
          total_withdrawn?: number | null
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          action: string
          ad_type: string | null
          contract_number: number | null
          created_at: string
          customer_name: string | null
          description: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          ad_type?: string | null
          contract_number?: number | null
          created_at?: string
          customer_name?: string | null
          description: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          ad_type?: string | null
          contract_number?: number | null
          created_at?: string
          customer_name?: string | null
          description?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          created_at: string | null
          id: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_knowledge_base: {
        Row: {
          category: string
          content: string
          created_at: string | null
          id: string
          priority: number
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string
          content: string
          created_at?: string | null
          id?: string
          priority?: number
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          id?: string
          priority?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_memory: {
        Row: {
          category: string
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          updated_at: string | null
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      base_prices: {
        Row: {
          billboard_level: string
          created_at: string
          full_year: number | null
          id: string
          one_day: number | null
          one_month: number | null
          six_months: number | null
          size_name: string
          three_months: number | null
          two_months: number | null
          updated_at: string
        }
        Insert: {
          billboard_level?: string
          created_at?: string
          full_year?: number | null
          id?: string
          one_day?: number | null
          one_month?: number | null
          six_months?: number | null
          size_name: string
          three_months?: number | null
          two_months?: number | null
          updated_at?: string
        }
        Update: {
          billboard_level?: string
          created_at?: string
          full_year?: number | null
          id?: string
          one_day?: number | null
          one_month?: number | null
          six_months?: number | null
          size_name?: string
          three_months?: number | null
          two_months?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      billboard_cost_centers: {
        Row: {
          amount: number
          billboard_id: number
          cost_type: string
          created_at: string
          frequency: string | null
          id: string
          notes: string | null
          period_end: string | null
          period_start: string | null
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          amount?: number
          billboard_id: number
          cost_type: string
          created_at?: string
          frequency?: string | null
          id?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          billboard_id?: number
          cost_type?: string
          created_at?: string
          frequency?: string | null
          id?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billboard_cost_centers_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboard_partnership_status"
            referencedColumns: ["billboard_id"]
          },
          {
            foreignKeyName: "billboard_cost_centers_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboards"
            referencedColumns: ["ID"]
          },
          {
            foreignKeyName: "billboard_cost_centers_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["billboard_id"]
          },
        ]
      }
      billboard_extensions: {
        Row: {
          billboard_id: number
          contract_number: number | null
          created_at: string
          created_by: string | null
          extension_days: number
          extension_type: string
          id: string
          new_end_date: string
          notes: string | null
          old_end_date: string
          reason: string
        }
        Insert: {
          billboard_id: number
          contract_number?: number | null
          created_at?: string
          created_by?: string | null
          extension_days: number
          extension_type?: string
          id?: string
          new_end_date: string
          notes?: string | null
          old_end_date: string
          reason: string
        }
        Update: {
          billboard_id?: number
          contract_number?: number | null
          created_at?: string
          created_by?: string | null
          extension_days?: number
          extension_type?: string
          id?: string
          new_end_date?: string
          notes?: string | null
          old_end_date?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "billboard_extensions_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboard_partnership_status"
            referencedColumns: ["billboard_id"]
          },
          {
            foreignKeyName: "billboard_extensions_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboards"
            referencedColumns: ["ID"]
          },
          {
            foreignKeyName: "billboard_extensions_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["billboard_id"]
          },
          {
            foreignKeyName: "billboard_extensions_contract_number_fkey"
            columns: ["contract_number"]
            isOneToOne: false
            referencedRelation: "Contract"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "billboard_extensions_contract_number_fkey"
            columns: ["contract_number"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "billboard_extensions_contract_number_fkey"
            columns: ["contract_number"]
            isOneToOne: false
            referencedRelation: "contract_summary"
            referencedColumns: ["Contract_Number"]
          },
        ]
      }
      billboard_faces: {
        Row: {
          count: number | null
          created_at: string | null
          description: string | null
          face_count: number
          id: number
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          count?: number | null
          created_at?: string | null
          description?: string | null
          face_count?: number
          id?: number
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          count?: number | null
          created_at?: string | null
          description?: string | null
          face_count?: number
          id?: number
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      billboard_history: {
        Row: {
          ad_type: string | null
          billboard_id: number
          billboard_rent_price: number | null
          contract_discount: number | null
          contract_number: number | null
          contract_total: number | null
          contract_total_rent: number | null
          created_at: string | null
          customer_name: string | null
          design_face_a_url: string | null
          design_face_b_url: string | null
          design_name: string | null
          discount_amount: number | null
          discount_percentage: number | null
          duration_days: number | null
          end_date: string | null
          fallback_path_design_a: string | null
          fallback_path_design_b: string | null
          fallback_path_installed_a: string | null
          fallback_path_installed_b: string | null
          id: string
          include_installation_in_price: boolean | null
          include_print_in_price: boolean | null
          individual_billboard_data: Json | null
          installation_cost: number | null
          installation_date: string | null
          installed_image_face_a_url: string | null
          installed_image_face_b_url: string | null
          net_rental_amount: number | null
          notes: string | null
          pricing_category: string | null
          pricing_mode: string | null
          print_cost: number | null
          rent_amount: number | null
          start_date: string | null
          team_name: string | null
          total_before_discount: number | null
          updated_at: string | null
        }
        Insert: {
          ad_type?: string | null
          billboard_id: number
          billboard_rent_price?: number | null
          contract_discount?: number | null
          contract_number?: number | null
          contract_total?: number | null
          contract_total_rent?: number | null
          created_at?: string | null
          customer_name?: string | null
          design_face_a_url?: string | null
          design_face_b_url?: string | null
          design_name?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          duration_days?: number | null
          end_date?: string | null
          fallback_path_design_a?: string | null
          fallback_path_design_b?: string | null
          fallback_path_installed_a?: string | null
          fallback_path_installed_b?: string | null
          id?: string
          include_installation_in_price?: boolean | null
          include_print_in_price?: boolean | null
          individual_billboard_data?: Json | null
          installation_cost?: number | null
          installation_date?: string | null
          installed_image_face_a_url?: string | null
          installed_image_face_b_url?: string | null
          net_rental_amount?: number | null
          notes?: string | null
          pricing_category?: string | null
          pricing_mode?: string | null
          print_cost?: number | null
          rent_amount?: number | null
          start_date?: string | null
          team_name?: string | null
          total_before_discount?: number | null
          updated_at?: string | null
        }
        Update: {
          ad_type?: string | null
          billboard_id?: number
          billboard_rent_price?: number | null
          contract_discount?: number | null
          contract_number?: number | null
          contract_total?: number | null
          contract_total_rent?: number | null
          created_at?: string | null
          customer_name?: string | null
          design_face_a_url?: string | null
          design_face_b_url?: string | null
          design_name?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          duration_days?: number | null
          end_date?: string | null
          fallback_path_design_a?: string | null
          fallback_path_design_b?: string | null
          fallback_path_installed_a?: string | null
          fallback_path_installed_b?: string | null
          id?: string
          include_installation_in_price?: boolean | null
          include_print_in_price?: boolean | null
          individual_billboard_data?: Json | null
          installation_cost?: number | null
          installation_date?: string | null
          installed_image_face_a_url?: string | null
          installed_image_face_b_url?: string | null
          net_rental_amount?: number | null
          notes?: string | null
          pricing_category?: string | null
          pricing_mode?: string | null
          print_cost?: number | null
          rent_amount?: number | null
          start_date?: string | null
          team_name?: string | null
          total_before_discount?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      billboard_levels: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          level_code: string
          level_name: string
          sort_order: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          level_code: string
          level_name: string
          sort_order?: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          level_code?: string
          level_name?: string
          sort_order?: number
        }
        Relationships: []
      }
      billboard_loans: {
        Row: {
          billboard_id: number
          compensation_days: number
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          loan_days: number
          notes: string | null
          source_contract_number: number
          start_date: string
          status: string
          target_contract_number: number
          updated_at: string
        }
        Insert: {
          billboard_id: number
          compensation_days?: number
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          loan_days: number
          notes?: string | null
          source_contract_number: number
          start_date: string
          status?: string
          target_contract_number: number
          updated_at?: string
        }
        Update: {
          billboard_id?: number
          compensation_days?: number
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          loan_days?: number
          notes?: string | null
          source_contract_number?: number
          start_date?: string
          status?: string
          target_contract_number?: number
          updated_at?: string
        }
        Relationships: []
      }
      billboard_nearby_businesses: {
        Row: {
          address: string | null
          billboard_id: number
          business_name: string
          business_type: string | null
          created_at: string | null
          distance_estimate: string | null
          id: string
          notes: string | null
          phone: string | null
          source: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          billboard_id: number
          business_name: string
          business_type?: string | null
          created_at?: string | null
          distance_estimate?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          billboard_id?: number
          business_name?: string
          business_type?: string | null
          created_at?: string | null
          distance_estimate?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billboard_nearby_businesses_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboard_partnership_status"
            referencedColumns: ["billboard_id"]
          },
          {
            foreignKeyName: "billboard_nearby_businesses_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboards"
            referencedColumns: ["ID"]
          },
          {
            foreignKeyName: "billboard_nearby_businesses_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["billboard_id"]
          },
        ]
      }
      billboard_print_customization: {
        Row: {
          billboard_name_alignment: string | null
          billboard_name_color: string | null
          billboard_name_font_size: string | null
          billboard_name_font_weight: string | null
          billboard_name_left: string | null
          billboard_name_offset_x: string | null
          billboard_name_top: string | null
          billboard_status_enabled: string
          billboard_status_font_size: string
          billboard_status_offset_y: string
          contract_number_alignment: string | null
          contract_number_color: string | null
          contract_number_font_size: string | null
          contract_number_font_weight: string | null
          contract_number_offset_x: string | null
          contract_number_right: string | null
          contract_number_top: string | null
          coords_bar_height: string | null
          coords_font_family: string | null
          coords_font_size: string | null
          cover_background_enabled: string | null
          cover_background_url: string | null
          cover_logo_align: string | null
          cover_logo_left: string | null
          cover_logo_size: string | null
          cover_logo_top: string | null
          cover_logo_url: string | null
          calc_meters_by_faces: string | null
          cover_municipality_align: string | null
          cover_municipality_font_size: string | null
          cover_municipality_left: string | null
          cover_municipality_top: string | null
          cover_page_enabled: string | null
          cover_phrase: string | null
          cover_phrase_align: string | null
          cover_phrase_font_size: string | null
          cover_phrase_left: string | null
          cover_phrase_top: string | null
          created_at: string
          custom_pin_url: string | null
          design_image_height: string | null
          designs_gap: string | null
          designs_left: string | null
          designs_top: string | null
          designs_width: string | null
          faces_count_alignment: string | null
          faces_count_color: string | null
          faces_count_font_size: string | null
          faces_count_left: string | null
          faces_count_offset_x: string | null
          faces_count_show: string | null
          faces_count_top: string | null
          id: string
          installation_date_alignment: string | null
          installation_date_color: string | null
          installation_date_font_size: string | null
          installation_date_font_weight: string | null
          installation_date_offset_x: string | null
          installation_date_right: string | null
          installation_date_top: string | null
          installed_image_height: string | null
          installed_images_gap: string | null
          installed_images_left: string | null
          installed_images_top: string | null
          installed_images_width: string | null
          landmark_info_alignment: string | null
          landmark_info_color: string | null
          landmark_info_font_size: string | null
          landmark_info_left: string | null
          landmark_info_offset_x: string | null
          landmark_info_top: string | null
          landmark_info_width: string | null
          location_info_alignment: string | null
          location_info_color: string | null
          location_info_font_size: string | null
          location_info_left: string | null
          location_info_offset_x: string | null
          location_info_top: string | null
          location_info_width: string | null
          main_image_height: string | null
          main_image_left: string | null
          main_image_object_fit: string | null
          main_image_top: string | null
          main_image_width: string | null
          map_show_labels: string | null
          map_zoom: string | null
          pin_color: string | null
          pin_size: string | null
          pin_text_color: string | null
          preview_background: string | null
          preview_zoom: string | null
          primary_font: string | null
          qr_left: string | null
          qr_size: string | null
          qr_top: string | null
          secondary_font: string | null
          setting_key: string
          size_alignment: string | null
          size_color: string | null
          size_font_size: string | null
          size_font_weight: string | null
          size_left: string | null
          size_offset_x: string | null
          size_top: string | null
          status_badges_font_size: string | null
          status_badges_left: string | null
          status_badges_show: string | null
          status_badges_top: string | null
          status_overrides: Json | null
          team_name_alignment: string | null
          team_name_color: string | null
          team_name_font_size: string | null
          team_name_font_weight: string | null
          team_name_offset_x: string | null
          team_name_right: string | null
          team_name_top: string | null
          updated_at: string
        }
        Insert: {
          billboard_name_alignment?: string | null
          billboard_name_color?: string | null
          billboard_name_font_size?: string | null
          billboard_name_font_weight?: string | null
          billboard_name_left?: string | null
          billboard_name_offset_x?: string | null
          billboard_name_top?: string | null
          billboard_status_enabled?: string
          billboard_status_font_size?: string
          billboard_status_offset_y?: string
          contract_number_alignment?: string | null
          contract_number_color?: string | null
          contract_number_font_size?: string | null
          contract_number_font_weight?: string | null
          contract_number_offset_x?: string | null
          contract_number_right?: string | null
          contract_number_top?: string | null
          coords_bar_height?: string | null
          coords_font_family?: string | null
          coords_font_size?: string | null
          cover_background_enabled?: string | null
          cover_background_url?: string | null
          cover_logo_align?: string | null
          cover_logo_left?: string | null
          cover_logo_size?: string | null
          cover_logo_top?: string | null
          cover_logo_url?: string | null
          calc_meters_by_faces?: string | null
          cover_municipality_align?: string | null
          cover_municipality_font_size?: string | null
          cover_municipality_left?: string | null
          cover_municipality_top?: string | null
          cover_page_enabled?: string | null
          cover_phrase?: string | null
          cover_phrase_align?: string | null
          cover_phrase_font_size?: string | null
          cover_phrase_left?: string | null
          cover_phrase_top?: string | null
          created_at?: string
          custom_pin_url?: string | null
          design_image_height?: string | null
          designs_gap?: string | null
          designs_left?: string | null
          designs_top?: string | null
          designs_width?: string | null
          faces_count_alignment?: string | null
          faces_count_color?: string | null
          faces_count_font_size?: string | null
          faces_count_left?: string | null
          faces_count_offset_x?: string | null
          faces_count_top?: string | null
          faces_count_show?: string | null
          id?: string
          installation_date_alignment?: string | null
          installation_date_color?: string | null
          installation_date_font_size?: string | null
          installation_date_font_weight?: string | null
          installation_date_offset_x?: string | null
          installation_date_right?: string | null
          installation_date_top?: string | null
          installed_image_height?: string | null
          installed_images_gap?: string | null
          installed_images_left?: string | null
          installed_images_top?: string | null
          installed_images_width?: string | null
          landmark_info_alignment?: string | null
          landmark_info_color?: string | null
          landmark_info_font_size?: string | null
          landmark_info_left?: string | null
          landmark_info_offset_x?: string | null
          landmark_info_top?: string | null
          landmark_info_width?: string | null
          location_info_alignment?: string | null
          location_info_color?: string | null
          location_info_font_size?: string | null
          location_info_left?: string | null
          location_info_offset_x?: string | null
          location_info_top?: string | null
          location_info_width?: string | null
          main_image_height?: string | null
          main_image_left?: string | null
          main_image_object_fit?: string | null
          main_image_top?: string | null
          main_image_width?: string | null
          map_show_labels?: string | null
          map_zoom?: string | null
          pin_color?: string | null
          pin_size?: string | null
          pin_text_color?: string | null
          preview_background?: string | null
          preview_zoom?: string | null
          primary_font?: string | null
          qr_left?: string | null
          qr_size?: string | null
          qr_top?: string | null
          secondary_font?: string | null
          setting_key?: string
          size_alignment?: string | null
          size_color?: string | null
          size_font_size?: string | null
          size_font_weight?: string | null
          size_left?: string | null
          size_offset_x?: string | null
          size_top?: string | null
          status_badges_font_size?: string | null
          status_badges_left?: string | null
          status_badges_show?: string | null
          status_badges_top?: string | null
          status_overrides?: Json | null
          team_name_alignment?: string | null
          team_name_color?: string | null
          team_name_font_size?: string | null
          team_name_font_weight?: string | null
          team_name_offset_x?: string | null
          team_name_right?: string | null
          team_name_top?: string | null
          updated_at?: string
        }
        Update: {
          billboard_name_alignment?: string | null
          billboard_name_color?: string | null
          billboard_name_font_size?: string | null
          billboard_name_font_weight?: string | null
          billboard_name_left?: string | null
          billboard_name_offset_x?: string | null
          billboard_name_top?: string | null
          billboard_status_enabled?: string
          billboard_status_font_size?: string
          billboard_status_offset_y?: string
          contract_number_alignment?: string | null
          contract_number_color?: string | null
          contract_number_font_size?: string | null
          contract_number_font_weight?: string | null
          contract_number_offset_x?: string | null
          contract_number_right?: string | null
          contract_number_top?: string | null
          coords_bar_height?: string | null
          coords_font_family?: string | null
          coords_font_size?: string | null
          cover_background_enabled?: string | null
          cover_background_url?: string | null
          cover_logo_align?: string | null
          cover_logo_left?: string | null
          cover_logo_size?: string | null
          cover_logo_top?: string | null
          cover_logo_url?: string | null
          calc_meters_by_faces?: string | null
          cover_municipality_align?: string | null
          cover_municipality_font_size?: string | null
          cover_municipality_left?: string | null
          cover_municipality_top?: string | null
          cover_page_enabled?: string | null
          cover_phrase?: string | null
          cover_phrase_align?: string | null
          cover_phrase_font_size?: string | null
          cover_phrase_left?: string | null
          cover_phrase_top?: string | null
          created_at?: string
          custom_pin_url?: string | null
          design_image_height?: string | null
          designs_gap?: string | null
          designs_left?: string | null
          designs_top?: string | null
          designs_width?: string | null
          faces_count_alignment?: string | null
          faces_count_color?: string | null
          faces_count_font_size?: string | null
          faces_count_left?: string | null
          faces_count_offset_x?: string | null
          faces_count_top?: string | null
          faces_count_show?: string | null
          id?: string
          installation_date_alignment?: string | null
          installation_date_color?: string | null
          installation_date_font_size?: string | null
          installation_date_font_weight?: string | null
          installation_date_offset_x?: string | null
          installation_date_right?: string | null
          installation_date_top?: string | null
          installed_image_height?: string | null
          installed_images_gap?: string | null
          installed_images_left?: string | null
          installed_images_top?: string | null
          installed_images_width?: string | null
          landmark_info_alignment?: string | null
          landmark_info_color?: string | null
          landmark_info_font_size?: string | null
          landmark_info_left?: string | null
          landmark_info_offset_x?: string | null
          landmark_info_top?: string | null
          landmark_info_width?: string | null
          location_info_alignment?: string | null
          location_info_color?: string | null
          location_info_font_size?: string | null
          location_info_left?: string | null
          location_info_offset_x?: string | null
          location_info_top?: string | null
          location_info_width?: string | null
          main_image_height?: string | null
          main_image_left?: string | null
          main_image_object_fit?: string | null
          main_image_top?: string | null
          main_image_width?: string | null
          map_show_labels?: string | null
          map_zoom?: string | null
          pin_color?: string | null
          pin_size?: string | null
          pin_text_color?: string | null
          preview_background?: string | null
          preview_zoom?: string | null
          primary_font?: string | null
          qr_left?: string | null
          qr_size?: string | null
          qr_top?: string | null
          secondary_font?: string | null
          setting_key?: string
          size_alignment?: string | null
          size_color?: string | null
          size_font_size?: string | null
          size_font_weight?: string | null
          size_left?: string | null
          size_offset_x?: string | null
          size_top?: string | null
          status_badges_font_size?: string | null
          status_badges_left?: string | null
          status_badges_show?: string | null
          status_badges_top?: string | null
          status_overrides?: Json | null
          team_name_alignment?: string | null
          team_name_color?: string | null
          team_name_font_size?: string | null
          team_name_font_weight?: string | null
          team_name_offset_x?: string | null
          team_name_right?: string | null
          team_name_top?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      billboard_print_profiles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          profile_name: string
          settings_data: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          profile_name: string
          settings_data: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          profile_name?: string
          settings_data?: Json
          updated_at?: string
        }
        Relationships: []
      }
      billboard_print_settings: {
        Row: {
          background_height: string | null
          background_url: string | null
          background_width: string | null
          created_at: string | null
          custom_css: string | null
          elements: Json | null
          id: string
          primary_font: string | null
          secondary_font: string | null
          setting_key: string
          updated_at: string | null
        }
        Insert: {
          background_height?: string | null
          background_url?: string | null
          background_width?: string | null
          created_at?: string | null
          custom_css?: string | null
          elements?: Json | null
          id?: string
          primary_font?: string | null
          secondary_font?: string | null
          setting_key?: string
          updated_at?: string | null
        }
        Update: {
          background_height?: string | null
          background_url?: string | null
          background_width?: string | null
          created_at?: string | null
          custom_css?: string | null
          elements?: Json | null
          id?: string
          primary_font?: string | null
          secondary_font?: string | null
          setting_key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      billboard_report_phrases: {
        Row: {
          created_at: string
          id: string
          phrase: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          phrase: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          phrase?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      billboard_status_history: {
        Row: {
          actor: string | null
          billboard_id: number
          contract_number: number | null
          created_at: string
          event: string
          id: string
          new_size: string | null
          note: string | null
          old_size: string | null
          status_id: string | null
          status_type: Database["public"]["Enums"]["billboard_status_type"]
        }
        Insert: {
          actor?: string | null
          billboard_id: number
          contract_number?: number | null
          created_at?: string
          event: string
          id?: string
          new_size?: string | null
          note?: string | null
          old_size?: string | null
          status_id?: string | null
          status_type: Database["public"]["Enums"]["billboard_status_type"]
        }
        Update: {
          actor?: string | null
          billboard_id?: number
          contract_number?: number | null
          created_at?: string
          event?: string
          id?: string
          new_size?: string | null
          note?: string | null
          old_size?: string | null
          status_id?: string | null
          status_type?: Database["public"]["Enums"]["billboard_status_type"]
        }
        Relationships: []
      }
      billboard_statuses: {
        Row: {
          billboard_id: number
          contract_number: number | null
          created_at: string
          created_by: string | null
          id: string
          is_resolved: boolean
          new_size: string | null
          note: string | null
          old_size: string | null
          resolved_at: string | null
          status_type: Database["public"]["Enums"]["billboard_status_type"]
          updated_at: string
        }
        Insert: {
          billboard_id: number
          contract_number?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_resolved?: boolean
          new_size?: string | null
          note?: string | null
          old_size?: string | null
          resolved_at?: string | null
          status_type: Database["public"]["Enums"]["billboard_status_type"]
          updated_at?: string
        }
        Update: {
          billboard_id?: number
          contract_number?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_resolved?: boolean
          new_size?: string | null
          note?: string | null
          old_size?: string | null
          resolved_at?: string | null
          status_type?: Database["public"]["Enums"]["billboard_status_type"]
          updated_at?: string
        }
        Relationships: []
      }
      billboard_tags: {
        Row: {
          ad_categories: string[] | null
          billboard_id: number
          description: string | null
          generated_at: string | null
          id: string
          location_type: string | null
          tags: string[] | null
          target_audience: string[] | null
        }
        Insert: {
          ad_categories?: string[] | null
          billboard_id: number
          description?: string | null
          generated_at?: string | null
          id?: string
          location_type?: string | null
          tags?: string[] | null
          target_audience?: string[] | null
        }
        Update: {
          ad_categories?: string[] | null
          billboard_id?: number
          description?: string | null
          generated_at?: string | null
          id?: string
          location_type?: string | null
          tags?: string[] | null
          target_audience?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "billboard_tags_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: true
            referencedRelation: "billboard_partnership_status"
            referencedColumns: ["billboard_id"]
          },
          {
            foreignKeyName: "billboard_tags_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: true
            referencedRelation: "billboards"
            referencedColumns: ["ID"]
          },
          {
            foreignKeyName: "billboard_tags_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: true
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["billboard_id"]
          },
        ]
      }
      billboard_types: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: number
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      billboards: {
        Row: {
          Ad_Type: string | null
          Billboard_Name: string | null
          billboard_type: string | null
          capital: number | null
          capital_remaining: number | null
          Category_Level: string | null
          City: string | null
          Contract_Number: number | null
          created_at: string | null
          Customer_Name: string | null
          Days_Count: string | null
          design_face_a: string | null
          design_face_b: string | null
          District: string | null
          Faces_Count: number | null
          fallback_path_image: string | null
          friend_company_id: string | null
          GPS_Coordinates: string | null
          GPS_Link: string | null
          has_cutout: boolean | null
          ID: number
          image_name: string | null
          Image_URL: string | null
          is_partnership: boolean | null
          is_visible_in_available: boolean | null
          Level: string | null
          maintenance_cost: number | null
          maintenance_date: string | null
          maintenance_notes: string | null
          maintenance_priority: string | null
          maintenance_status: string | null
          maintenance_type: string | null
          Municipality: string | null
          Nearest_Landmark: string | null
          needs_rephotography: boolean | null
          next_maintenance_date: string | null
          Order_Size: string | null
          own_company_id: string | null
          partner_companies: string[] | null
          Price: number | null
          Rent_End_Date: string | null
          Rent_Start_Date: string | null
          Review: string | null
          Size: string | null
          size_id: number | null
          Status: string | null
          updated_at: string | null
        }
        Insert: {
          Ad_Type?: string | null
          Billboard_Name?: string | null
          billboard_type?: string | null
          capital?: number | null
          capital_remaining?: number | null
          Category_Level?: string | null
          City?: string | null
          Contract_Number?: number | null
          created_at?: string | null
          Customer_Name?: string | null
          Days_Count?: string | null
          design_face_a?: string | null
          design_face_b?: string | null
          District?: string | null
          Faces_Count?: number | null
          fallback_path_image?: string | null
          friend_company_id?: string | null
          GPS_Coordinates?: string | null
          GPS_Link?: string | null
          has_cutout?: boolean | null
          ID?: number
          image_name?: string | null
          Image_URL?: string | null
          is_partnership?: boolean | null
          is_visible_in_available?: boolean | null
          Level?: string | null
          maintenance_cost?: number | null
          maintenance_date?: string | null
          maintenance_notes?: string | null
          maintenance_priority?: string | null
          maintenance_status?: string | null
          maintenance_type?: string | null
          Municipality?: string | null
          Nearest_Landmark?: string | null
          needs_rephotography?: boolean | null
          next_maintenance_date?: string | null
          Order_Size?: string | null
          own_company_id?: string | null
          partner_companies?: string[] | null
          Price?: number | null
          Rent_End_Date?: string | null
          Rent_Start_Date?: string | null
          Review?: string | null
          Size?: string | null
          size_id?: number | null
          Status?: string | null
          updated_at?: string | null
        }
        Update: {
          Ad_Type?: string | null
          Billboard_Name?: string | null
          billboard_type?: string | null
          capital?: number | null
          capital_remaining?: number | null
          Category_Level?: string | null
          City?: string | null
          Contract_Number?: number | null
          created_at?: string | null
          Customer_Name?: string | null
          Days_Count?: string | null
          design_face_a?: string | null
          design_face_b?: string | null
          District?: string | null
          Faces_Count?: number | null
          fallback_path_image?: string | null
          friend_company_id?: string | null
          GPS_Coordinates?: string | null
          GPS_Link?: string | null
          has_cutout?: boolean | null
          ID?: number
          image_name?: string | null
          Image_URL?: string | null
          is_partnership?: boolean | null
          is_visible_in_available?: boolean | null
          Level?: string | null
          maintenance_cost?: number | null
          maintenance_date?: string | null
          maintenance_notes?: string | null
          maintenance_priority?: string | null
          maintenance_status?: string | null
          maintenance_type?: string | null
          Municipality?: string | null
          Nearest_Landmark?: string | null
          needs_rephotography?: boolean | null
          next_maintenance_date?: string | null
          Order_Size?: string | null
          own_company_id?: string | null
          partner_companies?: string[] | null
          Price?: number | null
          Rent_End_Date?: string | null
          Rent_Start_Date?: string | null
          Review?: string | null
          Size?: string | null
          size_id?: number | null
          Status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billboards_own_company_id_fkey"
            columns: ["own_company_id"]
            isOneToOne: false
            referencedRelation: "friend_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billboards_own_company_id_fkey"
            columns: ["own_company_id"]
            isOneToOne: false
            referencedRelation: "friend_company_financials"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fk_billboard_friend_company"
            columns: ["friend_company_id"]
            isOneToOne: false
            referencedRelation: "friend_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_billboard_friend_company"
            columns: ["friend_company_id"]
            isOneToOne: false
            referencedRelation: "friend_company_financials"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fk_billboard_size"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_billboard_size_name"
            columns: ["Size"]
            isOneToOne: false
            referencedRelation: "sizes"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "fk_billboards_faces_count"
            columns: ["Faces_Count"]
            isOneToOne: false
            referencedRelation: "billboard_faces"
            referencedColumns: ["face_count"]
          },
          {
            foreignKeyName: "fk_billboards_level"
            columns: ["Level"]
            isOneToOne: false
            referencedRelation: "billboard_levels"
            referencedColumns: ["level_code"]
          },
          {
            foreignKeyName: "fk_contract"
            columns: ["Contract_Number"]
            isOneToOne: false
            referencedRelation: "Contract"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "fk_contract"
            columns: ["Contract_Number"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "fk_contract"
            columns: ["Contract_Number"]
            isOneToOne: false
            referencedRelation: "contract_summary"
            referencedColumns: ["Contract_Number"]
          },
        ]
      }
      booking_requests: {
        Row: {
          admin_notes: string | null
          billboard_ids: number[]
          created_at: string | null
          customer_id: string | null
          end_date: string
          id: string
          notes: string | null
          start_date: string
          status: string | null
          total_price: number
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          billboard_ids: number[]
          created_at?: string | null
          customer_id?: string | null
          end_date: string
          id?: string
          notes?: string | null
          start_date: string
          status?: string | null
          total_price: number
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          billboard_ids?: number[]
          created_at?: string | null
          customer_id?: string | null
          end_date?: string
          id?: string
          notes?: string | null
          start_date?: string
          status?: string | null
          total_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financial_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "booking_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financials"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "booking_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      category_factors: {
        Row: {
          category_name: string
          created_at: string
          description: string | null
          factor: number
          id: string
          is_active: boolean | null
          updated_at: string
        }
        Insert: {
          category_name: string
          created_at?: string
          description?: string | null
          factor?: number
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Update: {
          category_name?: string
          created_at?: string
          description?: string | null
          factor?: number
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      cleanup_logs: {
        Row: {
          billboard_ids_cleaned: number[] | null
          billboards_cleaned: number
          cleanup_date: string
          cleanup_type: string
          created_at: string
          id: string
          notes: string | null
        }
        Insert: {
          billboard_ids_cleaned?: number[] | null
          billboards_cleaned?: number
          cleanup_date?: string
          cleanup_type?: string
          created_at?: string
          id?: string
          notes?: string | null
        }
        Update: {
          billboard_ids_cleaned?: number[] | null
          billboards_cleaned?: number
          cleanup_date?: string
          cleanup_type?: string
          created_at?: string
          id?: string
          notes?: string | null
        }
        Relationships: []
      }
      composite_tasks: {
        Row: {
          combined_invoice_id: string | null
          company_cutout_cost: number | null
          company_installation_cost: number | null
          company_print_cost: number | null
          company_total: number | null
          contract_id: number | null
          cost_allocation: Json | null
          created_at: string | null
          customer_cutout_cost: number | null
          customer_id: string | null
          customer_installation_cost: number | null
          customer_name: string | null
          customer_print_cost: number | null
          customer_total: number | null
          cutout_cost: number | null
          cutout_discount: number | null
          cutout_discount_reason: string | null
          cutout_task_id: string | null
          discount_amount: number | null
          discount_reason: string | null
          id: string
          installation_cost: number | null
          installation_discount: number | null
          installation_discount_reason: string | null
          installation_task_id: string | null
          invoice_date: string | null
          invoice_generated: boolean | null
          net_profit: number | null
          notes: string | null
          paid_amount: number | null
          print_cost: number | null
          print_discount: number | null
          print_discount_reason: string | null
          print_task_id: string | null
          profit_percentage: number | null
          status: string | null
          task_number: number
          task_type: string
          total_cost: number | null
          updated_at: string | null
        }
        Insert: {
          combined_invoice_id?: string | null
          company_cutout_cost?: number | null
          company_installation_cost?: number | null
          company_print_cost?: number | null
          company_total?: number | null
          contract_id?: number | null
          cost_allocation?: Json | null
          created_at?: string | null
          customer_cutout_cost?: number | null
          customer_id?: string | null
          customer_installation_cost?: number | null
          customer_name?: string | null
          customer_print_cost?: number | null
          customer_total?: number | null
          cutout_cost?: number | null
          cutout_discount?: number | null
          cutout_discount_reason?: string | null
          cutout_task_id?: string | null
          discount_amount?: number | null
          discount_reason?: string | null
          id?: string
          installation_cost?: number | null
          installation_discount?: number | null
          installation_discount_reason?: string | null
          installation_task_id?: string | null
          invoice_date?: string | null
          invoice_generated?: boolean | null
          net_profit?: number | null
          notes?: string | null
          paid_amount?: number | null
          print_cost?: number | null
          print_discount?: number | null
          print_discount_reason?: string | null
          print_task_id?: string | null
          profit_percentage?: number | null
          status?: string | null
          task_number?: number
          task_type: string
          total_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          combined_invoice_id?: string | null
          company_cutout_cost?: number | null
          company_installation_cost?: number | null
          company_print_cost?: number | null
          company_total?: number | null
          contract_id?: number | null
          cost_allocation?: Json | null
          created_at?: string | null
          customer_cutout_cost?: number | null
          customer_id?: string | null
          customer_installation_cost?: number | null
          customer_name?: string | null
          customer_print_cost?: number | null
          customer_total?: number | null
          cutout_cost?: number | null
          cutout_discount?: number | null
          cutout_discount_reason?: string | null
          cutout_task_id?: string | null
          discount_amount?: number | null
          discount_reason?: string | null
          id?: string
          installation_cost?: number | null
          installation_discount?: number | null
          installation_discount_reason?: string | null
          installation_task_id?: string | null
          invoice_date?: string | null
          invoice_generated?: boolean | null
          net_profit?: number | null
          notes?: string | null
          paid_amount?: number | null
          print_cost?: number | null
          print_discount?: number | null
          print_discount_reason?: string | null
          print_task_id?: string | null
          profit_percentage?: number | null
          status?: string | null
          task_number?: number
          task_type?: string
          total_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "composite_tasks_combined_invoice_id_fkey"
            columns: ["combined_invoice_id"]
            isOneToOne: false
            referencedRelation: "print_invoices_standalone"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "composite_tasks_combined_invoice_id_fkey"
            columns: ["combined_invoice_id"]
            isOneToOne: false
            referencedRelation: "printed_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "composite_tasks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "Contract"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "composite_tasks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "composite_tasks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract_summary"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "composite_tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financial_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "composite_tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financials"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "composite_tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "composite_tasks_cutout_task_id_fkey"
            columns: ["cutout_task_id"]
            isOneToOne: false
            referencedRelation: "cutout_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "composite_tasks_installation_task_id_fkey"
            columns: ["installation_task_id"]
            isOneToOne: false
            referencedRelation: "installation_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "composite_tasks_print_task_id_fkey"
            columns: ["print_task_id"]
            isOneToOne: false
            referencedRelation: "print_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      Contract: {
        Row: {
          "Ad Type": string | null
          base_rent: number | null
          billboard_id: number | null
          billboard_ids: string | null
          billboard_prices: string | null
          billboards_count: number | null
          billboards_data: string | null
          billboards_released: boolean | null
          Company: string | null
          "Contract Date": string | null
          contract_currency: string | null
          Contract_Number: number
          "Customer Name": string | null
          customer_category: string | null
          customer_id: string | null
          design_data: Json | null
          Discount: number | null
          Duration: string | null
          duration_days: number | null
          duration_months: number | null
          "End Date": string | null
          exchange_rate: string | null
          fee: string | null
          friend_rental_data: Json | null
          friend_rental_includes_installation: boolean | null
          friend_rental_operating_fee_enabled: boolean | null
          friend_rental_operating_fee_rate: number | null
          id: number
          include_installation_in_price: boolean
          include_operating_in_installation: boolean | null
          include_operating_in_print: boolean | null
          include_print_in_billboard_price: boolean
          installation_cost: number | null
          installation_enabled: boolean | null
          installment_auto_calculate: boolean | null
          installment_count: number | null
          installment_distribution_type: string | null
          installment_first_at_signing: boolean | null
          installment_first_payment_amount: number | null
          installment_first_payment_type: string | null
          installment_interval: string | null
          installments_data: string | null
          level_discounts: Json | null
          operating_fee_rate: number | null
          operating_fee_rate_installation: number | null
          operating_fee_rate_print: number | null
          original_end_date: string | null
          original_start_date: string | null
          partnership_data: Json | null
          partnership_operating_data: Json | null
          partnership_operating_fee_rate: number | null
          "Payment 1": Json | null
          "Payment 2": string | null
          "Payment 3": string | null
          payment_status: string | null
          Phone: string | null
          previous_contract_number: number | null
          pricing_mode: string | null
          "Print Status": string | null
          print_cost: number | null
          print_cost_details: Json | null
          print_cost_enabled: string | null
          print_price_per_meter: string | null
          Remaining: string | null
          "Renewal Status": string | null
          single_face_billboards: string | null
          Total: number | null
          "Total Paid": string | null
          "Total Rent": number | null
          total_extension_days: number | null
          use_30_day_month: boolean | null
        }
        Insert: {
          "Ad Type"?: string | null
          base_rent?: number | null
          billboard_id?: number | null
          billboard_ids?: string | null
          billboard_prices?: string | null
          billboards_count?: number | null
          billboards_data?: string | null
          billboards_released?: boolean | null
          Company?: string | null
          "Contract Date"?: string | null
          contract_currency?: string | null
          Contract_Number?: number
          "Customer Name"?: string | null
          customer_category?: string | null
          customer_id?: string | null
          design_data?: Json | null
          Discount?: number | null
          Duration?: string | null
          duration_days?: number | null
          duration_months?: number | null
          "End Date"?: string | null
          exchange_rate?: string | null
          fee?: string | null
          friend_rental_data?: Json | null
          friend_rental_includes_installation?: boolean | null
          friend_rental_operating_fee_enabled?: boolean | null
          friend_rental_operating_fee_rate?: number | null
          id?: number
          include_installation_in_price?: boolean
          include_operating_in_installation?: boolean | null
          include_operating_in_print?: boolean | null
          include_print_in_billboard_price?: boolean
          installation_cost?: number | null
          installation_enabled?: boolean | null
          installment_auto_calculate?: boolean | null
          installment_count?: number | null
          installment_distribution_type?: string | null
          installment_first_at_signing?: boolean | null
          installment_first_payment_amount?: number | null
          installment_first_payment_type?: string | null
          installment_interval?: string | null
          installments_data?: string | null
          level_discounts?: Json | null
          operating_fee_rate?: number | null
          operating_fee_rate_installation?: number | null
          operating_fee_rate_print?: number | null
          original_end_date?: string | null
          original_start_date?: string | null
          partnership_data?: Json | null
          partnership_operating_data?: Json | null
          partnership_operating_fee_rate?: number | null
          "Payment 1"?: Json | null
          "Payment 2"?: string | null
          "Payment 3"?: string | null
          payment_status?: string | null
          Phone?: string | null
          previous_contract_number?: number | null
          pricing_mode?: string | null
          "Print Status"?: string | null
          print_cost?: number | null
          print_cost_details?: Json | null
          print_cost_enabled?: string | null
          print_price_per_meter?: string | null
          Remaining?: string | null
          "Renewal Status"?: string | null
          single_face_billboards?: string | null
          Total?: number | null
          "Total Paid"?: string | null
          "Total Rent"?: number | null
          total_extension_days?: number | null
          use_30_day_month?: boolean | null
        }
        Update: {
          "Ad Type"?: string | null
          base_rent?: number | null
          billboard_id?: number | null
          billboard_ids?: string | null
          billboard_prices?: string | null
          billboards_count?: number | null
          billboards_data?: string | null
          billboards_released?: boolean | null
          Company?: string | null
          "Contract Date"?: string | null
          contract_currency?: string | null
          Contract_Number?: number
          "Customer Name"?: string | null
          customer_category?: string | null
          customer_id?: string | null
          design_data?: Json | null
          Discount?: number | null
          Duration?: string | null
          duration_days?: number | null
          duration_months?: number | null
          "End Date"?: string | null
          exchange_rate?: string | null
          fee?: string | null
          friend_rental_data?: Json | null
          friend_rental_includes_installation?: boolean | null
          friend_rental_operating_fee_enabled?: boolean | null
          friend_rental_operating_fee_rate?: number | null
          id?: number
          include_installation_in_price?: boolean
          include_operating_in_installation?: boolean | null
          include_operating_in_print?: boolean | null
          include_print_in_billboard_price?: boolean
          installation_cost?: number | null
          installation_enabled?: boolean | null
          installment_auto_calculate?: boolean | null
          installment_count?: number | null
          installment_distribution_type?: string | null
          installment_first_at_signing?: boolean | null
          installment_first_payment_amount?: number | null
          installment_first_payment_type?: string | null
          installment_interval?: string | null
          installments_data?: string | null
          level_discounts?: Json | null
          operating_fee_rate?: number | null
          operating_fee_rate_installation?: number | null
          operating_fee_rate_print?: number | null
          original_end_date?: string | null
          original_start_date?: string | null
          partnership_data?: Json | null
          partnership_operating_data?: Json | null
          partnership_operating_fee_rate?: number | null
          "Payment 1"?: Json | null
          "Payment 2"?: string | null
          "Payment 3"?: string | null
          payment_status?: string | null
          Phone?: string | null
          previous_contract_number?: number | null
          pricing_mode?: string | null
          "Print Status"?: string | null
          print_cost?: number | null
          print_cost_details?: Json | null
          print_cost_enabled?: string | null
          print_price_per_meter?: string | null
          Remaining?: string | null
          "Renewal Status"?: string | null
          single_face_billboards?: string | null
          Total?: number | null
          "Total Paid"?: string | null
          "Total Rent"?: number | null
          total_extension_days?: number | null
          use_30_day_month?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_contract_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financial_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "fk_contract_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financials"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "fk_contract_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_borrowed_billboards: {
        Row: {
          billboard_id: number
          borrow_days: number
          borrower_contract_id: number
          compensated: boolean
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          notes: string | null
          source_contract_id: number
          start_date: string
        }
        Insert: {
          billboard_id: number
          borrow_days: number
          borrower_contract_id: number
          compensated?: boolean
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          notes?: string | null
          source_contract_id: number
          start_date: string
        }
        Update: {
          billboard_id?: number
          borrow_days?: number
          borrower_contract_id?: number
          compensated?: boolean
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          notes?: string | null
          source_contract_id?: number
          start_date?: string
        }
        Relationships: []
      }
      contract_expenses: {
        Row: {
          amount: number
          contract_number: number
          created_at: string
          expense_type: string
          id: string
          item_name: string | null
          notes: string | null
          quantity: number
          reason: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          amount?: number
          contract_number: number
          created_at?: string
          expense_type: string
          id?: string
          item_name?: string | null
          notes?: string | null
          quantity?: number
          reason: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          contract_number?: number
          created_at?: string
          expense_type?: string
          id?: string
          item_name?: string | null
          notes?: string | null
          quantity?: number
          reason?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_contract_expenses_contract"
            columns: ["contract_number"]
            isOneToOne: false
            referencedRelation: "Contract"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "fk_contract_expenses_contract"
            columns: ["contract_number"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "fk_contract_expenses_contract"
            columns: ["contract_number"]
            isOneToOne: false
            referencedRelation: "contract_summary"
            referencedColumns: ["Contract_Number"]
          },
        ]
      }
      contract_history: {
        Row: {
          action: string
          change_summary: string | null
          changed_by: string | null
          contract_number: number
          created_at: string
          id: string
          snapshot: Json
        }
        Insert: {
          action: string
          change_summary?: string | null
          changed_by?: string | null
          contract_number: number
          created_at?: string
          id?: string
          snapshot: Json
        }
        Update: {
          action?: string
          change_summary?: string | null
          changed_by?: string | null
          contract_number?: number
          created_at?: string
          id?: string
          snapshot?: Json
        }
        Relationships: []
      }
      contract_template_settings: {
        Row: {
          background_url: string | null
          created_at: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          background_url?: string | null
          created_at?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string | null
        }
        Update: {
          background_url?: string | null
          created_at?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      contract_terms: {
        Row: {
          created_at: string
          font_size: number | null
          font_weight: string | null
          id: string
          is_active: boolean
          position_x: number | null
          position_y: number | null
          term_content: string
          term_key: string
          term_order: number
          term_title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          font_size?: number | null
          font_weight?: string | null
          id?: string
          is_active?: boolean
          position_x?: number | null
          position_y?: number | null
          term_content: string
          term_key: string
          term_order?: number
          term_title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          font_size?: number | null
          font_weight?: string | null
          id?: string
          is_active?: boolean
          position_x?: number | null
          position_y?: number | null
          term_content?: string
          term_key?: string
          term_order?: number
          term_title?: string
          updated_at?: string
        }
        Relationships: []
      }
      custody_accounts: {
        Row: {
          account_number: string
          assigned_date: string
          closed_date: string | null
          created_at: string | null
          current_balance: number
          custody_name: string | null
          employee_id: string
          id: string
          initial_amount: number
          notes: string | null
          source_payment_id: string | null
          source_type: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          account_number: string
          assigned_date?: string
          closed_date?: string | null
          created_at?: string | null
          current_balance?: number
          custody_name?: string | null
          employee_id: string
          id?: string
          initial_amount?: number
          notes?: string | null
          source_payment_id?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          account_number?: string
          assigned_date?: string
          closed_date?: string | null
          created_at?: string | null
          current_balance?: number
          custody_name?: string | null
          employee_id?: string
          id?: string
          initial_amount?: number
          notes?: string | null
          source_payment_id?: string | null
          source_type?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custody_accounts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      custody_expenses: {
        Row: {
          amount: number
          created_at: string | null
          custody_account_id: string
          description: string
          expense_category: string
          expense_date: string
          id: string
          notes: string | null
          receipt_image_path: string | null
          receipt_image_url: string | null
          receipt_number: string | null
          updated_at: string | null
          vendor_name: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          custody_account_id: string
          description: string
          expense_category: string
          expense_date?: string
          id?: string
          notes?: string | null
          receipt_image_path?: string | null
          receipt_image_url?: string | null
          receipt_number?: string | null
          updated_at?: string | null
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          custody_account_id?: string
          description?: string
          expense_category?: string
          expense_date?: string
          id?: string
          notes?: string | null
          receipt_image_path?: string | null
          receipt_image_url?: string | null
          receipt_number?: string | null
          updated_at?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custody_expenses_custody_account_id_fkey"
            columns: ["custody_account_id"]
            isOneToOne: false
            referencedRelation: "custody_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      custody_transactions: {
        Row: {
          amount: number
          created_at: string | null
          custody_account_id: string
          description: string | null
          id: string
          notes: string | null
          receipt_number: string | null
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          custody_account_id: string
          description?: string | null
          id?: string
          notes?: string | null
          receipt_number?: string | null
          transaction_date?: string
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          custody_account_id?: string
          description?: string | null
          id?: string
          notes?: string | null
          receipt_number?: string | null
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "custody_transactions_custody_account_id_fkey"
            columns: ["custody_account_id"]
            isOneToOne: false
            referencedRelation: "custody_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_general_discounts: {
        Row: {
          applied_date: string
          created_at: string
          customer_id: string
          discount_type: string
          discount_value: number
          id: string
          reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          applied_date?: string
          created_at?: string
          customer_id: string
          discount_type: string
          discount_value?: number
          id?: string
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          applied_date?: string
          created_at?: string
          customer_id?: string
          discount_type?: string
          discount_value?: number
          id?: string
          reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_general_discounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financial_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_general_discounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financials"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_general_discounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payments: {
        Row: {
          amount: number
          collected_via_intermediary: boolean | null
          collection_date: string | null
          collector_name: string | null
          commission_notes: string | null
          composite_task_id: string | null
          contract_number: number | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          delivery_location: string | null
          destination_bank: string | null
          distributed_payment_id: string | null
          entry_type: string | null
          id: string
          intermediary_commission: number | null
          method: string | null
          net_amount: number | null
          notes: string | null
          paid_at: string
          printed_invoice_id: string | null
          purchase_invoice_id: string | null
          receiver_name: string | null
          reference: string | null
          sales_invoice_id: string | null
          source_bank: string | null
          transfer_fee: number | null
          transfer_image_url: string | null
          transfer_reference: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          collected_via_intermediary?: boolean | null
          collection_date?: string | null
          collector_name?: string | null
          commission_notes?: string | null
          composite_task_id?: string | null
          contract_number?: number | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          delivery_location?: string | null
          destination_bank?: string | null
          distributed_payment_id?: string | null
          entry_type?: string | null
          id?: string
          intermediary_commission?: number | null
          method?: string | null
          net_amount?: number | null
          notes?: string | null
          paid_at?: string
          printed_invoice_id?: string | null
          purchase_invoice_id?: string | null
          receiver_name?: string | null
          reference?: string | null
          sales_invoice_id?: string | null
          source_bank?: string | null
          transfer_fee?: number | null
          transfer_image_url?: string | null
          transfer_reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          collected_via_intermediary?: boolean | null
          collection_date?: string | null
          collector_name?: string | null
          commission_notes?: string | null
          composite_task_id?: string | null
          contract_number?: number | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          delivery_location?: string | null
          destination_bank?: string | null
          distributed_payment_id?: string | null
          entry_type?: string | null
          id?: string
          intermediary_commission?: number | null
          method?: string | null
          net_amount?: number | null
          notes?: string | null
          paid_at?: string
          printed_invoice_id?: string | null
          purchase_invoice_id?: string | null
          receiver_name?: string | null
          reference?: string | null
          sales_invoice_id?: string | null
          source_bank?: string | null
          transfer_fee?: number | null
          transfer_image_url?: string | null
          transfer_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_payments_composite_task_id_fkey"
            columns: ["composite_task_id"]
            isOneToOne: false
            referencedRelation: "composite_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financial_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financials"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_printed_invoice_id_fkey"
            columns: ["printed_invoice_id"]
            isOneToOne: false
            referencedRelation: "print_invoices_standalone"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_printed_invoice_id_fkey"
            columns: ["printed_invoice_id"]
            isOneToOne: false
            referencedRelation: "printed_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_sales_invoice_id_fkey"
            columns: ["sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_purchases: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_name: string | null
          id: string
          item_name: string
          notes: string | null
          purchase_date: string
          quantity: number
          total_price: number | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          item_name: string
          notes?: string | null
          purchase_date?: string
          quantity?: number
          total_price?: number | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          item_name?: string
          notes?: string | null
          purchase_date?: string
          quantity?: number
          total_price?: number | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_purchases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financial_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_purchases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financials"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_purchases_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          company: string | null
          contracts_count: number | null
          created_at: string | null
          email: string | null
          first_contract_date: string | null
          id: string
          is_customer: boolean | null
          is_supplier: boolean | null
          last_contract_date: string | null
          last_payment_date: string | null
          linked_friend_company_id: string | null
          name: string
          phone: string | null
          pricing_category: string | null
          printer_id: string | null
          supplier_type: string | null
          total_rent: number | null
          updated_at: string | null
        }
        Insert: {
          company?: string | null
          contracts_count?: number | null
          created_at?: string | null
          email?: string | null
          first_contract_date?: string | null
          id?: string
          is_customer?: boolean | null
          is_supplier?: boolean | null
          last_contract_date?: string | null
          last_payment_date?: string | null
          linked_friend_company_id?: string | null
          name: string
          phone?: string | null
          pricing_category?: string | null
          printer_id?: string | null
          supplier_type?: string | null
          total_rent?: number | null
          updated_at?: string | null
        }
        Update: {
          company?: string | null
          contracts_count?: number | null
          created_at?: string | null
          email?: string | null
          first_contract_date?: string | null
          id?: string
          is_customer?: boolean | null
          is_supplier?: boolean | null
          last_contract_date?: string | null
          last_payment_date?: string | null
          linked_friend_company_id?: string | null
          name?: string
          phone?: string | null
          pricing_category?: string | null
          printer_id?: string | null
          supplier_type?: string | null
          total_rent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_linked_friend_company_id_fkey"
            columns: ["linked_friend_company_id"]
            isOneToOne: false
            referencedRelation: "friend_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_linked_friend_company_id_fkey"
            columns: ["linked_friend_company_id"]
            isOneToOne: false
            referencedRelation: "friend_company_financials"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "customers_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printer_accounts"
            referencedColumns: ["printer_id"]
          },
          {
            foreignKeyName: "customers_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
        ]
      }
      cutout_task_items: {
        Row: {
          billboard_id: number | null
          created_at: string
          cutout_image_url: string | null
          description: string | null
          faces_count: number | null
          id: string
          notes: string | null
          quantity: number
          status: string
          task_id: string
          total_cost: number
          unit_cost: number
        }
        Insert: {
          billboard_id?: number | null
          created_at?: string
          cutout_image_url?: string | null
          description?: string | null
          faces_count?: number | null
          id?: string
          notes?: string | null
          quantity?: number
          status?: string
          task_id: string
          total_cost?: number
          unit_cost?: number
        }
        Update: {
          billboard_id?: number | null
          created_at?: string
          cutout_image_url?: string | null
          description?: string | null
          faces_count?: number | null
          id?: string
          notes?: string | null
          quantity?: number
          status?: string
          task_id?: string
          total_cost?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "cutout_task_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "cutout_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      cutout_tasks: {
        Row: {
          completed_at: string | null
          contract_id: number | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          customer_total_amount: number | null
          due_date: string | null
          id: string
          installation_task_id: string | null
          invoice_id: string | null
          is_composite: boolean | null
          notes: string | null
          printer_id: string | null
          priority: string
          status: string
          total_cost: number
          total_quantity: number
          unit_cost: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          contract_id?: number | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_total_amount?: number | null
          due_date?: string | null
          id?: string
          installation_task_id?: string | null
          invoice_id?: string | null
          is_composite?: boolean | null
          notes?: string | null
          printer_id?: string | null
          priority?: string
          status?: string
          total_cost?: number
          total_quantity?: number
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          contract_id?: number | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_total_amount?: number | null
          due_date?: string | null
          id?: string
          installation_task_id?: string | null
          invoice_id?: string | null
          is_composite?: boolean | null
          notes?: string | null
          printer_id?: string | null
          priority?: string
          status?: string
          total_cost?: number
          total_quantity?: number
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cutout_tasks_installation_task_id_fkey"
            columns: ["installation_task_id"]
            isOneToOne: false
            referencedRelation: "installation_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cutout_tasks_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "print_invoices_standalone"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cutout_tasks_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "printed_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cutout_tasks_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printer_accounts"
            referencedColumns: ["printer_id"]
          },
          {
            foreignKeyName: "cutout_tasks_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
        ]
      }
      cutout_workshops: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      distribution_items: {
        Row: {
          billboard_id: number
          created_at: string
          distribution_id: string
          id: string
          is_random: boolean
          municipality_group: string | null
          partner: string
          site_group: string | null
          size_group: string | null
          swap_count: number
        }
        Insert: {
          billboard_id: number
          created_at?: string
          distribution_id: string
          id?: string
          is_random?: boolean
          municipality_group?: string | null
          partner: string
          site_group?: string | null
          size_group?: string | null
          swap_count?: number
        }
        Update: {
          billboard_id?: number
          created_at?: string
          distribution_id?: string
          id?: string
          is_random?: boolean
          municipality_group?: string | null
          partner?: string
          site_group?: string | null
          size_group?: string | null
          swap_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "distribution_items_distribution_id_fkey"
            columns: ["distribution_id"]
            isOneToOne: false
            referencedRelation: "distributions"
            referencedColumns: ["id"]
          },
        ]
      }
      distributions: {
        Row: {
          ad_type_filter: string | null
          city_filter: string | null
          created_at: string
          distance_threshold: number
          id: string
          is_active: boolean
          municipality_filter: string | null
          name: string
          partner_a_count: number
          partner_a_name: string
          partner_b_count: number
          partner_b_name: string
          partner_counts: Json | null
          partner_names: Json | null
          random_seed: string | null
          size_filter: string
          status_filter: string | null
          total_billboards: number
          updated_at: string
        }
        Insert: {
          ad_type_filter?: string | null
          city_filter?: string | null
          created_at?: string
          distance_threshold?: number
          id?: string
          is_active?: boolean
          municipality_filter?: string | null
          name: string
          partner_a_count?: number
          partner_a_name?: string
          partner_b_count?: number
          partner_b_name?: string
          partner_counts?: Json | null
          partner_names?: Json | null
          random_seed?: string | null
          size_filter: string
          status_filter?: string | null
          total_billboards?: number
          updated_at?: string
        }
        Update: {
          ad_type_filter?: string | null
          city_filter?: string | null
          created_at?: string
          distance_threshold?: number
          id?: string
          is_active?: boolean
          municipality_filter?: string | null
          name?: string
          partner_a_count?: number
          partner_a_name?: string
          partner_b_count?: number
          partner_b_name?: string
          partner_counts?: Json | null
          partner_names?: Json | null
          random_seed?: string | null
          size_filter?: string
          status_filter?: string | null
          total_billboards?: number
          updated_at?: string
        }
        Relationships: []
      }
      employee_advances: {
        Row: {
          amount: number
          created_at: string
          distributed_payment_id: string | null
          employee_id: string
          id: string
          reason: string | null
          remaining: number
          request_date: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          distributed_payment_id?: string | null
          employee_id: string
          id?: string
          reason?: string | null
          remaining?: number
          request_date?: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          distributed_payment_id?: string | null
          employee_id?: string
          id?: string
          reason?: string | null
          remaining?: number
          request_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_advances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_contracts: {
        Row: {
          basic_salary: number
          created_at: string
          employee_id: string
          end_date: string | null
          housing_allowance: number | null
          id: string
          notes: string | null
          other_allowance: number | null
          overtime_rate: number | null
          social_security_pct: number | null
          start_date: string
          status: string
          tax_pct: number | null
          transport_allowance: number | null
          updated_at: string
        }
        Insert: {
          basic_salary?: number
          created_at?: string
          employee_id: string
          end_date?: string | null
          housing_allowance?: number | null
          id?: string
          notes?: string | null
          other_allowance?: number | null
          overtime_rate?: number | null
          social_security_pct?: number | null
          start_date: string
          status?: string
          tax_pct?: number | null
          transport_allowance?: number | null
          updated_at?: string
        }
        Update: {
          basic_salary?: number
          created_at?: string
          employee_id?: string
          end_date?: string | null
          housing_allowance?: number | null
          id?: string
          notes?: string | null
          other_allowance?: number | null
          overtime_rate?: number | null
          social_security_pct?: number | null
          start_date?: string
          status?: string
          tax_pct?: number | null
          transport_allowance?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_contracts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_credit_entries: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string
          employee_id: string
          entry_date: string
          entry_type: string
          expense_id: string | null
          id: string
          notes: string | null
          payment_method: string | null
          reference_number: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          balance_after?: number
          created_at?: string
          description: string
          employee_id: string
          entry_date?: string
          entry_type?: string
          expense_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          reference_number?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string
          employee_id?: string
          entry_date?: string
          entry_type?: string
          expense_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          reference_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_credit_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_credit_entries_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_deductions: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          notes: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          date?: string
          employee_id: string
          id?: string
          notes?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_deductions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_manual_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          operating_cost: number
          status: string
          task_date: string
          task_description: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          operating_cost?: number
          status?: string
          task_date?: string
          task_description: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          operating_cost?: number
          status?: string
          task_date?: string
          task_description?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_manual_tasks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          bank_account: string | null
          bank_name: string | null
          base_salary: number
          code: string | null
          created_at: string
          department: string | null
          email: string | null
          hire_date: string | null
          hourly_rate: number | null
          iban: string | null
          id: string
          installation_team_id: string | null
          linked_to_operating_expenses: boolean | null
          name: string
          national_id: string | null
          phone: string | null
          position: string | null
          salary_type: string
          status: string
          updated_at: string
        }
        Insert: {
          bank_account?: string | null
          bank_name?: string | null
          base_salary?: number
          code?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          iban?: string | null
          id?: string
          installation_team_id?: string | null
          linked_to_operating_expenses?: boolean | null
          name: string
          national_id?: string | null
          phone?: string | null
          position?: string | null
          salary_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          bank_account?: string | null
          bank_name?: string | null
          base_salary?: number
          code?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          hire_date?: string | null
          hourly_rate?: number | null
          iban?: string | null
          id?: string
          installation_team_id?: string | null
          linked_to_operating_expenses?: boolean | null
          name?: string
          national_id?: string | null
          phone?: string | null
          position?: string | null
          salary_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_installation_team_id_fkey"
            columns: ["installation_team_id"]
            isOneToOne: true
            referencedRelation: "installation_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_billboard_reservations: {
        Row: {
          billboard_id: string
          created_at: string
          end_date: string
          event_contract_id: string
          id: string
          start_date: string
          status: string
        }
        Insert: {
          billboard_id: string
          created_at?: string
          end_date: string
          event_contract_id: string
          id?: string
          start_date: string
          status?: string
        }
        Update: {
          billboard_id?: string
          created_at?: string
          end_date?: string
          event_contract_id?: string
          id?: string
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_billboard_reservations_event_contract_id_fkey"
            columns: ["event_contract_id"]
            isOneToOne: false
            referencedRelation: "event_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      event_contract_billboards: {
        Row: {
          billboard_id: string
          billboard_name: string | null
          created_at: string
          daily_price: number
          event_contract_id: string
          id: string
          total_price: number
        }
        Insert: {
          billboard_id: string
          billboard_name?: string | null
          created_at?: string
          daily_price?: number
          event_contract_id: string
          id?: string
          total_price?: number
        }
        Update: {
          billboard_id?: string
          billboard_name?: string | null
          created_at?: string
          daily_price?: number
          event_contract_id?: string
          id?: string
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_contract_billboards_event_contract_id_fkey"
            columns: ["event_contract_id"]
            isOneToOne: false
            referencedRelation: "event_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      event_contracts: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string
          discount_amount: number
          end_date: string
          event_contract_number: string
          event_name: string
          event_type: string | null
          id: string
          notes: string | null
          paid_amount: number
          start_date: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name: string
          discount_amount?: number
          end_date: string
          event_contract_number?: string
          event_name: string
          event_type?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number
          start_date: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string
          discount_amount?: number
          end_date?: string
          event_contract_number?: string
          event_name?: string
          event_type?: string | null
          id?: string
          notes?: string | null
          paid_amount?: number
          start_date?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          code: string | null
          color: string | null
          description: string | null
          id: number
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          color?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          color?: string | null
          description?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      expense_payments: {
        Row: {
          amount: number
          created_at: string
          distributed_payment_id: string | null
          expense_id: string
          id: string
          notes: string | null
          paid_at: string
          paid_via: string
          payment_source: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          distributed_payment_id?: string | null
          expense_id: string
          id?: string
          notes?: string | null
          paid_at?: string
          paid_via: string
          payment_source?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          distributed_payment_id?: string | null
          expense_id?: string
          id?: string
          notes?: string | null
          paid_at?: string
          paid_via?: string
          payment_source?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_payments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          category_id: number | null
          created_at: string | null
          description: string
          employee_id: string | null
          expense_date: string
          id: string
          notes: string | null
          paid_amount: number
          paid_by_distributed_payment_id: string | null
          paid_date: string | null
          paid_via: string | null
          payment_method: string | null
          payment_source: string | null
          payment_status: string
          receipt_number: string | null
          receiver_name: string | null
          sender_name: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          category: string
          category_id?: number | null
          created_at?: string | null
          description: string
          employee_id?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          paid_amount?: number
          paid_by_distributed_payment_id?: string | null
          paid_date?: string | null
          paid_via?: string | null
          payment_method?: string | null
          payment_source?: string | null
          payment_status?: string
          receipt_number?: string | null
          receiver_name?: string | null
          sender_name?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category?: string
          category_id?: number | null
          created_at?: string | null
          description?: string
          employee_id?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          paid_amount?: number
          paid_by_distributed_payment_id?: string | null
          paid_date?: string | null
          paid_via?: string | null
          payment_method?: string | null
          payment_source?: string | null
          payment_status?: string
          receipt_number?: string | null
          receiver_name?: string | null
          sender_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses_flags: {
        Row: {
          contract_id: string
          created_at: string | null
          excluded: boolean | null
          id: number
          updated_at: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          excluded?: boolean | null
          id?: number
          updated_at?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          excluded?: boolean | null
          id?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      expenses_withdrawals: {
        Row: {
          amount: number
          contract_id: number | null
          created_at: string | null
          date: string | null
          distributed_payment_id: string | null
          fee_percentage: number | null
          id: number
          method: string | null
          note: string | null
          notes: string | null
          receiver_name: string | null
          sender_name: string | null
          type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number
          contract_id?: number | null
          created_at?: string | null
          date?: string | null
          distributed_payment_id?: string | null
          fee_percentage?: number | null
          id?: number
          method?: string | null
          note?: string | null
          notes?: string | null
          receiver_name?: string | null
          sender_name?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          contract_id?: number | null
          created_at?: string | null
          date?: string | null
          distributed_payment_id?: string | null
          fee_percentage?: number | null
          id?: number
          method?: string | null
          note?: string | null
          notes?: string | null
          receiver_name?: string | null
          sender_name?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      export_city_images: {
        Row: {
          city_name: string
          created_at: string
          id: string
          image_url: string
          is_active: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          city_name?: string
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          city_name?: string
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      export_company_images: {
        Row: {
          company_name: string
          created_at: string
          id: string
          image_url: string
          is_active: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          company_name?: string
          created_at?: string
          id?: string
          image_url: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          company_name?: string
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      export_pricing: {
        Row: {
          "2_months": number
          "3_months": number
          "6_months": number
          billboard_level: string
          created_at: string
          customer_category: string
          full_year: number
          id: number
          one_day: number
          one_month: number
          size: string
          updated_at: string
        }
        Insert: {
          "2_months"?: number
          "3_months"?: number
          "6_months"?: number
          billboard_level?: string
          created_at?: string
          customer_category?: string
          full_year?: number
          id?: number
          one_day?: number
          one_month?: number
          size: string
          updated_at?: string
        }
        Update: {
          "2_months"?: number
          "3_months"?: number
          "6_months"?: number
          billboard_level?: string
          created_at?: string
          customer_category?: string
          full_year?: number
          id?: number
          one_day?: number
          one_month?: number
          size?: string
          updated_at?: string
        }
        Relationships: []
      }
      export_slides: {
        Row: {
          created_at: string
          id: string
          image_url: string
          is_active: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          is_active?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      field_photos: {
        Row: {
          bucket_url: string | null
          captured_at: string | null
          created_at: string | null
          device_make: string | null
          device_model: string | null
          direction_degrees: number | null
          file_name: string
          file_path: string
          focal_length: number | null
          id: string
          lat: number | null
          linked_billboard_id: number | null
          lng: number | null
          notes: string | null
          orbit_radius_meters: number | null
          user_id: string | null
          zoom_ratio: number | null
        }
        Insert: {
          bucket_url?: string | null
          captured_at?: string | null
          created_at?: string | null
          device_make?: string | null
          device_model?: string | null
          direction_degrees?: number | null
          file_name: string
          file_path: string
          focal_length?: number | null
          id?: string
          lat?: number | null
          linked_billboard_id?: number | null
          lng?: number | null
          notes?: string | null
          orbit_radius_meters?: number | null
          user_id?: string | null
          zoom_ratio?: number | null
        }
        Update: {
          bucket_url?: string | null
          captured_at?: string | null
          created_at?: string | null
          device_make?: string | null
          device_model?: string | null
          direction_degrees?: number | null
          file_name?: string
          file_path?: string
          focal_length?: number | null
          id?: string
          lat?: number | null
          linked_billboard_id?: number | null
          lng?: number | null
          notes?: string | null
          orbit_radius_meters?: number | null
          user_id?: string | null
          zoom_ratio?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "field_photos_linked_billboard_id_fkey"
            columns: ["linked_billboard_id"]
            isOneToOne: false
            referencedRelation: "billboard_partnership_status"
            referencedColumns: ["billboard_id"]
          },
          {
            foreignKeyName: "field_photos_linked_billboard_id_fkey"
            columns: ["linked_billboard_id"]
            isOneToOne: false
            referencedRelation: "billboards"
            referencedColumns: ["ID"]
          },
          {
            foreignKeyName: "field_photos_linked_billboard_id_fkey"
            columns: ["linked_billboard_id"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["billboard_id"]
          },
        ]
      }
      friend_billboard_rentals: {
        Row: {
          billboard_id: number
          contract_number: number
          created_at: string
          customer_rental_price: number
          end_date: string
          friend_company_id: string
          friend_rental_cost: number
          id: string
          notes: string | null
          profit: number | null
          selectable_for_payment: boolean | null
          start_date: string
          updated_at: string
          used_as_payment: number | null
        }
        Insert: {
          billboard_id: number
          contract_number: number
          created_at?: string
          customer_rental_price?: number
          end_date: string
          friend_company_id: string
          friend_rental_cost?: number
          id?: string
          notes?: string | null
          profit?: number | null
          selectable_for_payment?: boolean | null
          start_date: string
          updated_at?: string
          used_as_payment?: number | null
        }
        Update: {
          billboard_id?: number
          contract_number?: number
          created_at?: string
          customer_rental_price?: number
          end_date?: string
          friend_company_id?: string
          friend_rental_cost?: number
          id?: string
          notes?: string | null
          profit?: number | null
          selectable_for_payment?: boolean | null
          start_date?: string
          updated_at?: string
          used_as_payment?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_friend_rentals_billboard"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboard_partnership_status"
            referencedColumns: ["billboard_id"]
          },
          {
            foreignKeyName: "fk_friend_rentals_billboard"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboards"
            referencedColumns: ["ID"]
          },
          {
            foreignKeyName: "fk_friend_rentals_billboard"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["billboard_id"]
          },
          {
            foreignKeyName: "fk_friend_rentals_company"
            columns: ["friend_company_id"]
            isOneToOne: false
            referencedRelation: "friend_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_friend_rentals_company"
            columns: ["friend_company_id"]
            isOneToOne: false
            referencedRelation: "friend_company_financials"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "fk_friend_rentals_contract"
            columns: ["contract_number"]
            isOneToOne: false
            referencedRelation: "Contract"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "fk_friend_rentals_contract"
            columns: ["contract_number"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "fk_friend_rentals_contract"
            columns: ["contract_number"]
            isOneToOne: false
            referencedRelation: "contract_summary"
            referencedColumns: ["Contract_Number"]
          },
        ]
      }
      friend_companies: {
        Row: {
          brand_color: string | null
          company_type: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          brand_color?: string | null
          company_type?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          brand_color?: string | null
          company_type?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      image_cache: {
        Row: {
          base64_data: string
          created_at: string | null
          field_name: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          original_url: string
          table_name: string | null
        }
        Insert: {
          base64_data: string
          created_at?: string | null
          field_name?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          original_url: string
          table_name?: string | null
        }
        Update: {
          base64_data?: string
          created_at?: string | null
          field_name?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          original_url?: string
          table_name?: string | null
        }
        Relationships: []
      }
      installation_photo_history: {
        Row: {
          archived_at: string
          billboard_id: number
          fallback_path_installed_a: string | null
          fallback_path_installed_b: string | null
          id: string
          installation_date: string | null
          installed_image_face_a_url: string | null
          installed_image_face_b_url: string | null
          notes: string | null
          reinstall_number: number
          task_id: string
          task_item_id: string
        }
        Insert: {
          archived_at?: string
          billboard_id: number
          fallback_path_installed_a?: string | null
          fallback_path_installed_b?: string | null
          id?: string
          installation_date?: string | null
          installed_image_face_a_url?: string | null
          installed_image_face_b_url?: string | null
          notes?: string | null
          reinstall_number?: number
          task_id: string
          task_item_id: string
        }
        Update: {
          archived_at?: string
          billboard_id?: number
          fallback_path_installed_a?: string | null
          fallback_path_installed_b?: string | null
          id?: string
          installation_date?: string | null
          installed_image_face_a_url?: string | null
          installed_image_face_b_url?: string | null
          notes?: string | null
          reinstall_number?: number
          task_id?: string
          task_item_id?: string
        }
        Relationships: []
      }
      installation_print_pricing: {
        Row: {
          created_at: string
          id: string
          install_price: number
          print_price: number
          size: string
          size_id: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          install_price?: number
          print_price?: number
          size: string
          size_id?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          install_price?: number
          print_price?: number
          size?: string
          size_id?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installation_print_pricing_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "sizes"
            referencedColumns: ["id"]
          },
        ]
      }
      installation_task_items: {
        Row: {
          additional_cost: number | null
          additional_cost_notes: string | null
          billboard_id: number
          company_additional_cost: number | null
          company_additional_cost_notes: string | null
          company_installation_cost: number | null
          completed_at: string | null
          created_at: string
          customer_installation_cost: number | null
          customer_original_install_cost: number | null
          customer_reinstall_cost: number | null
          cutout_company_cost: number | null
          cutout_count: number | null
          cutout_customer_cost: number | null
          cutout_image_url: string | null
          cutout_notes: string | null
          cutout_workshop_id: string | null
          design_face_a: string | null
          design_face_b: string | null
          faces_to_install: number | null
          fallback_path_design_a: string | null
          fallback_path_design_b: string | null
          fallback_path_installed_a: string | null
          fallback_path_installed_b: string | null
          has_cutout: boolean | null
          id: string
          installation_date: string | null
          installed_image_face_a_url: string | null
          installed_image_face_b_url: string | null
          installed_image_url: string | null
          notes: string | null
          price_per_meter: number | null
          pricing_type: string | null
          reinstall_count: number | null
          reinstalled_faces: string | null
          replaced_by_item_id: string | null
          replacement_cost_bearer: string | null
          replacement_cost_percentage: number | null
          replacement_reason: string | null
          replacement_status: string | null
          replaces_item_id: string | null
          selected_design_id: string | null
          status: string
          task_id: string
          total_reinstalled_faces: number | null
        }
        Insert: {
          additional_cost?: number | null
          additional_cost_notes?: string | null
          billboard_id: number
          company_additional_cost?: number | null
          company_additional_cost_notes?: string | null
          company_installation_cost?: number | null
          completed_at?: string | null
          created_at?: string
          customer_installation_cost?: number | null
          customer_original_install_cost?: number | null
          customer_reinstall_cost?: number | null
          cutout_company_cost?: number | null
          cutout_count?: number | null
          cutout_customer_cost?: number | null
          cutout_image_url?: string | null
          cutout_notes?: string | null
          cutout_workshop_id?: string | null
          design_face_a?: string | null
          design_face_b?: string | null
          faces_to_install?: number | null
          fallback_path_design_a?: string | null
          fallback_path_design_b?: string | null
          fallback_path_installed_a?: string | null
          fallback_path_installed_b?: string | null
          has_cutout?: boolean | null
          id?: string
          installation_date?: string | null
          installed_image_face_a_url?: string | null
          installed_image_face_b_url?: string | null
          installed_image_url?: string | null
          notes?: string | null
          price_per_meter?: number | null
          pricing_type?: string | null
          reinstall_count?: number | null
          reinstalled_faces?: string | null
          replaced_by_item_id?: string | null
          replacement_cost_bearer?: string | null
          replacement_cost_percentage?: number | null
          replacement_reason?: string | null
          replacement_status?: string | null
          replaces_item_id?: string | null
          selected_design_id?: string | null
          status?: string
          task_id: string
          total_reinstalled_faces?: number | null
        }
        Update: {
          additional_cost?: number | null
          additional_cost_notes?: string | null
          billboard_id?: number
          company_additional_cost?: number | null
          company_additional_cost_notes?: string | null
          company_installation_cost?: number | null
          completed_at?: string | null
          created_at?: string
          customer_installation_cost?: number | null
          customer_original_install_cost?: number | null
          customer_reinstall_cost?: number | null
          cutout_company_cost?: number | null
          cutout_count?: number | null
          cutout_customer_cost?: number | null
          cutout_image_url?: string | null
          cutout_notes?: string | null
          cutout_workshop_id?: string | null
          design_face_a?: string | null
          design_face_b?: string | null
          faces_to_install?: number | null
          fallback_path_design_a?: string | null
          fallback_path_design_b?: string | null
          fallback_path_installed_a?: string | null
          fallback_path_installed_b?: string | null
          has_cutout?: boolean | null
          id?: string
          installation_date?: string | null
          installed_image_face_a_url?: string | null
          installed_image_face_b_url?: string | null
          installed_image_url?: string | null
          notes?: string | null
          price_per_meter?: number | null
          pricing_type?: string | null
          reinstall_count?: number | null
          reinstalled_faces?: string | null
          replaced_by_item_id?: string | null
          replacement_cost_bearer?: string | null
          replacement_cost_percentage?: number | null
          replacement_reason?: string | null
          replacement_status?: string | null
          replaces_item_id?: string | null
          selected_design_id?: string | null
          status?: string
          task_id?: string
          total_reinstalled_faces?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "installation_task_items_billboard_fk"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboard_partnership_status"
            referencedColumns: ["billboard_id"]
          },
          {
            foreignKeyName: "installation_task_items_billboard_fk"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboards"
            referencedColumns: ["ID"]
          },
          {
            foreignKeyName: "installation_task_items_billboard_fk"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["billboard_id"]
          },
          {
            foreignKeyName: "installation_task_items_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboard_partnership_status"
            referencedColumns: ["billboard_id"]
          },
          {
            foreignKeyName: "installation_task_items_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboards"
            referencedColumns: ["ID"]
          },
          {
            foreignKeyName: "installation_task_items_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["billboard_id"]
          },
          {
            foreignKeyName: "installation_task_items_cutout_workshop_id_fkey"
            columns: ["cutout_workshop_id"]
            isOneToOne: false
            referencedRelation: "cutout_workshops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installation_task_items_replaced_by_item_id_fkey"
            columns: ["replaced_by_item_id"]
            isOneToOne: false
            referencedRelation: "installation_task_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installation_task_items_replaces_item_id_fkey"
            columns: ["replaces_item_id"]
            isOneToOne: false
            referencedRelation: "installation_task_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installation_task_items_selected_design_id_fkey"
            columns: ["selected_design_id"]
            isOneToOne: false
            referencedRelation: "task_designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installation_task_items_task_fk"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "installation_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installation_task_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "installation_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      installation_tasks: {
        Row: {
          contract_id: number
          contract_ids: number[] | null
          created_at: string
          cutout_task_id: string | null
          default_price_per_meter: number | null
          default_pricing_type: string | null
          id: string
          print_task_id: string | null
          reinstallation_number: number | null
          status: string
          task_type: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          contract_id: number
          contract_ids?: number[] | null
          created_at?: string
          cutout_task_id?: string | null
          default_price_per_meter?: number | null
          default_pricing_type?: string | null
          id?: string
          print_task_id?: string | null
          reinstallation_number?: number | null
          status?: string
          task_type?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          contract_id?: number
          contract_ids?: number[] | null
          created_at?: string
          cutout_task_id?: string | null
          default_price_per_meter?: number | null
          default_pricing_type?: string | null
          id?: string
          print_task_id?: string | null
          reinstallation_number?: number | null
          status?: string
          task_type?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installation_tasks_contract_fk"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "Contract"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "installation_tasks_contract_fk"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "installation_tasks_contract_fk"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract_summary"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "installation_tasks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "Contract"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "installation_tasks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "installation_tasks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract_summary"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "installation_tasks_cutout_task_id_fkey"
            columns: ["cutout_task_id"]
            isOneToOne: false
            referencedRelation: "cutout_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installation_tasks_print_task_id_fkey"
            columns: ["print_task_id"]
            isOneToOne: false
            referencedRelation: "print_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installation_tasks_team_fk"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "installation_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installation_tasks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "installation_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      installation_team_accounts: {
        Row: {
          amount: number
          billboard_id: number
          contract_id: number
          created_at: string
          id: string
          installation_date: string
          notes: string | null
          status: string
          task_item_id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          billboard_id: number
          contract_id: number
          created_at?: string
          id?: string
          installation_date: string
          notes?: string | null
          status?: string
          task_item_id: string
          team_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          billboard_id?: number
          contract_id?: number
          created_at?: string
          id?: string
          installation_date?: string
          notes?: string | null
          status?: string
          task_item_id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installation_team_accounts_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboard_partnership_status"
            referencedColumns: ["billboard_id"]
          },
          {
            foreignKeyName: "installation_team_accounts_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboards"
            referencedColumns: ["ID"]
          },
          {
            foreignKeyName: "installation_team_accounts_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["billboard_id"]
          },
          {
            foreignKeyName: "installation_team_accounts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "Contract"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "installation_team_accounts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "installation_team_accounts_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract_summary"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "installation_team_accounts_task_item_id_fkey"
            columns: ["task_item_id"]
            isOneToOne: true
            referencedRelation: "installation_task_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installation_team_accounts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "installation_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      installation_teams: {
        Row: {
          cities: string[] | null
          created_at: string
          friend_company_id: string | null
          friend_company_ids: string[] | null
          id: string
          phone_number: string | null
          priority: number
          sizes: string[]
          team_name: string
          updated_at: string
        }
        Insert: {
          cities?: string[] | null
          created_at?: string
          friend_company_id?: string | null
          friend_company_ids?: string[] | null
          id?: string
          phone_number?: string | null
          priority?: number
          sizes?: string[]
          team_name: string
          updated_at?: string
        }
        Update: {
          cities?: string[] | null
          created_at?: string
          friend_company_id?: string | null
          friend_company_ids?: string[] | null
          id?: string
          phone_number?: string | null
          priority?: number
          sizes?: string[]
          team_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "installation_teams_friend_company_id_fkey"
            columns: ["friend_company_id"]
            isOneToOne: false
            referencedRelation: "friend_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installation_teams_friend_company_id_fkey"
            columns: ["friend_company_id"]
            isOneToOne: false
            referencedRelation: "friend_company_financials"
            referencedColumns: ["company_id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          billboard_id: number
          created_at: string | null
          days_count: number | null
          description: string
          end_date: string | null
          id: string
          invoice_id: string | null
          quantity: number | null
          start_date: string | null
          total_price: number | null
          unit_price: number
        }
        Insert: {
          billboard_id: number
          created_at?: string | null
          days_count?: number | null
          description: string
          end_date?: string | null
          id?: string
          invoice_id?: string | null
          quantity?: number | null
          start_date?: string | null
          total_price?: number | null
          unit_price: number
        }
        Update: {
          billboard_id?: number
          created_at?: string | null
          days_count?: number | null
          description?: string
          end_date?: string | null
          id?: string
          invoice_id?: string | null
          quantity?: number | null
          start_date?: string | null
          total_price?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          billboard_ids: number[]
          contract_number: number | null
          created_at: string | null
          customer_id: string | null
          discount_amount: number | null
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          payment_terms: string | null
          status: string | null
          subtotal: number
          tax_amount: number | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          billboard_ids: number[]
          contract_number?: number | null
          created_at?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          payment_terms?: string | null
          status?: string | null
          subtotal: number
          tax_amount?: number | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          billboard_ids?: number[]
          contract_number?: number | null
          created_at?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          payment_terms?: string | null
          status?: string | null
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financial_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financials"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: number
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      maintenance_history: {
        Row: {
          billboard_id: number | null
          cost: number | null
          created_at: string | null
          description: string | null
          id: string
          maintenance_date: string
          maintenance_type: string
          priority: string | null
          status: string | null
          technician_name: string | null
          updated_at: string | null
        }
        Insert: {
          billboard_id?: number | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          maintenance_date?: string
          maintenance_type: string
          priority?: string | null
          status?: string | null
          technician_name?: string | null
          updated_at?: string | null
        }
        Update: {
          billboard_id?: number | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          maintenance_date?: string
          maintenance_type?: string
          priority?: string | null
          status?: string | null
          technician_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_history_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboard_partnership_status"
            referencedColumns: ["billboard_id"]
          },
          {
            foreignKeyName: "maintenance_history_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboards"
            referencedColumns: ["ID"]
          },
          {
            foreignKeyName: "maintenance_history_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["billboard_id"]
          },
        ]
      }
      maintenance_statuses: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          label: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          label: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          label?: string
          name?: string
        }
        Relationships: []
      }
      management_phones: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string | null
          phone_number: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          phone_number: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          phone_number?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      messaging_api_settings: {
        Row: {
          api_key: string | null
          api_secret: string | null
          bot_token: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          phone_number: string | null
          platform: string
          updated_at: string | null
        }
        Insert: {
          api_key?: string | null
          api_secret?: string | null
          bot_token?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          phone_number?: string | null
          platform: string
          updated_at?: string | null
        }
        Update: {
          api_key?: string | null
          api_secret?: string | null
          bot_token?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          phone_number?: string | null
          platform?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      messaging_settings: {
        Row: {
          id: string
          updated_at: string | null
          updated_by: string | null
          whatsapp_bridge_url: string | null
          whatsapp_provider: string
          wppconnect_bridge_url: string | null
        }
        Insert: {
          id?: string
          updated_at?: string | null
          updated_by?: string | null
          whatsapp_bridge_url?: string | null
          whatsapp_provider?: string
          wppconnect_bridge_url?: string | null
        }
        Update: {
          id?: string
          updated_at?: string | null
          updated_by?: string | null
          whatsapp_bridge_url?: string | null
          whatsapp_provider?: string
          wppconnect_bridge_url?: string | null
        }
        Relationships: []
      }
      municipalities: {
        Row: {
          code: string
          created_at: string
          id: string
          logo_url: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      municipality_collection_items: {
        Row: {
          billboard_id: number | null
          billboard_name: string | null
          collection_id: string
          created_at: string
          design_face_a: string | null
          design_face_b: string | null
          faces_count: string | null
          id: string
          image_url: string | null
          item_type: string
          latitude: number | null
          location_text: string | null
          longitude: number | null
          nearest_landmark: string | null
          sequence_number: number
          size: string
          status: string | null
          updated_at: string
        }
        Insert: {
          billboard_id?: number | null
          billboard_name?: string | null
          collection_id: string
          created_at?: string
          design_face_a?: string | null
          design_face_b?: string | null
          faces_count?: string | null
          id?: string
          image_url?: string | null
          item_type?: string
          latitude?: number | null
          location_text?: string | null
          longitude?: number | null
          nearest_landmark?: string | null
          sequence_number: number
          size: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          billboard_id?: number | null
          billboard_name?: string | null
          collection_id?: string
          created_at?: string
          design_face_a?: string | null
          design_face_b?: string | null
          faces_count?: string | null
          id?: string
          image_url?: string | null
          item_type?: string
          latitude?: number | null
          location_text?: string | null
          longitude?: number | null
          nearest_landmark?: string | null
          sequence_number?: number
          size?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "municipality_collection_items_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboard_partnership_status"
            referencedColumns: ["billboard_id"]
          },
          {
            foreignKeyName: "municipality_collection_items_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboards"
            referencedColumns: ["ID"]
          },
          {
            foreignKeyName: "municipality_collection_items_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["billboard_id"]
          },
          {
            foreignKeyName: "municipality_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "municipality_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      municipality_collections: {
        Row: {
          city: string | null
          created_at: string
          default_size: string | null
          description: string | null
          id: string
          municipality_name: string | null
          name: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          default_size?: string | null
          description?: string | null
          id?: string
          municipality_name?: string | null
          name?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          default_size?: string | null
          description?: string | null
          id?: string
          municipality_name?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      municipality_factors: {
        Row: {
          created_at: string
          description: string | null
          factor: number
          id: string
          is_active: boolean | null
          municipality_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          factor?: number
          id?: string
          is_active?: boolean | null
          municipality_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          factor?: number
          id?: string
          is_active?: boolean | null
          municipality_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      municipality_rent_prices: {
        Row: {
          created_at: string
          currency: string | null
          id: string
          is_active: boolean | null
          municipality_name: string
          notes: string | null
          price_per_meter: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean | null
          municipality_name: string
          notes?: string | null
          price_per_meter?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean | null
          municipality_name?: string
          notes?: string | null
          price_per_meter?: number
          updated_at?: string
        }
        Relationships: []
      }
      municipality_stickers_settings: {
        Row: {
          color_settings: Json | null
          created_at: string
          element_positions: Json | null
          element_visibility: Json | null
          font_settings: Json | null
          id: string
          max_number: number | null
          phone_number: string | null
          reserve_count: number | null
          setting_name: string
          size_configs: Json | null
          unified_size_height: number | null
          unified_size_width: number | null
          updated_at: string
          use_unified_size: boolean | null
          user_id: string | null
        }
        Insert: {
          color_settings?: Json | null
          created_at?: string
          element_positions?: Json | null
          element_visibility?: Json | null
          font_settings?: Json | null
          id?: string
          max_number?: number | null
          phone_number?: string | null
          reserve_count?: number | null
          setting_name?: string
          size_configs?: Json | null
          unified_size_height?: number | null
          unified_size_width?: number | null
          updated_at?: string
          use_unified_size?: boolean | null
          user_id?: string | null
        }
        Update: {
          color_settings?: Json | null
          created_at?: string
          element_positions?: Json | null
          element_visibility?: Json | null
          font_settings?: Json | null
          id?: string
          max_number?: number | null
          phone_number?: string | null
          reserve_count?: number | null
          setting_name?: string
          size_configs?: Json | null
          unified_size_height?: number | null
          unified_size_width?: number | null
          updated_at?: string
          use_unified_size?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      offers: {
        Row: {
          ad_type: string | null
          billboard_prices: Json | null
          billboards_count: number | null
          billboards_data: Json | null
          converted_contract_number: number | null
          created_at: string | null
          currency: string | null
          customer_id: string | null
          customer_name: string
          discount: number | null
          discount_percentage: number | null
          discount_type: string | null
          duration_months: number
          end_date: string | null
          exchange_rate: number | null
          id: string
          include_installation_in_price: boolean | null
          include_print_in_billboard_price: boolean | null
          installation_cost: number | null
          installation_details: Json | null
          installation_enabled: boolean | null
          installments_data: Json | null
          installment_auto_calculate: boolean | null
          installment_count: number | null
          installment_first_at_signing: boolean | null
          installment_first_payment_amount: number | null
          installment_first_payment_type: string | null
          installment_distribution_type: string | null
          installment_interval: string | null
          level_discounts: Json | null
          notes: string | null
          offer_number: number
          operating_fee: number | null
          operating_fee_rate: number | null
          pricing_category: string | null
          print_cost: number | null
          print_cost_enabled: boolean | null
          print_details: Json | null
          print_price_per_meter: number | null
          selected_boards: Json | null
          single_face_billboards: string | null
          start_date: string
          status: string | null
          total: number | null
          updated_at: string | null
        }
        Insert: {
          ad_type?: string | null
          billboard_prices?: Json | null
          billboards_count?: number | null
          billboards_data?: Json | null
          converted_contract_number?: number | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          customer_name: string
          discount?: number | null
          discount_percentage?: number | null
          discount_type?: string | null
          duration_months?: number
          end_date?: string | null
          exchange_rate?: number | null
          id?: string
          include_installation_in_price?: boolean | null
          include_print_in_billboard_price?: boolean | null
          installation_cost?: number | null
          installation_details?: Json | null
          installation_enabled?: boolean | null
          installments_data?: Json | null
          installment_auto_calculate?: boolean | null
          installment_count?: number | null
          installment_first_at_signing?: boolean | null
          installment_first_payment_amount?: number | null
          installment_first_payment_type?: string | null
          installment_distribution_type?: string | null
          installment_interval?: string | null
          level_discounts?: Json | null
          notes?: string | null
          offer_number?: number
          operating_fee?: number | null
          operating_fee_rate?: number | null
          pricing_category?: string | null
          print_cost?: number | null
          print_cost_enabled?: boolean | null
          print_details?: Json | null
          print_price_per_meter?: number | null
          selected_boards?: Json | null
          single_face_billboards?: string | null
          start_date: string
          status?: string | null
          total?: number | null
          updated_at?: string | null
        }
        Update: {
          ad_type?: string | null
          billboard_prices?: Json | null
          billboards_count?: number | null
          billboards_data?: Json | null
          converted_contract_number?: number | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          customer_name?: string
          discount?: number | null
          discount_percentage?: number | null
          discount_type?: string | null
          duration_months?: number
          end_date?: string | null
          exchange_rate?: number | null
          id?: string
          include_installation_in_price?: boolean | null
          include_print_in_billboard_price?: boolean | null
          installation_cost?: number | null
          installation_details?: Json | null
          installation_enabled?: boolean | null
          installments_data?: Json | null
          installment_auto_calculate?: boolean | null
          installment_count?: number | null
          installment_first_at_signing?: boolean | null
          installment_first_payment_amount?: number | null
          installment_first_payment_type?: string | null
          installment_distribution_type?: string | null
          installment_interval?: string | null
          level_discounts?: Json | null
          notes?: string | null
          offer_number?: number
          operating_fee?: number | null
          operating_fee_rate?: number | null
          pricing_category?: string | null
          print_cost?: number | null
          print_cost_enabled?: boolean | null
          print_details?: Json | null
          print_price_per_meter?: number | null
          selected_boards?: Json | null
          single_face_billboards?: string | null
          start_date?: string
          status?: string | null
          total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financial_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "offers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financials"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "offers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string | null
          default_capital_contribution: number
          default_partner_post_pct: number
          default_partner_pre_pct: number
          email: string | null
          id: string
          name: string
          notes: string | null
          partnership_percentage: number | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string | null
          default_capital_contribution?: number
          default_partner_post_pct?: number
          default_partner_pre_pct?: number
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          partnership_percentage?: number | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string | null
          default_capital_contribution?: number
          default_partner_post_pct?: number
          default_partner_pre_pct?: number
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          partnership_percentage?: number | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      partnership_contract_shares: {
        Row: {
          billboard_id: number
          capital_deduction: number | null
          capital_remaining_after: number | null
          company_share_amount: number | null
          company_share_percentage: number | null
          contract_id: number
          created_at: string
          id: string
          partner_id: string
          partner_name: string | null
          partner_share_amount: number | null
          partner_share_percentage: number | null
          phase: string | null
          rent_amount: number | null
          updated_at: string
        }
        Insert: {
          billboard_id: number
          capital_deduction?: number | null
          capital_remaining_after?: number | null
          company_share_amount?: number | null
          company_share_percentage?: number | null
          contract_id: number
          created_at?: string
          id?: string
          partner_id: string
          partner_name?: string | null
          partner_share_amount?: number | null
          partner_share_percentage?: number | null
          phase?: string | null
          rent_amount?: number | null
          updated_at?: string
        }
        Update: {
          billboard_id?: number
          capital_deduction?: number | null
          capital_remaining_after?: number | null
          company_share_amount?: number | null
          company_share_percentage?: number | null
          contract_id?: number
          created_at?: string
          id?: string
          partner_id?: string
          partner_name?: string | null
          partner_share_amount?: number | null
          partner_share_percentage?: number | null
          phase?: string | null
          rent_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnership_contract_shares_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "Contract"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "partnership_contract_shares_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "partnership_contract_shares_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract_summary"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "partnership_contract_shares_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      paused_billboard_replacements: {
        Row: {
          allocated_amount: number
          contract_number: number
          created_at: string
          end_date: string
          id: string
          notes: string | null
          paused_billboard_id: string
          replacement_billboard_id: number
          replacement_billboard_name: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          allocated_amount?: number
          contract_number: number
          created_at?: string
          end_date: string
          id?: string
          notes?: string | null
          paused_billboard_id: string
          replacement_billboard_id: number
          replacement_billboard_name?: string | null
          start_date: string
          updated_at?: string
        }
        Update: {
          allocated_amount?: number
          contract_number?: number
          created_at?: string
          end_date?: string
          id?: string
          notes?: string | null
          paused_billboard_id?: string
          replacement_billboard_id?: number
          replacement_billboard_name?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paused_billboard_replacements_paused_billboard_id_fkey"
            columns: ["paused_billboard_id"]
            isOneToOne: true
            referencedRelation: "paused_billboards"
            referencedColumns: ["id"]
          },
        ]
      }
      paused_billboards: {
        Row: {
          billboard_id: number
          billboard_name: string | null
          consumed_amount: number
          contract_number: number
          created_at: string
          deducted_from_contract: boolean
          full_price: number | null
          id: string
          manual_refund: number | null
          net_after_discount: number | null
          net_rent: number
          notes: string | null
          original_end_date: string | null
          original_price: number
          original_start_date: string | null
          pause_date: string
          price_before_discount: number | null
          refund_amount: number
          updated_at: string
        }
        Insert: {
          billboard_id: number
          billboard_name?: string | null
          consumed_amount?: number
          contract_number: number
          created_at?: string
          deducted_from_contract?: boolean
          full_price?: number | null
          id?: string
          manual_refund?: number | null
          net_after_discount?: number | null
          net_rent?: number
          notes?: string | null
          original_end_date?: string | null
          original_price?: number
          original_start_date?: string | null
          pause_date: string
          price_before_discount?: number | null
          refund_amount?: number
          updated_at?: string
        }
        Update: {
          billboard_id?: number
          billboard_name?: string | null
          consumed_amount?: number
          contract_number?: number
          created_at?: string
          deducted_from_contract?: boolean
          full_price?: number | null
          id?: string
          manual_refund?: number | null
          net_after_discount?: number | null
          net_rent?: number
          notes?: string | null
          original_end_date?: string | null
          original_price?: number
          original_start_date?: string | null
          pause_date?: string
          price_before_discount?: number | null
          refund_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      payments_salary: {
        Row: {
          amount: number
          employee_id: string
          id: string
          method: string | null
          notes: string | null
          paid_at: string
          payroll_item_id: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          employee_id: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string
          payroll_item_id?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          employee_id?: string
          id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string
          payroll_item_id?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_salary_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_salary_payroll_item_id_fkey"
            columns: ["payroll_item_id"]
            isOneToOne: false
            referencedRelation: "payroll_items"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_items: {
        Row: {
          advances_deduction: number
          allowances: number
          basic_salary: number
          contract_id: string | null
          created_at: string
          deductions: number
          employee_id: string
          id: string
          net_salary: number
          overtime_amount: number | null
          overtime_hours: number | null
          paid: boolean | null
          payment_method: string | null
          payroll_id: string
          social_security: number | null
          tax: number | null
          working_days: number | null
          working_hours: number | null
        }
        Insert: {
          advances_deduction?: number
          allowances?: number
          basic_salary?: number
          contract_id?: string | null
          created_at?: string
          deductions?: number
          employee_id: string
          id?: string
          net_salary?: number
          overtime_amount?: number | null
          overtime_hours?: number | null
          paid?: boolean | null
          payment_method?: string | null
          payroll_id: string
          social_security?: number | null
          tax?: number | null
          working_days?: number | null
          working_hours?: number | null
        }
        Update: {
          advances_deduction?: number
          allowances?: number
          basic_salary?: number
          contract_id?: string | null
          created_at?: string
          deductions?: number
          employee_id?: string
          id?: string
          net_salary?: number
          overtime_amount?: number | null
          overtime_hours?: number | null
          paid?: boolean | null
          payment_method?: string | null
          payroll_id?: string
          social_security?: number | null
          tax?: number | null
          working_days?: number | null
          working_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_items_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "employee_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_payroll_id_fkey"
            columns: ["payroll_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_payroll_id_fkey"
            columns: ["payroll_id"]
            isOneToOne: false
            referencedRelation: "payroll_summary"
            referencedColumns: ["payroll_id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          approved_at: string | null
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          status: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: string
        }
        Relationships: []
      }
      period_closures: {
        Row: {
          closure_date: string
          closure_type: string | null
          contract_end: string | null
          contract_start: string | null
          created_at: string | null
          id: number
          is_closed: boolean | null
          notes: string | null
          period_end: string | null
          period_start: string | null
          remaining_balance: number | null
          total_amount: number | null
          total_contracts: number | null
          total_withdrawn: number | null
        }
        Insert: {
          closure_date: string
          closure_type?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string | null
          id?: number
          is_closed?: boolean | null
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          remaining_balance?: number | null
          total_amount?: number | null
          total_contracts?: number | null
          total_withdrawn?: number | null
        }
        Update: {
          closure_date?: string
          closure_type?: string | null
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string | null
          id?: number
          is_closed?: boolean | null
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          remaining_balance?: number | null
          total_amount?: number | null
          total_contracts?: number | null
          total_withdrawn?: number | null
        }
        Relationships: []
      }
      pricing: {
        Row: {
          "2_months": number | null
          "3_months": number | null
          "6_months": number | null
          billboard_level: string
          created_at: string | null
          customer_category: string
          full_year: number | null
          id: number
          one_day: number | null
          one_month: number | null
          size: string
          size_id: number | null
        }
        Insert: {
          "2_months"?: number | null
          "3_months"?: number | null
          "6_months"?: number | null
          billboard_level: string
          created_at?: string | null
          customer_category: string
          full_year?: number | null
          id?: number
          one_day?: number | null
          one_month?: number | null
          size: string
          size_id?: number | null
        }
        Update: {
          "2_months"?: number | null
          "3_months"?: number | null
          "6_months"?: number | null
          billboard_level?: string
          created_at?: string | null
          customer_category?: string
          full_year?: number | null
          id?: number
          one_day?: number | null
          one_month?: number | null
          size?: string
          size_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pricing_level"
            columns: ["billboard_level"]
            isOneToOne: false
            referencedRelation: "billboard_levels"
            referencedColumns: ["level_code"]
          },
          {
            foreignKeyName: "fk_pricing_size"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pricing_size_name"
            columns: ["size"]
            isOneToOne: false
            referencedRelation: "sizes"
            referencedColumns: ["name"]
          },
        ]
      }
      pricing_categories: {
        Row: {
          created_at: string | null
          id: number
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          name: string
        }
        Update: {
          created_at?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      pricing_durations: {
        Row: {
          created_at: string
          days: number
          db_column: string
          id: string
          is_active: boolean
          label: string
          months: number
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          days: number
          db_column: string
          id?: string
          is_active?: boolean
          label: string
          months?: number
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          days?: number
          db_column?: string
          id?: string
          is_active?: boolean
          label?: string
          months?: number
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      print_backgrounds: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          thumbnail_url: string | null
          updated_at: string
          url: string
          usage_count: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          thumbnail_url?: string | null
          updated_at?: string
          url: string
          usage_count?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          thumbnail_url?: string | null
          updated_at?: string
          url?: string
          usage_count?: number | null
        }
        Relationships: []
      }
      print_installation_pricing: {
        Row: {
          billboard_level: string
          created_at: string | null
          customer_category: string
          id: number
          installation_price: number | null
          print_price: number | null
          size: string
        }
        Insert: {
          billboard_level: string
          created_at?: string | null
          customer_category: string
          id?: number
          installation_price?: number | null
          print_price?: number | null
          size: string
        }
        Update: {
          billboard_level?: string
          created_at?: string | null
          customer_category?: string
          id?: number
          installation_price?: number | null
          print_price?: number | null
          size?: string
        }
        Relationships: []
      }
      print_invoice_payments: {
        Row: {
          amount: number
          created_at: string
          customer_id: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          payment_date: string
          payment_method: string | null
          payment_reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          payment_reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          payment_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_invoice_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financial_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "print_invoice_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financials"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "print_invoice_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "print_invoices_standalone"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "printed_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      print_reprints: {
        Row: {
          area: number
          billboard_id: number | null
          cost_type: string
          created_at: string
          customer_charge: number
          defect_image_url: string | null
          face_type: string
          id: string
          notes: string | null
          print_task_item_id: string
          printer_cost: number
          reason: string
          status: string
          task_id: string
          updated_at: string
        }
        Insert: {
          area?: number
          billboard_id?: number | null
          cost_type: string
          created_at?: string
          customer_charge?: number
          defect_image_url?: string | null
          face_type: string
          id?: string
          notes?: string | null
          print_task_item_id: string
          printer_cost?: number
          reason: string
          status?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          area?: number
          billboard_id?: number | null
          cost_type?: string
          created_at?: string
          customer_charge?: number
          defect_image_url?: string | null
          face_type?: string
          id?: string
          notes?: string | null
          print_task_item_id?: string
          printer_cost?: number
          reason?: string
          status?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_reprints_print_task_item_id_fkey"
            columns: ["print_task_item_id"]
            isOneToOne: false
            referencedRelation: "print_task_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_reprints_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "print_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      print_settings: {
        Row: {
          accent_color: string | null
          background_image: string | null
          background_opacity: number | null
          body_font_size: number | null
          border_radius: number | null
          border_width: number | null
          company_address: string | null
          company_email: string | null
          company_name: string | null
          company_phone: string | null
          company_subtitle: string | null
          company_subtitle_color: string | null
          company_tax_id: string | null
          company_website: string | null
          created_at: string | null
          customer_section_bg_color: string | null
          customer_section_border_color: string | null
          customer_section_title: string | null
          customer_text_color: string | null
          date_format: string | null
          direction: string | null
          document_info_alignment: string | null
          document_info_bg_color: string | null
          document_info_margin_top: number | null
          document_info_text_color: string | null
          document_title_alignment: string | null
          document_title_ar: string | null
          document_title_en: string | null
          document_title_margin_top: number | null
          document_type: string
          font_family: string | null
          footer_alignment: string | null
          footer_text: string | null
          footer_text_color: string | null
          header_alignment: string | null
          header_bg_color: string | null
          header_direction: string | null
          header_font_size: number | null
          header_margin_bottom: number | null
          header_style: string | null
          header_swap: boolean | null
          header_text_color: string | null
          id: string
          logo_path: string | null
          logo_position: string | null
          logo_position_order: number | null
          logo_size: number | null
          logo_size_preset: string | null
          page_margin_bottom: number | null
          page_margin_left: number | null
          page_margin_right: number | null
          page_margin_top: number | null
          primary_color: string | null
          secondary_color: string | null
          show_company_address: boolean | null
          show_company_contact: boolean | null
          show_company_name: boolean | null
          show_company_subtitle: boolean | null
          show_customer_section: boolean | null
          show_document_date: boolean | null
          show_document_number: boolean | null
          show_email: boolean | null
          show_footer: boolean | null
          show_hijri_date: boolean | null
          show_logo: boolean | null
          show_page_number: boolean | null
          show_tax_id: boolean | null
          show_website: boolean | null
          summary_bg_color: string | null
          summary_border_color: string | null
          summary_text_color: string | null
          table_body_font_size: number | null
          table_body_padding: string | null
          table_body_row_height: number | null
          table_border_color: string | null
          table_border_radius: number | null
          table_border_style: string | null
          table_border_width: number | null
          table_header_bg_color: string | null
          table_header_font_size: number | null
          table_header_font_weight: string | null
          table_header_height: number | null
          table_header_padding: string | null
          table_header_text_color: string | null
          table_line_height: string | null
          table_row_even_color: string | null
          table_row_odd_color: string | null
          table_text_color: string | null
          title_font_size: number | null
          totals_box_bg_color: string | null
          totals_box_border_color: string | null
          totals_box_border_radius: number | null
          totals_box_text_color: string | null
          totals_title_font_size: number | null
          totals_value_font_size: number | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          background_image?: string | null
          background_opacity?: number | null
          body_font_size?: number | null
          border_radius?: number | null
          border_width?: number | null
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_subtitle?: string | null
          company_subtitle_color?: string | null
          company_tax_id?: string | null
          company_website?: string | null
          created_at?: string | null
          customer_section_bg_color?: string | null
          customer_section_border_color?: string | null
          customer_section_title?: string | null
          customer_text_color?: string | null
          date_format?: string | null
          direction?: string | null
          document_info_alignment?: string | null
          document_info_bg_color?: string | null
          document_info_margin_top?: number | null
          document_info_text_color?: string | null
          document_title_alignment?: string | null
          document_title_ar?: string | null
          document_title_en?: string | null
          document_title_margin_top?: number | null
          document_type: string
          font_family?: string | null
          footer_alignment?: string | null
          footer_text?: string | null
          footer_text_color?: string | null
          header_alignment?: string | null
          header_bg_color?: string | null
          header_direction?: string | null
          header_font_size?: number | null
          header_margin_bottom?: number | null
          header_style?: string | null
          header_swap?: boolean | null
          header_text_color?: string | null
          id?: string
          logo_path?: string | null
          logo_position?: string | null
          logo_position_order?: number | null
          logo_size?: number | null
          logo_size_preset?: string | null
          page_margin_bottom?: number | null
          page_margin_left?: number | null
          page_margin_right?: number | null
          page_margin_top?: number | null
          primary_color?: string | null
          secondary_color?: string | null
          show_company_address?: boolean | null
          show_company_contact?: boolean | null
          show_company_name?: boolean | null
          show_company_subtitle?: boolean | null
          show_customer_section?: boolean | null
          show_document_date?: boolean | null
          show_document_number?: boolean | null
          show_email?: boolean | null
          show_footer?: boolean | null
          show_hijri_date?: boolean | null
          show_logo?: boolean | null
          show_page_number?: boolean | null
          show_tax_id?: boolean | null
          show_website?: boolean | null
          summary_bg_color?: string | null
          summary_border_color?: string | null
          summary_text_color?: string | null
          table_body_font_size?: number | null
          table_body_padding?: string | null
          table_body_row_height?: number | null
          table_border_color?: string | null
          table_border_radius?: number | null
          table_border_style?: string | null
          table_border_width?: number | null
          table_header_bg_color?: string | null
          table_header_font_size?: number | null
          table_header_font_weight?: string | null
          table_header_height?: number | null
          table_header_padding?: string | null
          table_header_text_color?: string | null
          table_line_height?: string | null
          table_row_even_color?: string | null
          table_row_odd_color?: string | null
          table_text_color?: string | null
          title_font_size?: number | null
          totals_box_bg_color?: string | null
          totals_box_border_color?: string | null
          totals_box_border_radius?: number | null
          totals_box_text_color?: string | null
          totals_title_font_size?: number | null
          totals_value_font_size?: number | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          background_image?: string | null
          background_opacity?: number | null
          body_font_size?: number | null
          border_radius?: number | null
          border_width?: number | null
          company_address?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_subtitle?: string | null
          company_subtitle_color?: string | null
          company_tax_id?: string | null
          company_website?: string | null
          created_at?: string | null
          customer_section_bg_color?: string | null
          customer_section_border_color?: string | null
          customer_section_title?: string | null
          customer_text_color?: string | null
          date_format?: string | null
          direction?: string | null
          document_info_alignment?: string | null
          document_info_bg_color?: string | null
          document_info_margin_top?: number | null
          document_info_text_color?: string | null
          document_title_alignment?: string | null
          document_title_ar?: string | null
          document_title_en?: string | null
          document_title_margin_top?: number | null
          document_type?: string
          font_family?: string | null
          footer_alignment?: string | null
          footer_text?: string | null
          footer_text_color?: string | null
          header_alignment?: string | null
          header_bg_color?: string | null
          header_direction?: string | null
          header_font_size?: number | null
          header_margin_bottom?: number | null
          header_style?: string | null
          header_swap?: boolean | null
          header_text_color?: string | null
          id?: string
          logo_path?: string | null
          logo_position?: string | null
          logo_position_order?: number | null
          logo_size?: number | null
          logo_size_preset?: string | null
          page_margin_bottom?: number | null
          page_margin_left?: number | null
          page_margin_right?: number | null
          page_margin_top?: number | null
          primary_color?: string | null
          secondary_color?: string | null
          show_company_address?: boolean | null
          show_company_contact?: boolean | null
          show_company_name?: boolean | null
          show_company_subtitle?: boolean | null
          show_customer_section?: boolean | null
          show_document_date?: boolean | null
          show_document_number?: boolean | null
          show_email?: boolean | null
          show_footer?: boolean | null
          show_hijri_date?: boolean | null
          show_logo?: boolean | null
          show_page_number?: boolean | null
          show_tax_id?: boolean | null
          show_website?: boolean | null
          summary_bg_color?: string | null
          summary_border_color?: string | null
          summary_text_color?: string | null
          table_body_font_size?: number | null
          table_body_padding?: string | null
          table_body_row_height?: number | null
          table_border_color?: string | null
          table_border_radius?: number | null
          table_border_style?: string | null
          table_border_width?: number | null
          table_header_bg_color?: string | null
          table_header_font_size?: number | null
          table_header_font_weight?: string | null
          table_header_height?: number | null
          table_header_padding?: string | null
          table_header_text_color?: string | null
          table_line_height?: string | null
          table_row_even_color?: string | null
          table_row_odd_color?: string | null
          table_text_color?: string | null
          title_font_size?: number | null
          totals_box_bg_color?: string | null
          totals_box_border_color?: string | null
          totals_box_border_radius?: number | null
          totals_box_text_color?: string | null
          totals_title_font_size?: number | null
          totals_value_font_size?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      print_task_items: {
        Row: {
          area: number | null
          billboard_id: number | null
          created_at: string
          customer_cutout_cost: number | null
          customer_total_cost: number | null
          customer_total_price: number | null
          customer_unit_cost: number | null
          customer_unit_price: number | null
          cutout_image_url: string | null
          cutout_quantity: number | null
          defect_image_url: string | null
          description: string | null
          design_face_a: string | null
          design_face_b: string | null
          faces_count: number | null
          has_cutout: boolean | null
          height: number | null
          id: string
          model_link: string | null
          printer_cutout_cost: number | null
          printer_unit_cost: number | null
          quantity: number | null
          status: string
          task_id: string
          total_cost: number | null
          unit_cost: number | null
          width: number | null
        }
        Insert: {
          area?: number | null
          billboard_id?: number | null
          created_at?: string
          customer_cutout_cost?: number | null
          customer_total_cost?: number | null
          customer_total_price?: number | null
          customer_unit_cost?: number | null
          customer_unit_price?: number | null
          cutout_image_url?: string | null
          cutout_quantity?: number | null
          defect_image_url?: string | null
          description?: string | null
          design_face_a?: string | null
          design_face_b?: string | null
          faces_count?: number | null
          has_cutout?: boolean | null
          height?: number | null
          id?: string
          model_link?: string | null
          printer_cutout_cost?: number | null
          printer_unit_cost?: number | null
          quantity?: number | null
          status?: string
          task_id: string
          total_cost?: number | null
          unit_cost?: number | null
          width?: number | null
        }
        Update: {
          area?: number | null
          billboard_id?: number | null
          created_at?: string
          customer_cutout_cost?: number | null
          customer_total_cost?: number | null
          customer_total_price?: number | null
          customer_unit_cost?: number | null
          customer_unit_price?: number | null
          cutout_image_url?: string | null
          cutout_quantity?: number | null
          defect_image_url?: string | null
          description?: string | null
          design_face_a?: string | null
          design_face_b?: string | null
          faces_count?: number | null
          has_cutout?: boolean | null
          height?: number | null
          id?: string
          model_link?: string | null
          printer_cutout_cost?: number | null
          printer_unit_cost?: number | null
          quantity?: number | null
          status?: string
          task_id?: string
          total_cost?: number | null
          unit_cost?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "print_task_items_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboard_partnership_status"
            referencedColumns: ["billboard_id"]
          },
          {
            foreignKeyName: "print_task_items_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "billboards"
            referencedColumns: ["ID"]
          },
          {
            foreignKeyName: "print_task_items_billboard_id_fkey"
            columns: ["billboard_id"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["billboard_id"]
          },
          {
            foreignKeyName: "print_task_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "print_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      print_tasks: {
        Row: {
          completed_at: string | null
          composite_task_id: string | null
          contract_id: number | null
          created_at: string
          customer_cost_per_meter: number | null
          customer_cutout_cost: number | null
          customer_cutout_price: number | null
          customer_cutout_total: number | null
          customer_id: string | null
          customer_name: string | null
          customer_price_per_meter: number | null
          customer_total_amount: number | null
          customer_total_cost: number | null
          cutout_cost: number | null
          cutout_image_url: string | null
          cutout_printer_id: string | null
          cutout_quantity: number | null
          due_date: string | null
          has_cutouts: boolean | null
          id: string
          installation_task_id: string | null
          invoice_id: string | null
          is_composite: boolean | null
          notes: string | null
          price_per_meter: number | null
          printer_cost_per_meter: number | null
          printer_cutout_cost: number | null
          printer_id: string | null
          printer_total_cost: number | null
          priority: string | null
          status: string
          total_area: number | null
          total_cost: number | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          composite_task_id?: string | null
          contract_id?: number | null
          created_at?: string
          customer_cost_per_meter?: number | null
          customer_cutout_cost?: number | null
          customer_cutout_price?: number | null
          customer_cutout_total?: number | null
          customer_id?: string | null
          customer_name?: string | null
          customer_price_per_meter?: number | null
          customer_total_amount?: number | null
          customer_total_cost?: number | null
          cutout_cost?: number | null
          cutout_image_url?: string | null
          cutout_printer_id?: string | null
          cutout_quantity?: number | null
          due_date?: string | null
          has_cutouts?: boolean | null
          id?: string
          installation_task_id?: string | null
          invoice_id?: string | null
          is_composite?: boolean | null
          notes?: string | null
          price_per_meter?: number | null
          printer_cost_per_meter?: number | null
          printer_cutout_cost?: number | null
          printer_id?: string | null
          printer_total_cost?: number | null
          priority?: string | null
          status?: string
          total_area?: number | null
          total_cost?: number | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          composite_task_id?: string | null
          contract_id?: number | null
          created_at?: string
          customer_cost_per_meter?: number | null
          customer_cutout_cost?: number | null
          customer_cutout_price?: number | null
          customer_cutout_total?: number | null
          customer_id?: string | null
          customer_name?: string | null
          customer_price_per_meter?: number | null
          customer_total_amount?: number | null
          customer_total_cost?: number | null
          cutout_cost?: number | null
          cutout_image_url?: string | null
          cutout_printer_id?: string | null
          cutout_quantity?: number | null
          due_date?: string | null
          has_cutouts?: boolean | null
          id?: string
          installation_task_id?: string | null
          invoice_id?: string | null
          is_composite?: boolean | null
          notes?: string | null
          price_per_meter?: number | null
          printer_cost_per_meter?: number | null
          printer_cutout_cost?: number | null
          printer_id?: string | null
          printer_total_cost?: number | null
          priority?: string | null
          status?: string
          total_area?: number | null
          total_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_tasks_composite_task_id_fkey"
            columns: ["composite_task_id"]
            isOneToOne: false
            referencedRelation: "composite_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_tasks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "Contract"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "print_tasks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "print_tasks_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract_summary"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "print_tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financial_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "print_tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financials"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "print_tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_tasks_cutout_printer_id_fkey"
            columns: ["cutout_printer_id"]
            isOneToOne: false
            referencedRelation: "printer_accounts"
            referencedColumns: ["printer_id"]
          },
          {
            foreignKeyName: "print_tasks_cutout_printer_id_fkey"
            columns: ["cutout_printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_tasks_installation_task_id_fkey"
            columns: ["installation_task_id"]
            isOneToOne: false
            referencedRelation: "installation_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_tasks_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "print_invoices_standalone"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_tasks_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "printed_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_tasks_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printer_accounts"
            referencedColumns: ["printer_id"]
          },
          {
            foreignKeyName: "print_tasks_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
        ]
      }
      printed_invoices: {
        Row: {
          account_deduction: number | null
          account_payments_deducted: string | null
          composite_task_id: string | null
          contract_number: number
          contract_numbers: string | null
          cost_allocation: Json | null
          created_at: string
          currency_code: string | null
          currency_symbol: string | null
          "currency_symbol'": string | null
          customer_id: string | null
          customer_name: string | null
          design_face_a_path: string | null
          design_face_b_path: string | null
          discount: number | null
          discount_amount: number | null
          discount_reason: string | null
          discount_type: string | null
          id: string
          include_account_balance: boolean | null
          included_in_contract: boolean | null
          invoice_date: string
          invoice_number: string
          invoice_type: string | null
          items: Json | null
          locked: boolean
          notes: string | null
          paid: boolean | null
          paid_amount: number | null
          paid_at: string | null
          payment_method: string | null
          print_items: string | null
          printer_cost: number | null
          printer_id: string | null
          printer_name: string
          subtotal: number | null
          total: number | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          account_deduction?: number | null
          account_payments_deducted?: string | null
          composite_task_id?: string | null
          contract_number: number
          contract_numbers?: string | null
          cost_allocation?: Json | null
          created_at?: string
          currency_code?: string | null
          currency_symbol?: string | null
          "currency_symbol'"?: string | null
          customer_id?: string | null
          customer_name?: string | null
          design_face_a_path?: string | null
          design_face_b_path?: string | null
          discount?: number | null
          discount_amount?: number | null
          discount_reason?: string | null
          discount_type?: string | null
          id?: string
          include_account_balance?: boolean | null
          included_in_contract?: boolean | null
          invoice_date?: string
          invoice_number: string
          invoice_type?: string | null
          items?: Json | null
          locked?: boolean
          notes?: string | null
          paid?: boolean | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          print_items?: string | null
          printer_cost?: number | null
          printer_id?: string | null
          printer_name: string
          subtotal?: number | null
          total?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          account_deduction?: number | null
          account_payments_deducted?: string | null
          composite_task_id?: string | null
          contract_number?: number
          contract_numbers?: string | null
          cost_allocation?: Json | null
          created_at?: string
          currency_code?: string | null
          currency_symbol?: string | null
          "currency_symbol'"?: string | null
          customer_id?: string | null
          customer_name?: string | null
          design_face_a_path?: string | null
          design_face_b_path?: string | null
          discount?: number | null
          discount_amount?: number | null
          discount_reason?: string | null
          discount_type?: string | null
          id?: string
          include_account_balance?: boolean | null
          included_in_contract?: boolean | null
          invoice_date?: string
          invoice_number?: string
          invoice_type?: string | null
          items?: Json | null
          locked?: boolean
          notes?: string | null
          paid?: boolean | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          print_items?: string | null
          printer_cost?: number | null
          printer_id?: string | null
          printer_name?: string
          subtotal?: number | null
          total?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_invoices_contract_number_fkey"
            columns: ["contract_number"]
            isOneToOne: false
            referencedRelation: "Contract"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "print_invoices_contract_number_fkey"
            columns: ["contract_number"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "print_invoices_contract_number_fkey"
            columns: ["contract_number"]
            isOneToOne: false
            referencedRelation: "contract_summary"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "print_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financial_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "print_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financials"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "print_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printed_invoices_composite_task_id_fkey"
            columns: ["composite_task_id"]
            isOneToOne: false
            referencedRelation: "composite_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printed_invoices_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printer_accounts"
            referencedColumns: ["printer_id"]
          },
          {
            foreignKeyName: "printed_invoices_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
        ]
      }
      printer_payments: {
        Row: {
          amount: number
          created_at: string
          cutout_task_id: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: string
          print_task_id: string | null
          printer_id: string
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          cutout_task_id?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          print_task_id?: string | null
          printer_id: string
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          cutout_task_id?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          print_task_id?: string | null
          printer_id?: string
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "printer_payments_cutout_task_id_fkey"
            columns: ["cutout_task_id"]
            isOneToOne: false
            referencedRelation: "cutout_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_payments_print_task_id_fkey"
            columns: ["print_task_id"]
            isOneToOne: false
            referencedRelation: "print_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_payments_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printer_accounts"
            referencedColumns: ["printer_id"]
          },
          {
            foreignKeyName: "printer_payments_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
        ]
      }
      printers: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          allowed_clients: string[] | null
          allowed_customers: string[] | null
          approved: boolean | null
          approved_at: string | null
          approved_by: string | null
          company: string | null
          created_at: string | null
          email: string | null
          id: string
          linked_customer_id: string | null
          name: string | null
          phone: string | null
          price_tier: string | null
          pricing_category: string | null
          role: string | null
          status: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          allowed_clients?: string[] | null
          allowed_customers?: string[] | null
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          linked_customer_id?: string | null
          name?: string | null
          phone?: string | null
          price_tier?: string | null
          pricing_category?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          allowed_clients?: string[] | null
          allowed_customers?: string[] | null
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          linked_customer_id?: string | null
          name?: string | null
          phone?: string | null
          price_tier?: string | null
          pricing_category?: string | null
          role?: string | null
          status?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_linked_customer_id_fkey"
            columns: ["linked_customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financial_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "profiles_linked_customer_id_fkey"
            columns: ["linked_customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financials"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "profiles_linked_customer_id_fkey"
            columns: ["linked_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoice_items: {
        Row: {
          created_at: string
          depth: number | null
          height: number | null
          id: string
          image_url: string | null
          invoice_id: string
          item_name: string
          quantity: number
          total_price: number
          unit: string | null
          unit_price: number
          width: number | null
        }
        Insert: {
          created_at?: string
          depth?: number | null
          height?: number | null
          id?: string
          image_url?: string | null
          invoice_id: string
          item_name: string
          quantity?: number
          total_price?: number
          unit?: string | null
          unit_price?: number
          width?: number | null
        }
        Update: {
          created_at?: string
          depth?: number | null
          height?: number | null
          id?: string
          image_url?: string | null
          invoice_id?: string
          item_name?: string
          quantity?: number
          total_price?: number
          unit?: string | null
          unit_price?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoice_payments: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_method: string
          payment_reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          payment_reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          payment_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          created_at: string
          customer_id: string
          customer_name: string
          discount: number
          id: string
          invoice_date: string
          invoice_name: string | null
          invoice_number: string
          notes: string | null
          paid: boolean
          paid_amount: number
          remaining_credit: number | null
          selectable_for_payment: boolean | null
          total_amount: number
          updated_at: string
          used_as_payment: number | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          customer_name: string
          discount?: number
          id?: string
          invoice_date?: string
          invoice_name?: string | null
          invoice_number: string
          notes?: string | null
          paid?: boolean
          paid_amount?: number
          remaining_credit?: number | null
          selectable_for_payment?: boolean | null
          total_amount?: number
          updated_at?: string
          used_as_payment?: number | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          customer_name?: string
          discount?: number
          id?: string
          invoice_date?: string
          invoice_name?: string | null
          invoice_number?: string
          notes?: string | null
          paid?: boolean
          paid_amount?: number
          remaining_credit?: number | null
          selectable_for_payment?: boolean | null
          total_amount?: number
          updated_at?: string
          used_as_payment?: number | null
        }
        Relationships: []
      }
      purchases: {
        Row: {
          commission: number
          created_at: string
          date: string
          id: string
          invoice_number: string | null
          notes: string | null
          paid_amount: number
          phase_id: string | null
          project_id: string | null
          purchase_source: string
          status: string
          supplier_id: string | null
          technician_id: string | null
          total_amount: number
          treasury_id: string | null
          updated_at: string
        }
        Insert: {
          commission?: number
          created_at?: string
          date?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          paid_amount?: number
          phase_id?: string | null
          project_id?: string | null
          purchase_source?: string
          status?: string
          supplier_id?: string | null
          technician_id?: string | null
          total_amount?: number
          treasury_id?: string | null
          updated_at?: string
        }
        Update: {
          commission?: number
          created_at?: string
          date?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          paid_amount?: number
          phase_id?: string | null
          project_id?: string | null
          purchase_source?: string
          status?: string
          supplier_id?: string | null
          technician_id?: string | null
          total_amount?: number
          treasury_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      removal_task_items: {
        Row: {
          billboard_id: number
          completed_at: string | null
          created_at: string
          design_face_a: string | null
          design_face_b: string | null
          id: string
          installed_image_url: string | null
          notes: string | null
          removal_date: string | null
          removed_image_url: string | null
          status: string
          task_id: string
        }
        Insert: {
          billboard_id: number
          completed_at?: string | null
          created_at?: string
          design_face_a?: string | null
          design_face_b?: string | null
          id?: string
          installed_image_url?: string | null
          notes?: string | null
          removal_date?: string | null
          removed_image_url?: string | null
          status?: string
          task_id: string
        }
        Update: {
          billboard_id?: number
          completed_at?: string | null
          created_at?: string
          design_face_a?: string | null
          design_face_b?: string | null
          id?: string
          installed_image_url?: string | null
          notes?: string | null
          removal_date?: string | null
          removed_image_url?: string | null
          status?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "removal_task_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "removal_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      removal_tasks: {
        Row: {
          contract_id: number | null
          contract_ids: number[] | null
          created_at: string
          id: string
          status: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          contract_id?: number | null
          contract_ids?: number[] | null
          created_at?: string
          id?: string
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          contract_id?: number | null
          contract_ids?: number[] | null
          created_at?: string
          id?: string
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      report_items: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          item_type: string | null
          notes: string | null
          order_index: number | null
          report_id: string | null
          status: string | null
          task_id: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          item_type?: string | null
          notes?: string | null
          order_index?: number | null
          report_id?: string | null
          status?: string | null
          task_id?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          item_type?: string | null
          notes?: string | null
          order_index?: number | null
          report_id?: string | null
          status?: string | null
          task_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_items_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string | null
          created_by: string | null
          end_date: string | null
          font_family: string | null
          font_weight: string | null
          id: string
          report_date: string
          report_type: string
          start_date: string | null
          summary: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          font_family?: string | null
          font_weight?: string | null
          id?: string
          report_date: string
          report_type: string
          start_date?: string | null
          summary?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          end_date?: string | null
          font_family?: string | null
          font_weight?: string | null
          id?: string
          report_date?: string
          report_type?: string
          start_date?: string | null
          summary?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          name: string
          permissions: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          name: string
          permissions?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          name?: string
          permissions?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sales_invoice_payments: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_method: string
          payment_reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          payment_reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string
          payment_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoices: {
        Row: {
          created_at: string
          customer_id: string
          customer_name: string
          discount: number | null
          id: string
          invoice_date: string
          invoice_name: string | null
          invoice_number: string
          items: Json
          locked: boolean
          notes: string | null
          paid: boolean
          paid_amount: number
          remaining_amount: number | null
          selectable_for_payment: boolean | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          customer_name: string
          discount?: number | null
          id?: string
          invoice_date?: string
          invoice_name?: string | null
          invoice_number: string
          items: Json
          locked?: boolean
          notes?: string | null
          paid?: boolean
          paid_amount?: number
          remaining_amount?: number | null
          selectable_for_payment?: boolean | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          customer_name?: string
          discount?: number | null
          id?: string
          invoice_date?: string
          invoice_name?: string | null
          invoice_number?: string
          items?: Json
          locked?: boolean
          notes?: string | null
          paid?: boolean
          paid_amount?: number
          remaining_amount?: number | null
          selectable_for_payment?: boolean | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      shared_billboards: {
        Row: {
          billboard_id: number
          capital_contribution: number
          capital_deduction_per_contract: number | null
          capital_remaining: number
          company_share: number | null
          confirmed_amount: number | null
          contract_id: number | null
          contract_share: number | null
          created_at: string | null
          end_date: string | null
          id: string
          notes: string | null
          partner_company_id: string | null
          partner_post_pct: number
          partner_pre_pct: number
          partnership_percentage: number
          post_company_pct: number
          pre_capital_pct: number
          pre_company_pct: number
          reserved_amount: number | null
          start_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          billboard_id: number
          capital_contribution?: number
          capital_deduction_per_contract?: number | null
          capital_remaining?: number
          company_share?: number | null
          confirmed_amount?: number | null
          contract_id?: number | null
          contract_share?: number | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          partner_company_id?: string | null
          partner_post_pct?: number
          partner_pre_pct?: number
          partnership_percentage?: number
          post_company_pct?: number
          pre_capital_pct?: number
          pre_company_pct?: number
          reserved_amount?: number | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          billboard_id?: number
          capital_contribution?: number
          capital_deduction_per_contract?: number | null
          capital_remaining?: number
          company_share?: number | null
          confirmed_amount?: number | null
          contract_id?: number | null
          contract_share?: number | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          partner_company_id?: string | null
          partner_post_pct?: number
          partner_pre_pct?: number
          partnership_percentage?: number
          post_company_pct?: number
          pre_capital_pct?: number
          pre_company_pct?: number
          reserved_amount?: number | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_billboards_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "Contract"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "shared_billboards_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "shared_billboards_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contract_summary"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "shared_billboards_partner_company_id_fkey"
            columns: ["partner_company_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_transactions: {
        Row: {
          amount: number
          beneficiary: string
          billboard_id: number | null
          created_at: string
          id: string
          notes: string | null
          partner_company_id: string | null
          type: string
        }
        Insert: {
          amount?: number
          beneficiary: string
          billboard_id?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          partner_company_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          beneficiary?: string
          billboard_id?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          partner_company_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_transactions_partner_fk"
            columns: ["partner_company_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      site_theme_settings: {
        Row: {
          accent_color: string | null
          background_color: string | null
          border_color: string | null
          created_at: string
          favicon_url: string | null
          id: string
          invoice_font_family: string | null
          logo_url: string | null
          muted_color: string | null
          primary_color: string | null
          secondary_color: string | null
          setting_key: string
          site_font_family: string | null
          text_color: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          background_color?: string | null
          border_color?: string | null
          created_at?: string
          favicon_url?: string | null
          id?: string
          invoice_font_family?: string | null
          logo_url?: string | null
          muted_color?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          setting_key?: string
          site_font_family?: string | null
          text_color?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          background_color?: string | null
          border_color?: string | null
          created_at?: string
          favicon_url?: string | null
          id?: string
          invoice_font_family?: string | null
          logo_url?: string | null
          muted_color?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          setting_key?: string
          site_font_family?: string | null
          text_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sizes: {
        Row: {
          created_at: string | null
          description: string | null
          height: number | null
          id: number
          install_price_per_meter: number | null
          installation_price: number | null
          name: string
          sort_order: number | null
          width: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          height?: number | null
          id?: number
          install_price_per_meter?: number | null
          installation_price?: number | null
          name: string
          sort_order?: number | null
          width?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          height?: number | null
          id?: number
          install_price_per_meter?: number | null
          installation_price?: number | null
          name?: string
          sort_order?: number | null
          width?: number | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          installation_pricing_method: string | null
          setting_key: string
          setting_type: string | null
          setting_value: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          installation_pricing_method?: string | null
          setting_key: string
          setting_type?: string | null
          setting_value?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          installation_pricing_method?: string | null
          setting_key?: string
          setting_type?: string | null
          setting_value?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      task_designs: {
        Row: {
          created_at: string
          cutout_image_url: string | null
          design_face_a_url: string
          design_face_b_url: string | null
          design_name: string
          design_order: number | null
          fallback_path_cutout: string | null
          fallback_path_face_a: string | null
          fallback_path_face_b: string | null
          id: string
          task_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cutout_image_url?: string | null
          design_face_a_url: string
          design_face_b_url?: string | null
          design_name: string
          design_order?: number | null
          fallback_path_cutout?: string | null
          fallback_path_face_a?: string | null
          fallback_path_face_b?: string | null
          id?: string
          task_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cutout_image_url?: string | null
          design_face_a_url?: string
          design_face_b_url?: string | null
          design_name?: string
          design_order?: number | null
          fallback_path_cutout?: string | null
          fallback_path_face_a?: string | null
          fallback_path_face_b?: string | null
          id?: string
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_designs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "installation_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          cancellation_reason: string | null
          completed_at: string | null
          completion_notes: string | null
          completion_result: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string
          id: string
          priority: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          cancellation_reason?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          completion_result?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date: string
          id?: string
          priority?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          cancellation_reason?: string | null
          completed_at?: string | null
          completion_notes?: string | null
          completion_result?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string
          id?: string
          priority?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      team_account_expenses: {
        Row: {
          amount: number
          created_at: string
          description: string
          expense_date: string
          id: string
          notes: string | null
          team_account_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          expense_date?: string
          id?: string
          notes?: string | null
          team_account_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          team_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_account_expenses_team_account_id_fkey"
            columns: ["team_account_id"]
            isOneToOne: false
            referencedRelation: "installation_team_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      template_settings: {
        Row: {
          background_color: string | null
          body_font: string | null
          created_at: string | null
          font_size_body: number | null
          font_size_header: number | null
          footer_text: string | null
          header_font: string | null
          header_text: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          logo_height: number | null
          logo_url: string | null
          logo_width: number | null
          margin_bottom: number | null
          margin_left: number | null
          margin_right: number | null
          margin_top: number | null
          page_orientation: string | null
          page_size: string | null
          primary_color: string | null
          secondary_color: string | null
          show_footer: boolean | null
          show_header: boolean | null
          show_logo: boolean | null
          show_signature: boolean | null
          signature_label: string | null
          signature_url: string | null
          template_name: string
          template_type: string
          text_color: string | null
          updated_at: string | null
        }
        Insert: {
          background_color?: string | null
          body_font?: string | null
          created_at?: string | null
          font_size_body?: number | null
          font_size_header?: number | null
          footer_text?: string | null
          header_font?: string | null
          header_text?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          logo_height?: number | null
          logo_url?: string | null
          logo_width?: number | null
          margin_bottom?: number | null
          margin_left?: number | null
          margin_right?: number | null
          margin_top?: number | null
          page_orientation?: string | null
          page_size?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_footer?: boolean | null
          show_header?: boolean | null
          show_logo?: boolean | null
          show_signature?: boolean | null
          signature_label?: string | null
          signature_url?: string | null
          template_name: string
          template_type: string
          text_color?: string | null
          updated_at?: string | null
        }
        Update: {
          background_color?: string | null
          body_font?: string | null
          created_at?: string | null
          font_size_body?: number | null
          font_size_header?: number | null
          footer_text?: string | null
          header_font?: string | null
          header_text?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          logo_height?: number | null
          logo_url?: string | null
          logo_width?: number | null
          margin_bottom?: number | null
          margin_left?: number | null
          margin_right?: number | null
          margin_top?: number | null
          page_orientation?: string | null
          page_size?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_footer?: boolean | null
          show_header?: boolean | null
          show_logo?: boolean | null
          show_signature?: boolean | null
          signature_label?: string | null
          signature_url?: string | null
          template_name?: string
          template_type?: string
          text_color?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      timesheets: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          date: string
          employee_id: string
          hours: number | null
          id: string
          notes: string | null
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date: string
          employee_id: string
          hours?: number | null
          id?: string
          notes?: string | null
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          hours?: number | null
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          calculation_method: string
          contract_id: number | null
          created_at: string | null
          fee_percentage: number
          id: number
          notes: string | null
          period_end: string | null
          period_start: string | null
          withdrawal_method: string
        }
        Insert: {
          amount: number
          calculation_method: string
          contract_id?: number | null
          created_at?: string | null
          fee_percentage: number
          id?: number
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          withdrawal_method: string
        }
        Update: {
          amount?: number
          calculation_method?: string
          contract_id?: number | null
          created_at?: string | null
          fee_percentage?: number
          id?: number
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          withdrawal_method?: string
        }
        Relationships: []
      }
    }
    Views: {
      billboard_partnership_status: {
        Row: {
          billboard_id: number | null
          billboard_name: string | null
          capital: number | null
          capital_remaining: number | null
          is_partnership: boolean | null
          partners: Json[] | null
          partners_count: number | null
          total_capital_contributions: number | null
          total_capital_remaining: number | null
          total_confirmed: number | null
          total_reserved: number | null
        }
        Relationships: []
      }
      contract_billboard_summary: {
        Row: {
          billboard_id: number | null
          Billboard_Name: string | null
          billboard_status: string | null
          City: string | null
          contract_id: number | null
          Contract_Number: number | null
          "Customer Name": string | null
          end_date: string | null
          rent_cost: number | null
          Size: string | null
          start_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_billboard_size_name"
            columns: ["Size"]
            isOneToOne: false
            referencedRelation: "sizes"
            referencedColumns: ["name"]
          },
        ]
      }
      contract_summary: {
        Row: {
          actual_paid: number | null
          "Ad Type": string | null
          base_rent: number | null
          billboard_id: number | null
          billboard_ids: string | null
          billboard_prices: string | null
          billboards_count: number | null
          billboards_data: string | null
          billboards_released: boolean | null
          Company: string | null
          "Contract Date": string | null
          contract_currency: string | null
          Contract_Number: number | null
          "Customer Name": string | null
          customer_category: string | null
          customer_company: string | null
          customer_id: string | null
          customer_phone: string | null
          design_data: Json | null
          Discount: number | null
          Duration: string | null
          "End Date": string | null
          exchange_rate: string | null
          fee: string | null
          friend_rental_data: Json | null
          friend_rental_includes_installation: boolean | null
          friend_rental_operating_fee_enabled: boolean | null
          friend_rental_operating_fee_rate: number | null
          id: number | null
          include_installation_in_price: boolean | null
          include_operating_in_installation: boolean | null
          include_operating_in_print: boolean | null
          include_print_in_billboard_price: boolean | null
          installation_cost: number | null
          installation_enabled: boolean | null
          installment_auto_calculate: boolean | null
          installment_count: number | null
          installment_distribution_type: string | null
          installment_first_at_signing: boolean | null
          installment_first_payment_amount: number | null
          installment_first_payment_type: string | null
          installment_interval: string | null
          installments_data: string | null
          level_discounts: Json | null
          operating_fee_rate: number | null
          partnership_data: Json | null
          partnership_operating_data: Json | null
          partnership_operating_fee_rate: number | null
          "Payment 1": Json | null
          "Payment 2": string | null
          "Payment 3": string | null
          payment_status: string | null
          Phone: string | null
          "Print Status": string | null
          print_cost: number | null
          print_cost_enabled: string | null
          print_price_per_meter: string | null
          Remaining: string | null
          "Renewal Status": string | null
          single_face_billboards: string | null
          Total: number | null
          "Total Paid": string | null
          "Total Rent": number | null
          total_expenses: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_contract_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financial_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "fk_contract_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financials"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "fk_contract_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_financial_summary: {
        Row: {
          balance: number | null
          customer_id: string | null
          customer_name: string | null
          total_contracts: number | null
          total_due: number | null
          total_paid: number | null
          total_printed_invoices: number | null
          total_purchases: number | null
          total_sales_invoices: number | null
        }
        Relationships: []
      }
      customer_financials: {
        Row: {
          contracts_count: number | null
          created_at: string | null
          customer_id: string | null
          last_payment_date: string | null
          name: string | null
          total_contracts_amount: number | null
          total_paid: number | null
          total_remaining: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      friend_company_financials: {
        Row: {
          company_id: string | null
          company_name: string | null
          first_rental_date: string | null
          last_rental_date: string | null
          total_billboards: number | null
          total_contracts: number | null
          total_paid_to_friend: number | null
          total_profit: number | null
          total_revenue_from_customers: number | null
        }
        Relationships: []
      }
      payroll_summary: {
        Row: {
          payroll_id: string | null
          period_end: string | null
          period_start: string | null
          total_allowances: number | null
          total_deductions: number | null
          total_gross: number | null
          total_net: number | null
          total_paid: number | null
        }
        Relationships: []
      }
      print_invoices_standalone: {
        Row: {
          account_deduction: number | null
          account_payments_deducted: string | null
          composite_task_id: string | null
          contract_number: number | null
          contract_numbers: string | null
          created_at: string | null
          currency_code: string | null
          currency_symbol: string | null
          "currency_symbol'": string | null
          customer_id: string | null
          customer_name: string | null
          design_face_a_path: string | null
          design_face_b_path: string | null
          discount: number | null
          discount_amount: number | null
          discount_type: string | null
          id: string | null
          include_account_balance: boolean | null
          invoice_date: string | null
          invoice_number: string | null
          invoice_type: string | null
          items: Json | null
          locked: boolean | null
          notes: string | null
          paid: boolean | null
          paid_amount: number | null
          paid_at: string | null
          payment_method: string | null
          print_items: string | null
          printer_cost: number | null
          printer_id: string | null
          printer_name: string | null
          subtotal: number | null
          total: number | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          account_deduction?: number | null
          account_payments_deducted?: string | null
          composite_task_id?: string | null
          contract_number?: number | null
          contract_numbers?: string | null
          created_at?: string | null
          currency_code?: string | null
          currency_symbol?: string | null
          "currency_symbol'"?: string | null
          customer_id?: string | null
          customer_name?: string | null
          design_face_a_path?: string | null
          design_face_b_path?: string | null
          discount?: number | null
          discount_amount?: number | null
          discount_type?: string | null
          id?: string | null
          include_account_balance?: boolean | null
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_type?: string | null
          items?: Json | null
          locked?: boolean | null
          notes?: string | null
          paid?: boolean | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          print_items?: string | null
          printer_cost?: number | null
          printer_id?: string | null
          printer_name?: string | null
          subtotal?: number | null
          total?: number | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          account_deduction?: number | null
          account_payments_deducted?: string | null
          composite_task_id?: string | null
          contract_number?: number | null
          contract_numbers?: string | null
          created_at?: string | null
          currency_code?: string | null
          currency_symbol?: string | null
          "currency_symbol'"?: string | null
          customer_id?: string | null
          customer_name?: string | null
          design_face_a_path?: string | null
          design_face_b_path?: string | null
          discount?: number | null
          discount_amount?: number | null
          discount_type?: string | null
          id?: string | null
          include_account_balance?: boolean | null
          invoice_date?: string | null
          invoice_number?: string | null
          invoice_type?: string | null
          items?: Json | null
          locked?: boolean | null
          notes?: string | null
          paid?: boolean | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_method?: string | null
          print_items?: string | null
          printer_cost?: number | null
          printer_id?: string | null
          printer_name?: string | null
          subtotal?: number | null
          total?: number | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_invoices_contract_number_fkey"
            columns: ["contract_number"]
            isOneToOne: false
            referencedRelation: "Contract"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "print_invoices_contract_number_fkey"
            columns: ["contract_number"]
            isOneToOne: false
            referencedRelation: "contract_billboard_summary"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "print_invoices_contract_number_fkey"
            columns: ["contract_number"]
            isOneToOne: false
            referencedRelation: "contract_summary"
            referencedColumns: ["Contract_Number"]
          },
          {
            foreignKeyName: "print_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financial_summary"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "print_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_financials"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "print_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printed_invoices_composite_task_id_fkey"
            columns: ["composite_task_id"]
            isOneToOne: false
            referencedRelation: "composite_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printed_invoices_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printer_accounts"
            referencedColumns: ["printer_id"]
          },
          {
            foreignKeyName: "printed_invoices_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
        ]
      }
      printer_accounts: {
        Row: {
          customer_id: string | null
          customer_name: string | null
          cutout_tasks_count: number | null
          final_balance: number | null
          print_tasks_count: number | null
          printer_id: string | null
          printer_name: string | null
          total_customer_debt: number | null
          total_customer_payments: number | null
          total_cutout_costs: number | null
          total_payments_to_printer: number | null
          total_print_costs: number | null
          total_supplier_debt: number | null
        }
        Relationships: []
      }
      shared_beneficiary_summary: {
        Row: {
          beneficiary: string | null
          total_due: number | null
          total_paid: number | null
        }
        Relationships: []
      }
      team_accounts_summary: {
        Row: {
          paid_amount: number | null
          paid_count: number | null
          pending_amount: number | null
          pending_count: number | null
          team_id: string | null
          team_name: string | null
          total_amount: number | null
          total_installations: number | null
        }
        Relationships: [
          {
            foreignKeyName: "installation_team_accounts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "installation_teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cleanup_expired_billboards: {
        Args: never
        Returns: {
          cleaned_billboard_ids: number[]
          cleaned_count: number
          operation_timestamp: string
        }[]
      }
      cleanup_orphaned_data: { Args: never; Returns: number }
      contracts_by_customer: { Args: { cust_id: string }; Returns: Json }
      create_installation_tasks_for_contract: {
        Args: { p_contract_number: number }
        Returns: Json
      }
      delete_billboard: { Args: { billboard_id: number }; Returns: undefined }
      get_table_schema: {
        Args: { p_table_name: string }
        Returns: {
          column_default: string
          column_name: string
          data_type: string
          is_nullable: string
          is_primary: boolean
        }[]
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      recompute_expense_paid_amount: {
        Args: { _expense_id: string }
        Returns: undefined
      }
      recompute_expense_payment_status: {
        Args: { _expense_id: string }
        Returns: undefined
      }
      round: { Args: { digits: number; val: number }; Returns: number }
      safe_delete_billboard: {
        Args: { input_billboard_id: number }
        Returns: boolean
      }
      setval_billboards_seq: { Args: never; Returns: undefined }
      shared_company_summary: {
        Args: { p_beneficiary: string }
        Returns: {
          total_due: number
          total_paid: number
        }[]
      }
      show_tables_summary: {
        Args: never
        Returns: {
          sample_data: Json
          structure: Json
          table_name: string
        }[]
      }
      sync_billboards_from_contract: {
        Args: { p_contract_number: number }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "sub_admin"
        | "accountant"
        | "customer"
        | "marketer"
      billboard_status_type: "torn_ad" | "size_changed" | "removed"
      user_role: "user" | "admin" | "manager" | "viewer"
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
    Enums: {
      app_role: [
        "admin",
        "user",
        "sub_admin",
        "accountant",
        "customer",
        "marketer",
      ],
      billboard_status_type: ["torn_ad", "size_changed", "removed"],
      user_role: ["user", "admin", "manager", "viewer"],
    },
  },
} as const

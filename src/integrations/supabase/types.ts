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
      acumulado_mensual_verificador: {
        Row: {
          anio: number
          id: string
          mes: number
          monto_acumulado: number
          verificador_id: string
        }
        Insert: {
          anio: number
          id?: string
          mes: number
          monto_acumulado?: number
          verificador_id: string
        }
        Update: {
          anio?: number
          id?: string
          mes?: number
          monto_acumulado?: number
          verificador_id?: string
        }
        Relationships: []
      }
      catalogo_categorias: {
        Row: {
          activo: boolean
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      catalogo_departamentos: {
        Row: {
          activo: boolean
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      configuracion_limites: {
        Row: {
          autorizador_una_firma_max: number
          id: number
          updated_at: string
          ventana_revocacion_horas: number
          verificador_alerta_activa_max: number
          verificador_auto_aprueba_max: number
          verificador_limite_mensual: number
          verificador_warning_pct: number
        }
        Insert: {
          autorizador_una_firma_max?: number
          id?: number
          updated_at?: string
          ventana_revocacion_horas?: number
          verificador_alerta_activa_max?: number
          verificador_auto_aprueba_max?: number
          verificador_limite_mensual?: number
          verificador_warning_pct?: number
        }
        Update: {
          autorizador_una_firma_max?: number
          id?: number
          updated_at?: string
          ventana_revocacion_horas?: number
          verificador_alerta_activa_max?: number
          verificador_auto_aprueba_max?: number
          verificador_limite_mensual?: number
          verificador_warning_pct?: number
        }
        Relationships: []
      }
      email_log: {
        Row: {
          created_at: string
          destinatarios: string[]
          error: string | null
          id: string
          ok: boolean
          orden_id: string | null
          subject: string
          tipo: string
        }
        Insert: {
          created_at?: string
          destinatarios: string[]
          error?: string | null
          id?: string
          ok?: boolean
          orden_id?: string | null
          subject: string
          tipo: string
        }
        Update: {
          created_at?: string
          destinatarios?: string[]
          error?: string | null
          id?: string
          ok?: boolean
          orden_id?: string | null
          subject?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "ordenes_pago"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          activa: boolean
          created_at: string
          id: string
          nombre: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          id?: string
          nombre: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      orden_autorizaciones: {
        Row: {
          autorizador_id: string
          created_at: string
          id: string
          orden_id: string
        }
        Insert: {
          autorizador_id: string
          created_at?: string
          id?: string
          orden_id: string
        }
        Update: {
          autorizador_id?: string
          created_at?: string
          id?: string
          orden_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orden_autorizaciones_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "ordenes_pago"
            referencedColumns: ["id"]
          },
        ]
      }
      orden_historial: {
        Row: {
          accion: string
          comentario: string | null
          created_at: string
          id: string
          orden_id: string
          usuario_id: string | null
          usuario_nombre: string | null
        }
        Insert: {
          accion: string
          comentario?: string | null
          created_at?: string
          id?: string
          orden_id: string
          usuario_id?: string | null
          usuario_nombre?: string | null
        }
        Update: {
          accion?: string
          comentario?: string | null
          created_at?: string
          id?: string
          orden_id?: string
          usuario_id?: string | null
          usuario_nombre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orden_historial_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "ordenes_pago"
            referencedColumns: ["id"]
          },
        ]
      }
      ordenes_pago: {
        Row: {
          autorizado_at: string | null
          autorizado_por_id: string | null
          autorizado_por_rol:
            | Database["public"]["Enums"]["autorizado_por_rol_t"]
            | null
          categoria_gasto: string
          centro_costo: string | null
          comprobante_path: string | null
          concepto: string
          created_at: string
          departamento: string
          empresa_id: string
          fecha_pago_requerida: string | null
          firmas_requeridas: number
          folio: number
          frecuencia: Database["public"]["Enums"]["orden_frecuencia"] | null
          id: string
          moneda: string
          monto: number
          notas: string | null
          prioridad: Database["public"]["Enums"]["orden_prioridad"]
          proveedor_nombre: string
          proveedor_rfc: string | null
          recurrente: boolean
          revocable_hasta: string | null
          revocada: boolean
          solicitante_id: string
          status: Database["public"]["Enums"]["orden_status"]
          updated_at: string
        }
        Insert: {
          autorizado_at?: string | null
          autorizado_por_id?: string | null
          autorizado_por_rol?:
            | Database["public"]["Enums"]["autorizado_por_rol_t"]
            | null
          categoria_gasto: string
          centro_costo?: string | null
          comprobante_path?: string | null
          concepto: string
          created_at?: string
          departamento: string
          empresa_id: string
          fecha_pago_requerida?: string | null
          firmas_requeridas?: number
          folio?: number
          frecuencia?: Database["public"]["Enums"]["orden_frecuencia"] | null
          id?: string
          moneda?: string
          monto: number
          notas?: string | null
          prioridad?: Database["public"]["Enums"]["orden_prioridad"]
          proveedor_nombre?: string
          proveedor_rfc?: string | null
          recurrente?: boolean
          revocable_hasta?: string | null
          revocada?: boolean
          solicitante_id: string
          status?: Database["public"]["Enums"]["orden_status"]
          updated_at?: string
        }
        Update: {
          autorizado_at?: string | null
          autorizado_por_id?: string | null
          autorizado_por_rol?:
            | Database["public"]["Enums"]["autorizado_por_rol_t"]
            | null
          categoria_gasto?: string
          centro_costo?: string | null
          comprobante_path?: string | null
          concepto?: string
          created_at?: string
          departamento?: string
          empresa_id?: string
          fecha_pago_requerida?: string | null
          firmas_requeridas?: number
          folio?: number
          frecuencia?: Database["public"]["Enums"]["orden_frecuencia"] | null
          id?: string
          moneda?: string
          monto?: number
          notas?: string | null
          prioridad?: Database["public"]["Enums"]["orden_prioridad"]
          proveedor_nombre?: string
          proveedor_rfc?: string | null
          recurrente?: boolean
          revocable_hasta?: string | null
          revocada?: boolean
          solicitante_id?: string
          status?: Database["public"]["Enums"]["orden_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_pago_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activo: boolean
          created_at: string
          email: string
          empresa_id: string | null
          id: string
          must_change_password: boolean
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          email: string
          empresa_id?: string | null
          id: string
          must_change_password?: boolean
          nombre?: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          email?: string
          empresa_id?: string | null
          id?: string
          must_change_password?: boolean
          nombre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_needed: { Args: never; Returns: boolean }
      current_user_empresa: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "capturista" | "verificador" | "autorizador" | "admin"
      autorizado_por_rol_t: "verificador" | "autorizador"
      orden_frecuencia: "mensual" | "quincenal" | "semanal"
      orden_prioridad: "normal" | "urgente"
      orden_status:
        | "borrador"
        | "en_revision"
        | "en_autorizacion"
        | "aprobada"
        | "rechazada"
        | "devuelta"
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
      app_role: ["capturista", "verificador", "autorizador", "admin"],
      autorizado_por_rol_t: ["verificador", "autorizador"],
      orden_frecuencia: ["mensual", "quincenal", "semanal"],
      orden_prioridad: ["normal", "urgente"],
      orden_status: [
        "borrador",
        "en_revision",
        "en_autorizacion",
        "aprobada",
        "rechazada",
        "devuelta",
      ],
    },
  },
} as const

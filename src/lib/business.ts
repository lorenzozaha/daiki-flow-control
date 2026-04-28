// Reglas de negocio centralizadas para la matriz de autorización
// y utilidades de cálculo mensual.

export interface ConfigLimites {
  verificador_auto_aprueba_max: number;   // $0 - 2000 → verificador auto-aprueba (silenciosa)
  verificador_alerta_activa_max: number;  // 2001 - 5000 → verificador aprueba + alerta activa
  autorizador_una_firma_max: number;      // 5001 - 200000 → 1 firma autorizador
  verificador_limite_mensual: number;     // 50000
  verificador_warning_pct: number;        // 80
  ventana_revocacion_horas: number;       // 24
}

export type RutaAutorizacion =
  | "verificador_silenciosa"
  | "verificador_alerta"
  | "autorizador_una_firma"
  | "autorizador_dos_firmas";

export function rutaPorMonto(monto: number, cfg: ConfigLimites): RutaAutorizacion {
  if (monto <= cfg.verificador_auto_aprueba_max) return "verificador_silenciosa";
  if (monto <= cfg.verificador_alerta_activa_max) return "verificador_alerta";
  if (monto <= cfg.autorizador_una_firma_max) return "autorizador_una_firma";
  return "autorizador_dos_firmas";
}

export function verificadorPuedeAprobar(monto: number, cfg: ConfigLimites): boolean {
  const r = rutaPorMonto(monto, cfg);
  return r === "verificador_silenciosa" || r === "verificador_alerta";
}

export function firmasRequeridas(monto: number, cfg: ConfigLimites): number {
  return rutaPorMonto(monto, cfg) === "autorizador_dos_firmas" ? 2 : 1;
}

export function fmtMXN(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(n || 0);
}

export function fmtFechaLarga(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function fmtFechaCorta(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function diasEnEspera(desde: string): number {
  const ms = Date.now() - new Date(desde).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export const STATUS_LABEL: Record<string, string> = {
  borrador: "Borrador",
  en_revision: "En revisión",
  en_autorizacion: "En autorización",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  devuelta: "Devuelta",
};

export const STATUS_BADGE_CLASS: Record<string, string> = {
  borrador: "bg-status-borrador/20 text-foreground border border-status-borrador",
  en_revision: "bg-status-revision/10 text-status-revision border border-status-revision/30",
  en_autorizacion: "bg-status-autorizacion/10 text-status-autorizacion border border-status-autorizacion/30",
  aprobada: "bg-accent/15 text-accent-foreground border border-accent/40",
  rechazada: "bg-status-rechazada/10 text-status-rechazada border border-status-rechazada/30",
  devuelta: "bg-status-devuelta/15 text-foreground border border-status-devuelta/40",
};

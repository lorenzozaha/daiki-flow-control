import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import {
  fmtFechaCorta, fmtMXN, ConfigLimites, rutaPorMonto, firmasRequeridas,
} from "@/lib/business";
import {
  CheckCircle2, XCircle, Undo2, Loader2, Inbox, AlertTriangle, FileText, Eye,
} from "lucide-react";
import { toast } from "sonner";

type Bandeja = "verificador" | "autorizador";

interface Orden {
  id: string;
  folio: number;
  monto: number;
  concepto: string;
  proveedor_nombre: string | null;
  departamento: string;
  categoria_gasto: string;
  prioridad: string;
  status: string;
  created_at: string;
  fecha_pago_requerida: string | null;
  empresa_id: string;
  firmas_requeridas: number;
  autorizado_por_rol: string | null;
  autorizado_at: string | null;
  revocable_hasta: string | null;
  vobo_verificador_id: string | null;
  vobo_verificador_nombre: string | null;
  vobo_at: string | null;
}

export function BandejaOrdenes({ bandeja }: { bandeja: Bandeja }) {
  const { profile } = useAuth();
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [revocables, setRevocables] = useState<Orden[]>([]);
  const [cfg, setCfg] = useState<ConfigLimites | null>(null);
  const [acumulado, setAcumulado] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const cargar = async () => {
    setLoading(true);
    const ahora = new Date();
    const mes = ahora.getUTCMonth() + 1;
    const anio = ahora.getUTCFullYear();

    const statuses: ("en_revision" | "en_autorizacion")[] =
      bandeja === "verificador" ? ["en_revision"] : ["en_revision", "en_autorizacion"];

    const [{ data: lista }, { data: limites }, { data: acum }, { data: revs }] = await Promise.all([
      supabase.from("ordenes_pago").select("*").in("status", statuses).order("created_at", { ascending: true }),
      supabase.from("configuracion_limites").select("*").eq("id", 1).maybeSingle(),
      bandeja === "verificador" && profile
        ? supabase.from("acumulado_mensual_verificador").select("monto_acumulado")
            .eq("verificador_id", profile.id).eq("mes", mes).eq("anio", anio).maybeSingle()
        : Promise.resolve({ data: null }),
      bandeja === "autorizador"
        ? supabase.from("ordenes_pago").select("*")
            .eq("status", "aprobada").eq("autorizado_por_rol", "verificador").eq("revocada", false)
            .gt("revocable_hasta", new Date().toISOString())
            .order("autorizado_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    setCfg(limites as ConfigLimites | null);
    setOrdenes((lista ?? []) as Orden[]);
    setAcumulado(Number((acum as any)?.monto_acumulado ?? 0));
    setRevocables((revs ?? []) as Orden[]);
    setLoading(false);
  };

  useEffect(() => { if (profile) cargar(); /* eslint-disable-next-line */ }, [profile, bandeja]);

  const llamarAccion = async (
    orden_id: string,
    accion: "aprobar" | "rechazar" | "devolver" | "revocar" | "confirmar" | "vobo",
    comentario?: string,
  ) => {
    setWorking(orden_id + accion);
    try {
      const { data, error } = await supabase.functions.invoke("orden-accion", {
        body: { orden_id, accion, comentario },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(
        accion === "aprobar" ? "Orden aprobada" :
        accion === "rechazar" ? "Orden rechazada" :
        accion === "devolver" ? "Orden devuelta al capturista" :
        accion === "confirmar" ? "Aprobación confirmada (ya no es revocable)" :
        accion === "vobo" ? "VoBo registrado y escalado al autorizador" :
        "Aprobación revocada"
      );
      if (accion === "aprobar" && (data as any)?.warning_pct_alcanzado) {
        toast.warning("Estás cerca de tu límite mensual de aprobación.");
      }
      await cargar();
    } catch (e: any) {
      toast.error("No se pudo procesar", { description: e.message ?? String(e) });
    } finally {
      setWorking(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>;
  }

  const limiteMensual = cfg ? Number(cfg.verificador_limite_mensual) : 50000;
  const pctUso = limiteMensual ? Math.min(100, (acumulado / limiteMensual) * 100) : 0;
  const cercaLimite = cfg && pctUso >= Number(cfg.verificador_warning_pct);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">
          {bandeja === "verificador" ? "Bandeja de revisión" : "Bandeja de autorización"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {bandeja === "verificador"
            ? "Revisa y aprueba órdenes dentro de tu autoridad. Las órdenes mayores se escalan al autorizador."
            : "Autoriza órdenes que requieren tu firma y revoca aprobaciones de verificador dentro de las 24 h."}
        </p>
      </div>

      {bandeja === "verificador" && cfg && (
        <div className="daiki-card p-4 md:p-5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                Acumulado mensual aprobado
              </p>
              <p className="text-xl font-bold">
                {fmtMXN(acumulado)} <span className="text-sm font-normal text-muted-foreground">/ {fmtMXN(limiteMensual)}</span>
              </p>
            </div>
            {cercaLimite && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning bg-warning/10 px-2.5 py-1 rounded-full border border-warning/30">
                <AlertTriangle className="w-3.5 h-3.5" /> Cerca del límite
              </span>
            )}
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${cercaLimite ? "bg-warning" : "bg-accent"}`}
              style={{ width: `${pctUso}%` }}
            />
          </div>
        </div>
      )}

      {bandeja === "autorizador" && revocables.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2">
            Aprobadas por verificador (revocables 24 h) · {revocables.length}
          </h2>
          <div className="space-y-2">
            {revocables.map((o) => (
              <RevocableCard
                key={o.id}
                orden={o}
                working={working}
                onConfirmar={() => llamarAccion(o.id, "confirmar")}
                onRevocar={(c) => llamarAccion(o.id, "revocar", c)}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2">
          Pendientes · {ordenes.length}
        </h2>
        {ordenes.length === 0 ? (
          <div className="daiki-card p-10 text-center text-muted-foreground">
            <Inbox className="w-10 h-10 mx-auto mb-3 opacity-40" />
            No hay órdenes pendientes en este momento.
          </div>
        ) : (
          <div className="space-y-3">
            {ordenes.map((o) => (
              <OrdenCard
                key={o.id}
                orden={o}
                bandeja={bandeja}
                cfg={cfg}
                working={working}
                onAprobar={(c) => llamarAccion(o.id, "aprobar", c)}
                onRechazar={(c) => llamarAccion(o.id, "rechazar", c)}
                onDevolver={(c) => llamarAccion(o.id, "devolver", c)}
                onVoBo={(c) => llamarAccion(o.id, "vobo", c)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function OrdenCard({
  orden, bandeja, cfg, working, onAprobar, onRechazar, onDevolver, onVoBo,
}: {
  orden: Orden;
  bandeja: Bandeja;
  cfg: ConfigLimites | null;
  working: string | null;
  onAprobar: (c?: string) => void;
  onRechazar: (c: string) => void;
  onDevolver: (c: string) => void;
  onVoBo: (c?: string) => void;
}) {
  const ruta = cfg ? rutaPorMonto(orden.monto, cfg) : null;
  const firmas = cfg ? firmasRequeridas(orden.monto, cfg) : 1;

  // En bandeja del verificador, marcar las que NO puede aprobar (escalan)
  const verificadorPuede = ruta === "verificador_silenciosa" || ruta === "verificador_alerta";
  const puedeAprobar = bandeja === "verificador" ? verificadorPuede : true;

  return (
    <div className="daiki-card p-4 md:p-5">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground font-mono">#{orden.folio}</span>
            <StatusBadge status={orden.status} />
            {orden.prioridad === "urgente" && (
              <span className="daiki-badge bg-warning/15 text-warning border border-warning/30">
                Urgente
              </span>
            )}
            {bandeja === "verificador" && ruta === "verificador_alerta" && (
              <span className="daiki-badge bg-info/10 text-info border border-info/30">
                Alerta activa
              </span>
            )}
            {firmas === 2 && (
              <span className="daiki-badge bg-status-autorizacion/15 text-status-autorizacion border border-status-autorizacion/30">
                Requiere 2 firmas
              </span>
            )}
            {bandeja === "autorizador" && orden.vobo_verificador_id && (
              <span className="daiki-badge bg-accent/15 text-accent border border-accent/30">
                ✓ VoBo {orden.vobo_verificador_nombre ?? "verificador"}
              </span>
            )}
          </div>
          <p className="font-semibold truncate">{orden.concepto}</p>
          <p className="text-xs text-muted-foreground truncate">
            {orden.proveedor_nombre || "Sin proveedor"} · {orden.departamento} · {orden.categoria_gasto}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-extrabold">{fmtMXN(orden.monto)}</p>
          <p className="text-xs text-muted-foreground">
            Capturada {fmtFechaCorta(orden.created_at)}
          </p>
        </div>
      </div>

      {!puedeAprobar && bandeja === "verificador" && (
        <div className="text-xs text-muted-foreground bg-secondary px-3 py-2 rounded-md mb-3">
          Este monto excede tu autoridad y debe ser aprobado por un autorizador.
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-border">
        <Button asChild variant="ghost" size="sm">
          <Link to={`/ordenes/${orden.id}`}><Eye className="w-4 h-4 mr-1.5" /> Ver detalle</Link>
        </Button>
        <div className="flex-1" />
        <ActionDialog
          title="Devolver al capturista"
          description="Indica qué necesita corregir."
          buttonLabel="Devolver"
          variant="outline"
          icon={<Undo2 className="w-4 h-4 mr-1.5" />}
          requireComment
          working={working === orden.id + "devolver"}
          onConfirm={(c) => onDevolver(c!)}
        />
        <ActionDialog
          title="Rechazar orden"
          description="Esta acción es definitiva. Indica el motivo."
          buttonLabel="Rechazar"
          variant="destructive-outline"
          icon={<XCircle className="w-4 h-4 mr-1.5" />}
          requireComment
          working={working === orden.id + "rechazar"}
          onConfirm={(c) => onRechazar(c!)}
        />
        {puedeAprobar && (
          <Button
            size="sm"
            disabled={working === orden.id + "aprobar"}
            onClick={() => onAprobar()}
            className="bg-accent text-accent-foreground hover:bg-accent-hover font-semibold"
          >
            {working === orden.id + "aprobar"
              ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
            Aprobar
          </Button>
        )}
      </div>
    </div>
  );
}

function RevocableCard({
  orden, working, onConfirmar, onRevocar,
}: {
  orden: Orden;
  working: string | null;
  onConfirmar: () => void;
  onRevocar: (c: string) => void;
}) {
  const expira = orden.revocable_hasta ? new Date(orden.revocable_hasta) : null;
  const horasRestantes = expira ? Math.max(0, Math.round((expira.getTime() - Date.now()) / 3600000)) : 0;

  return (
    <div className="daiki-card p-4 border-l-4 border-l-warning">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-muted-foreground font-mono">#{orden.folio}</span>
            <span className="daiki-badge bg-warning/10 text-warning border border-warning/30">
              Revocable {horasRestantes} h
            </span>
          </div>
          <p className="font-semibold truncate">{orden.concepto}</p>
          <p className="text-xs text-muted-foreground">
            {fmtMXN(orden.monto)} · Aprobada por verificador
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to={`/ordenes/${orden.id}`}><FileText className="w-4 h-4 mr-1.5" /> Ver</Link>
          </Button>
          <ActionDialog
            title="Revocar aprobación"
            description="La orden volverá a estatus rechazada y se ajustará el acumulado del verificador."
            buttonLabel="Revocar"
            variant="destructive-outline"
            icon={<Undo2 className="w-4 h-4 mr-1.5" />}
            requireComment
            working={working === orden.id + "revocar"}
            onConfirm={(c) => onRevocar(c!)}
          />
          <Button
            size="sm"
            disabled={working === orden.id + "confirmar"}
            onClick={onConfirmar}
            className="bg-accent text-accent-foreground hover:bg-accent-hover font-semibold"
          >
            {working === orden.id + "confirmar"
              ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
            Confirmar aprobación
          </Button>
        </div>
      </div>
    </div>
  );
}

function ActionDialog({
  title, description, buttonLabel, variant, icon, requireComment, working, onConfirm,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  variant: "outline" | "destructive-outline";
  icon: React.ReactNode;
  requireComment?: boolean;
  working: boolean;
  onConfirm: (comentario?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [comentario, setComentario] = useState("");

  const buttonClass = variant === "destructive-outline"
    ? "border-destructive/40 text-destructive hover:bg-destructive/10"
    : "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={buttonClass}>
          {icon}{buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Textarea
          rows={3}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Comentario para el capturista..."
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            disabled={working || (requireComment && !comentario.trim())}
            onClick={() => { onConfirm(comentario.trim()); setOpen(false); setComentario(""); }}
            className={variant === "destructive-outline"
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : ""}
          >
            {working ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

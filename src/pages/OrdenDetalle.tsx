import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtFechaLarga, fmtMXN } from "@/lib/business";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Edit3, Loader2, Trash2, FileText, Download, Send } from "lucide-react";

interface Orden {
  id: string; folio: number; empresa_id: string; solicitante_id: string;
  departamento: string; categoria_gasto: string; concepto: string;
  proveedor_nombre: string; proveedor_rfc: string | null; monto: number;
  fecha_pago_requerida: string | null; recurrente: boolean; frecuencia: string | null;
  prioridad: string; centro_costo: string | null; comprobante_path: string | null;
  notas: string | null; status: string; autorizado_por_rol: string | null;
  autorizado_at: string | null; created_at: string; revocable_hasta: string | null;
  revocada: boolean;
}

interface HistItem {
  id: string; usuario_nombre: string | null; accion: string; comentario: string | null; created_at: string;
}

export default function OrdenDetalle() {
  const { id } = useParams<{ id: string }>();
  const { profile, hasRole } = useAuth();
  const navigate = useNavigate();
  const [orden, setOrden] = useState<Orden | null>(null);
  const [hist, setHist] = useState<HistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);
  const [comentario, setComentario] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [empresa, setEmpresa] = useState<string>("");

  const load = async () => {
    if (!id) return;
    const [{ data: o }, { data: h }] = await Promise.all([
      supabase.from("ordenes_pago").select("*").eq("id", id).maybeSingle(),
      supabase.from("orden_historial").select("*").eq("orden_id", id).order("created_at", { ascending: true }),
    ]);
    setOrden(o as Orden | null);
    setHist((h ?? []) as HistItem[]);
    if (o?.empresa_id) {
      const { data: e } = await supabase.from("empresas").select("nombre").eq("id", o.empresa_id).maybeSingle();
      setEmpresa(e?.nombre || "");
    }
    if (o?.comprobante_path) {
      const { data: signed } = await supabase.storage.from("comprobantes").createSignedUrl(o.comprobante_path, 3600);
      setComprobanteUrl(signed?.signedUrl ?? null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const isOwner = orden?.solicitante_id === profile?.id;
  const canEdit = isOwner && orden && ["borrador", "devuelta"].includes(orden.status);
  const canDelete = isOwner && orden?.status === "borrador";
  const canSend = canEdit;

  const handleDelete = async () => {
    if (!orden) return;
    setSubmitting(true);
    const { error } = await supabase.from("ordenes_pago").delete().eq("id", orden.id);
    setSubmitting(false);
    if (error) { toast.error("No pudimos eliminar", { description: error.message }); return; }
    toast.success("Borrador eliminado");
    navigate("/mis-ordenes");
  };

  const handleSend = async () => {
    if (!orden) return;
    setSubmitting(true);
    const { error } = await supabase.from("ordenes_pago").update({ status: "en_revision" }).eq("id", orden.id);
    if (!error) {
      await supabase.from("orden_historial").insert({
        orden_id: orden.id, usuario_id: profile!.id, usuario_nombre: profile!.nombre,
        accion: "Enviada a revisión", comentario: comentario || null,
      });
      toast.success("Orden enviada a revisión");
      await load();
      setComentario("");
    } else {
      toast.error("No pudimos enviar", { description: error.message });
    }
    setSubmitting(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>;
  if (!orden) return <div className="text-center py-20"><p className="text-muted-foreground">Orden no encontrada.</p></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1">
          <div className="text-xs font-mono text-muted-foreground">#{String(orden.folio).padStart(5, "0")}</div>
          <h1 className="text-2xl font-extrabold line-clamp-1">{orden.concepto}</h1>
        </div>
        <StatusBadge status={orden.status} />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Datos principales */}
        <div className="lg:col-span-2 space-y-5">
          <div className="daiki-card p-5">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Monto</div>
                <div className="text-3xl font-extrabold text-foreground">{fmtMXN(orden.monto)}</div>
              </div>
              {orden.prioridad === "urgente" && (
                <span className="daiki-badge bg-warning/15 text-warning border border-warning/30">Urgente</span>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <DataRow label="Empresa" value={empresa} />
              <DataRow label="Departamento" value={orden.departamento} />
              <DataRow label="Categoría" value={orden.categoria_gasto} />
              <DataRow label="Centro de costo" value={orden.centro_costo || "—"} />
              <DataRow label="Proveedor" value={orden.proveedor_nombre || "—"} />
              <DataRow label="RFC" value={orden.proveedor_rfc || "—"} />
              <DataRow label="Fecha de pago" value={orden.fecha_pago_requerida || "—"} />
              <DataRow label="Recurrente" value={orden.recurrente ? `Sí · ${orden.frecuencia}` : "No"} />
            </div>

            {orden.notas && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Notas</div>
                <p className="text-sm whitespace-pre-line">{orden.notas}</p>
              </div>
            )}
          </div>

          {/* Comprobante */}
          {comprobanteUrl && (
            <div className="daiki-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Comprobante adjunto</div>
                  <div className="text-xs text-muted-foreground">Enlace válido por 1 hora</div>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={comprobanteUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="w-4 h-4 mr-1.5" /> Ver
                </a>
              </Button>
            </div>
          )}

          {/* Acciones del solicitante */}
          {isOwner && (canEdit || canDelete || canSend) && (
            <div className="daiki-card p-5 space-y-3">
              <div className="font-semibold">Acciones</div>
              {canSend && (
                <div className="space-y-2">
                  <Textarea rows={2} placeholder="Comentario opcional al enviar..." value={comentario}
                    onChange={(e) => setComentario(e.target.value)} />
                  <Button disabled={submitting} onClick={handleSend}
                    className="bg-accent text-accent-foreground hover:bg-accent-hover font-semibold w-full">
                    <Send className="w-4 h-4 mr-2" /> Enviar a revisión
                  </Button>
                </div>
              )}
              <div className="flex gap-2">
                {canEdit && (
                  <Button asChild variant="secondary" className="flex-1">
                    <Link to={`/ordenes/${orden.id}/editar`}><Edit3 className="w-4 h-4 mr-2" /> Editar</Link>
                  </Button>
                )}
                {canDelete && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar este borrador?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={submitting}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          )}

          {/* Bandeja de verificador/autorizador: placeholder de próxima fase */}
          {!isOwner && (hasRole("verificador") || hasRole("autorizador")) && (
            <div className="daiki-card p-5 text-sm text-muted-foreground">
              Las acciones de aprobación se habilitan en la bandeja correspondiente (próxima fase).
            </div>
          )}
        </div>

        {/* Historial */}
        <aside className="daiki-card p-5 h-fit">
          <div className="font-semibold mb-3">Historial</div>
          {hist.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin eventos aún.</p>
          ) : (
            <ol className="relative border-l border-border pl-4 space-y-4">
              {hist.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-accent ring-4 ring-accent/20" />
                  <div className="text-sm font-semibold">{h.accion}</div>
                  <div className="text-xs text-muted-foreground">
                    {h.usuario_nombre || "—"} · {fmtFechaLarga(h.created_at)}
                  </div>
                  {h.comentario && <div className="text-sm mt-1 p-2 rounded-md bg-secondary">{h.comentario}</div>}
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value || "—"}</div>
    </div>
  );
}

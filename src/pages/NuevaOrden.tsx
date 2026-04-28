import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Paperclip, Save, Send } from "lucide-react";
import { firmasRequeridas, ConfigLimites } from "@/lib/business";

interface FormState {
  empresa_id: string;
  departamento: string;
  categoria_gasto: string;
  concepto: string;
  proveedor_nombre: string;
  proveedor_rfc: string;
  monto: string;
  fecha_pago_requerida: string;
  recurrente: boolean;
  frecuencia: string;
  prioridad: "normal" | "urgente";
  centro_costo: string;
  notas: string;
}

const empty: FormState = {
  empresa_id: "",
  departamento: "",
  categoria_gasto: "",
  concepto: "",
  proveedor_nombre: "",
  proveedor_rfc: "",
  monto: "",
  fecha_pago_requerida: "",
  recurrente: false,
  frecuencia: "",
  prioridad: "normal",
  centro_costo: "",
  notas: "",
};

export default function NuevaOrden() {
  const { id } = useParams<{ id?: string }>();
  const editing = Boolean(id);
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(empty);
  const [empresas, setEmpresas] = useState<{ id: string; nombre: string }[]>([]);
  const [deps, setDeps] = useState<{ id: string; nombre: string }[]>([]);
  const [cats, setCats] = useState<{ id: string; nombre: string }[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [existingComprobante, setExistingComprobante] = useState<string | null>(null);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<ConfigLimites | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: e }, { data: d }, { data: c }, { data: l }] = await Promise.all([
        supabase.from("empresas").select("id, nombre").eq("activa", true).order("nombre"),
        supabase.from("catalogo_departamentos").select("id, nombre").eq("activo", true).order("nombre"),
        supabase.from("catalogo_categorias").select("id, nombre").eq("activo", true).order("nombre"),
        supabase.from("configuracion_limites").select("*").eq("id", 1).maybeSingle(),
      ]);
      setEmpresas(e ?? []);
      setDeps(d ?? []);
      setCats(c ?? []);
      setCfg(l as ConfigLimites | null);

      if (!editing && profile?.empresa_id) {
        setForm((f) => ({ ...f, empresa_id: profile.empresa_id! }));
      }

      if (editing && id) {
        const { data: orden, error } = await supabase.from("ordenes_pago").select("*").eq("id", id).maybeSingle();
        if (error || !orden) {
          toast.error("No encontramos la orden");
          navigate("/mis-ordenes");
          return;
        }
        setForm({
          empresa_id: orden.empresa_id,
          departamento: orden.departamento,
          categoria_gasto: orden.categoria_gasto,
          concepto: orden.concepto,
          proveedor_nombre: orden.proveedor_nombre || "",
          proveedor_rfc: orden.proveedor_rfc || "",
          monto: String(orden.monto),
          fecha_pago_requerida: orden.fecha_pago_requerida || "",
          recurrente: orden.recurrente,
          frecuencia: orden.frecuencia || "",
          prioridad: orden.prioridad as "normal" | "urgente",
          centro_costo: orden.centro_costo || "",
          notas: orden.notas || "",
        });
        setExistingComprobante(orden.comprobante_path);
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const up = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const validate = (): string | null => {
    if (!form.empresa_id) return "Selecciona la empresa";
    if (!form.departamento) return "Selecciona el departamento";
    if (!form.categoria_gasto) return "Selecciona la categoría de gasto";
    if (!form.concepto.trim()) return "Captura el concepto";
    if (form.concepto.length > 200) return "El concepto no puede exceder 200 caracteres";
    const monto = Number(form.monto);
    if (!monto || monto <= 0) return "El monto debe ser mayor a cero";
    if (form.recurrente && !form.frecuencia) return "Indica la frecuencia del pago recurrente";
    return null;
  };

  const uploadComprobante = async (ordenId: string): Promise<string | null> => {
    if (!file) return existingComprobante;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("El archivo supera los 10 MB");
      throw new Error("archivo muy grande");
    }
    const ext = file.name.split(".").pop() || "bin";
    const path = `${profile!.id}/${ordenId}.${ext}`;
    const { error } = await supabase.storage.from("comprobantes").upload(path, file, {
      upsert: true, contentType: file.type || undefined,
    });
    if (error) throw error;
    return path;
  };

  const handleSave = async (accion: "borrador" | "enviar") => {
    const err = validate();
    if (err) { toast.error(err); return; }
    if (!cfg) { toast.error("Configuración no disponible"); return; }

    setSaving(true);
    try {
      const monto = Number(form.monto);
      const base = {
        empresa_id: form.empresa_id,
        solicitante_id: profile!.id,
        departamento: form.departamento,
        categoria_gasto: form.categoria_gasto,
        concepto: form.concepto.trim(),
        proveedor_nombre: form.proveedor_nombre.trim(),
        proveedor_rfc: form.proveedor_rfc.trim() || null,
        monto,
        fecha_pago_requerida: form.fecha_pago_requerida || null,
        recurrente: form.recurrente,
        frecuencia: form.recurrente ? (form.frecuencia as any) : null,
        prioridad: form.prioridad,
        centro_costo: form.centro_costo.trim() || null,
        notas: form.notas.trim() || null,
        status: (accion === "enviar" ? "en_revision" : "borrador") as "en_revision" | "borrador",
        firmas_requeridas: firmasRequeridas(monto, cfg),
      };

      let ordenId = id;
      if (editing && id) {
        const { error } = await supabase.from("ordenes_pago").update(base).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("ordenes_pago").insert(base).select("id").single();
        if (error) throw error;
        ordenId = data.id;
      }

      let comprobante_path: string | null = existingComprobante;
      if (file && ordenId) {
        comprobante_path = await uploadComprobante(ordenId);
        await supabase.from("ordenes_pago").update({ comprobante_path }).eq("id", ordenId);
      }

      // Historial
      await supabase.from("orden_historial").insert({
        orden_id: ordenId!,
        usuario_id: profile!.id,
        usuario_nombre: profile!.nombre,
        accion: accion === "enviar" ? "Enviada a revisión" : (editing ? "Borrador actualizado" : "Borrador creado"),
      });

      // TODO fase 2: notificar a verificadores por email cuando accion === "enviar"

      toast.success(accion === "enviar" ? "Orden enviada a revisión" : "Borrador guardado");
      navigate("/mis-ordenes");
    } catch (e: any) {
      toast.error("No pudimos guardar", { description: e.message ?? String(e) });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-extrabold">{editing ? "Editar orden" : "Nueva orden de pago"}</h1>
          <p className="text-sm text-muted-foreground">Completa todos los campos requeridos. Puedes guardar como borrador o enviarla a revisión.</p>
        </div>
      </div>

      <form className="daiki-card p-5 md:p-6 space-y-6" onSubmit={(e) => { e.preventDefault(); handleSave("enviar"); }}>
        {/* Empresa y depto */}
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Empresa" required>
            <Select value={form.empresa_id} onValueChange={(v) => up("empresa_id", v)}>
              <SelectTrigger><SelectValue placeholder="Selecciona empresa" /></SelectTrigger>
              <SelectContent>
                {empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Departamento" required>
            <Select value={form.departamento} onValueChange={(v) => up("departamento", v)}>
              <SelectTrigger><SelectValue placeholder="Selecciona departamento" /></SelectTrigger>
              <SelectContent>
                {deps.map((d) => <SelectItem key={d.id} value={d.nombre}>{d.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Categoría de gasto" required>
          <Select value={form.categoria_gasto} onValueChange={(v) => up("categoria_gasto", v)}>
            <SelectTrigger><SelectValue placeholder="Selecciona categoría" /></SelectTrigger>
            <SelectContent>
              {cats.map((c) => <SelectItem key={c.id} value={c.nombre}>{c.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Concepto" required hint={`${form.concepto.length}/200`}>
          <Input
            maxLength={200} value={form.concepto}
            onChange={(e) => up("concepto", e.target.value)}
            placeholder="¿Qué se va a pagar?"
          />
        </Field>

        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Proveedor">
            <Input value={form.proveedor_nombre} onChange={(e) => up("proveedor_nombre", e.target.value)} placeholder="Razón social" />
          </Field>
          <Field label="RFC proveedor">
            <Input value={form.proveedor_rfc} onChange={(e) => up("proveedor_rfc", e.target.value)} placeholder="Opcional" />
          </Field>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Monto (MXN)" required>
            <Input
              type="number" step="0.01" min="0" inputMode="decimal"
              value={form.monto} onChange={(e) => up("monto", e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Fecha de pago requerida">
            <Input type="date" value={form.fecha_pago_requerida}
              onChange={(e) => up("fecha_pago_requerida", e.target.value)} />
          </Field>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Centro de costo">
            <Input value={form.centro_costo} onChange={(e) => up("centro_costo", e.target.value)} placeholder="Ej. CC-001" />
          </Field>
          <Field label="Prioridad">
            <RadioGroup
              value={form.prioridad}
              onValueChange={(v) => up("prioridad", v as "normal" | "urgente")}
              className="flex gap-4 pt-2"
            >
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <RadioGroupItem value="normal" id="prio-n" /> Normal
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <RadioGroupItem value="urgente" id="prio-u" />
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-warning" /> Urgente
                </span>
              </label>
            </RadioGroup>
          </Field>
        </div>

        {/* Recurrente */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-secondary">
          <div>
            <Label className="font-semibold">Pago recurrente</Label>
            <p className="text-xs text-muted-foreground mt-0.5">Actívalo si este gasto se repite periódicamente.</p>
          </div>
          <Switch checked={form.recurrente} onCheckedChange={(v) => up("recurrente", v)} />
        </div>
        {form.recurrente && (
          <Field label="Frecuencia" required>
            <Select value={form.frecuencia} onValueChange={(v) => up("frecuencia", v)}>
              <SelectTrigger><SelectValue placeholder="Selecciona frecuencia" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mensual">Mensual</SelectItem>
                <SelectItem value="quincenal">Quincenal</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}

        <Field label="Comprobante (PDF o imagen, máx 10 MB)">
          <label className="flex items-center gap-3 border border-dashed border-border rounded-lg px-4 py-3 cursor-pointer hover:border-accent transition-colors">
            <Paperclip className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground flex-1 truncate">
              {file ? file.name : existingComprobante ? "Comprobante ya cargado · Reemplazar" : "Seleccionar archivo (opcional)"}
            </span>
            <input
              type="file" accept="application/pdf,image/*" className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </Field>

        <Field label="Notas">
          <Textarea rows={3} value={form.notas} onChange={(e) => up("notas", e.target.value)}
            placeholder="Comentarios, detalles adicionales..." />
        </Field>

        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-border">
          <Button type="button" variant="secondary" disabled={saving} onClick={() => handleSave("borrador")}>
            <Save className="w-4 h-4 mr-2" /> Guardar borrador
          </Button>
          <Button type="submit" disabled={saving}
            className="bg-accent text-accent-foreground hover:bg-accent-hover font-semibold flex-1 sm:flex-none">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Enviar a revisión
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm">
          {label}{required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtMXN, STATUS_LABEL } from "@/lib/business";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import { Loader2, TrendingUp, Clock, CheckCircle2, XCircle, Download } from "lucide-react";

interface Orden {
  id: string;
  folio: number;
  monto: number;
  concepto: string;
  proveedor_nombre: string | null;
  departamento: string;
  categoria_gasto: string;
  status: string;
  created_at: string;
  autorizado_at: string | null;
  autorizado_por_rol: string | null;
  solicitante_id: string;
  autorizado_por_id: string | null;
  vobo_verificador_id: string | null;
  vobo_verificador_nombre: string | null;
}

const COLORS = ["#47D7AC", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

export default function Dashboard() {
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [perfiles, setPerfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Default: primer día del mes actual al día actual
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [desde, setDesde] = useState<Date>(firstOfMonth);
  const [hasta, setHasta] = useState<Date>(today);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const desdeISO = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate(), 0, 0, 0).toISOString();
      const hastaISO = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate(), 23, 59, 59).toISOString();

      const { data } = await supabase
        .from("ordenes_pago")
        .select("id, folio, monto, concepto, proveedor_nombre, departamento, categoria_gasto, status, created_at, autorizado_at, autorizado_por_rol, solicitante_id, autorizado_por_id, vobo_verificador_id, vobo_verificador_nombre")
        .gte("created_at", desdeISO)
        .lte("created_at", hastaISO)
        .order("created_at", { ascending: false });

      const list = (data ?? []) as Orden[];
      setOrdenes(list);

      // Cargar nombres de perfiles involucrados
      const ids = new Set<string>();
      list.forEach((o) => {
        if (o.solicitante_id) ids.add(o.solicitante_id);
        if (o.autorizado_por_id) ids.add(o.autorizado_por_id);
      });
      if (ids.size > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nombre, email")
          .in("id", Array.from(ids));
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p: any) => { map[p.id] = p.nombre || p.email || ""; });
        setPerfiles(map);
      } else {
        setPerfiles({});
      }
      setLoading(false);
    })();
  }, [desde, hasta]);

  const kpis = useMemo(() => {
    const aprobadas = ordenes.filter((o) => o.status === "aprobada");
    const pendientes = ordenes.filter((o) => ["en_revision", "en_autorizacion"].includes(o.status));
    const rechazadas = ordenes.filter((o) => o.status === "rechazada");
    const totalAprobado = aprobadas.reduce((s, o) => s + Number(o.monto), 0);
    const totalPendiente = pendientes.reduce((s, o) => s + Number(o.monto), 0);
    return {
      total: ordenes.length,
      aprobadas: aprobadas.length,
      pendientes: pendientes.length,
      rechazadas: rechazadas.length,
      totalAprobado, totalPendiente,
    };
  }, [ordenes]);

  const porCategoria = useMemo(() => {
    const map = new Map<string, number>();
    ordenes.filter(o => o.status === "aprobada").forEach((o) => {
      map.set(o.categoria_gasto, (map.get(o.categoria_gasto) ?? 0) + Number(o.monto));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 8);
  }, [ordenes]);

  const porDepto = useMemo(() => {
    const map = new Map<string, number>();
    ordenes.filter(o => o.status === "aprobada").forEach((o) => {
      map.set(o.departamento, (map.get(o.departamento) ?? 0) + Number(o.monto));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 8);
  }, [ordenes]);

  const porStatus = useMemo(() => {
    const map = new Map<string, number>();
    ordenes.forEach((o) => {
      map.set(o.status, (map.get(o.status) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([k, v]) => ({ name: STATUS_LABEL[k] ?? k, value: v }));
  }, [ordenes]);

  const exportarCsv = () => {
    const headers = [
      "folio", "fecha", "concepto", "proveedor", "departamento", "categoria",
      "monto", "status", "capturista", "verificador", "autorizador", "autorizado_at",
    ];
    const rows = ordenes.map((o) => {
      const capturista = perfiles[o.solicitante_id] ?? "";
      const verificador = o.vobo_verificador_nombre
        ?? (o.autorizado_por_rol === "verificador" && o.autorizado_por_id ? (perfiles[o.autorizado_por_id] ?? "") : "");
      const autorizador = o.autorizado_por_rol === "autorizador" && o.autorizado_por_id
        ? (perfiles[o.autorizado_por_id] ?? "") : "";
      return [
        o.folio, o.created_at, o.concepto, o.proveedor_nombre ?? "", o.departamento,
        o.categoria_gasto, o.monto, o.status, capturista, verificador, autorizador,
        o.autorizado_at ?? "",
      ];
    });
    const csv = [headers, ...rows].map((r) =>
      r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const fname = `ordenes_${format(desde, "yyyy-MM-dd")}_a_${format(hasta, "yyyy-MM-dd")}.csv`;
    a.href = url; a.download = fname; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Dashboard ejecutivo</h1>
          <p className="text-sm text-muted-foreground">Resumen del flujo de autorizaciones</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <DateField label="Desde" date={desde} onChange={(d) => d && setDesde(d)} maxDate={hasta} />
          <DateField label="Hasta" date={hasta} onChange={(d) => d && setHasta(d)} minDate={desde} />
          <Button onClick={exportarCsv} variant="outline" className="h-10 gap-2">
            <Download className="w-4 h-4" /> CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={<TrendingUp className="w-5 h-5" />} label="Total aprobado" value={fmtMXN(kpis.totalAprobado)} color="text-accent" />
        <Kpi icon={<Clock className="w-5 h-5" />} label="Pendiente" value={fmtMXN(kpis.totalPendiente)} color="text-info" />
        <Kpi icon={<CheckCircle2 className="w-5 h-5" />} label="Órdenes aprobadas" value={String(kpis.aprobadas)} color="text-accent" />
        <Kpi icon={<XCircle className="w-5 h-5" />} label="Rechazadas" value={String(kpis.rechazadas)} color="text-destructive" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Gasto aprobado por categoría">
          {porCategoria.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={porCategoria} margin={{ left: 0, right: 8, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => fmtMXN(Number(v))} />
                <Bar dataKey="value" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Gasto por departamento">
          {porDepto.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={porDepto} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} label={(e: any) => e.name}>
                  {porDepto.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => fmtMXN(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Distribución por estatus">
          {porStatus.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={porStatus} layout="vertical" margin={{ left: 16, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function DateField({
  label, date, onChange, minDate, maxDate,
}: {
  label: string;
  date: Date;
  onChange: (d?: Date) => void;
  minDate?: Date;
  maxDate?: Date;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("h-10 justify-start text-left font-normal gap-2")}>
          <CalendarIcon className="w-4 h-4 opacity-60" />
          <span className="text-xs text-muted-foreground">{label}:</span>
          {format(date, "dd MMM yyyy", { locale: es })}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onChange}
          disabled={(d) => (minDate ? d < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()) : false) || (maxDate ? d > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate()) : false)}
          initialFocus
          locale={es}
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

function Kpi({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="daiki-card p-4">
      <div className={`${color} mb-2`}>{icon}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">{label}</div>
      <div className="text-xl font-extrabold mt-1 truncate">{value}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="daiki-card p-4 md:p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Empty() {
  return <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">Sin datos en este rango</div>;
}

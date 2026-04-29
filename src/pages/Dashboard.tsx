import { useEffect, useMemo, useState } from "react";
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, Loader2, TrendingUp, Clock, CheckCircle2, XCircle, Download, FileText } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fmtMXN, STATUS_LABEL } from "@/lib/business";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";

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
  const { user, hasRole } = useAuth();
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [ordenesPrev, setOrdenesPrev] = useState<Orden[]>([]);
  const [perfiles, setPerfiles] = useState<Record<string, string>>({});
  const [scopeDeptos, setScopeDeptos] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [desde, setDesde] = useState<Date>(firstOfMonth);
  const [hasta, setHasta] = useState<Date>(today);

  // Scope del verificador (solo informativo: el filtrado real lo hace RLS)
  useEffect(() => {
    if (!user || !hasRole("verificador") || hasRole("admin") || hasRole("autorizador")) {
      setScopeDeptos(null);
      return;
    }
    supabase.from("verificador_scope").select("departamento").eq("user_id", user.id)
      .then(({ data }) => setScopeDeptos((data ?? []).map((r: any) => r.departamento)));
  }, [user, hasRole]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const desdeISO = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate(), 0, 0, 0).toISOString();
      const hastaISO = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate(), 23, 59, 59).toISOString();

      const cols = "id, folio, monto, concepto, proveedor_nombre, departamento, categoria_gasto, status, created_at, autorizado_at, autorizado_por_rol, solicitante_id, autorizado_por_id, vobo_verificador_id, vobo_verificador_nombre";

      // Periodo seleccionado
      const { data } = await supabase
        .from("ordenes_pago").select(cols)
        .gte("created_at", desdeISO).lte("created_at", hastaISO)
        .order("created_at", { ascending: false });

      // Mes calendario anterior al "desde" (para comparativo)
      const prevStart = startOfMonth(subMonths(desde, 1));
      const prevEnd = endOfMonth(subMonths(desde, 1));
      const { data: dataPrev } = await supabase
        .from("ordenes_pago").select(cols)
        .gte("created_at", prevStart.toISOString())
        .lte("created_at", prevEnd.toISOString());

      const list = (data ?? []) as Orden[];
      const listPrev = (dataPrev ?? []) as Orden[];
      setOrdenes(list);
      setOrdenesPrev(listPrev);

      // Cargar nombres de perfiles
      const ids = new Set<string>();
      [...list, ...listPrev].forEach((o) => {
        if (o.solicitante_id) ids.add(o.solicitante_id);
        if (o.autorizado_por_id) ids.add(o.autorizado_por_id);
      });
      if (ids.size > 0) {
        const { data: profs } = await supabase
          .from("profiles").select("id, nombre, email")
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

  // ---------- KPIs ----------
  const kpis = useMemo(() => {
    const aprobadas = ordenes.filter((o) => o.status === "aprobada");
    const pendientes = ordenes.filter((o) => ["en_revision", "en_autorizacion"].includes(o.status));
    const rechazadas = ordenes.filter((o) => o.status === "rechazada");
    return {
      total: ordenes.length,
      aprobadas: aprobadas.length,
      pendientes: pendientes.length,
      rechazadas: rechazadas.length,
      totalAprobado: aprobadas.reduce((s, o) => s + Number(o.monto), 0),
      totalPendiente: pendientes.reduce((s, o) => s + Number(o.monto), 0),
    };
  }, [ordenes]);

  // ---------- Resumen (gráficas) ----------
  const aprobadasPeriodo = useMemo(() => ordenes.filter((o) => o.status === "aprobada"), [ordenes]);

  const porCategoria = useMemo(() => {
    const map = new Map<string, number>();
    aprobadasPeriodo.forEach((o) => map.set(o.categoria_gasto, (map.get(o.categoria_gasto) ?? 0) + Number(o.monto)));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [aprobadasPeriodo]);

  const porDepto = useMemo(() => {
    const map = new Map<string, number>();
    aprobadasPeriodo.forEach((o) => map.set(o.departamento, (map.get(o.departamento) ?? 0) + Number(o.monto)));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [aprobadasPeriodo]);

  const porStatus = useMemo(() => {
    const map = new Map<string, number>();
    ordenes.forEach((o) => map.set(o.status, (map.get(o.status) ?? 0) + 1));
    return Array.from(map.entries()).map(([k, v]) => ({ name: STATUS_LABEL[k] ?? k, value: v }));
  }, [ordenes]);

  // ---------- Reporte: Departamento × Categoría ----------
  const matriz = useMemo(() => {
    const deptos = new Set<string>();
    const cats = new Set<string>();
    const cell = new Map<string, number>();
    aprobadasPeriodo.forEach((o) => {
      deptos.add(o.departamento); cats.add(o.categoria_gasto);
      const k = `${o.departamento}__${o.categoria_gasto}`;
      cell.set(k, (cell.get(k) ?? 0) + Number(o.monto));
    });
    const deptosArr = Array.from(deptos).sort();
    const catsArr = Array.from(cats).sort();
    const totalDepto = (d: string) => catsArr.reduce((s, c) => s + (cell.get(`${d}__${c}`) ?? 0), 0);
    const totalCat = (c: string) => deptosArr.reduce((s, d) => s + (cell.get(`${d}__${c}`) ?? 0), 0);
    const total = aprobadasPeriodo.reduce((s, o) => s + Number(o.monto), 0);
    return { deptos: deptosArr, cats: catsArr, cell, totalDepto, totalCat, total };
  }, [aprobadasPeriodo]);

  const comparativo = useMemo(() => {
    const sumByDepto = (lst: Orden[]) => {
      const m = new Map<string, number>();
      lst.filter(o => o.status === "aprobada").forEach((o) => m.set(o.departamento, (m.get(o.departamento) ?? 0) + Number(o.monto)));
      return m;
    };
    const cur = sumByDepto(ordenes);
    const prev = sumByDepto(ordenesPrev);
    const allDeptos = new Set([...cur.keys(), ...prev.keys()]);
    return Array.from(allDeptos).map((d) => {
      const c = cur.get(d) ?? 0;
      const p = prev.get(d) ?? 0;
      const delta = p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100;
      return { departamento: d, actual: c, anterior: p, delta };
    }).sort((a, b) => b.actual - a.actual);
  }, [ordenes, ordenesPrev]);

  // ---------- Reporte: Aging de pendientes ----------
  const aging = useMemo(() => {
    const now = new Date();
    const pendientes = ordenes.filter((o) => ["en_revision", "en_autorizacion"].includes(o.status));
    const buckets = { "0-2": [] as Orden[], "3-5": [] as Orden[], "6+": [] as Orden[] };
    pendientes.forEach((o) => {
      const d = differenceInDays(now, new Date(o.created_at));
      if (d <= 2) buckets["0-2"].push(o);
      else if (d <= 5) buckets["3-5"].push(o);
      else buckets["6+"].push(o);
    });
    return buckets;
  }, [ordenes]);

  // ---------- Exportes ----------
  const periodoLabel = `${format(desde, "dd MMM yyyy", { locale: es })} – ${format(hasta, "dd MMM yyyy", { locale: es })}`;
  const fnameBase = `${format(desde, "yyyy-MM-dd")}_a_${format(hasta, "yyyy-MM-dd")}`;

  const downloadCSV = (rows: (string | number)[][], fname: string) => {
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fname; a.click();
    URL.revokeObjectURL(url);
  };

  const exportarOrdenesCSV = () => {
    const headers = ["folio", "fecha", "concepto", "proveedor", "departamento", "categoria", "monto", "status", "capturista", "verificador", "autorizador", "autorizado_at"];
    const rows: (string | number)[][] = ordenes.map((o) => {
      const capturista = perfiles[o.solicitante_id] ?? "";
      const verificador = o.vobo_verificador_nombre ?? (o.autorizado_por_rol === "verificador" && o.autorizado_por_id ? (perfiles[o.autorizado_por_id] ?? "") : "");
      const autorizador = o.autorizado_por_rol === "autorizador" && o.autorizado_por_id ? (perfiles[o.autorizado_por_id] ?? "") : "";
      return [o.folio, o.created_at, o.concepto, o.proveedor_nombre ?? "", o.departamento, o.categoria_gasto, o.monto, o.status, capturista, verificador, autorizador, o.autorizado_at ?? ""];
    });
    downloadCSV([headers, ...rows], `ordenes_${fnameBase}.csv`);
  };

  const exportarMatrizCSV = () => {
    const headers = ["Departamento", ...matriz.cats, "Total"];
    const rows: (string | number)[][] = matriz.deptos.map((d) => [
      d, ...matriz.cats.map((c) => matriz.cell.get(`${d}__${c}`) ?? 0), matriz.totalDepto(d),
    ]);
    rows.push(["TOTAL", ...matriz.cats.map((c) => matriz.totalCat(c)), matriz.total]);
    downloadCSV([headers, ...rows], `depto_categoria_${fnameBase}.csv`);
  };

  const exportarComparativoCSV = () => {
    const headers = ["Departamento", "Periodo actual", "Mes anterior", "Variación %"];
    const rows: (string | number)[][] = comparativo.map((r) => [r.departamento, r.actual, r.anterior, r.delta.toFixed(1)]);
    downloadCSV([headers, ...rows], `comparativo_depto_${fnameBase}.csv`);
  };

  const exportarAgingCSV = () => {
    const headers = ["bucket_dias", "folio", "fecha", "dias_espera", "concepto", "departamento", "monto", "status", "capturista", "responsable_actual"];
    const rows: (string | number)[][] = [];
    (Object.entries(aging) as [keyof typeof aging, Orden[]][]).forEach(([bucket, items]) => {
      items.forEach((o) => {
        const dias = differenceInDays(new Date(), new Date(o.created_at));
        const responsable = o.status === "en_revision" ? "Verificador" : "Autorizador";
        rows.push([bucket, o.folio, o.created_at, dias, o.concepto, o.departamento, o.monto, STATUS_LABEL[o.status] ?? o.status, perfiles[o.solicitante_id] ?? "", responsable]);
      });
    });
    downloadCSV([headers, ...rows], `aging_${fnameBase}.csv`);
  };

  const exportarPDF = () => {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const pageW = doc.internal.pageSize.getWidth();

    // Encabezado
    doc.setFillColor(20, 32, 64);
    doc.rect(0, 0, pageW, 70, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold"); doc.setFontSize(18);
    doc.text("Daiki — Reporte ejecutivo", 40, 32);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(`Periodo: ${periodoLabel}`, 40, 52);
    doc.text(`Generado: ${format(new Date(), "dd MMM yyyy HH:mm", { locale: es })}`, pageW - 40, 52, { align: "right" });

    // KPIs
    doc.setTextColor(0, 0, 0);
    let y = 100;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Indicadores", 40, y); y += 6;
    autoTable(doc, {
      startY: y + 4,
      head: [["Indicador", "Valor"]],
      body: [
        ["Total aprobado", fmtMXN(kpis.totalAprobado)],
        ["Pendiente", fmtMXN(kpis.totalPendiente)],
        ["Órdenes aprobadas", String(kpis.aprobadas)],
        ["Órdenes pendientes", String(kpis.pendientes)],
        ["Órdenes rechazadas", String(kpis.rechazadas)],
        ["Total de órdenes", String(kpis.total)],
      ],
      theme: "striped", headStyles: { fillColor: [71, 215, 172], textColor: 0 }, styles: { fontSize: 10 },
    });

    // Matriz Depto × Categoría
    y = (doc as any).lastAutoTable.finalY + 24;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Gasto aprobado por departamento y categoría", 40, y);
    autoTable(doc, {
      startY: y + 6,
      head: [["Departamento", ...matriz.cats, "Total"]],
      body: [
        ...matriz.deptos.map((d) => [d, ...matriz.cats.map((c) => fmtMXN(matriz.cell.get(`${d}__${c}`) ?? 0)), fmtMXN(matriz.totalDepto(d))]),
        ["TOTAL", ...matriz.cats.map((c) => fmtMXN(matriz.totalCat(c))), fmtMXN(matriz.total)],
      ],
      theme: "grid", headStyles: { fillColor: [59, 130, 246], textColor: 255 }, styles: { fontSize: 8, cellPadding: 4 },
    });

    // Comparativo
    y = (doc as any).lastAutoTable.finalY + 24;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Comparativo vs mes anterior", 40, y);
    autoTable(doc, {
      startY: y + 6,
      head: [["Departamento", "Periodo actual", "Mes anterior", "Variación"]],
      body: comparativo.map((r) => [r.departamento, fmtMXN(r.actual), fmtMXN(r.anterior), `${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(1)}%`]),
      theme: "striped", headStyles: { fillColor: [59, 130, 246], textColor: 255 }, styles: { fontSize: 9 },
    });

    // Aging
    y = (doc as any).lastAutoTable.finalY + 24;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text("Antigüedad de pendientes", 40, y);
    autoTable(doc, {
      startY: y + 6,
      head: [["Bucket", "# órdenes", "Monto"]],
      body: (Object.entries(aging) as [string, Orden[]][]).map(([bucket, items]) => [
        `${bucket} días`, String(items.length), fmtMXN(items.reduce((s, o) => s + Number(o.monto), 0)),
      ]),
      theme: "striped", headStyles: { fillColor: [245, 158, 11], textColor: 0 }, styles: { fontSize: 10 },
    });

    doc.save(`reporte_ejecutivo_${fnameBase}.pdf`);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Dashboard ejecutivo</h1>
          <p className="text-sm text-muted-foreground">Resumen y reportes del periodo</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <DateField label="Desde" date={desde} onChange={(d) => d && setDesde(d)} maxDate={hasta} />
          <DateField label="Hasta" date={hasta} onChange={(d) => d && setHasta(d)} minDate={desde} />
          <Button onClick={exportarPDF} className="h-10 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <FileText className="w-4 h-4" /> PDF ejecutivo
          </Button>
        </div>
      </div>

      {scopeDeptos && scopeDeptos.length > 0 && (
        <div className="rounded-md border border-info/30 bg-info/10 px-4 py-2.5 text-sm">
          <span className="font-semibold text-info">Vista filtrada: </span>
          solo se muestran órdenes de los departamentos {scopeDeptos.map((d) => `"${d}"`).join(", ")}.
        </div>
      )}

        <Kpi icon={<TrendingUp className="w-5 h-5" />} label="Total aprobado" value={fmtMXN(kpis.totalAprobado)} color="text-accent" />
        <Kpi icon={<Clock className="w-5 h-5" />} label="Pendiente" value={fmtMXN(kpis.totalPendiente)} color="text-info" />
        <Kpi icon={<CheckCircle2 className="w-5 h-5" />} label="Órdenes aprobadas" value={String(kpis.aprobadas)} color="text-accent" />
        <Kpi icon={<XCircle className="w-5 h-5" />} label="Rechazadas" value={String(kpis.rechazadas)} color="text-destructive" />
      </div>

      <Tabs defaultValue="resumen" className="w-full">
        <TabsList className="grid grid-cols-3 w-full md:w-auto">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="depto">Depto y categoría</TabsTrigger>
          <TabsTrigger value="aging">Aging</TabsTrigger>
        </TabsList>

        {/* Resumen */}
        <TabsContent value="resumen" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={exportarOrdenesCSV} variant="outline" className="h-9 gap-2">
              <Download className="w-4 h-4" /> CSV de órdenes
            </Button>
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
        </TabsContent>

        {/* Depto y categoría */}
        <TabsContent value="depto" className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-2 justify-end">
            <Button onClick={exportarMatrizCSV} variant="outline" className="h-9 gap-2">
              <Download className="w-4 h-4" /> CSV matriz
            </Button>
            <Button onClick={exportarComparativoCSV} variant="outline" className="h-9 gap-2">
              <Download className="w-4 h-4" /> CSV comparativo
            </Button>
          </div>

          <div className="daiki-card p-4 md:p-5 overflow-x-auto">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3">
              Gasto aprobado por departamento × categoría
            </h2>
            {matriz.deptos.length === 0 ? <Empty /> : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-2 font-semibold">Departamento</th>
                    {matriz.cats.map((c) => <th key={c} className="text-right p-2 font-semibold whitespace-nowrap">{c}</th>)}
                    <th className="text-right p-2 font-semibold bg-muted/50">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {matriz.deptos.map((d) => (
                    <tr key={d} className="border-b border-border/50">
                      <td className="p-2 font-medium">{d}</td>
                      {matriz.cats.map((c) => {
                        const v = matriz.cell.get(`${d}__${c}`) ?? 0;
                        return <td key={c} className="text-right p-2 tabular-nums text-muted-foreground">{v ? fmtMXN(v) : "—"}</td>;
                      })}
                      <td className="text-right p-2 tabular-nums font-semibold bg-muted/30">{fmtMXN(matriz.totalDepto(d))}</td>
                    </tr>
                  ))}
                  <tr className="bg-muted/50 font-bold">
                    <td className="p-2">TOTAL</td>
                    {matriz.cats.map((c) => <td key={c} className="text-right p-2 tabular-nums">{fmtMXN(matriz.totalCat(c))}</td>)}
                    <td className="text-right p-2 tabular-nums">{fmtMXN(matriz.total)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          <div className="daiki-card p-4 md:p-5 overflow-x-auto">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3">
              Comparativo vs mes anterior ({format(subMonths(desde, 1), "MMMM yyyy", { locale: es })})
            </h2>
            {comparativo.length === 0 ? <Empty /> : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-2 font-semibold">Departamento</th>
                    <th className="text-right p-2 font-semibold">Periodo actual</th>
                    <th className="text-right p-2 font-semibold">Mes anterior</th>
                    <th className="text-right p-2 font-semibold">Variación</th>
                  </tr>
                </thead>
                <tbody>
                  {comparativo.map((r) => (
                    <tr key={r.departamento} className="border-b border-border/50">
                      <td className="p-2 font-medium">{r.departamento}</td>
                      <td className="text-right p-2 tabular-nums">{fmtMXN(r.actual)}</td>
                      <td className="text-right p-2 tabular-nums text-muted-foreground">{fmtMXN(r.anterior)}</td>
                      <td className={cn("text-right p-2 tabular-nums font-semibold", r.delta >= 0 ? "text-accent" : "text-destructive")}>
                        {r.delta >= 0 ? "+" : ""}{r.delta.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* Aging */}
        <TabsContent value="aging" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={exportarAgingCSV} variant="outline" className="h-9 gap-2">
              <Download className="w-4 h-4" /> CSV aging
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(["0-2", "3-5", "6+"] as const).map((b) => {
              const items = aging[b];
              const monto = items.reduce((s, o) => s + Number(o.monto), 0);
              const tone = b === "0-2" ? "text-accent" : b === "3-5" ? "text-amber-500" : "text-destructive";
              return (
                <div key={b} className="daiki-card p-4">
                  <div className={`text-xs font-bold uppercase tracking-wide ${tone}`}>{b} días en espera</div>
                  <div className="text-2xl font-extrabold mt-1">{items.length}</div>
                  <div className="text-sm text-muted-foreground">{fmtMXN(monto)}</div>
                </div>
              );
            })}
          </div>

          {(["6+", "3-5", "0-2"] as const).map((b) => {
            const items = aging[b];
            if (items.length === 0) return null;
            return (
              <div key={b} className="daiki-card p-4 md:p-5 overflow-x-auto">
                <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-3">
                  Pendientes de {b} días ({items.length})
                </h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 font-semibold">Folio</th>
                      <th className="text-left p-2 font-semibold">Concepto</th>
                      <th className="text-left p-2 font-semibold">Depto</th>
                      <th className="text-right p-2 font-semibold">Monto</th>
                      <th className="text-left p-2 font-semibold">Estatus</th>
                      <th className="text-left p-2 font-semibold">Responsable</th>
                      <th className="text-right p-2 font-semibold">Días</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((o) => {
                      const dias = differenceInDays(new Date(), new Date(o.created_at));
                      const responsable = o.status === "en_revision" ? "Verificador" : "Autorizador";
                      return (
                        <tr key={o.id} className="border-b border-border/50">
                          <td className="p-2 font-mono text-xs">#{o.folio}</td>
                          <td className="p-2 max-w-[260px] truncate">{o.concepto}</td>
                          <td className="p-2 text-muted-foreground">{o.departamento}</td>
                          <td className="text-right p-2 tabular-nums">{fmtMXN(Number(o.monto))}</td>
                          <td className="p-2 text-muted-foreground">{STATUS_LABEL[o.status] ?? o.status}</td>
                          <td className="p-2">{responsable}</td>
                          <td className="text-right p-2 tabular-nums font-semibold">{dias}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}

          {Object.values(aging).every((a) => a.length === 0) && (
            <div className="daiki-card p-8 text-center text-muted-foreground">
              No hay órdenes pendientes en este periodo. 🎉
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DateField({
  label, date, onChange, minDate, maxDate,
}: { label: string; date: Date; onChange: (d?: Date) => void; minDate?: Date; maxDate?: Date }) {
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
          disabled={(d) =>
            (minDate ? d < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()) : false) ||
            (maxDate ? d > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate()) : false)
          }
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
  return <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">Sin datos en este rango</div>;
}

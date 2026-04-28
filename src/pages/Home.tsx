import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fmtMXN } from "@/lib/business";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, FilePlus2, Inbox, LayoutDashboard, ShieldCheck } from "lucide-react";

export default function Home() {
  const { profile, primaryRole, hasRole } = useAuth();
  const [stats, setStats] = useState<{ misOrdenes?: number; pendientes?: number; aprobadasMes?: number; montoMes?: number }>({});

  useEffect(() => {
    (async () => {
      const now = new Date();
      const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      if (hasRole("capturista") || hasRole("admin")) {
        const { count } = await supabase
          .from("ordenes_pago").select("*", { count: "exact", head: true })
          .eq("solicitante_id", profile!.id);
        setStats((s) => ({ ...s, misOrdenes: count ?? 0 }));
      }
      if (hasRole("verificador") || hasRole("autorizador") || hasRole("admin")) {
        const { count: p } = await supabase
          .from("ordenes_pago").select("*", { count: "exact", head: true })
          .in("status", ["en_revision", "en_autorizacion"]);
        const { data: aprobMes } = await supabase
          .from("ordenes_pago").select("monto")
          .eq("status", "aprobada").gte("autorizado_at", inicioMes);
        const total = (aprobMes ?? []).reduce((acc, r: any) => acc + Number(r.monto || 0), 0);
        setStats((s) => ({ ...s, pendientes: p ?? 0, aprobadasMes: aprobMes?.length ?? 0, montoMes: total }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  return (
    <div className="space-y-8">
      {/* Hero saludo */}
      <section className="bg-primary text-primary-foreground rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-accent mb-1">
            {primaryRole === "admin" ? "Administrador" :
             primaryRole === "autorizador" ? "Autorizador" :
             primaryRole === "verificador" ? "Verificador" :
             primaryRole === "capturista" ? "Capturista" : "Usuario"}
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold">
            Hola, {profile?.nombre?.split(" ")[0] || "bienvenido"}.
          </h1>
          <p className="text-primary-foreground/80 text-sm mt-1 max-w-xl">
            Este es tu tablero de Daiki. Desde aquí puedes capturar, revisar y autorizar órdenes de pago.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(hasRole("capturista") || hasRole("admin")) && (
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent-hover font-semibold">
              <Link to="/ordenes/nueva"><FilePlus2 className="w-4 h-4 mr-2" /> Nueva orden</Link>
            </Button>
          )}
          {(hasRole("verificador") || hasRole("admin")) && (
            <Button asChild variant="secondary"><Link to="/bandeja/revision"><Inbox className="w-4 h-4 mr-2" /> Bandeja de revisión</Link></Button>
          )}
          {(hasRole("autorizador") || hasRole("admin")) && (
            <Button asChild variant="secondary"><Link to="/bandeja/autorizacion"><ShieldCheck className="w-4 h-4 mr-2" /> Bandeja de autorización</Link></Button>
          )}
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(hasRole("capturista") || hasRole("admin")) && (
          <KpiCard label="Mis órdenes" value={String(stats.misOrdenes ?? "—")} hint="Total capturadas por ti" />
        )}
        {(hasRole("verificador") || hasRole("autorizador") || hasRole("admin")) && (
          <>
            <KpiCard label="Pendientes" value={String(stats.pendientes ?? "—")} hint="En revisión o autorización" accent />
            <KpiCard label="Aprobadas este mes" value={String(stats.aprobadasMes ?? "—")} />
            <KpiCard label="Monto autorizado (mes)" value={fmtMXN(stats.montoMes ?? 0)} />
          </>
        )}
      </section>

      {/* Accesos */}
      <section className="grid md:grid-cols-2 gap-4">
        {(hasRole("verificador") || hasRole("autorizador") || hasRole("admin")) && (
          <AccessCard to="/dashboard" title="Dashboard ejecutivo" icon={<LayoutDashboard className="w-5 h-5" />}
            text="Indicadores, gasto por categoría y departamento, exportación a CSV." />
        )}
        {hasRole("admin") && (
          <AccessCard to="/admin" title="Panel de administración" icon={<ShieldCheck className="w-5 h-5" />}
            text="Invita usuarios, ajusta umbrales de autorización y gestiona catálogos." />
        )}
      </section>
    </div>
  );
}

function KpiCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`daiki-kpi ${accent ? "ring-1 ring-accent/40" : ""}`}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl md:text-3xl font-extrabold mt-1">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function AccessCard({ to, title, text, icon }: { to: string; title: string; text: string; icon: React.ReactNode }) {
  return (
    <Link to={to} className="daiki-card p-5 hover:border-accent transition-colors group">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-accent/15 text-accent flex items-center justify-center">{icon}</div>
        <div className="flex-1">
          <div className="font-semibold flex items-center gap-2">{title}
            <ArrowRight className="w-4 h-4 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">{text}</div>
        </div>
      </div>
    </Link>
  );
}

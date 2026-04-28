import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtFechaCorta, fmtMXN } from "@/lib/business";
import { FilePlus2, Loader2, Search } from "lucide-react";

interface Orden {
  id: string;
  folio: number;
  concepto: string;
  monto: number;
  status: string;
  prioridad: string;
  created_at: string;
  fecha_pago_requerida: string | null;
  departamento: string;
  categoria_gasto: string;
}

export default function MisOrdenes() {
  const { profile } = useAuth();
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("todos");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("ordenes_pago")
        .select("id, folio, concepto, monto, status, prioridad, created_at, fecha_pago_requerida, departamento, categoria_gasto")
        .eq("solicitante_id", profile!.id)
        .order("created_at", { ascending: false });
      if (!error) setOrdenes((data ?? []) as Orden[]);
      setLoading(false);
    })();
  }, [profile?.id]);

  const filtered = useMemo(() => {
    return ordenes.filter((o) => {
      if (status !== "todos" && o.status !== status) return false;
      if (q && !(`${o.folio} ${o.concepto} ${o.categoria_gasto} ${o.departamento}`.toLowerCase().includes(q.toLowerCase())))
        return false;
      return true;
    });
  }, [ordenes, status, q]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Mis órdenes</h1>
          <p className="text-sm text-muted-foreground">Todas las órdenes que has capturado.</p>
        </div>
        <Button asChild className="bg-accent text-accent-foreground hover:bg-accent-hover font-semibold self-start md:self-auto">
          <Link to="/ordenes/nueva"><FilePlus2 className="w-4 h-4 mr-2" /> Nueva orden</Link>
        </Button>
      </div>

      {/* Filtros */}
      <div className="daiki-card p-3 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por folio, concepto, categoría..."
            className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los estatus</SelectItem>
            <SelectItem value="borrador">Borrador</SelectItem>
            <SelectItem value="en_revision">En revisión</SelectItem>
            <SelectItem value="en_autorizacion">En autorización</SelectItem>
            <SelectItem value="aprobada">Aprobada</SelectItem>
            <SelectItem value="rechazada">Rechazada</SelectItem>
            <SelectItem value="devuelta">Devuelta</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
      ) : filtered.length === 0 ? (
        <div className="daiki-card p-12 text-center">
          <div className="text-lg font-semibold">Sin órdenes aún</div>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Crea la primera para comenzar.</p>
          <Button asChild className="bg-accent text-accent-foreground hover:bg-accent-hover">
            <Link to="/ordenes/nueva">Nueva orden</Link>
          </Button>
        </div>
      ) : (
        <div className="daiki-card overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-secondary-foreground">
                <tr className="text-left">
                  <Th>Folio</Th><Th>Concepto</Th><Th>Categoría</Th>
                  <Th className="text-right">Monto</Th><Th>Fecha captura</Th><Th>Estatus</Th><Th></Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id} className="border-t border-border hover:bg-secondary/40 transition-colors">
                    <td className="px-3 py-3 font-mono text-xs">#{String(o.folio).padStart(5, "0")}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium line-clamp-1 max-w-xs">{o.concepto}</div>
                      <div className="text-xs text-muted-foreground">{o.departamento}</div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{o.categoria_gasto}</td>
                    <td className="px-3 py-3 text-right font-semibold">{fmtMXN(o.monto)}</td>
                    <td className="px-3 py-3 text-muted-foreground">{fmtFechaCorta(o.created_at)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={o.status} />
                        {o.prioridad === "urgente" && (
                          <span className="daiki-badge bg-warning/15 text-warning border border-warning/30">Urgente</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/ordenes/${o.id}`}>Ver</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-border">
            {filtered.map((o) => (
              <Link to={`/ordenes/${o.id}`} key={o.id} className="block p-4 hover:bg-secondary/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">#{String(o.folio).padStart(5, "0")}</span>
                      <span>·</span>
                      <span>{o.categoria_gasto}</span>
                    </div>
                    <div className="font-semibold mt-1 line-clamp-2">{o.concepto}</div>
                    <div className="text-xs text-muted-foreground mt-1">{o.departamento} · {fmtFechaCorta(o.created_at)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold">{fmtMXN(o.monto)}</div>
                    <div className="mt-1"><StatusBadge status={o.status} /></div>
                  </div>
                </div>
                {o.prioridad === "urgente" && (
                  <div className="mt-2"><span className="daiki-badge bg-warning/15 text-warning border border-warning/30">Urgente</span></div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wider ${className}`}>{children}</th>;
}

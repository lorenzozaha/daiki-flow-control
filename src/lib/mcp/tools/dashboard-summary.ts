import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "dashboard_summary",
  title: "Resumen del dashboard",
  description:
    "Devuelve conteos por estatus y montos totales de las órdenes visibles para el usuario autenticado (respeta RLS y scope por departamento).",
  inputSchema: {
    dias: z.number().int().min(1).max(365).default(30).describe("Ventana en días hacia atrás."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ dias }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    const desde = new Date(Date.now() - dias * 86400_000).toISOString();
    const { data, error } = await supabaseForUser(ctx)
      .from("ordenes_pago")
      .select("status, monto, moneda, departamento")
      .gte("created_at", desde);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const porStatus: Record<string, { count: number; monto: number }> = {};
    const porDepto: Record<string, { count: number; monto: number }> = {};
    for (const r of data ?? []) {
      const s = r.status as string;
      porStatus[s] ??= { count: 0, monto: 0 };
      porStatus[s].count++;
      porStatus[s].monto += Number(r.monto ?? 0);
      const d = r.departamento as string;
      porDepto[d] ??= { count: 0, monto: 0 };
      porDepto[d].count++;
      porDepto[d].monto += Number(r.monto ?? 0);
    }
    const summary = { dias, total: data?.length ?? 0, por_status: porStatus, por_departamento: porDepto };
    return {
      content: [{ type: "text", text: JSON.stringify(summary) }],
      structuredContent: summary,
    };
  },
});

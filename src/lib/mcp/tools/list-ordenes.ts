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
  name: "list_ordenes",
  title: "Listar órdenes de pago",
  description:
    "Lista órdenes de pago visibles para el usuario autenticado (respeta RLS, rol y scope por departamento). Filtros opcionales por status, departamento y límite.",
  inputSchema: {
    status: z
      .enum([
        "borrador",
        "en_revision",
        "vobo_dado",
        "aprobada",
        "rechazada",
        "devuelta",
        "revocada",
        "pagada",
      ])
      .optional()
      .describe("Filtrar por estatus de la orden."),
    departamento: z.string().optional().describe("Filtrar por departamento."),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, departamento, limit }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    let q = supabaseForUser(ctx)
      .from("ordenes_pago")
      .select(
        "id, folio, concepto, proveedor_nombre, monto, moneda, status, prioridad, departamento, categoria_gasto, fecha_pago_requerida, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) q = q.eq("status", status);
    if (departamento) q = q.eq("departamento", departamento);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { ordenes: data ?? [] },
    };
  },
});

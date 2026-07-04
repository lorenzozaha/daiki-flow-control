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
  name: "create_orden",
  title: "Crear orden de pago",
  description:
    "Crea una nueva orden de pago (borrador o enviada a revisión). Requiere rol capturista o admin. El solicitante es el usuario autenticado.",
  inputSchema: {
    empresa_id: z.string().uuid().describe("UUID de la empresa."),
    concepto: z.string().min(3),
    proveedor_nombre: z.string().min(1),
    proveedor_rfc: z.string().optional(),
    monto: z.number().positive(),
    moneda: z.string().default("MXN"),
    departamento: z.string().min(1),
    categoria_gasto: z.string().min(1),
    centro_costo: z.string().optional(),
    prioridad: z.enum(["baja", "media", "alta", "urgente"]).default("media"),
    fecha_pago_requerida: z.string().optional().describe("Formato YYYY-MM-DD."),
    notas: z.string().optional(),
    enviar_a_revision: z
      .boolean()
      .default(false)
      .describe("Si true, la orden se envía directamente a revisión; si no, queda como borrador."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    const { enviar_a_revision, ...rest } = input;
    const { data, error } = await supabaseForUser(ctx)
      .from("ordenes_pago")
      .insert({
        ...rest,
        solicitante_id: ctx.getUserId(),
        status: enviar_a_revision ? "en_revision" : "borrador",
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Orden creada folio #${data.folio}` }],
      structuredContent: { orden: data },
    };
  },
});

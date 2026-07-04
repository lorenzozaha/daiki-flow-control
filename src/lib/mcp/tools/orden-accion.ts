import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "orden_accion",
  title: "Ejecutar acción sobre orden",
  description:
    "Ejecuta una acción de flujo sobre una orden: aprobar, rechazar, devolver, revocar (solo autorizador), vobo (verificador/contador) o confirmar. La lógica de permisos y umbrales se valida en el backend según el rol del usuario.",
  inputSchema: {
    orden_id: z.string().uuid(),
    accion: z.enum(["aprobar", "rechazar", "devolver", "revocar", "vobo", "confirmar"]),
    comentario: z.string().optional().describe("Comentario o motivo (obligatorio para rechazar/devolver)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ orden_id, accion, comentario }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    const url = `${process.env.SUPABASE_URL}/functions/v1/orden-accion`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.getToken()}`,
        apikey: process.env.SUPABASE_PUBLISHABLE_KEY!,
      },
      body: JSON.stringify({ orden_id, accion, comentario }),
    });
    const text = await res.text();
    if (!res.ok)
      return { content: [{ type: "text", text: `Error ${res.status}: ${text}` }], isError: true };
    return { content: [{ type: "text", text }] };
  },
});

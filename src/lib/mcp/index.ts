import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listOrdenes from "./tools/list-ordenes";
import getOrden from "./tools/get-orden";
import createOrden from "./tools/create-orden";
import ordenAccion from "./tools/orden-accion";
import dashboardSummary from "./tools/dashboard-summary";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "daiki-autorizaciones-mcp",
  title: "Daiki · Autorizaciones",
  version: "0.1.0",
  instructions:
    "Herramientas para el sistema Daiki de autorizaciones de pago (Grupo Zabia). Permite listar y consultar órdenes de pago, crear nuevas órdenes (rol capturista/admin) y ejecutar acciones de flujo (aprobar, rechazar, devolver, VoBo, revocar) según el rol del usuario autenticado. Todas las operaciones respetan RLS y el scope por departamento.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listOrdenes, getOrden, createOrden, ordenAccion, dashboardSummary],
});

// Actualizar usuario (activo, roles, nombre, empresa) - solo admin
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, serviceKey);
    const { data: isAdmin } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Solo admin" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { userId, nombre, empresa_id, activo, roles, newPassword } = await req.json();
    if (!userId) throw new Error("userId requerido");

    const patch: any = {};
    if (typeof nombre === "string") patch.nombre = nombre;
    if (empresa_id !== undefined) patch.empresa_id = empresa_id;
    if (typeof activo === "boolean") patch.activo = activo;
    if (Object.keys(patch).length) {
      await admin.from("profiles").update(patch).eq("id", userId);
    }

    if (Array.isArray(roles)) {
      await admin.from("user_roles").delete().eq("user_id", userId);
      if (roles.length) {
        await admin.from("user_roles").insert(roles.map((r: string) => ({ user_id: userId, role: r })));
      }
    }

    if (typeof newPassword === "string" && newPassword.length >= 8) {
      await admin.auth.admin.updateUserById(userId, { password: newPassword });
      await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);
    }

    if (typeof activo === "boolean" && !activo) {
      // ban user
      await admin.auth.admin.updateUserById(userId, { ban_duration: "87600h" });
    } else if (typeof activo === "boolean" && activo) {
      await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

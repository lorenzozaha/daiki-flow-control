// Invitar / crear usuario (solo admin). Crea el auth user, profile y asigna roles.
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

    // Validate requester is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, serviceKey);
    const { data: isAdmin } = await admin
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Solo administradores pueden invitar usuarios" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { email, password, nombre, empresa_id, roles } = body as {
      email: string; password: string; nombre: string;
      empresa_id: string | null; roles: string[];
    };

    if (!email || !password || !roles?.length) {
      return new Response(JSON.stringify({ error: "Email, contraseña y al menos un rol son requeridos" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { nombre: nombre || email.split("@")[0] },
    });
    if (createErr) throw createErr;
    const userId = created.user!.id;

    await admin.from("profiles").upsert({
      id: userId,
      email,
      nombre: nombre || email.split("@")[0],
      empresa_id: empresa_id ?? null,
      must_change_password: true,
      activo: true,
    });

    const rolesRows = roles.map((r) => ({ user_id: userId, role: r }));
    await admin.from("user_roles").insert(rolesRows);

    return new Response(JSON.stringify({ ok: true, userId }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

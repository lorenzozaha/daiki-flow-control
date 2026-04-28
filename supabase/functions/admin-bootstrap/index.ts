// Bootstrap del primer admin. Si no existe ningún admin, crea un usuario
// autorizado y le asigna rol admin + autorizador. Después del primer uso,
// queda bloqueado.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { email, password, nombre } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email y contraseña son requeridos" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey);

    // Check if any admin already exists
    const { count, error: countErr } = await admin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if (countErr) throw countErr;

    if ((count ?? 0) > 0) {
      return new Response(
        JSON.stringify({ error: "Ya existe un administrador. El bootstrap está deshabilitado." }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Pick the first empresa
    const { data: empresa } = await admin
      .from("empresas")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    // Create user
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre: nombre || email.split("@")[0] },
    });
    if (createErr) throw createErr;
    const userId = created.user!.id;

    // Upsert profile
    await admin.from("profiles").upsert({
      id: userId,
      email,
      nombre: nombre || email.split("@")[0],
      empresa_id: empresa?.id ?? null,
      must_change_password: false,
      activo: true,
    });

    // Assign admin + autorizador roles
    await admin.from("user_roles").insert([
      { user_id: userId, role: "admin" },
      { user_id: userId, role: "autorizador" },
    ]);

    return new Response(JSON.stringify({ ok: true, userId }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

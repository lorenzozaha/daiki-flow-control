// Acciones server-side sobre órdenes de pago:
//   - aprobar: verificador o autorizador (según matriz de montos y firmas)
//   - rechazar: verificador o autorizador
//   - devolver: verificador o autorizador (regresa al capturista para corrección)
//   - revocar: autorizador puede revocar aprobaciones del verificador dentro de
//              la ventana configurada (default 24h) si el monto entró por la
//              ruta "alerta_activa".
//
// Toda la lógica de autorización vive aquí (no en el cliente) para garantizar
// integridad: matriz de umbrales, límite mensual del verificador, firmas
// requeridas y ventana de revocación.

import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Accion = "aprobar" | "rechazar" | "devolver" | "revocar";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "No autenticado" }, 401);

    // Cliente con el JWT del usuario para identificar quién llama
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Sesión inválida" }, 401);
    const uid = userData.user.id;

    // Cliente admin para escribir saltando RLS donde sea necesario
    const admin = createClient(url, serviceKey);

    const body = await req.json().catch(() => ({}));
    const accion = body.accion as Accion | "confirmar";
    const ordenId = body.orden_id as string;
    const comentario = (body.comentario ?? "").toString().trim() || null;

    if (!ordenId || !["aprobar", "rechazar", "devolver", "revocar", "confirmar"].includes(accion)) {
      return json({ error: "Parámetros inválidos" }, 400);
    }
    if ((accion === "rechazar" || accion === "devolver" || accion === "revocar") && !comentario) {
      return json({ error: "El comentario es obligatorio para esta acción" }, 400);
    }

    // Cargar perfil + roles + orden + config en paralelo
    const [profRes, rolesRes, ordenRes, cfgRes] = await Promise.all([
      admin.from("profiles").select("id, nombre, empresa_id").eq("id", uid).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", uid),
      admin.from("ordenes_pago").select("*").eq("id", ordenId).maybeSingle(),
      admin.from("configuracion_limites").select("*").eq("id", 1).maybeSingle(),
    ]);

    if (!profRes.data) return json({ error: "Perfil no encontrado" }, 404);
    if (!ordenRes.data) return json({ error: "Orden no encontrada" }, 404);
    if (!cfgRes.data) return json({ error: "Configuración no disponible" }, 500);

    const profile = profRes.data;
    const roles = (rolesRes.data ?? []).map((r: any) => r.role as string);
    const orden = ordenRes.data;
    const cfg = cfgRes.data;

    // Misma empresa (excepto admin)
    if (!roles.includes("admin") && orden.empresa_id !== profile.empresa_id) {
      return json({ error: "No tienes acceso a esta orden" }, 403);
    }

    const monto = Number(orden.monto);
    const esVerificador = roles.includes("verificador");
    const esAutorizador = roles.includes("autorizador");
    const esAdmin = roles.includes("admin");

    // ============== CONFIRMAR (cierra ventana de revocación) ==============
    if (accion === "confirmar") {
      if (!(esAutorizador || esAdmin)) {
        return json({ error: "Solo un autorizador puede confirmar" }, 403);
      }
      if (orden.status !== "aprobada" || orden.autorizado_por_rol !== "verificador") {
        return json({ error: "Solo se confirman aprobaciones de verificador pendientes" }, 400);
      }
      if (orden.revocada) return json({ error: "Esta orden fue revocada" }, 400);
      if (!orden.revocable_hasta) return json({ error: "Esta orden ya fue confirmada" }, 400);

      const { error: updErr } = await admin.from("ordenes_pago")
        .update({ revocable_hasta: null }).eq("id", ordenId);
      if (updErr) throw updErr;

      await admin.from("orden_historial").insert({
        orden_id: ordenId, usuario_id: uid, usuario_nombre: profile.nombre,
        accion: "Aprobación confirmada por autorizador (ventana cerrada)", comentario,
      });
      return json({ ok: true, status: "aprobada", confirmada: true });
    }

    // ============== REVOCAR ==============
    if (accion === "revocar") {
      if (!esAutorizador && !esAdmin) {
        return json({ error: "Solo un autorizador puede revocar" }, 403);
      }
      if (orden.status !== "aprobada") {
        return json({ error: "Solo se pueden revocar órdenes aprobadas" }, 400);
      }
      if (orden.autorizado_por_rol !== "verificador") {
        return json({ error: "Solo se pueden revocar aprobaciones de verificador" }, 400);
      }
      if (orden.revocada) {
        return json({ error: "Esta orden ya fue revocada" }, 400);
      }
      const limite = orden.revocable_hasta ? new Date(orden.revocable_hasta).getTime() : 0;
      if (Date.now() > limite) {
        return json({ error: "La ventana de revocación de 24 h ya expiró" }, 400);
      }

      const { error: updErr } = await admin
        .from("ordenes_pago")
        .update({ status: "rechazada", revocada: true })
        .eq("id", ordenId);
      if (updErr) throw updErr;

      // Devolver al acumulado mensual del verificador que la había aprobado
      if (orden.autorizado_por_id && orden.autorizado_at) {
        const fechaAprob = new Date(orden.autorizado_at);
        const mes = fechaAprob.getUTCMonth() + 1;
        const anio = fechaAprob.getUTCFullYear();
        const { data: acum } = await admin
          .from("acumulado_mensual_verificador")
          .select("*")
          .eq("verificador_id", orden.autorizado_por_id)
          .eq("mes", mes).eq("anio", anio)
          .maybeSingle();
        if (acum) {
          await admin
            .from("acumulado_mensual_verificador")
            .update({ monto_acumulado: Math.max(0, Number(acum.monto_acumulado) - monto) })
            .eq("id", acum.id);
        }
      }

      await admin.from("orden_historial").insert({
        orden_id: ordenId, usuario_id: uid, usuario_nombre: profile.nombre,
        accion: "Aprobación revocada por autorizador", comentario,
      });

      return json({ ok: true, status: "rechazada", mensaje: "Aprobación revocada" });
    }

    // ============== RECHAZAR ==============
    if (accion === "rechazar") {
      if (!(esVerificador || esAutorizador || esAdmin)) {
        return json({ error: "No tienes permiso para rechazar" }, 403);
      }
      if (!["en_revision", "en_autorizacion"].includes(orden.status)) {
        return json({ error: "La orden no está en un estatus rechazable" }, 400);
      }
      const { error } = await admin.from("ordenes_pago")
        .update({ status: "rechazada" }).eq("id", ordenId);
      if (error) throw error;

      await admin.from("orden_historial").insert({
        orden_id: ordenId, usuario_id: uid, usuario_nombre: profile.nombre,
        accion: "Rechazada", comentario,
      });
      return json({ ok: true, status: "rechazada" });
    }

    // ============== DEVOLVER ==============
    if (accion === "devolver") {
      if (!(esVerificador || esAutorizador || esAdmin)) {
        return json({ error: "No tienes permiso para devolver" }, 403);
      }
      if (!["en_revision", "en_autorizacion"].includes(orden.status)) {
        return json({ error: "La orden no está en un estatus que se pueda devolver" }, 400);
      }
      const { error } = await admin.from("ordenes_pago")
        .update({ status: "devuelta" }).eq("id", ordenId);
      if (error) throw error;

      await admin.from("orden_historial").insert({
        orden_id: ordenId, usuario_id: uid, usuario_nombre: profile.nombre,
        accion: "Devuelta al capturista", comentario,
      });
      return json({ ok: true, status: "devuelta" });
    }

    // ============== APROBAR ==============
    // Determinar ruta por monto
    const aprobMax = Number(cfg.verificador_auto_aprueba_max);
    const alertaMax = Number(cfg.verificador_alerta_activa_max);
    const unaFirmaMax = Number(cfg.autorizador_una_firma_max);

    let ruta: "verificador_silenciosa" | "verificador_alerta" | "autorizador_una" | "autorizador_dos";
    if (monto <= aprobMax) ruta = "verificador_silenciosa";
    else if (monto <= alertaMax) ruta = "verificador_alerta";
    else if (monto <= unaFirmaMax) ruta = "autorizador_una";
    else ruta = "autorizador_dos";

    // ----- Caso verificador aprueba (rutas 1 y 2) -----
    if (ruta === "verificador_silenciosa" || ruta === "verificador_alerta") {
      if (!(esVerificador || esAdmin)) {
        return json({ error: "Esta orden requiere un verificador" }, 403);
      }
      if (orden.status !== "en_revision") {
        return json({ error: "La orden no está en revisión" }, 400);
      }

      // Validar límite mensual del verificador
      const ahora = new Date();
      const mes = ahora.getUTCMonth() + 1;
      const anio = ahora.getUTCFullYear();
      const { data: acum } = await admin
        .from("acumulado_mensual_verificador")
        .select("*")
        .eq("verificador_id", uid).eq("mes", mes).eq("anio", anio)
        .maybeSingle();

      const acumActual = Number(acum?.monto_acumulado ?? 0);
      const limiteMensual = Number(cfg.verificador_limite_mensual);
      if (!esAdmin && acumActual + monto > limiteMensual) {
        return json({
          error: `Esta aprobación supera tu límite mensual de $${limiteMensual.toLocaleString("es-MX")}. Acumulado: $${acumActual.toLocaleString("es-MX")}.`,
        }, 400);
      }

      const ahoraIso = ahora.toISOString();
      const ventanaHoras = Number(cfg.ventana_revocacion_horas) || 24;
      const revocableHasta = new Date(ahora.getTime() + ventanaHoras * 3600 * 1000).toISOString();

      const { error: updErr } = await admin.from("ordenes_pago").update({
        status: "aprobada",
        autorizado_por_rol: "verificador",
        autorizado_por_id: uid,
        autorizado_at: ahoraIso,
        revocable_hasta: revocableHasta,
      }).eq("id", ordenId);
      if (updErr) throw updErr;

      // Actualizar acumulado
      if (acum) {
        await admin.from("acumulado_mensual_verificador")
          .update({ monto_acumulado: acumActual + monto })
          .eq("id", acum.id);
      } else {
        await admin.from("acumulado_mensual_verificador").insert({
          verificador_id: uid, mes, anio, monto_acumulado: monto,
        });
      }

      await admin.from("orden_historial").insert({
        orden_id: ordenId, usuario_id: uid, usuario_nombre: profile.nombre,
        accion: ruta === "verificador_alerta"
          ? "Aprobada por verificador (con alerta a autorizador)"
          : "Aprobada por verificador",
        comentario,
      });

      return json({
        ok: true,
        status: "aprobada",
        ruta,
        revocable_hasta: revocableHasta,
        nuevo_acumulado: acumActual + monto,
        warning_pct_alcanzado:
          (acumActual + monto) >= limiteMensual * (Number(cfg.verificador_warning_pct) / 100),
      });
    }

    // ----- Caso autorizador (rutas 3 y 4) -----
    if (!(esAutorizador || esAdmin)) {
      return json({ error: "Esta orden requiere un autorizador" }, 403);
    }
    if (!["en_revision", "en_autorizacion"].includes(orden.status)) {
      return json({ error: "La orden no está en un estatus aprobable" }, 400);
    }

    // Si está en revisión, primero la "escala" automáticamente a en_autorizacion
    // (cualquier autorizador puede tomarla directamente)
    const firmasNec = ruta === "autorizador_dos" ? 2 : 1;

    // Cargar firmas previas
    const { data: firmasPrevias } = await admin
      .from("orden_autorizaciones")
      .select("autorizador_id")
      .eq("orden_id", ordenId);

    const yaFirmo = (firmasPrevias ?? []).some((f: any) => f.autorizador_id === uid);
    if (yaFirmo) return json({ error: "Ya autorizaste esta orden previamente" }, 400);

    // Insertar firma
    const { error: firmaErr } = await admin.from("orden_autorizaciones")
      .insert({ orden_id: ordenId, autorizador_id: uid });
    if (firmaErr) throw firmaErr;

    const totalFirmas = (firmasPrevias?.length ?? 0) + 1;

    if (totalFirmas >= firmasNec) {
      const ahoraIso = new Date().toISOString();
      await admin.from("ordenes_pago").update({
        status: "aprobada",
        autorizado_por_rol: "autorizador",
        autorizado_por_id: uid,
        autorizado_at: ahoraIso,
        revocable_hasta: null,
        firmas_requeridas: firmasNec,
      }).eq("id", ordenId);

      await admin.from("orden_historial").insert({
        orden_id: ordenId, usuario_id: uid, usuario_nombre: profile.nombre,
        accion: firmasNec === 2 ? "Aprobada (segunda firma autorizador)" : "Aprobada por autorizador",
        comentario,
      });

      return json({ ok: true, status: "aprobada", ruta, firmas: totalFirmas, requeridas: firmasNec });
    } else {
      // Falta otra firma: pasa a en_autorizacion
      await admin.from("ordenes_pago").update({
        status: "en_autorizacion",
        firmas_requeridas: firmasNec,
      }).eq("id", ordenId);

      await admin.from("orden_historial").insert({
        orden_id: ordenId, usuario_id: uid, usuario_nombre: profile.nombre,
        accion: `Primera firma de autorizador (${totalFirmas}/${firmasNec})`,
        comentario,
      });

      return json({ ok: true, status: "en_autorizacion", ruta, firmas: totalFirmas, requeridas: firmasNec });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});

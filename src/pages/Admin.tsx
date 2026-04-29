import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { fmtMXN } from "@/lib/business";
import { Loader2, UserPlus, Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const ALL_ROLES = ["capturista", "verificador", "contador", "autorizador", "admin"] as const;

export default function Admin() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Panel de administración</h1>
        <p className="text-sm text-muted-foreground">Configura límites, usuarios y catálogos del sistema.</p>
      </div>

      <Tabs defaultValue="limites" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="limites">Límites</TabsTrigger>
          <TabsTrigger value="usuarios">Usuarios</TabsTrigger>
          <TabsTrigger value="categorias">Categorías</TabsTrigger>
          <TabsTrigger value="departamentos">Departamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="limites" className="mt-4"><LimitesTab /></TabsContent>
        <TabsContent value="usuarios" className="mt-4"><UsuariosTab /></TabsContent>
        <TabsContent value="categorias" className="mt-4">
          <CatalogoTab tabla="catalogo_categorias" titulo="Categorías de gasto" />
        </TabsContent>
        <TabsContent value="departamentos" className="mt-4">
          <CatalogoTab tabla="catalogo_departamentos" titulo="Departamentos" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LimitesTab() {
  const [cfg, setCfg] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("configuracion_limites").select("*").eq("id", 1).maybeSingle()
      .then(({ data }) => setCfg(data));
  }, []);

  if (!cfg) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>;

  const guardar = async () => {
    setSaving(true);
    const { error } = await supabase.from("configuracion_limites").update({
      verificador_auto_aprueba_max: cfg.verificador_auto_aprueba_max,
      verificador_alerta_activa_max: cfg.verificador_alerta_activa_max,
      autorizador_una_firma_max: cfg.autorizador_una_firma_max,
      verificador_limite_mensual: cfg.verificador_limite_mensual,
      verificador_warning_pct: cfg.verificador_warning_pct,
      ventana_revocacion_horas: cfg.ventana_revocacion_horas,
    }).eq("id", 1);
    setSaving(false);
    if (error) toast.error("No se pudo guardar", { description: error.message });
    else toast.success("Configuración actualizada");
  };

  const upd = (k: string, v: number) => setCfg({ ...cfg, [k]: v });

  return (
    <div className="daiki-card p-5 space-y-5 max-w-3xl">
      <div>
        <h2 className="font-bold mb-1">Matriz de autorización</h2>
        <p className="text-xs text-muted-foreground">Los rangos se aplican en orden ascendente. Cualquier monto mayor al último cae en doble firma.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Verificador auto-aprueba hasta (silenciosa)" hint={`Actual: ${fmtMXN(cfg.verificador_auto_aprueba_max)}`}>
          <Input type="number" value={cfg.verificador_auto_aprueba_max}
            onChange={(e) => upd("verificador_auto_aprueba_max", Number(e.target.value))} />
        </Field>
        <Field label="Verificador con alerta activa hasta" hint={`Actual: ${fmtMXN(cfg.verificador_alerta_activa_max)}`}>
          <Input type="number" value={cfg.verificador_alerta_activa_max}
            onChange={(e) => upd("verificador_alerta_activa_max", Number(e.target.value))} />
        </Field>
        <Field label="Autorizador 1 firma hasta" hint={`Actual: ${fmtMXN(cfg.autorizador_una_firma_max)} · arriba: 2 firmas`}>
          <Input type="number" value={cfg.autorizador_una_firma_max}
            onChange={(e) => upd("autorizador_una_firma_max", Number(e.target.value))} />
        </Field>
        <Field label="Límite mensual por verificador" hint={`Actual: ${fmtMXN(cfg.verificador_limite_mensual)}`}>
          <Input type="number" value={cfg.verificador_limite_mensual}
            onChange={(e) => upd("verificador_limite_mensual", Number(e.target.value))} />
        </Field>
        <Field label="% de aviso del límite mensual" hint="Avisa al verificador cuando alcanza este % de su tope">
          <Input type="number" value={cfg.verificador_warning_pct}
            onChange={(e) => upd("verificador_warning_pct", Number(e.target.value))} />
        </Field>
        <Field label="Ventana de revocación (horas)" hint="Tiempo en que el autorizador puede revocar la aprobación del verificador">
          <Input type="number" value={cfg.ventana_revocacion_horas}
            onChange={(e) => upd("ventana_revocacion_horas", Number(e.target.value))} />
        </Field>
      </div>

      <div className="flex justify-end pt-2 border-t border-border">
        <Button onClick={guardar} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent-hover">
          {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
          Guardar configuración
        </Button>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  activo: boolean;
  empresa_id: string | null;
  roles: string[];
}

function UsuariosTab() {
  const [users, setUsers] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  const cargar = async () => {
    setLoading(true);
    const [{ data: profs }, { data: rs }] = await Promise.all([
      supabase.from("profiles").select("id, email, nombre, activo, empresa_id"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const rolesMap = new Map<string, string[]>();
    (rs ?? []).forEach((r: any) => {
      const arr = rolesMap.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesMap.set(r.user_id, arr);
    });
    setUsers((profs ?? []).map((p: any) => ({ ...p, roles: rolesMap.get(p.id) ?? [] })));
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-bold">Usuarios del sistema · {users.length}</h2>
        <InvitarDialog onCreated={cargar} />
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div> : (
        <div className="space-y-2">
          {users.map((u) => <UsuarioRow key={u.id} user={u} onChanged={cargar} />)}
        </div>
      )}
    </div>
  );
}

function UsuarioRow({ user, onChanged }: { user: Usuario; onChanged: () => void }) {
  const [working, setWorking] = useState(false);
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState(user.nombre);
  const [activo, setActivo] = useState(user.activo);
  const [roles, setRoles] = useState<string[]>(user.roles);
  const [newPassword, setNewPassword] = useState("");
  const [deptos, setDeptos] = useState<string[]>([]);
  const [scopeDeptos, setScopeDeptos] = useState<string[]>([]);
  const [scopeOriginal, setScopeOriginal] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setNombre(user.nombre);
    setActivo(user.activo);
    setRoles(user.roles);
    setNewPassword("");
    Promise.all([
      supabase.from("catalogo_departamentos").select("nombre").eq("activo", true).order("nombre"),
      supabase.from("verificador_scope").select("departamento").eq("user_id", user.id),
    ]).then(([{ data: deps }, { data: sc }]) => {
      setDeptos((deps ?? []).map((d: any) => d.nombre));
      const list = (sc ?? []).map((s: any) => s.departamento);
      setScopeDeptos(list);
      setScopeOriginal(list);
    });
  }, [open, user]);

  const guardar = async () => {
    setWorking(true);
    const { data, error } = await supabase.functions.invoke("admin-update-user", {
      body: { userId: user.id, nombre, activo, roles, newPassword: newPassword || undefined },
    });
    if (error || (data as any)?.error) {
      setWorking(false);
      toast.error("No se pudo guardar", { description: (data as any)?.error ?? error?.message });
      return;
    }

    // Sincronizar scope solo si tiene rol verificador
    const aplicaScope = roles.includes("verificador") || roles.includes("contador");
    if (aplicaScope) {
      const toAdd = scopeDeptos.filter((d) => !scopeOriginal.includes(d));
      const toDel = scopeOriginal.filter((d) => !scopeDeptos.includes(d));
      if (toAdd.length > 0) {
        await supabase.from("verificador_scope").insert(
          toAdd.map((d) => ({ user_id: user.id, departamento: d }))
        );
      }
      if (toDel.length > 0) {
        await supabase.from("verificador_scope")
          .delete().eq("user_id", user.id).in("departamento", toDel);
      }
    } else if (scopeOriginal.length > 0) {
      // Si dejó de ser verificador/contador, limpiar scope
      await supabase.from("verificador_scope").delete().eq("user_id", user.id);
    }

    setWorking(false);
    toast.success("Usuario actualizado");
    setOpen(false);
    setNewPassword("");
    onChanged();
  };

  const aplicaScope = roles.includes("verificador") || roles.includes("contador");

  return (
    <div className="daiki-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold truncate">{user.nombre}</p>
          {!user.activo && <span className="daiki-badge bg-destructive/10 text-destructive border border-destructive/30">Inactivo</span>}
        </div>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Roles: {user.roles.join(", ") || "—"}</p>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">Editar</Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
            <DialogDescription>{user.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div>
              <Label className="mb-2 block">Roles</Label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={roles.includes(r)}
                      onCheckedChange={(c) =>
                        setRoles(c ? [...roles, r] : roles.filter((x) => x !== r))
                      }
                    />
                    <span className="capitalize">{r}</span>
                  </label>
                ))}
              </div>
            </div>

            {esVerificador && (
              <div className="rounded-md border border-border p-3 space-y-2 bg-muted/30">
                <div>
                  <Label className="text-sm font-semibold">Departamentos visibles para este verificador</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Si no marcas ninguno, verá <strong>todos</strong> los departamentos. Marca uno o varios para limitar su acceso.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {deptos.length === 0 && <p className="text-xs text-muted-foreground col-span-2">No hay departamentos en el catálogo.</p>}
                  {deptos.map((d) => (
                    <label key={d} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={scopeDeptos.includes(d)}
                        onCheckedChange={(c) =>
                          setScopeDeptos(c ? [...scopeDeptos, d] : scopeDeptos.filter((x) => x !== d))
                        }
                      />
                      <span>{d}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {scopeDeptos.length === 0
                    ? "Acceso: todos los departamentos"
                    : `Acceso restringido a ${scopeDeptos.length} departamento(s)`}
                </p>
              </div>
            )}

            <div>
              <Label>Nueva contraseña (opcional)</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Dejar vacío para no cambiar" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={activo} onCheckedChange={(c) => setActivo(!!c)} />
              Usuario activo
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={guardar} disabled={working} className="bg-accent text-accent-foreground hover:bg-accent-hover">
              {working ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InvitarDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<string[]>(["capturista"]);
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      supabase.from("empresas").select("id, nombre").eq("activa", true).then(({ data }) => {
        setEmpresas(data ?? []);
        if (data?.[0]) setEmpresaId(data[0].id);
      });
    }
  }, [open]);

  const crear = async () => {
    if (!email || !password || !roles.length) {
      toast.error("Email, contraseña y al menos un rol son requeridos");
      return;
    }
    setWorking(true);
    const { data, error } = await supabase.functions.invoke("admin-invite-user", {
      body: { email, password, nombre, empresa_id: empresaId, roles },
    });
    setWorking(false);
    if (error || (data as any)?.error) {
      toast.error("No se pudo crear", { description: (data as any)?.error ?? error?.message });
    } else {
      toast.success("Usuario creado");
      setOpen(false);
      setEmail(""); setNombre(""); setPassword(""); setRoles(["capturista"]);
      onCreated();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-accent text-accent-foreground hover:bg-accent-hover">
          <UserPlus className="w-4 h-4 mr-1.5" /> Invitar usuario
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar usuario</DialogTitle>
          <DialogDescription>Se creará la cuenta con la contraseña inicial. Deberá cambiarla al primer acceso.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Nombre</Label><Input value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Contraseña inicial</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          {empresas.length > 1 && (
            <div>
              <Label>Empresa</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={empresaId ?? ""} onChange={(e) => setEmpresaId(e.target.value || null)}>
                {empresas.map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
          )}
          <div>
            <Label className="mb-2 block">Roles</Label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_ROLES.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={roles.includes(r)} onCheckedChange={(c) =>
                    setRoles(c ? [...roles, r] : roles.filter((x) => x !== r))} />
                  <span className="capitalize">{r}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={crear} disabled={working} className="bg-accent text-accent-foreground hover:bg-accent-hover">
            {working ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <UserPlus className="w-4 h-4 mr-1.5" />}
            Crear usuario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CatItem { id: string; nombre: string; activo: boolean }

function CatalogoTab({ tabla, titulo }: { tabla: "catalogo_categorias" | "catalogo_departamentos"; titulo: string }) {
  const [items, setItems] = useState<CatItem[]>([]);
  const [nuevo, setNuevo] = useState("");
  const [loading, setLoading] = useState(true);

  const cargar = async () => {
    setLoading(true);
    const { data } = await supabase.from(tabla).select("*").order("nombre");
    setItems((data ?? []) as CatItem[]);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [tabla]);

  const agregar = async () => {
    if (!nuevo.trim()) return;
    const { error } = await supabase.from(tabla).insert({ nombre: nuevo.trim() });
    if (error) toast.error("No se pudo agregar", { description: error.message });
    else { setNuevo(""); cargar(); toast.success("Agregado"); }
  };

  const toggle = async (it: CatItem) => {
    const { error } = await supabase.from(tabla).update({ activo: !it.activo }).eq("id", it.id);
    if (error) toast.error("Error", { description: error.message });
    else cargar();
  };

  const eliminar = async (it: CatItem) => {
    if (!confirm(`¿Eliminar "${it.nombre}"?`)) return;
    const { error } = await supabase.from(tabla).delete().eq("id", it.id);
    if (error) toast.error("No se pudo eliminar", { description: error.message });
    else cargar();
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <h2 className="font-bold">{titulo}</h2>

      <div className="flex gap-2">
        <Input placeholder={`Nuevo ${titulo.toLowerCase().slice(0, -1)}...`} value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && agregar()} />
        <Button onClick={agregar} className="bg-accent text-accent-foreground hover:bg-accent-hover">
          <Plus className="w-4 h-4 mr-1.5" /> Agregar
        </Button>
      </div>

      {loading ? <Loader2 className="w-5 h-5 animate-spin text-accent mx-auto" /> : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="daiki-card p-3 flex items-center justify-between gap-3">
              <span className={`font-medium ${!it.activo ? "line-through text-muted-foreground" : ""}`}>{it.nombre}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => toggle(it)}>
                  {it.activo ? "Desactivar" : "Activar"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => eliminar(it)}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

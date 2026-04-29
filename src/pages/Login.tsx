import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

type Mode = "login" | "bootstrap";

export default function Login() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");

  // Si ya hay sesión, mandar a home
  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [user, loading, navigate]);

  // Detectar si es la primera vez (no hay ningún admin)
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("bootstrap_needed");
      // Si hay error o ya hay admin, mostrar login
      setMode(!error && data === true ? "bootstrap" : "login");
      setChecking(false);
    })();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error("No pudimos iniciar sesión", { description: error.message });
      return;
    }
    toast.success("Bienvenido a Daiki");
    navigate("/", { replace: true });
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("admin-bootstrap", {
      body: { email, password, nombre },
    });
    if (error || (data as any)?.error) {
      setSubmitting(false);
      toast.error("No pudimos crear el administrador", {
        description: (data as any)?.error || error?.message,
      });
      return;
    }
    // Iniciar sesión con esas mismas credenciales
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInErr) {
      toast.error("Admin creado, pero falló el inicio de sesión", { description: signInErr.message });
      return;
    }
    toast.success("Administrador creado correctamente");
    navigate("/", { replace: true });
  };

  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      {/* Panel izquierdo — branding */}
      <div className="hidden md:flex flex-col justify-between bg-primary text-primary-foreground p-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-accent text-accent-foreground flex items-center justify-center font-extrabold text-xl">
            D
          </div>
          <div>
            <div className="text-2xl font-extrabold leading-tight">Daiki</div>
            <div className="text-xs uppercase tracking-widest opacity-80">Autorizaciones</div>
          </div>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-extrabold leading-tight">
            Autorización de órdenes de pago,<br />
            <span className="text-accent">simple y auditable.</span>
          </h1>
          <p className="text-primary-foreground/80 text-sm max-w-md">
            Flujo de aprobación por montos, bandejas por rol y dashboard ejecutivo.
            Piloto Mitsubishi — Grupo Zabia.
          </p>

          <div className="flex items-center gap-3 text-sm text-primary-foreground/80">
            <ShieldCheck className="w-5 h-5 text-accent" />
            <span>Acceso solo por invitación. Datos protegidos por empresa.</span>
          </div>
        </div>

        <div className="text-xs text-primary-foreground/60">
          © {new Date().getFullYear()} Grupo Zabia · Todos los derechos reservados
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          {/* Logo móvil */}
          <div className="md:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-extrabold text-lg">
              D
            </div>
            <div>
              <div className="font-extrabold leading-tight">Daiki</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Autorizaciones</div>
            </div>
          </div>

          {mode === "bootstrap" ? (
            <>
              <h2 className="text-2xl font-extrabold">Configuración inicial</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-6">
                Crea la primera cuenta de administrador. Podrás invitar al resto del equipo desde el panel.
              </p>
              <form onSubmit={handleBootstrap} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="nombre">Nombre completo</Label>
                  <Input
                    id="nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Lorenzo Zabaleta"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Correo corporativo</Label>
                  <Input
                    id="email" type="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="director.finanzas@nissanmonclova.com.mx"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Contraseña (mínimo 8 caracteres)</Label>
                  <Input
                    id="password" type="password" required minLength={8}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button
                  type="submit" disabled={submitting}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent-hover font-semibold"
                >
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Crear administrador y entrar
                </Button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-extrabold">Iniciar sesión</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-6">
                Empresa: <span className="font-semibold text-foreground">Mitsubishi Daiki</span>
              </p>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Correo</Label>
                  <Input
                    id="email" type="email" required autoComplete="email"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password" type="password" required autoComplete="current-password"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button
                  type="submit" disabled={submitting}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent-hover font-semibold"
                >
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Entrar
                </Button>
                <p className="text-xs text-muted-foreground text-center pt-2">
                  ¿No tienes cuenta? Solicita acceso a tu administrador.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

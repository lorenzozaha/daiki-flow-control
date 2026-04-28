import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";

export default function CambiarContrasena() {
  const { profile, refresh, signOut } = useAuth();
  const navigate = useNavigate();
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw1.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (pw1 !== pw2) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: pw1 });
    if (error) {
      setSubmitting(false);
      toast.error("No pudimos actualizar", { description: error.message });
      return;
    }
    await supabase.from("profiles").update({ must_change_password: false }).eq("id", profile!.id);
    await refresh();
    setSubmitting(false);
    toast.success("Contraseña actualizada");
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary p-6">
      <div className="w-full max-w-md daiki-card p-6 md:p-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-accent/20 text-accent-foreground flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold">Cambia tu contraseña</h1>
            <p className="text-xs text-muted-foreground">Es tu primer ingreso. Por seguridad, define una nueva.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pw1">Nueva contraseña</Label>
            <Input id="pw1" type="password" required minLength={8} value={pw1} onChange={(e) => setPw1(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw2">Confirmar contraseña</Label>
            <Input id="pw2" type="password" required minLength={8} value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </div>
          <Button type="submit" disabled={submitting}
            className="w-full bg-accent text-accent-foreground hover:bg-accent-hover font-semibold">
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar y continuar
          </Button>
          <Button
            type="button" variant="ghost" className="w-full"
            onClick={async () => { await signOut(); navigate("/login"); }}
          >
            Cancelar y cerrar sesión
          </Button>
        </form>
      </div>
    </div>
  );
}

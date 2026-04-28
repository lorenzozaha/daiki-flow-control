import { useAuth } from "@/contexts/AuthContext";
import { ShieldAlert } from "lucide-react";

export default function Placeholder({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  const { primaryRole } = useAuth();
  return (
    <div className="max-w-xl mx-auto text-center py-16">
      <div className="w-14 h-14 rounded-2xl bg-accent/15 text-accent flex items-center justify-center mx-auto mb-4">
        <ShieldAlert className="w-7 h-7" />
      </div>
      <h1 className="text-2xl font-extrabold">{titulo}</h1>
      <p className="text-sm text-muted-foreground mt-2">{descripcion}</p>
      <p className="text-xs text-muted-foreground mt-4">Sesión activa como <strong className="text-foreground capitalize">{primaryRole}</strong>.</p>
    </div>
  );
}

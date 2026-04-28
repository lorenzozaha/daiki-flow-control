import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface Props {
  children: ReactNode;
  roles?: AppRole[];
}

export function ProtectedRoute({ children, roles }: Props) {
  const { user, profile, loading, hasRole } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;

  if (profile?.must_change_password && loc.pathname !== "/cambiar-contrasena") {
    return <Navigate to="/cambiar-contrasena" replace />;
  }

  if (roles && roles.length > 0 && !roles.some((r) => hasRole(r))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

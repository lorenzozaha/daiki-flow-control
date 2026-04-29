import { ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User as UserIcon, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  show: boolean;
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, roles, primaryRole, signOut, hasRole } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  const items: NavItem[] = [
    { to: "/", label: "Inicio", show: true },
    { to: "/ordenes/nueva", label: "Nueva orden", show: hasRole("capturista") || hasRole("admin") },
    { to: "/mis-ordenes", label: "Mis órdenes", show: hasRole("capturista") || hasRole("admin") },
    { to: "/bandeja/revision", label: "Bandeja de revisión", show: hasRole("verificador") || hasRole("admin") },
    { to: "/bandeja/autorizacion", label: "Bandeja de autorización", show: hasRole("autorizador") || hasRole("admin") },
    { to: "/dashboard", label: "Dashboard", show: hasRole("autorizador") || hasRole("admin") },
    { to: "/admin", label: "Administración", show: hasRole("admin") },
  ].filter((i) => i.show);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const initials = (profile?.nombre || profile?.email || "?")
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-sm">
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-accent text-accent-foreground font-extrabold">
              D
            </div>
            <div className="leading-tight">
              <div className="font-extrabold text-base tracking-tight">Daiki</div>
              <div className="text-[10px] uppercase tracking-widest opacity-75 -mt-0.5">Autorizaciones</div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-primary-foreground/80 hover:bg-white/10 hover:text-primary-foreground"
                  )
                }
              >
                {it.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-full pl-2 pr-3 py-1.5 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center">
                    {initials}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-semibold leading-tight">{profile?.nombre}</div>
                    <div className="text-[10px] opacity-75 capitalize leading-tight">{primaryRole}</div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-semibold">{profile?.nombre}</div>
                  <div className="text-xs font-normal text-muted-foreground">{profile?.email}</div>
                  <div className="text-xs font-normal text-muted-foreground mt-1">
                    Roles: {roles.join(", ") || "—"}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/perfil")}>
                  <UserIcon className="w-4 h-4 mr-2" /> Mi cuenta
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menú"
            >
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {open && (
          <nav className="md:hidden border-t border-white/10 bg-primary">
            <div className="container py-2 flex flex-col">
              {items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.to === "/"}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "px-3 py-2.5 rounded-md text-sm font-medium",
                      isActive ? "bg-accent text-accent-foreground" : "text-primary-foreground/85"
                    )
                  }
                >
                  {it.label}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>

      {/* Main */}
      <main className="flex-1 container py-6 md:py-8 animate-fade-in" key={loc.pathname}>
        {children}
      </main>

      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        Daiki · Autorizaciones — Grupo Zabia · Piloto Mitsubishi
      </footer>
    </div>
  );
}

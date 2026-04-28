import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "capturista" | "verificador" | "autorizador" | "admin";

export interface Profile {
  id: string;
  email: string;
  nombre: string;
  empresa_id: string | null;
  must_change_password: boolean;
  activo: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  primaryRole: AppRole | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const rolePriority: AppRole[] = ["admin", "autorizador", "verificador", "capturista"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfileAndRoles = async (userId: string) => {
    const [{ data: prof }, { data: rolesData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile(prof as Profile | null);
    setRoles((rolesData ?? []).map((r: any) => r.role as AppRole));
  };

  useEffect(() => {
    // Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Defer to avoid deadlocks
        setTimeout(() => {
          loadProfileAndRoles(newSession.user.id);
        }, 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });

    // Then fetch existing session
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        loadProfileAndRoles(existing.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
  };

  const refresh = async () => {
    if (user) await loadProfileAndRoles(user.id);
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const primaryRole = rolePriority.find((r) => roles.includes(r)) ?? null;

  return (
    <AuthContext.Provider
      value={{ user, session, profile, roles, loading, signOut, refresh, hasRole, primaryRole }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

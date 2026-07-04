import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";

type Details = {
  client?: { name?: string; client_uri?: string };
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
};

// Typed shim for the beta oauth namespace on supabase-js.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: Details | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: Details | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: Details | null; error: { message: string } | null }>;
};

function oauth(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<Details | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Falta authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorizationId)
      : await oauth().denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("El servidor de autorización no devolvió URL de retorno.");
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full space-y-3 text-center">
          <h1 className="text-xl font-bold">No pudimos cargar esta solicitud</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </main>
    );
  }
  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </main>
    );
  }

  const clientName = details.client?.name ?? "una aplicación";

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md bg-card border rounded-xl p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent text-accent-foreground flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-extrabold">Autorizar acceso</div>
            <div className="text-xs text-muted-foreground">Daiki · Autorizaciones</div>
          </div>
        </div>
        <p className="text-sm">
          <span className="font-semibold">{clientName}</span> quiere conectarse a tu cuenta y usar
          Daiki en tu nombre. Podrá leer y actuar sobre las órdenes de pago que tú puedas ver, con
          los mismos permisos de tu rol.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
            Denegar
          </Button>
          <Button
            className="flex-1 bg-accent text-accent-foreground hover:bg-accent-hover font-semibold"
            disabled={busy}
            onClick={() => decide(true)}
          >
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Aprobar
          </Button>
        </div>
      </div>
    </main>
  );
}

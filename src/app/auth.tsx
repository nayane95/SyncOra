import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { Navigate, useLocation, Link } from "react-router-dom";
import { supabase, configured } from "../lib/supabase";
import { message } from "../lib/api";
import { Button } from "../components/ui/button";
import { Loading, ErrorState } from "../components/shared";
import type { Profile } from "../types/database";
interface AuthState {
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  error: unknown;
}
const AuthContext = createContext<AuthState>({
  profile: null,
  session: null,
  loading: true,
  error: null,
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(configured),
    [authError, setAuthError] = useState<unknown>(null);
  const cache = useQueryClient();
  useEffect(() => {
    if (!supabase) return;
    let live = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (live) {
        setSession(data.session);
        setAuthError(error);
        setLoading(false);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (live) {
        setSession(next);
        setLoading(false);
        if (!next) cache.clear();
      }
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, [cache]);
  const profile = useQuery({
    queryKey: ["profile", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("profiles")
        .select("*")
        .eq("id", session!.user.id)
        .single();
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });
  useEffect(() => {
    if (!supabase || !session) return;
    const channel = supabase
      .channel(`profile:${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${session.user.id}`,
        },
        () => {
          void cache.invalidateQueries({ queryKey: ["profile"] });
        },
      )
      .subscribe();
    return () => {
      void supabase!.removeChannel(channel);
    };
  }, [session, cache]);
  return (
    <AuthContext.Provider
      value={{
        profile: profile.data ?? null,
        session,
        loading: loading || (!!session && profile.isPending),
        error: authError || profile.error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
export function Guard({
  children,
  admin = false,
  superOnly = false,
}: {
  children: ReactNode;
  admin?: boolean;
  superOnly?: boolean;
}) {
  const auth = useAuth(),
    location = useLocation();
  if (auth.loading) return <Loading />;
  if (auth.error)
    return (
      <ErrorState
        error={auth.error}
        retry={() => location.pathname && window.location.reload()}
      />
    );
  if (!configured) return <Navigate to="/login" replace />;
  if (!auth.session)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (auth.profile?.status === "pending")
    return <Navigate to="/pending-approval" replace />;
  if (
    auth.profile?.status !== "active" ||
    (admin && auth.profile.role === "developer") ||
    (superOnly && auth.profile.role !== "super_admin")
  )
    return <Navigate to="/access-denied" replace />;
  return children;
}
export function Login() {
  const { profile, loading, session } = useAuth();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (loading) return <Loading />;
  if (session && profile)
    return (
      <Navigate
        to={
          profile.status === "pending"
            ? "/pending-approval"
            : profile.status === "active"
              ? "/dashboard"
              : "/access-denied"
        }
        replace
      />
    );
  async function signIn() {
    setError("");
    setBusy(true);
    try {
      const { error } = await supabase!.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <span className="wordmark">
          Sync<span>Ora</span>
        </span>
        <div>
          <p className="eyebrow">A clearer working day</p>
          <h1>
            Plan together.
            <br />
            Keep work moving.
          </h1>
          <p>
            Morning assignments, evening updates, and the context your next
            meeting needs.
          </p>
          <div className="day-rhythm">
            <span>09:00 · Plan the day</span>
            <span>17:00 · Close the loop</span>
          </div>
        </div>
        <small>Daily standups & team work management</small>
      </section>
      <section className="auth-panel">
        <p className="eyebrow">Your team workspace</p>
        <h2>
          {configured ? "Welcome to SyncOra" : "Connect your workspace"}
        </h2>
        <p className="muted">
          {configured
            ? "Sign in with your work Google account. New accounts require administrator approval."
            : "Set up Supabase to enable secure sign-in and persistent team data."}
        </p>
        {configured ? (
          <Button disabled={busy} onClick={signIn}>
            {busy ? "Opening Google…" : "Continue with Google"}
          </Button>
        ) : (
          <div className="setup">
            <ol>
              <li>Create a Supabase project and apply both migrations.</li>
              <li>Enable Google in Supabase Authentication.</li>
              <li>
                Copy <code>.env.example</code> to <code>.env.local</code> and
                add the project URL and publishable key.
              </li>
              <li>
                Bootstrap your first administrator using the documented SQL.
              </li>
              <li>Restart the development server.</li>
            </ol>
            <p>
              Setup instructions: <code>docs/deployment.md</code>
            </p>
          </div>
        )}
        {error && <ErrorState error={new Error(error)} />}
        <p className="auth-note">
          Access is limited to approved team members. Your Google password is
          never shared with this application.
        </p>
      </section>
    </main>
  );
}
export function Callback() {
  const { error, loading, session } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const oauthError = params.get("error_description") || params.get("error");
  if (error || oauthError)
    return (
      <div className="auth-center">
        <ErrorState error={error || new Error(oauthError!)} />
        <Link to="/login">Return to sign in</Link>
      </div>
    );
  if (loading) return <Loading />;
  return <Navigate to={session ? "/dashboard" : "/login"} replace />;
}
export function AccessPage({ pending = false }: { pending?: boolean }) {
  const { profile, session, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <Navigate to="/login" replace />;
  if (pending && profile?.status !== "pending")
    return (
      <Navigate
        to={profile?.status === "active" ? "/dashboard" : "/access-denied"}
        replace
      />
    );
  return (
    <main className="auth-center">
      <span className="wordmark">
        Sync<span>Ora</span>
      </span>
      <h1>
        {pending ? "Your account is awaiting approval" : "Access is restricted"}
      </h1>
      <p className="muted">
        {pending
          ? "An administrator needs to approve your account and assign your team. This page checks for approval automatically."
          : "Your account or role does not have access to this workspace."}
      </p>
      <Button variant="secondary" onClick={() => void supabase?.auth.signOut()}>
        Sign out
      </Button>
      <Link to="/login">Return to sign in</Link>
    </main>
  );
}

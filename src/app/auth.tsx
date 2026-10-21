import { motion, useReducedMotion } from "framer-motion";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { Card } from "../components/ui/card";
import {
  createContext,
  lazy,
  Suspense,
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
const LoginIllustration = lazy(
  () => import("../components/login-illustration"),
);
interface AuthState {
  profile: Profile | null;
  session: Session | null;
  avatarUrl: string | undefined;
  loading: boolean;
  error: unknown;
}
const AuthContext = createContext<AuthState>({
  profile: null,
  session: null,
  avatarUrl: undefined,
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
        avatarUrl: [
          session?.user.user_metadata?.avatar_url,
          session?.user.user_metadata?.picture,
          profile.data?.avatar_url,
        ].find(
          (value): value is string =>
            typeof value === "string" && value.startsWith("https://"),
        ),
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
  const reducedMotion = useReducedMotion();
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
      <section
        className="auth-story auth-story-future"
        aria-label="About SyncOra"
      >
        <div className="auth-story-top">
          <span className="wordmark">
            <RefreshCw className="auth-brand-symbol" aria-hidden="true" />
            <span>
              Sync<span>Ora</span>
            </span>
          </span>
          <span className="auth-parent-brand">A workspace by Blissora</span>
        </div>
        <div className="auth-hero">
          <motion.div
            className="auth-story-copy"
            initial={reducedMotion ? false : { y: 12 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <p className="eyebrow">A clearer working day</p>
            <h1>
              Plan together.
              <br />
              Keep work moving.
            </h1>
            <p>Your tasks, daily progress, and the context your team needs.</p>
          </motion.div>
          <Suspense
            fallback={
              <div
                className="login-illustration-placeholder"
                aria-hidden="true"
              />
            }
          >
            <LoginIllustration />
          </Suspense>
        </div>
        <div className="auth-story-footer">
          <span>Plan. Progress. Carry forward.</span>
          <span>SyncOra / Blissora</span>
        </div>
      </section>
      <div className="auth-signin-region">
        <Card className="auth-panel">
          <h2>
            {configured ? (
              <>
                Welcome to{" "}
                <span>
                  Sync<span className="text-primary">Ora</span>
                </span>
              </>
            ) : (
              "Connect your workspace"
            )}
          </h2>
          <p className="muted">
            {configured
              ? "Sign in with your work Google account to continue."
              : "Set up Supabase to enable secure sign-in and persistent team data."}
          </p>
          {configured ? (
            <Button disabled={busy} onClick={signIn}>
              <svg
                className="google-signin-mark"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.2h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.5ZM12 22c2.7 0 5-1 6.6-2.3l-3.2-2.5a6 6 0 0 1-9-3.2H3.1v2.6A10 10 0 0 0 12 22ZM6.4 14a6 6 0 0 1 0-4V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14ZM12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.5 9.5 0 0 0 12 2a10 10 0 0 0-8.9 5.4L6.4 10A6 6 0 0 1 12 6Z"
                />
              </svg>
              {busy ? "Opening Google…" : "Continue with Google"}
            </Button>
          ) : (
            <div className="setup">
              <ol>
                <li>
                  Create a Supabase project and apply the repository migrations.
                </li>
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
            <ShieldCheck size={16} aria-hidden="true" />
            <span>
              New accounts need administrator approval. Your Google password
              stays with Google.
            </span>
          </p>
        </Card>
        <div className="auth-signin-illustration">
          <Suspense
            fallback={
              <div
                className="login-illustration-placeholder"
                aria-hidden="true"
              />
            }
          >
            <LoginIllustration variant="relay" />
          </Suspense>
        </div>
      </div>
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

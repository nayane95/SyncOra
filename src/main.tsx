import { Button } from "./components/ui/button";
import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, Guard, Login, Callback, AccessPage } from "./app/auth";
import { Shell } from "./app/shell";
import { Empty, Loading } from "./components/shared";
const Dashboard = lazy(() =>
  import("./features/dashboard").then((m) => ({ default: m.Dashboard })),
);
const TasksPage = lazy(() =>
  import("./features/tasks").then((m) => ({ default: m.TasksPage })),
);
const DeveloperTaskCalendar = lazy(() =>
  import("./features/developer-calendar").then((m) => ({
    default: m.DeveloperTaskCalendar,
  })),
);
const StandupPage = lazy(() =>
  import("./features/standups").then((m) => ({ default: m.StandupPage })),
);
const LeavePage = lazy(() =>
  import("./features/leave").then((m) => ({ default: m.LeavePage })),
);
const TeamsPage = lazy(() =>
  import("./features/management").then((m) => ({ default: m.TeamsPage })),
);
const PeoplePage = lazy(() =>
  import("./features/management").then((m) => ({ default: m.PeoplePage })),
);
const ProjectsPage = lazy(() =>
  import("./features/management").then((m) => ({ default: m.ProjectsPage })),
);
const ReportsPage = lazy(() =>
  import("./features/reports").then((m) => ({ default: m.ReportsPage })),
);
const AuditPage = lazy(() =>
  import("./features/settings").then((m) => ({ default: m.AuditPage })),
);
const IntegrationsPage = lazy(() =>
  import("./features/settings").then((m) => ({ default: m.IntegrationsPage })),
);
const NotificationsPage = lazy(() =>
  import("./features/settings").then((m) => ({ default: m.NotificationsPage })),
);
const ProfilePage = lazy(() =>
  import("./features/settings").then((m) => ({ default: m.ProfilePage })),
);
const SettingsPage = lazy(() =>
  import("./features/settings").then((m) => ({ default: m.SettingsPage })),
);
import "./app/styles.css";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1, refetchOnWindowFocus: true },
  },
});
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="auth-center">
        <h1>The workspace could not open</h1>
        <p>Refresh the page to retry. Your saved records remain in Supabase.</p>
        <Button
          className="button button-primary"
          onClick={() => window.location.reload()}
        >
          Reload workspace
        </Button>
      </main>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/auth/callback" element={<Callback />} />
                <Route
                  path="/pending-approval"
                  element={<AccessPage pending />}
                />
                <Route path="/access-denied" element={<AccessPage />} />
                <Route
                  element={
                    <Guard>
                      <Shell />
                    </Guard>
                  }
                >
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="profile" element={<ProfilePage />} />
                  <Route path="notifications" element={<NotificationsPage />} />
                  <Route path="my-tasks" element={<DeveloperTaskCalendar />} />
                  <Route
                    path="my-updates"
                    element={<Navigate to="/my-tasks" replace />}
                  />
                  <Route
                    path="my-updates/:date"
                    element={<Navigate to="/my-tasks" replace />}
                  />
                  <Route
                    path="my-history"
                    element={<Navigate to="/my-tasks" replace />}
                  />
                  <Route path="my-leave" element={<LeavePage />} />
                  <Route
                    path="admin/dashboard"
                    element={
                      <Guard admin>
                        <Dashboard />
                      </Guard>
                    }
                  />
                  <Route
                    path="admin/morning-standup"
                    element={
                      <Guard admin>
                        <StandupPage />
                      </Guard>
                    }
                  />
                  <Route
                    path="admin/evening-standup"
                    element={
                      <Guard admin>
                        <StandupPage evening />
                      </Guard>
                    }
                  />
                  <Route
                    path="admin/tasks"
                    element={
                      <Guard admin>
                        <TasksPage />
                      </Guard>
                    }
                  />
                  <Route
                    path="admin/teams"
                    element={
                      <Guard admin>
                        <TeamsPage />
                      </Guard>
                    }
                  />
                  <Route
                    path="admin/developers"
                    element={
                      <Guard admin>
                        <PeoplePage />
                      </Guard>
                    }
                  />
                  <Route
                    path="admin/projects"
                    element={
                      <Guard admin>
                        <ProjectsPage />
                      </Guard>
                    }
                  />
                  <Route
                    path="admin/leave"
                    element={
                      <Guard admin>
                        <LeavePage admin />
                      </Guard>
                    }
                  />
                  <Route
                    path="admin/approvals"
                    element={
                      <Guard admin>
                        <PeoplePage approvals />
                      </Guard>
                    }
                  />
                  <Route
                    path="admin/reports"
                    element={
                      <Guard admin>
                        <ReportsPage />
                      </Guard>
                    }
                  />
                  <Route
                    path="admin/reports/export"
                    element={
                      <Guard admin>
                        <ReportsPage />
                      </Guard>
                    }
                  />
                  <Route
                    path="admin/integrations"
                    element={
                      <Guard superOnly>
                        <IntegrationsPage />
                      </Guard>
                    }
                  />
                  <Route
                    path="admin/settings"
                    element={
                      <Guard superOnly>
                        <SettingsPage />
                      </Guard>
                    }
                  />
                  <Route
                    path="admin/audit-logs"
                    element={
                      <Guard superOnly>
                        <AuditPage />
                      </Guard>
                    }
                  />
                  <Route
                    path="*"
                    element={
                      <Empty title="Page not found">
                        <a href="/dashboard">Return to dashboard</a>
                      </Empty>
                    }
                  />
                </Route>
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);

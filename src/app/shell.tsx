import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Sun,
  Moon,
  ListTodo,
  Users,
  FolderKanban,
  CalendarDays,
  FileChartColumn,
  Settings,
  Plug,
  ShieldCheck,
  Bell,
  LogOut,
  Menu,
  History,
  RefreshCw,
  User,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { supabase } from "../lib/supabase";
import { dateLabel } from "../lib/business";
import { useBusinessDate } from "../lib/use-business-date";
import { Avatar } from "../components/shared";
import { Button } from "../components/ui/button";
export function Shell() {
  const { profile, avatarUrl } = useAuth();
  const businessDate = useBusinessDate();
  const reducedMotion = useReducedMotion();
  const [menu, setMenu] = useState(false),
    [dark, setDark] = useState(
      () => localStorage.getItem("syncora-theme") === "dark",
    );
  const location = useLocation(),
    cache = useQueryClient();
  const admin = profile?.role !== "developer",
    superAdmin = profile?.role === "super_admin";
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("syncora-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    if (!supabase || !profile) return;
    const channel = supabase
      .channel("workspace")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => {
          void cache.invalidateQueries({ queryKey: ["tasks"] });
          void cache.invalidateQueries({ queryKey: ["task_status_history"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leave_requests" },
        () => {
          void cache.invalidateQueries({ queryKey: ["leave_requests"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "standup_sessions" },
        () => {
          void cache.invalidateQueries({ queryKey: ["standup_sessions"] });
        },
      )
      .subscribe();
    return () => {
      void supabase!.removeChannel(channel);
    };
  }, [profile, cache]);
  const links = admin
    ? [
        ["Overview", "/admin/dashboard", LayoutDashboard],
        ["Morning standup", "/admin/morning-standup", Sun],
        ["Evening standup", "/admin/evening-standup", Moon],
        ["Task register", "/admin/tasks", ListTodo],
        ["Teams", "/admin/teams", Users],
        ["People", "/admin/developers", User],
        ["Projects", "/admin/projects", FolderKanban],
        ["Leave", "/admin/leave", CalendarDays],
        ["Approvals", "/admin/approvals", ShieldCheck],
        ["Reports", "/admin/reports", FileChartColumn],
        ...(superAdmin
          ? [
              ["Integrations", "/admin/integrations", Plug],
              ["Settings", "/admin/settings", Settings],
              ["Audit log", "/admin/audit-logs", History],
            ]
          : []),
      ]
    : [
        ["Overview", "/dashboard", LayoutDashboard],
        ["My tasks", "/my-tasks", ListTodo],
        ["My leave", "/my-leave", CalendarDays],
      ];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={`sidebar ${menu ? "is-open" : ""}`}>
        <NavLink className="wordmark" to="/dashboard">
          <RefreshCw className="brand-symbol" aria-hidden="true" />
          <span className="brand-name">
            Sync<span>Ora</span>
          </span>
        </NavLink>
        <div className="workspace-label">
          <span className="workspace-dot" />
          Blissora workspace
        </div>
        <p className="nav-heading">Workspace</p>
        <nav aria-label="Workspace navigation">
          {links.map(([name, path, Icon]) => {
            const Glyph = Icon as typeof Sun;
            return (
              <NavLink
                onClick={() => setMenu(false)}
                key={String(path)}
                to={String(path)}
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        className="nav-active-surface"
                        layoutId={
                          reducedMotion ? undefined : "workspace-navigation"
                        }
                        transition={{
                          type: "spring",
                          stiffness: 420,
                          damping: 36,
                        }}
                        aria-hidden="true"
                      />
                    )}
                    <Glyph size={18} />
                    <span>{String(name)}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="daily-rhythm">
            <FolderKanban size={17} />
            <div>
              <strong>Built together, delivered together</strong>
              <p>A workspace by Blissora.</p>
            </div>
          </div>
          <NavLink
            to="/profile"
            className="user-card"
            onClick={() => setMenu(false)}
          >
            <Avatar name={profile!.name} src={avatarUrl} />
            <span>
              <strong>{profile!.name}</strong>
              <small>{profile!.role.replaceAll("_", " ")}</small>
            </span>
          </NavLink>
        </div>
      </aside>
      {menu && (
        <Button
          variant="ghost"
          className="menu-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-column">
        <header className="topbar">
          <div className="toolbar">
            <Button
              variant="ghost"
              className="mobile-menu"
              onClick={() => setMenu(!menu)}
              aria-expanded={menu}
            >
              <Menu size={18} />
              Menu
            </Button>
            <span className="breadcrumb">
              Workspace <span>/</span>{" "}
              {location.pathname.split("/").at(-1)?.replaceAll("-", " ")}
            </span>
          </div>
          <div className="toolbar">
            <span className="top-date">
              {dateLabel(businessDate)} <small>Colombo</small>
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={dark ? "Use light theme" : "Use dark theme"}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
            <NavLink
              className="icon-link"
              to="/notifications"
              aria-label="Notifications"
            >
              <Bell size={18} />
            </NavLink>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              onClick={() => void supabase?.auth.signOut()}
            >
              <LogOut size={18} />
            </Button>
          </div>
        </header>
        <main id="main" className="page-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>
            SyncOra <span className="muted">by Blissora</span>
          </span>
          <span>Plan. Progress. Carry forward.</span>
        </footer>
      </div>
    </div>
  );
}

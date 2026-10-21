export type Role = "super_admin" | "admin" | "developer";
export type AccountStatus = "pending" | "active" | "rejected" | "inactive";
export type TaskStatus =
  "backlog" | "planned" | "in_progress" | "blocked" | "completed" | "cancelled";
export type SubmissionStatus =
  "draft" | "submitted" | "approved" | "revision_requested";
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
export interface Base {
  id: string;
  created_at: string;
}
export interface Profile extends Base {
  avatar_url?: string | null;
  name: string;
  email: string;
  role: Role;
  status: AccountStatus;
  job_title: string;
  updated_at: string;
}
export interface Team extends Base {
  name: string;
  archived: boolean;
  updated_at: string;
}
export interface Membership extends Base {
  team_id: string;
  developer_id: string;
  is_lead: boolean;
  starts_on: string;
  ends_on: string | null;
}
export type Project = Team;
export interface Module extends Team {
  project_id: string;
}
export interface Task extends Base {
  task_number: number;
  title: string;
  description: string;
  team_id: string;
  project_id: string | null;
  module_id: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: TaskStatus;
  assignee_id: string | null;
  assigned_by: string;
  target_date: string | null;
  start_date: string | null;
  completed_at: string | null;
  blocker: string;
  blocker_owner: string | null;
  unplanned: boolean;
  updated_at: string;
}
export interface WorkLog extends Base {
  developer_id: string;
  team_id: string | null;
  work_date: string;
  attendance: Attendance;
  hours: number;
  completed_work: string;
  remaining_work: string;
  blockers: string;
  unplanned_work: string;
  notes: string;
  status: SubmissionStatus;
  recorded_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string;
  updated_at: string;
}
export type Attendance =
  "working" | "half_day" | "on_leave" | "absent" | "holiday" | "weekend";
export interface TaskUpdate extends Base {
  work_log_id: string;
  task_id: string;
  status: TaskStatus;
  title: string;
  project_id: string | null;
  module_id: string | null;
  notes: string;
}
export interface Leave extends Base {
  developer_id: string;
  team_id: string | null;
  leave_type_id: string;
  starts_on: string;
  ends_on: string;
  half_day: boolean;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  decision_note: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  updated_at: string;
}
export interface Session extends Base {
  team_id: string;
  meeting_date: string;
  period: "morning" | "evening";
  state: "draft" | "confirmed";
  notes: string;
  created_by: string;
  updated_at: string;
}
export interface Tables {
  profiles: Profile;
  teams: Team;
  team_memberships: Membership;
  projects: Project;
  modules: Module;
  project_memberships: Base & { project_id: string; team_id: string };
  tasks: Task;
  task_assignees: Base & { task_id: string; developer_id: string };
  task_status_history: Base & {
    task_id: string;
    old_status: TaskStatus | null;
    new_status: TaskStatus;
    assignee_id: string | null;
    actor_id: string | null;
    detail: Json;
  };
  task_comments: Base & { task_id: string; author_id: string; body: string };
  standup_sessions: Session;
  standup_assignments: Base & {
    session_id: string;
    task_id: string;
    developer_id: string;
  };
  daily_work_logs: WorkLog;
  daily_task_updates: TaskUpdate;
  leave_requests: Leave;
  leave_types: Base & { name: string; active: boolean };
  holidays: Base & { holiday_date: string; name: string };
  working_calendar_settings: Base & {
    singleton: boolean;
    working_days: number[];
    timezone: string;
    allowed_domains: string[];
    updated_at: string;
  };
  report_snapshots: Base & {
    report_date: string;
    team_id: string;
    style: "person" | "team";
    body: string;
    created_by: string;
  };
  report_exports: Base & {
    starts_on: string;
    ends_on: string;
    format: string;
    created_by: string;
  };
  google_sheet_integrations: Base & {
    enabled: boolean;
    spreadsheet_id: string;
    singleton: boolean;
    updated_at: string;
  };
  sync_jobs: Base & {
    status: string;
    records: number;
    error: string | null;
    requested_by: string | null;
    finished_at: string | null;
  };
  audit_logs: Base & {
    actor_id: string | null;
    action: string;
    entity: string;
    record_id: string | null;
    detail: Json;
  };
}
type TableDef<T> = {
  Row: T & Record<string, unknown>;
  Insert: Partial<T> & Record<string, unknown>;
  Update: Partial<T> & Record<string, unknown>;
  Relationships: [];
};
export interface Database {
  public: {
    Tables: { [K in keyof Tables]: TableDef<Tables[K]> };
    Views: Record<never, never>;
    Functions: {
      search_tasks: {
        Args: {
          p_query?: string;
          p_filters?: Json;
          p_page?: number;
          p_limit?: number;
        };
        Returns: Json;
      };
      command: { Args: { action: string; payload: Json }; Returns: Json };
      expected_attendance: { Args: { d: string; day: string }; Returns: Json };
    };
    Enums: {
      app_role: Role;
      account_status: AccountStatus;
      task_status: TaskStatus;
      submission_status: SubmissionStatus;
    };
    CompositeTypes: Record<never, never>;
  };
}

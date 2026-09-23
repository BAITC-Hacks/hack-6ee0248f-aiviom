export type Grade = "Junior" | "Middle" | "Senior" | "Lead";
export type Role = "employee" | "advisor" | "manager" | "hr" | "supervisor";
export type Levels = Record<string, number>;
export interface Goal {
  target_role: string;
  target_grade: Grade;
}
export interface Employee {
  employee_id: string;
  full_name: string;
  department: string;
  role: string;
  grade: Grade;
  manager_id: string | null;
  hire_date: string;
  tenure_months: number;
  work_format: string;
  preferred_language: string;
  career_goal: Goal | null;
  skills: Levels;
  last_review_date: string;
}
export interface Skill {
  skill_id: string;
  name: string;
  type: string;
  category: string;
  description: string;
}
export interface RoleProfile {
  role: string;
  grade: Grade;
  required_skills: Levels;
  critical_skills: string[];
}
export interface Gain {
  skill_id: string;
  gain: number;
  max_level: number;
}
export interface Event {
  event_id: string;
  title: string;
  description: string;
  type: string;
  format: string;
  duration_hours: number;
  mandatory: boolean;
  target_roles: string[];
  target_grades: string[];
  develops_skills: Gain[];
  prerequisites: Levels;
  upcoming_sessions: string[];
}
export interface History {
  created_at?: string;
  record_id: string;
  employee_id: string;
  event_id: string;
  date: string;
  due_date: string | null;
  status: string;
  completion_pct: number;
  score: number | null;
  feedback_rating: number | null;
  assigned_by: string;
  completed_at?: string;
  completion_time_quality?: "proxy" | "exact";
}
export interface Credit {
  created_at?: string;
  credit_id: string;
  employee_id: string;
  completed_at: string;
  gains: Gain[];
  source_id: string;
}
export interface Dataset {
  employees: Employee[];
  events: Event[];
  skills: Skill[];
  role_profiles: RoleProfile[];
  history: History[];
}
export interface Gap {
  skill_id: string;
  name: string;
  current: number;
  required: number;
  gap: number;
  critical: boolean;
}
export interface Candidate {
  event: Event;
  eligible: boolean;
  reasons: string[];
  session: string | null;
  continuing: boolean;
  deltas: Levels;
  U: number;
  K: number;
  E: number | null;
  B: number;
  H: number;
  priority: number;
  evidence_ids: string[];
}
export interface Profile {
  employee: Employee;
  as_of: string;
  skills: Levels;
  goal: Goal | null;
  goal_source: string;
  gaps: Gap[];
  coverage: number | null;
  total_gap: number;
  critical_met: number;
  critical_total: number;
  history: History[];
  provenance: { record_id: string; date: string; quality: string }[];
  candidates: Candidate[];
  mandatory: History[];
  no_next_reason: string | null;
}
export interface Preview {
  before: Levels;
  after: Levels;
  deltas: Levels;
  coverage_before: number | null;
  coverage_after: number | null;
  unlocked_event_ids: string[];
}
export interface Milestone {
  skill_id: string;
  name: string;
  current: number;
  required: number;
  critical: boolean;
  status: string;
  event_ids: string[];
}
export interface Roadmap {
  alternatives?: {quest_id:string;title:string;status:string;skill_ids:string[]}[];
  milestones: Milestone[];
  steps: {
    event_id: string;
    session: string | null;
    status: string;
    reason: string;
  }[];
  remaining_gaps: Gap[];
  search_limited: boolean;
  plan_hours: number;
  weeks_lower_bound: number | null;
}
export interface Recommendation {
  event_id: string;
  reason: string;
  factor_keys: string[];
  evidence_ids: string[];
  alternative_event_id: string | null;
  alternative_reason: string;
}
export interface RecommendationResult {
  mode: "live_ai" | "cached_live_ai" | "rules_fallback" | "unavailable";
  recommendations: Recommendation[];
  warnings: string[];
  model: string | null;
  generated_at: string;
  latency_ms: number;
  usage?: { input_tokens: number; output_tokens: number };
  facts_hash: string;
}
export interface Identity {
  id: string;
  label: string;
  role: Role;
  employee_id: string | null;
}
export interface Quest {
  id: string;
  employee_id: string;
  title: string;
  description: string;
  deliverables: string;
  estimated_hours: number | null;
  source_url: string | null;
  skill_ids: string[];
  gains: Gain[];
  criteria: string;
  status: string;
  requires_resource: boolean;
  requires_policy: boolean;
  resource_approved: boolean;
  policy_approved: boolean;
  advisor_approved: boolean;
  evidence: string;
  decisions: { actor: string; action: string; reason: string; at: string }[];
  created_at: string;
  version: number;
}

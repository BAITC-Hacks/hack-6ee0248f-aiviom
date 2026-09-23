import type { Candidate, Employee, Event, Identity, Profile, Quest, RecommendationResult, Roadmap, RoleProfile, Skill } from '../shared/types';

export interface Session {
  workspace_id: string;
  as_of: string;
  identity: Identity;
  identities: Identity[];
  version: number;
  ai_available: boolean;
}

export interface ExtendedProfile extends Profile {
  xp: number;
  balance: number;
  personal_level: number;
  plan_progress: number | null;
  weekly_budget: number;
  plan_items: string[];
  help_requests: Record<string, unknown>[];
}

export interface Catalog { events: Event[]; skills: Skill[]; role_profiles: RoleProfile[] }
export interface Rewards { balance: number; earned: number; items: { id: string; title: string; cost: number; description: string }[]; ledger: Record<string, unknown>[] }
export interface ExternalResults { mode: 'live_search'|'unavailable'; opportunities: { title:string; url:string; excerpt:string; checked_at:string; cost:'unknown'; duration:'unknown'; company_approved:false; skill_gain:null }[]; warning:string }
export type { Candidate, Employee, Event, Quest, RecommendationResult, Roadmap };

function errorMessage(value: unknown, status: number): string {
  if (typeof value === 'object' && value !== null && 'user_message' in value && typeof value.user_message === 'string') return value.user_message;
  return `Запрос не выполнен (${status}). Повторите попытку.`;
}

let requestLocale: import('../shared/locale').Locale = 'ru';
export function setApiLocale(locale: import('../shared/locale').Locale) { requestLocale = locale; }

export class ApiError extends Error {
  constructor(message: string, public code: string, public messageKey?: string, public params?: Record<string, string | number>, public requestId?: string) { super(message); this.name = 'ApiError'; }
}

export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { 'Accept-Language': requestLocale, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload as { code?: string; message_key?: string; params?: Record<string, string | number>; request_id?: string } | null;
    throw new ApiError(errorMessage(payload, response.status), error?.code ?? 'REQUEST_FAILED', error?.message_key, error?.params, error?.request_id);
  }
  return payload as T;
}

export const endpoint = {
  session: () => api<Session>('/api/session'),
  switchIdentity: (identity_id: string) => api<Session>('/api/session/switch', 'POST', { identity_id }),
  reset: () => api<Session>('/api/demo/reset', 'POST'),
  date: (as_of: string) => api<Session>('/api/demo/date', 'POST', { as_of }),
  catalog: () => api<Catalog>('/api/catalog'),
  employees: () => api<{ employees: Employee[] }>('/api/employees'),
  profile: (id: string) => api<ExtendedProfile>(`/api/employees/${encodeURIComponent(id)}/profile`),
  goal: (id: string, goal: { target_role: string; target_grade: string } | null, weekly_budget: number) => api<ExtendedProfile>(`/api/employees/${encodeURIComponent(id)}/goal`, 'PUT', { goal, weekly_budget }),
  roadmap: (id: string) => api<Roadmap>(`/api/employees/${encodeURIComponent(id)}/roadmap`),
  recommendations: (id: string) => api<RecommendationResult>(`/api/employees/${encodeURIComponent(id)}/recommendations`, 'POST'),
  preview: (id: string, event_id: string) => api<import('../shared/types').Preview>(`/api/employees/${encodeURIComponent(id)}/preview`, 'POST', { event_id }),
  plan: (employee_id: string, event_id: string) => api<{ ok: true }>('/api/plan', 'POST', { employee_id, event_id }),
  completionRequest: (employee_id: string, event_id: string, evidence: string, session?: string) => api<{ ok: true }>('/api/completion-requests', 'POST', { employee_id, event_id, evidence, session, idempotency_key: crypto.randomUUID() }),
  completionRequests: () => api<{ requests: Record<string, unknown>[] }>('/api/completion-requests'),
  acceptCompletion: (id: string, reason: string) => api<unknown>(`/api/completion-requests/${encodeURIComponent(id)}/accept`, 'POST', { reason }),
  quests: () => api<{ quests: Quest[] }>('/api/side-quests'),
  createQuest: (body: unknown) => api<Quest>('/api/side-quests', 'POST', body),
  reviewQuest: (id: string, body: unknown) => api<Quest>(`/api/side-quests/${encodeURIComponent(id)}/review`, 'POST', body),
  resubmitQuest: (id: string, body: {title:string;description:string;deliverables:string}) => api<Quest>(`/api/side-quests/${encodeURIComponent(id)}/resubmit`, 'POST', body),
  resourceQuest: (id: string, body: unknown) => api<Quest>(`/api/side-quests/${encodeURIComponent(id)}/resource`, 'POST', body),
  policyQuest: (id: string, body: unknown) => api<Quest>(`/api/side-quests/${encodeURIComponent(id)}/policy`, 'POST', body),
  evidenceQuest: (id: string, evidence: string) => api<Quest>(`/api/side-quests/${encodeURIComponent(id)}/evidence`, 'POST', { evidence }),
  acceptQuest: (id: string, reason: string) => api<Quest>(`/api/side-quests/${encodeURIComponent(id)}/accept`, 'POST', { reason }),
  help: (employee_id: string, reason: string, event_id?: string) => api<{ ok: true }>('/api/help', 'POST', { employee_id, reason, event_id }),
  helpRequests: () => api<{ requests: Record<string, unknown>[] }>('/api/help'),
  resolveHelp: (id: string, reason: string) => api<unknown>(`/api/help/${encodeURIComponent(id)}/resolve`, 'POST', { reason }),
  assignment: (employee_id: string, event_id: string, due_date: string) => api<{ ok: true }>('/api/assignments', 'POST', { employee_id, event_id, due_date }),
  analytics: () => api<Record<string, unknown>>('/api/hr/analytics'),
  importPreview: (body: unknown) => api<Record<string, unknown>>('/api/import/preview', 'POST', body),
  importCommit: (body: unknown) => api<Record<string, unknown>>('/api/import/commit', 'POST', body),
  rewards: () => api<Rewards>('/api/rewards'),
  redeem: (id: string) => api<unknown>(`/api/rewards/${encodeURIComponent(id)}/redeem`, 'POST', { idempotency_key: crypto.randomUUID() }),
  audit: () => api<{ events: Record<string, unknown>[] }>('/api/audit'),
  externalSearch: (skill_id:string,desired_level:number,language:'ru'|'kk'|'en',format?:'online'|'offline'|'self_paced') => api<ExternalResults>('/api/external/search','POST',{skill_id,desired_level,language,format}),
};

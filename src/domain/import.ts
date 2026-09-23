import type { Dataset, Employee, History, Levels } from '../shared/types.js';
import { validDate } from './calculation.js';
import { normalizeHistory, parseHistoryCsv, unwrap } from './source.js';

export interface ImportError { row: number; field: string; message: string }
export interface ImportResult { valid: boolean; errors: ImportError[]; warnings: string[]; employees: Employee[]; history: History[]; counts: { employees: number; history: number } }

const GRADES = new Set(['Junior', 'Middle', 'Senior', 'Lead']);
const STATUSES = new Set(['completed', 'in_progress', 'dropped', 'no_show', 'declined', 'overdue']);
const WORK_FORMATS = new Set(['office', 'hybrid', 'remote']);
const LANGUAGES = new Set(['kk', 'ru', 'en']);
const ASSIGNERS = new Set(['self', 'manager', 'hr']);
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
const nullable = (v: unknown) => v === '' || v === null || v === undefined;
const stable = (v: unknown): string => JSON.stringify(v, function (_key, value: unknown) {
  return isObject(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value;
});

function extractEmployees(input: unknown): unknown[] {
  if (input === undefined || input === null) return [];
  if (Array.isArray(input)) return input;
  if (isObject(input) && Array.isArray(input.employees)) return input.employees;
  if (isObject(input) && 'employee_id' in input) return [input];
  throw new Error('employees must be an array, wrapper, or employee object');
}

function extractHistory(input: unknown): unknown[] {
  if (input === undefined || input === null || input === '') return [];
  if (typeof input === 'string') return parseHistoryCsv(input);
  if (Array.isArray(input)) return input;
  if (isObject(input) && Array.isArray(input.history)) return input.history;
  throw new Error('history must be CSV, array, or wrapper');
}

export function validateImport(dataset: Dataset, input: unknown): ImportResult {
  const errors: ImportError[] = [];
  const warnings: string[] = [];
  const add = (row: number, field: string, message: string) => errors.push({ row, field, message });
  if (!isObject(input)) return { valid: false, errors: [{ row: 0, field: 'input', message: 'Expected {employees, history}' }], warnings, employees: [], history: [], counts: { employees: 0, history: 0 } };
  let rawEmployees: unknown[] = [];
  let rawHistory: unknown[] = [];
  try { rawEmployees = extractEmployees(input.employees); } catch (error) { add(0, 'employees', String(error)); }
  try { rawHistory = extractHistory(input.history); } catch (error) { add(0, 'history', String(error)); }
  const skillIds = new Set(dataset.skills.map(s => s.skill_id));
  const eventMap = new Map(dataset.events.map(e => [e.event_id, e]));
  const profileKeys = new Set(dataset.role_profiles.map(p => `${p.role}\0${p.grade}`));
  const knownEmployees = new Map(dataset.employees.map(e => [e.employee_id, e]));
  const knownHistory = new Map(dataset.history.map(h => [h.record_id, h]));
  const completionKey = (h: History) => `${h.employee_id}\0${h.event_id}${h.event_id === 'EV_036' ? `\0${h.date}` : ''}`;
  const knownCompletions = new Set(dataset.history.filter(h => h.status === 'completed' && !eventMap.get(h.event_id)?.mandatory).map(completionKey));
  const employeeIds = new Set<string>();
  const recordIds = new Set<string>();
  const employees: Employee[] = [];
  const history: History[] = [];
  rawEmployees.forEach((raw, i) => {
    const row = i + 1;
    if (!isObject(raw)) { add(row, 'employee', 'Expected object'); return; }
    const start = errors.length;
    for (const field of ['employee_id', 'full_name', 'department', 'role', 'grade', 'hire_date', 'work_format', 'preferred_language', 'last_review_date'])
      if (!str(raw[field])) add(row, field, 'Required non-empty string');
    if (typeof raw.employee_id === 'string') {
      if (employeeIds.has(raw.employee_id)) add(row, 'employee_id', 'Duplicate ID in import');
      employeeIds.add(raw.employee_id);
    }
    if (!GRADES.has(String(raw.grade))) add(row, 'grade', 'Unknown grade');
    if (!profileKeys.has(`${raw.role}\0${raw.grade}`)) add(row, 'role', 'Unknown role/grade profile');
    if (!WORK_FORMATS.has(String(raw.work_format))) add(row, 'work_format', 'Unknown work format');
    if (!LANGUAGES.has(String(raw.preferred_language))) add(row, 'preferred_language', 'Unknown language');
    if (!validDate(String(raw.hire_date))) add(row, 'hire_date', 'Invalid ISO date');
    if (!validDate(String(raw.last_review_date))) add(row, 'last_review_date', 'Invalid ISO date');
    if (validDate(String(raw.hire_date)) && validDate(String(raw.last_review_date)) && String(raw.last_review_date) < String(raw.hire_date)) add(row, 'last_review_date', 'Before hire date');
    if (!Number.isInteger(raw.tenure_months) || (raw.tenure_months as number) < 0) add(row, 'tenure_months', 'Expected non-negative integer');
    if (!nullable(raw.manager_id) && !str(raw.manager_id)) add(row, 'manager_id', 'Expected ID or null');
    if (!isObject(raw.skills)) add(row, 'skills', 'Expected skill levels object');
    else for (const [id, level] of Object.entries(raw.skills)) {
      if (!skillIds.has(id)) add(row, `skills.${id}`, 'Unknown skill');
      if (!Number.isInteger(level) || (level as number) < 0 || (level as number) > 5) add(row, `skills.${id}`, 'Expected integer 0–5');
    }
    if (!nullable(raw.career_goal)) {
      if (!isObject(raw.career_goal) || !profileKeys.has(`${raw.career_goal.target_role}\0${raw.career_goal.target_grade}`)) add(row, 'career_goal', 'Unknown target role/grade');
    }
    if (errors.length > start) return;
    const employee: Employee = { employee_id: String(raw.employee_id), full_name: String(raw.full_name), department: String(raw.department),
      role: String(raw.role), grade: raw.grade as Employee['grade'], manager_id: nullable(raw.manager_id) ? null : String(raw.manager_id),
      hire_date: String(raw.hire_date), tenure_months: raw.tenure_months as number, work_format: String(raw.work_format),
      preferred_language: String(raw.preferred_language), career_goal: nullable(raw.career_goal) ? null : raw.career_goal as Employee['career_goal'],
      skills: raw.skills as Levels, last_review_date: String(raw.last_review_date) };
    const existing = knownEmployees.get(employee.employee_id);
    if (existing) {
      if (stable(existing) !== stable(employee)) add(row, 'employee_id', 'Existing ID has conflicting content');
      else warnings.push(`Employee ${employee.employee_id} already exists; no-op`);
    } else employees.push(employee);
  });
  const incomingIds = new Set(employees.map(e => e.employee_id));
  employees.forEach((e, i) => {
    if (e.manager_id && !knownEmployees.has(e.manager_id) && !incomingIds.has(e.manager_id))
      warnings.push(`Employee ${e.employee_id}: manager ${e.manager_id} is unresolved`);
    if (e.manager_id === e.employee_id) add(i + 1, 'manager_id', 'Cannot manage self');
  });
  rawHistory.forEach((raw, i) => {
    const row = i + 1;
    if (!isObject(raw)) { add(row, 'history', 'Expected object'); return; }
    const start = errors.length;
    for (const field of ['record_id', 'employee_id', 'event_id', 'date', 'status', 'assigned_by']) if (!str(raw[field])) add(row, field, 'Required non-empty string');
    if (typeof raw.record_id === 'string') {
      if (recordIds.has(raw.record_id)) add(row, 'record_id', 'Duplicate ID in import');
      recordIds.add(raw.record_id);
    }
    if (!knownEmployees.has(String(raw.employee_id)) && !incomingIds.has(String(raw.employee_id))) add(row, 'employee_id', 'Unknown employee');
    const event = eventMap.get(String(raw.event_id));
    if (!event) add(row, 'event_id', 'Unknown event');
    if (!validDate(String(raw.date))) add(row, 'date', 'Invalid ISO date');
    if (!nullable(raw.due_date) && !validDate(String(raw.due_date))) add(row, 'due_date', 'Invalid ISO date');
    if (!STATUSES.has(String(raw.status))) add(row, 'status', 'Unknown status');
    if (!ASSIGNERS.has(String(raw.assigned_by))) add(row, 'assigned_by', 'Unknown assigner');
    const pct = Number(raw.completion_pct);
    if (!Number.isInteger(pct) || pct < 0 || pct > 100) add(row, 'completion_pct', 'Expected integer 0–100');
    if (raw.status === 'completed' && pct !== 100) add(row, 'completion_pct', 'Completed requires 100');
    if (['in_progress', 'overdue'].includes(String(raw.status)) && pct > 95) add(row, 'completion_pct', 'Unfinished status cannot exceed 95');
    if (raw.status === 'dropped' && (pct < 5 || pct > 95)) add(row, 'completion_pct', 'Dropped requires 5–95');
    if (['no_show', 'declined'].includes(String(raw.status)) && pct !== 0) add(row, 'completion_pct', 'Status requires 0');
    if (raw.status === 'no_show' && event?.format === 'self_paced') add(row, 'status', 'No-show requires a scheduled event');
    if (!nullable(raw.score) && (!Number.isInteger(Number(raw.score)) || Number(raw.score) < 0 || Number(raw.score) > 100)) add(row, 'score', 'Expected integer 0–100 or blank');
    if (!nullable(raw.feedback_rating) && (!Number.isInteger(Number(raw.feedback_rating)) || Number(raw.feedback_rating) < 1 || Number(raw.feedback_rating) > 5)) add(row, 'feedback_rating', 'Expected integer 1–5 or blank');
    if (!nullable(raw.completed_at) && !validDate(String(raw.completed_at))) add(row, 'completed_at', 'Invalid ISO date');
    if (!nullable(raw.completed_at) && raw.status !== 'completed') add(row, 'completed_at', 'Only completed records have completion date');
    if (!nullable(raw.completed_at) && validDate(String(raw.date)) && validDate(String(raw.completed_at)) && String(raw.completed_at) < String(raw.date))
      add(row, 'completed_at', 'Completion before enrollment/session');
    if (errors.length > start) return;
    const item = normalizeHistory(raw);
    const existing = knownHistory.get(item.record_id);
    if (existing) {
      if (stable(existing) !== stable(item)) add(row, 'record_id', 'Existing ID has conflicting content');
      else warnings.push(`History ${item.record_id} already exists; no-op`);
    } else {
      if (item.status === 'completed' && !event?.mandatory) {
        const key = completionKey(item);
        if (knownCompletions.has(key)) add(row, 'event_id', item.event_id === 'EV_036' ? 'Session already completed' : 'Event already completed');
        else knownCompletions.add(key);
      }
      if (errors.length === start) history.push(item);
    }
  });
  return { valid: errors.length === 0, errors, warnings, employees, history, counts: { employees: employees.length, history: history.length } };
}

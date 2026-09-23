import { importMessage, type ImportCode, type ImportIssue } from '../shared/import-i18n.js';
import type { Dataset, Employee, History, Levels } from '../shared/types.js';
import { validDate } from './calculation.js';
import { normalizeHistory, parseHistoryCsv, unwrap } from './source.js';

export interface ImportError { row: number; field: string; message: string; code: ImportCode; message_key: string }
export interface ImportResult { valid: boolean; errors: ImportError[]; warnings: string[]; warning_details: ImportIssue[]; employees: Employee[]; history: History[]; counts: { employees: number; history: number } }

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
  const warning_details: ImportIssue[] = [];
  const warn = (code: ImportCode, params: Record<string,string|number>) => { warning_details.push({code,params}); warnings.push(importMessage(code, 'en',params)); };
  const add = (row: number, field: string, code: ImportCode) => errors.push({ row, field, code, message_key: `import.${code}`, message: importMessage(code, 'en') });
  if (!isObject(input)) return { valid: false, errors: [{ row: 0, field: 'input', code: 'input', message_key: 'import.input', message: importMessage('input', 'en') }], warnings, warning_details, employees: [], history: [], counts: { employees: 0, history: 0 } };
  let rawEmployees: unknown[] = [];
  let rawHistory: unknown[] = [];
  try { rawEmployees = extractEmployees(input.employees); } catch { add(0, 'employees', 'employees_shape'); }
  try { rawHistory = extractHistory(input.history); } catch { add(0, 'history', typeof input.history === 'string' ? 'csv' : 'history_shape'); }
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
    if (!isObject(raw)) { add(row, 'employee', 'object'); return; }
    const start = errors.length;
    for (const field of ['employee_id', 'full_name', 'department', 'role', 'grade', 'hire_date', 'work_format', 'preferred_language', 'last_review_date'])
      if (!str(raw[field]) || String(raw[field]).length > 300) add(row, field, 'required');
    if (typeof raw.employee_id === 'string' && (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(raw.employee_id) || (Object.prototype.hasOwnProperty.call(Object.prototype,raw.employee_id) || raw.employee_id==='prototype'))) add(row, 'employee_id', 'employee_id');
    if (typeof raw.employee_id === 'string') {
      if (employeeIds.has(raw.employee_id)) add(row, 'employee_id', 'duplicate');
      employeeIds.add(raw.employee_id);
    }
    if (!GRADES.has(String(raw.grade))) add(row, 'grade', 'grade');
    if (!profileKeys.has(`${raw.role}\0${raw.grade}`)) add(row, 'role', 'role');
    if (!WORK_FORMATS.has(String(raw.work_format))) add(row, 'work_format', 'work_format');
    if (!LANGUAGES.has(String(raw.preferred_language))) add(row, 'preferred_language', 'language');
    if (!validDate(String(raw.hire_date))) add(row, 'hire_date', 'date');
    if (!validDate(String(raw.last_review_date))) add(row, 'last_review_date', 'date');
    if (validDate(String(raw.hire_date)) && validDate(String(raw.last_review_date)) && String(raw.last_review_date) < String(raw.hire_date)) add(row, 'last_review_date', 'before_hire');
    if (!Number.isInteger(raw.tenure_months) || (raw.tenure_months as number) < 0) add(row, 'tenure_months', 'nonnegative');
    if (!nullable(raw.manager_id) && !str(raw.manager_id)) add(row, 'manager_id', 'nullable_id');
    if (!isObject(raw.skills)) add(row, 'skills', 'skills');
    else for (const [id, level] of Object.entries(raw.skills)) {
      if (!skillIds.has(id)) add(row, `skills.${id}`, 'skill');
      if (!Number.isInteger(level) || (level as number) < 0 || (level as number) > 5) add(row, `skills.${id}`, 'level');
    }
    if (!nullable(raw.career_goal)) {
      if (!isObject(raw.career_goal) || !profileKeys.has(`${raw.career_goal.target_role}\0${raw.career_goal.target_grade}`)) add(row, 'career_goal', 'goal');
    }
    if (errors.length > start) return;
    const employee: Employee = { employee_id: String(raw.employee_id), full_name: String(raw.full_name), department: String(raw.department),
      role: String(raw.role), grade: raw.grade as Employee['grade'], manager_id: nullable(raw.manager_id) ? null : String(raw.manager_id),
      hire_date: String(raw.hire_date), tenure_months: raw.tenure_months as number, work_format: String(raw.work_format),
      preferred_language: String(raw.preferred_language), career_goal: nullable(raw.career_goal) ? null : raw.career_goal as Employee['career_goal'],
      skills: raw.skills as Levels, last_review_date: String(raw.last_review_date) };
    const existing = knownEmployees.get(employee.employee_id);
    if (existing) {
      if (stable(existing) !== stable(employee)) add(row, 'employee_id', 'conflict');
      else warn('employee_exists', {id:employee.employee_id});
    } else employees.push(employee);
  });
  const incomingIds = new Set(employees.map(e => e.employee_id));
  employees.forEach((e, i) => {
    if (e.manager_id && !knownEmployees.has(e.manager_id) && !incomingIds.has(e.manager_id))
      warn('manager_unresolved', {id:e.employee_id,manager:e.manager_id});
    if (e.manager_id === e.employee_id) add(i + 1, 'manager_id', 'self_manager');
  });
  rawHistory.forEach((raw, i) => {
    const row = i + 1;
    if (!isObject(raw)) { add(row, 'history', 'object'); return; }
    const start = errors.length;
    for (const field of ['record_id', 'employee_id', 'event_id', 'date', 'status', 'assigned_by']) if (!str(raw[field]) || String(raw[field]).length > 300) add(row, field, 'required');
    if (typeof raw.record_id === 'string' && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(raw.record_id)) add(row, 'record_id', 'record_id');
    if (typeof raw.record_id === 'string') {
      if (recordIds.has(raw.record_id)) add(row, 'record_id', 'duplicate');
      recordIds.add(raw.record_id);
    }
    if (!knownEmployees.has(String(raw.employee_id)) && !incomingIds.has(String(raw.employee_id))) add(row, 'employee_id', 'employee');
    const event = eventMap.get(String(raw.event_id));
    if (!event) add(row, 'event_id', 'event');
    if (!validDate(String(raw.date))) add(row, 'date', 'date');
    if (!nullable(raw.due_date) && !validDate(String(raw.due_date))) add(row, 'due_date', 'date');
    if (!STATUSES.has(String(raw.status))) add(row, 'status', 'status');
    if (!ASSIGNERS.has(String(raw.assigned_by))) add(row, 'assigned_by', 'assigner');
    const pct = Number(raw.completion_pct);
    if (!Number.isInteger(pct) || pct < 0 || pct > 100) add(row, 'completion_pct', 'percent');
    if (raw.status === 'completed' && pct !== 100) add(row, 'completion_pct', 'completed');
    if (['in_progress', 'overdue'].includes(String(raw.status)) && pct > 95) add(row, 'completion_pct', 'unfinished');
    if (raw.status === 'dropped' && (pct < 5 || pct > 95)) add(row, 'completion_pct', 'dropped');
    if (['no_show', 'declined'].includes(String(raw.status)) && pct !== 0) add(row, 'completion_pct', 'zero');
    if (raw.status === 'no_show' && event?.format === 'self_paced') add(row, 'status', 'scheduled');
    if (!nullable(raw.score) && (!Number.isInteger(Number(raw.score)) || Number(raw.score) < 0 || Number(raw.score) > 100)) add(row, 'score', 'score');
    if (!nullable(raw.feedback_rating) && (!Number.isInteger(Number(raw.feedback_rating)) || Number(raw.feedback_rating) < 1 || Number(raw.feedback_rating) > 5)) add(row, 'feedback_rating', 'rating');
    if (!nullable(raw.completed_at) && !validDate(String(raw.completed_at))) add(row, 'completed_at', 'date');
    if (!nullable(raw.completed_at) && raw.status !== 'completed') add(row, 'completed_at', 'completion_date');
    if (!nullable(raw.completed_at) && validDate(String(raw.date)) && validDate(String(raw.completed_at)) && String(raw.completed_at) < String(raw.date))
      add(row, 'completed_at', 'chronology');
    if (errors.length > start) return;
    const item = normalizeHistory(raw);
    const existing = knownHistory.get(item.record_id);
    if (existing) {
      if (stable(existing) !== stable(item)) add(row, 'record_id', 'conflict');
      else warn('history_exists', {id:item.record_id});
    } else {
      if (item.status === 'completed' && !event?.mandatory) {
        const key = completionKey(item);
        if (knownCompletions.has(key)) add(row, 'event_id', item.event_id === 'EV_036' ? 'session_repeat' : 'event_repeat');
        else knownCompletions.add(key);
      }
      if (errors.length === start) history.push(item);
    }
  });
  return { valid: errors.length === 0, errors, warnings, warning_details, employees, history, counts: { employees: employees.length, history: history.length } };
}

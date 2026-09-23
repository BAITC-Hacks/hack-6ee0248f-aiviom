import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';
import type { Dataset, Employee, Event, History, RoleProfile, Skill } from '../shared/types.js';

type Wrapper<T> = T[] | Record<string, unknown>;

export function unwrap<T>(value: Wrapper<T>, key: string): T[] {
  const rows = Array.isArray(value) ? value : value?.[key];
  if (!Array.isArray(rows)) throw new Error(`${key} must be an array`);
  return rows as T[];
}

export function parseHistoryCsv(csv: string): Record<string, unknown>[] {
  return parse(csv.replace(/^\uFEFF/, ''), {
    bom: true, columns: true, skip_empty_lines: true, relax_quotes: false,
  }) as Record<string, unknown>[];
}

export function normalizeHistory(row: Record<string, unknown>): History {
  const nullableNumber = (v: unknown): number | null => v === '' || v === null || v === undefined ? null : Number(v);
  const nullableString = (v: unknown): string | null => v === '' || v === null || v === undefined ? null : String(v);
  const completed_at = nullableString(row.completed_at);
  return {
    record_id: String(row.record_id ?? ''), employee_id: String(row.employee_id ?? ''),
    event_id: String(row.event_id ?? ''), date: String(row.date ?? ''),
    due_date: nullableString(row.due_date), status: String(row.status ?? ''),
    completion_pct: Number(row.completion_pct), score: nullableNumber(row.score),
    feedback_rating: nullableNumber(row.feedback_rating), assigned_by: String(row.assigned_by ?? ''),
    ...(completed_at ? { completed_at, completion_time_quality: row.completion_time_quality === 'proxy' ? 'proxy' as const : 'exact' as const } : {}),
  };
}

export function loadSourceDataset(sourceDir = join(process.cwd(), 'data/source')): Dataset {
  const json = (name: string): Record<string, unknown> => JSON.parse(readFileSync(join(sourceDir, name), 'utf8')) as Record<string, unknown>;
  const employees = unwrap<Employee>(json('employees.json'), 'employees');
  const events = unwrap<Event>(json('events.json'), 'events');
  const skillsFile = json('skills.json');
  const skills = unwrap<Skill>(skillsFile, 'skills');
  const role_profiles = unwrap<RoleProfile>(skillsFile, 'role_profiles');
  const history = parseHistoryCsv(readFileSync(join(sourceDir, 'activity_history.csv'), 'utf8')).map(normalizeHistory);
  return { employees, events, skills, role_profiles, history };
}

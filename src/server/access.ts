import type { Identity, Role } from "../shared/types.js";
import type { State } from "./store.js";
import { requireThat } from "./errors.js";
export function role(actor: Identity, ...allowed: Role[]) {
  requireThat(
    allowed.includes(actor.role),
    "Недостаточно прав для этого действия",
    403,
    "FORBIDDEN",
  );
}
export function canRead(s: State, a: Identity, id: string) {
  if (a.role === "hr" || a.role === "supervisor") return true;
  if (a.role === "employee") return a.employee_id === id;
  if (a.role === "advisor")
    return (s.advisor_assignments[a.id] || []).includes(id);
  return s.dataset.employees.some(
    (e) => e.employee_id === id && e.manager_id === a.employee_id,
  );
}
export function scope(s: State, a: Identity, id: string) {
  requireThat(
    s.dataset.employees.some((e) => e.employee_id === id),
    "Сотрудник не найден",
    404,
    "NOT_FOUND",
  );
  requireThat(
    canRead(s, a, id),
    "Профиль вне вашей области доступа",
    403,
    "FORBIDDEN",
  );
}
export function own(s: State, a: Identity, id: string) {
  scope(s, a, id);
  requireThat(
    a.role === "employee" && a.employee_id === id,
    "Действие доступно только автору",
    403,
    "FORBIDDEN",
  );
}
export function reviewer(s: State, a: Identity, id: string) {
  role(a, "advisor", "hr");
  scope(s, a, id);
  requireThat(
    a.employee_id !== id,
    "Нельзя подтверждать собственную работу",
    403,
    "SELF_APPROVAL",
  );
}

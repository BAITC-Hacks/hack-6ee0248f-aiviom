import { randomUUID } from "node:crypto";
import type { Gain, Identity, Quest } from "../shared/types.js";
import {
  type State,
  audit,
  creditReward,
  guard,
  profile,
  stamp,
} from "./store.js";
import { requireThat, text } from "./errors.js";
import { own, reviewer, role, scope } from "./access.js";
export function complete(
  s: State,
  actor: Identity,
  workspace: string,
  input: {
    employee_id: string;
    event_id: string;
    session?: string | null;
    evidence: string;
  },
) {
  reviewer(s, actor, input.employee_id);
  text(input.evidence, "Доказательство");
  const event = s.dataset.events.find((e) => e.event_id === input.event_id);
  requireThat(event, "Активность не найдена", 404);
  const key = `event:${input.employee_id}:${event.event_id}:${event.event_id === "EV_036" ? input.session || "" : "once"}`;
  const existing = s.dataset.history.find(
    (h) =>
      h.employee_id === input.employee_id &&
      h.event_id === event.event_id &&
      h.status === "completed" &&
      (event.event_id !== "EV_036" || h.date === input.session),
  );
  if (existing) return { ok: true, duplicate: true, xp: 0 };
  if (event.mandatory)
    requireThat(
      s.dataset.history.some(
        (h) =>
          h.employee_id === input.employee_id &&
          h.event_id === event.event_id &&
          h.status !== "completed",
      ),
      "Нет обязательного назначения на эту активность",
    );
  const before = profile(s, input.employee_id);
  if (!event.mandatory) {
    const candidate = before.candidates.find(
      (c) => c.event.event_id === event.event_id,
    );
    requireThat(
      candidate &&
        !candidate.reasons.some((r) =>
          [
            "audience_blocked",
            "prerequisites_blocked",
            "already_completed",
          ].includes(r),
        ),
      "Активность сейчас недоступна: проверьте аудиторию и prerequisites",
    );
  }
  if (event.format !== "self_paced") {
    requireThat(
      typeof input.session === "string" &&
        event.upcoming_sessions.includes(input.session),
      "Выберите реальную сессию каталога",
    );
    requireThat(
      input.session <= s.as_of,
      "Сессия ещё не состоялась. Для демо явно измените дату workspace.",
    );
  }
  if (!guard(workspace, key)) return { ok: true, duplicate: true, xp: 0 };
  const inProgress = s.dataset.history.find(
    (h) =>
      h.employee_id === input.employee_id &&
      h.event_id === event.event_id &&
      h.status !== "completed" &&
      (event.event_id !== "EV_036" || h.date === input.session),
  );
  if (inProgress) {
    inProgress.status = "completed";
    inProgress.completion_pct = 100;
    inProgress.completed_at = s.as_of;
    inProgress.completion_time_quality = "exact";
  } else
    s.dataset.history.push({
      record_id: "APP_" + randomUUID(),
      employee_id: input.employee_id,
      event_id: event.event_id,
      date: input.session || s.as_of,
      due_date: null,
      status: "completed",
      completion_pct: 100,
      score: null,
      feedback_rating: null,
      assigned_by: "self",
      completed_at: s.as_of,
      completion_time_quality: "exact",
    });
  const after = profile(s, input.employee_id);
  const xp = creditReward(
    s,
    input.employee_id,
    key,
    before.skills,
    after.skills,
  );
  audit(s, actor.id, "completion.confirmed", key, input.evidence);
  return { ok: true, duplicate: false, xp };
}
export function questFor(s: State, actor: Identity, id: string) {
  const q = s.quests.find((q) => q.id === id);
  requireThat(q, "Заявка не найдена", 404);
  scope(s, actor, q.employee_id);
  return q;
}
export function gains(s: State, value: unknown): Gain[] {
  requireThat(
    Array.isArray(value) && value.length > 0 && value.length <= 10,
    "Укажите 1–10 проверяемых навыков",
  );
  const seen = new Set<string>();
  return value.map((g) => {
    requireThat(
      g &&
        typeof g.skill_id === "string" &&
        !seen.has(g.skill_id) &&
        s.dataset.skills.some((x) => x.skill_id === g.skill_id),
      "Некорректный или повторяющийся навык",
    );
    seen.add(g.skill_id);
    requireThat(
      Number.isFinite(g.gain) &&
        g.gain > 0 &&
        g.gain <= 5 &&
        Number.isFinite(g.max_level) &&
        g.max_level >= 0 &&
        g.max_level <= 5,
      "Некорректный gain/cap",
    );
    return { skill_id: g.skill_id, gain: g.gain, max_level: g.max_level };
  });
}
function next(q: Quest) {
  q.status = !q.advisor_approved
    ? "submitted"
    : q.requires_resource && !q.resource_approved
      ? "resource_review"
      : q.requires_policy && !q.policy_approved
        ? "policy_review"
        : "ready";
}
export function reviewQuest(s: State, a: Identity, id: string, body: any) {
  const q = questFor(s, a, id);
  reviewer(s, a, q.employee_id);
  requireThat(
    [
      "submitted",
      "advisor_review",
      "needs_revision",
      "evidence_submitted",
    ].includes(q.status),
    "Заявка не ожидает решения наставника",
  );
  const reason = text(body.reason, "Причина");
  requireThat(
    ["approve", "revise", "reject"].includes(body.action),
    "Неизвестное действие",
  );
  const evidenceRevision =
    q.status === "evidence_submitted" ||
    (q.status === "needs_revision" && q.advisor_approved);
  if (body.action === "approve") {
    requireThat(
      !evidenceRevision,
      "Для результата используйте принятие доказательств",
    );
    q.gains = gains(s, body.gains);
    requireThat(
      q.gains.every((g) => q.skill_ids.includes(g.skill_id)),
      "Зачёт должен соответствовать предложенным навыкам",
    );
    q.criteria = text(body.criteria, "Критерии");
    q.requires_resource =
      typeof body.requires_resource === "boolean"
        ? body.requires_resource
        : q.requires_resource;
    q.requires_policy =
      typeof body.requires_policy === "boolean"
        ? body.requires_policy
        : q.requires_policy;
    q.resource_approved = !q.requires_resource;
    q.policy_approved = !q.requires_policy;
    q.advisor_approved = true;
    next(q);
  } else {
    q.status = body.action === "revise" ? "needs_revision" : "rejected";
    q.advisor_approved = evidenceRevision && body.action === "revise";
  }
  q.version++;
  q.decisions.push({ actor: a.id, action: body.action, reason, at: stamp() });
  audit(s, a.id, "quest.review", id, reason);
  return q;
}
export function resourceQuest(
  s: State,
  a: Identity,
  id: string,
  body: any,
  policy = false,
) {
  const q = questFor(s, a, id);
  role(
    a,
    ...(policy ? (["supervisor"] as const) : (["manager", "hr"] as const)),
  );
  requireThat(
    a.employee_id !== q.employee_id,
    "Нельзя согласовывать собственную работу",
    403,
  );
  requireThat(
    q.advisor_approved && q.status !== "accepted" && q.status !== "rejected",
    "Сначала требуется согласование наставника",
  );
  requireThat(
    policy
      ? q.requires_policy && !q.policy_approved
      : q.requires_resource && !q.resource_approved,
    "Это согласование не требуется",
  );
  const reason = text(body.reason, "Причина");
  requireThat(
    ["approve", "reject"].includes(body.action),
    "Неизвестное действие",
  );
  if (body.action === "reject") q.status = "rejected";
  else {
    if (policy) q.policy_approved = true;
    else q.resource_approved = true;
    next(q);
  }
  q.version++;
  q.decisions.push({
    actor: a.id,
    action: (policy ? "policy." : "resource.") + body.action,
    reason,
    at: stamp(),
  });
  audit(s, a.id, policy ? "quest.policy" : "quest.resource", id, reason);
  return q;
}
export function evidenceQuest(s: State, a: Identity, id: string, body: any) {
  const q = questFor(s, a, id);
  own(s, a, q.employee_id);
  requireThat(
    ["ready", "in_progress", "needs_revision"].includes(q.status) &&
      q.advisor_approved &&
      q.resource_approved &&
      q.policy_approved,
    "Сначала нужны все согласования",
  );
  const evidence = text(body.evidence, "Доказательство", 8000);
  const duplicate = s.quests.find(
    (x) => x.id !== q.id && x.evidence === evidence && x.status === "accepted",
  );
  requireThat(
    !duplicate,
    "Эта работа уже зачтена; запросите отдельное обоснование у наставника",
  );
  q.evidence = evidence;
  q.status = "evidence_submitted";
  q.version++;
  audit(s, a.id, "quest.evidence", id);
  return q;
}
export function acceptQuest(
  s: State,
  a: Identity,
  workspace: string,
  id: string,
  body: any,
) {
  const q = questFor(s, a, id);
  reviewer(s, a, q.employee_id);
  if (q.status === "accepted") return q;
  requireThat(
    q.status === "evidence_submitted" &&
      q.advisor_approved &&
      q.resource_approved &&
      q.policy_approved &&
      q.evidence,
    "Результат не готов к зачёту",
  );
  const reason = text(body.reason, "Основание принятия");
  requireThat(
    !s.quests.some(
      (x) =>
        x.id !== q.id && x.evidence === q.evidence && x.status === "accepted",
    ),
    "Это доказательство уже принято в другой заявке",
  );
  if (!guard(workspace, `quest:${id}`)) return q;
  const before = profile(s, q.employee_id);
  s.credits.push({
    credit_id: "C_" + id,
    employee_id: q.employee_id,
    completed_at: s.as_of,
    gains: q.gains,
    source_id: id,
  });
  q.status = "accepted";
  q.version++;
  q.decisions.push({ actor: a.id, action: "accept", reason, at: stamp() });
  const after = profile(s, q.employee_id);
  creditReward(s, q.employee_id, id, before.skills, after.skills);
  audit(s, a.id, "quest.accept", id, reason);
  return q;
}

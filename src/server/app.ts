import express from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Identity, Quest } from "../shared/types.js";
import {
  buildAnalytics,
  buildRoadmap,
  previewEvent,
  validateImport,
} from "../domain/index.js";
import { recommend } from "../ai/index.js";
import { validDate, audienceAllows } from "../domain/calculation.js";
import { searchExternalOpportunities } from "../ai/external.js";
import { judgeRecommendation } from "./gateway.js";
import {
  db,
  createSession,
  session,
  identity,
  identities,
  readState,
  mutate,
  profile,
  audit,
  guard,
  seed,
  stamp,
  type State,
} from "./store.js";
import { AppError, requireThat, text } from "./errors.js";
import { normalizeLocale } from '../shared/locale.js';
import { errorMessageKey, serverMessage } from '../shared/server-i18n.js';
import { catalogText } from '../shared/catalog-i18n.js';
import { localizeImportResult } from '../shared/import-i18n.js';
import { canRead, own, reviewer, role, scope } from "./access.js";
import {
  acceptQuest,
  complete,
  evidenceQuest,
  questFor,
  resourceQuest,
  reviewQuest,
} from "./workflows.js";
import { reserveAi, settleAi } from "./ai-budget.js";
export const app = express();
app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY === "1" ? 1 : "loopback");
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  if (req.path.startsWith("/api")) res.setHeader("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.headers.origin) {
    try {
      requireThat(
        new URL(req.headers.origin).host === req.headers.host,
        "Запрос с другого сайта отклонён",
        403,
        "ORIGIN",
      );
    } catch (e) {
      return next(e);
    }
  }
  next();
});
app.get("/health", (_req, res) =>
  res.json({
    ok: true,
    service: "career-quest",
    version: process.env.RELEASE_SHA || "development",
  }),
);
const newSessions = new Map<string, { count: number; start: number }>();
app.use("/api", (req, res, next) => {
  try {
    requireThat(
      process.env.DEMO_ENABLED !== "false",
      "Demo workspace отключён",
      503,
      "DEMO_DISABLED",
    );
    let sid = req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("cq_session="))
      ?.slice(11);
    let current = sid ? session(sid) : undefined;
    if (!current) {
      const ip = req.ip || "local";
      let rate = newSessions.get(ip);
      if (!rate || Date.now() - rate.start > 3600000) {
        rate = { count: 0, start: Date.now() };
        newSessions.set(ip, rate);
      }
      requireThat(
        rate.count < 20,
        "Лимит новых demo workspace. Используйте существующую сессию.",
        429,
        "RATE_LIMIT",
      );
      rate.count++;
      sid = createSession();
      current = session(sid)!;
      res.cookie("cq_session", sid, {
        httpOnly: true,
        sameSite: "lax",
        secure: req.secure,
        maxAge: 7 * 86400000,
        path: "/",
      });
    }
    res.locals.session = current;
    next();
  } catch (e) {
    next(e);
  }
});
function context(res: express.Response) {
  const se = res.locals.session as NonNullable<ReturnType<typeof session>>;
  const state = readState(se.workspace_id);
  const actor = identity(state, se.identity_id);
  requireThat(actor, "Демо-пользователь не найден", 401);
  return { se, state, actor };
}
function sessionView(s: State, a: Identity, w: string) {
  return {
    workspace_id: w,
    as_of: s.as_of,
    identity: a,
    identities: identities(s),
    version: s.version,
    ai_available:
      !!process.env.OPENAI_API_KEY ||
      (process.env.AI_MODE !== "offline" &&
        process.env.JUDGE_GATEWAY_URL !== "off"),
  };
}
function route(
  method: "get" | "post" | "put",
  path: string,
  fn: (req: express.Request, res: express.Response) => any,
) {
  app[method](path, (req, res, next) =>
    Promise.resolve()
      .then(() => fn(req, res))
      .then((value) => {
        if (!res.headersSent) res.json(value);
      })
      .catch(next),
  );
}
function change(
  res: express.Response,
  fn: (s: State, a: Identity, w: string) => any,
) {
  const { se } = context(res);
  return mutate(se.workspace_id, (s) => {
    const a = identity(s, se.identity_id)!;
    return fn(s, a, se.workspace_id);
  });
}
const param = (req: express.Request, key = "id") => String(req.params[key]);
const rewards = [
  {
    id: "mentor",
    title: "Сессия с наставником",
    cost: 20,
    description: "Демо-политика: дополнительный разбор 30 минут.",
  },
  {
    id: "project",
    title: "Время на личный проект",
    cost: 80,
    description:
      "Демо-политика: запрос согласованного времени, не обещание банка.",
  },
];
route("get", "/api/session", (_r, res) => {
  const { se, state, actor } = context(res);
  return sessionView(state, actor, se.workspace_id);
});
route("post", "/api/session/switch", (req, res) => {
  const { se, state } = context(res);
  const next = identity(
    state,
    text(req.body.identity_id, "Демо-пользователь", 80),
  );
  requireThat(next, "Неизвестный демонстрационный пользователь", 404);
  db.prepare("UPDATE sessions SET identity_id=? WHERE id=?").run(
    next.id,
    se.id,
  );
  return sessionView(state, next, se.workspace_id);
});
route("post", "/api/demo/reset", (_r, res) => {
  const { se } = context(res);
  db.transaction(() => {
    db.prepare("DELETE FROM credits_guard WHERE workspace_id=?").run(
      se.workspace_id,
    );
    db.prepare("UPDATE workspaces SET state=? WHERE id=?").run(
      JSON.stringify(seed()),
      se.workspace_id,
    );
    db.prepare("UPDATE sessions SET identity_id=? WHERE id=?").run(
      "employee",
      se.id,
    );
  })();
  const state = readState(se.workspace_id);
  return sessionView(state, identity(state, "employee")!, se.workspace_id);
});
route("post", "/api/demo/date", (req, res) =>
  change(res, (s, a, w) => {
    const date = z
      .string()
      .regex(/^2026-\d{2}-\d{2}$/)
      .parse(req.body.as_of);
    requireThat(
      date >= "2026-10-01" && date <= "2026-12-31" && validDate(date),
      "Демо-дата должна быть 01.10–31.12.2026",
    );
    s.as_of = date;
    audit(s, a.id, "demo.date", date);
    return sessionView(s, a, w);
  }),
);
route("get", "/api/catalog", (_r, res) => {
  const { state: s } = context(res);
  return {
    events: s.dataset.events,
    skills: s.dataset.skills,
    role_profiles: s.dataset.role_profiles,
  };
});
route("get", "/api/employees", (_r, res) => {
  const { state: s, actor: a } = context(res);
  return {
    employees: s.dataset.employees.filter((e) => canRead(s, a, e.employee_id)),
  };
});
route("get", "/api/employees/:id/profile", (req, res) => {
  const { state: s, actor: a } = context(res);
  const id = param(req);
  scope(s, a, id);
  const p = profile(s, id),
    plan = s.plans[id];
  const ledger = s.ledger.filter((l) => l.employee_id === id);
  const earned = ledger.reduce((n, l) => n + Math.max(0, l.amount), 0);
  return {
    ...p,
    xp: earned,
    balance: ledger.reduce((n, l) => n + l.amount, 0),
    personal_level: 1 + Math.floor(earned / 100),
    plan_progress:
      plan?.baseline_gap > 0
        ? 100 *
          Math.max(
            0,
            Math.min(1, (plan.baseline_gap - p.total_gap) / plan.baseline_gap),
          )
        : null,
    weekly_budget: plan?.weekly_budget ?? 4,
    plan_items: plan?.items ?? [],
    help_requests: s.help.filter((h) => h.employee_id === id),
  };
});
route("put", "/api/employees/:id/goal", (req, res) =>
  change(res, (s, a) => {
    const id = param(req);
    own(s, a, id);
    const goal =
      req.body.goal === null
        ? null
        : z
            .object({
              target_role: z.string(),
              target_grade: z.enum(["Junior", "Middle", "Senior", "Lead"]),
            })
            .strict()
            .parse(req.body.goal);
    requireThat(
      goal === null ||
        s.dataset.role_profiles.some(
          (p) => p.role === goal.target_role && p.grade === goal.target_grade,
        ),
      "Такой цели нет в каталоге",
    );
    const budget = z
      .number()
      .min(0)
      .max(40)
      .parse(req.body.weekly_budget ?? s.plans[id]?.weekly_budget ?? 4);
    s.plans[id] = {
      goal,
      baseline_gap: 0,
      version: (s.plans[id]?.version ?? 0) + 1,
      weekly_budget: budget,
      items: [],
    };
    s.plans[id].baseline_gap = profile(s, id).total_gap;
    audit(s, a.id, "goal.change", id);
    return profile(s, id);
  }),
);
route("get", "/api/employees/:id/roadmap", (req, res) => {
  const { state: s, actor: a } = context(res);
  const id = param(req);
  scope(s, a, id);
  return buildRoadmap(s.dataset, profile(s, id), s.plans[id]?.weekly_budget, s.quests);
});
route("post", "/api/employees/:id/preview", (req, res) => {
  const { state: s, actor: a } = context(res);
  const id = param(req);
  scope(s, a, id);
  return previewEvent(
    s.dataset,
    profile(s, id),
    text(req.body.event_id, "Активность", 80),
  );
});
route("post", "/api/employees/:id/recommendations", async (req, res) => {
  const locale = normalizeLocale(req.headers['accept-language']);
  const { state: s, actor: a, se } = context(res);
  const id = param(req);
  scope(s, a, id);
  const p = profile(s, id);
  const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
  let reservation: string | undefined;
  const result = process.env.OPENAI_API_KEY && process.env.AI_MODE !== "offline"
    ? await recommend(p, {
        apiKey: process.env.OPENAI_API_KEY,
        model,
        locale,
        workspaceVersion: se.workspace_id + ":" + s.version,
        beforeRequest: () => { reservation = reserveAi(se.workspace_id, model); },
      })
    : await judgeRecommendation(p, se.workspace_id, locale);
  if (reservation) settleAi(reservation, result);
  return result;
});
route("post", "/api/judge/recommend", async (req, res) => {
  const locale = normalizeLocale(req.headers['accept-language']);
  const { se } = context(res);
  requireThat(
    process.env.OPENAI_API_KEY && process.env.AI_MODE !== "offline",
    "Live AI на gateway не настроен",
    503,
    "AI_UNAVAILABLE",
  );
  const base = structuredClone((await import("./store.js")).source());
  const input = z
    .object({
      employee: z.unknown(),
      history: z.array(z.unknown()).max(500),
      goal: z
        .object({
          target_role: z.string(),
          target_grade: z.enum(["Junior", "Middle", "Senior", "Lead"]),
        })
        .nullable(),
      as_of: z.string().regex(/^2026-\d{2}-\d{2}$/),
    })
    .strict()
    .parse(req.body);
  // Treat this isolated input as a new baseline; never persist judge profile or accept client-computed candidates.
  const employeeId = (input.employee as any)?.employee_id;
  requireThat(typeof employeeId === "string", "Нужен профиль сотрудника");
  base.employees = base.employees.filter((e) => e.employee_id !== employeeId);
  base.history = base.history.filter((h) => h.employee_id !== employeeId);
  const validation = validateImport(base, {
    employees: [input.employee],
    history: input.history,
  });
  requireThat(validation.valid, "Некорректный профиль для gateway");
  requireThat(
    validation.history.every((h) => h.employee_id === employeeId),
    "Gateway принимает историю только одного профиля",
  );
  base.employees.push(...validation.employees);
  base.history.push(...validation.history);
  requireThat(
    validDate(input.as_of) && input.as_of >= "2026-10-01" && input.as_of <= "2026-12-31",
    "Некорректная дата анализа",
  );
  const { buildProfile } = await import("../domain/index.js");
  const p = buildProfile(base, employeeId, {
    asOf: input.as_of,
    goal: input.goal,
  });
  const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
  let reservation: string | undefined;
  const result = await recommend(p, {
    apiKey: process.env.OPENAI_API_KEY,
    model,
    locale,
    workspaceVersion: se.workspace_id,
    timeoutMs: 8000,
    beforeRequest: () => { reservation = reserveAi(se.workspace_id, model); },
  });
  if (reservation) settleAi(reservation, result);
  return result;
});
route("post", "/api/external/search", async (req, res) => {
  const { state: s, se } = context(res);
  const input = z
    .object({
      skill_id: z.string(),
      desired_level: z.number().int().min(0).max(5),
      language: z.enum(["ru", "kk", "en"]).optional(),
      format: z.enum(["online", "offline", "self_paced"]).optional(),
    })
    .strict()
    .parse(req.body);
  const skill = s.dataset.skills.find((k) => k.skill_id === input.skill_id);
  requireThat(skill, "Навык не найден");
  const locale = normalizeLocale(req.headers['accept-language'] ?? input.language);
  let reservation: string | undefined;
  if (process.env.OPENAI_API_KEY && process.env.AI_MODE !== "offline")
    reservation = reserveAi(
      se.workspace_id,
      process.env.OPENAI_MODEL || "gpt-5.4-mini",
    );
  const result = await searchExternalOpportunities(
    { ...input, language: locale, skill_name: catalogText(locale, 'skill', skill.skill_id, skill.name) },
    { apiKey: process.env.AI_MODE === "offline" ? undefined : process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL },
  );
  if (reservation) settleAi(reservation, { mode: result.mode });
  return result;
});
route("post", "/api/plan", (req, res) =>
  change(res, (s, a) => {
    const id = text(req.body.employee_id, "Сотрудник", 80);
    own(s, a, id);
    const event = text(req.body.event_id, "Активность", 80);
    const p = profile(s, id);
    requireThat(
      p.candidates.some((c) => c.event.event_id === event && c.eligible),
      "Активность недоступна",
    );
    s.plans[id] ??= {
      goal: p.goal,
      baseline_gap: p.total_gap,
      version: 1,
      weekly_budget: 4,
      items: [],
    };
    if (!s.plans[id].items.includes(event)) s.plans[id].items.push(event);
    audit(s, a.id, "plan.add", event);
    return { ok: true };
  }),
);
route("post", "/api/completions", (req, res) =>
  change(res, (s, a, w) => complete(s, a, w, req.body)),
);
route("post", "/api/completion-requests", (req, res) =>
  change(res, (s, a) => {
    const id = text(req.body.employee_id, "Сотрудник", 80);
    own(s, a, id);
    const event = text(req.body.event_id, "Активность", 80);
    requireThat(
      s.dataset.events.some((e) => e.event_id === event),
      "Активность не найдена",
    );
    const evidence = text(req.body.evidence, "Доказательство");
    if (
      !s.completion_requests.some(
        (r) =>
          r.employee_id === id &&
          r.event_id === event &&
          r.session === (req.body.session || null) &&
          r.status === "pending",
      )
    )
      s.completion_requests.push({
        id: randomUUID(),
        employee_id: id,
        event_id: event,
        session: req.body.session || null,
        evidence,
        status: "pending",
        created_at: stamp(),
      });
    audit(s, a.id, "completion.request", event);
    return { ok: true };
  }),
);
route("get", "/api/completion-requests", (_req, res) => {
  const { state: s, actor: a } = context(res);
  return {
    requests: s.completion_requests.filter((r) => canRead(s, a, r.employee_id)),
  };
});
route("post", "/api/completion-requests/:id/accept", (req, res) =>
  change(res, (s, a, w) => {
    const r = s.completion_requests.find((r) => r.id === param(req));
    requireThat(r, "Запрос не найден", 404);
    const reason = text(req.body.reason, "Основание");
    const result = complete(s, a, w, r);
    r.status = "accepted";
    audit(s, a.id, "completion.request.accept", r.id, reason);
    return result;
  }),
);
route("get", "/api/side-quests", (_r, res) => {
  const { state: s, actor: a } = context(res);
  return { quests: s.quests.filter((q) => canRead(s, a, q.employee_id)) };
});
route("post", "/api/side-quests", (req, res) =>
  change(res, (s, a) => {
    role(a, "employee");
    const b = req.body;
    const title = text(b.title, "Название", 180),
      description = text(b.description, "Описание"),
      deliverables = text(b.deliverables, "Результат");
    const skillIds = z.array(z.string()).min(1).max(10).parse(b.skill_ids);
    requireThat(
      skillIds.every((id) => s.dataset.skills.some((k) => k.skill_id === id)),
      "Неизвестный навык",
    );
    let url: string | null = null;
    if (b.source_url) {
      url = z.string().url().max(2000).parse(b.source_url);
      requireThat(/^https?:\/\//.test(url), "Разрешены только HTTP(S) ссылки");
    }
    const q: Quest = {
      id: "Q_" + randomUUID(),
      employee_id: a.employee_id!,
      title,
      description,
      deliverables,
      estimated_hours:
        b.estimated_hours == null
          ? null
          : z.number().min(0).max(1000).parse(b.estimated_hours),
      source_url: url,
      skill_ids: skillIds,
      gains: [],
      criteria: "",
      status: "submitted",
      requires_resource: !!b.requires_resource,
      requires_policy: !!b.requires_policy,
      resource_approved: !b.requires_resource,
      policy_approved: !b.requires_policy,
      advisor_approved: false,
      evidence: "",
      decisions: [],
      created_at: stamp(),
      version: 1,
    };
    s.quests.push(q);
    audit(s, a.id, "quest.submit", q.id);
    return q;
  }),
);
route("post", "/api/side-quests/:id/resubmit", (req, res) =>
  change(res, (s, a) => {
    const q = questFor(s, a, param(req));
    own(s, a, q.employee_id);
    requireThat(
      q.status === "needs_revision" && !q.advisor_approved,
      "Предложение не ожидает доработки",
    );
    q.title = text(req.body.title, "Название", 180);
    q.description = text(req.body.description, "Описание");
    q.deliverables = text(req.body.deliverables, "Результат");
    q.status = "submitted";
    q.version++;
    audit(s, a.id, "quest.resubmit", q.id);
    return q;
  }),
);
route("post", "/api/side-quests/:id/review", (req, res) =>
  change(res, (s, a) => reviewQuest(s, a, param(req), req.body)),
);
route("post", "/api/side-quests/:id/resource", (req, res) =>
  change(res, (s, a) => resourceQuest(s, a, param(req), req.body)),
);
route("post", "/api/side-quests/:id/policy", (req, res) =>
  change(res, (s, a) => resourceQuest(s, a, param(req), req.body, true)),
);
route("post", "/api/side-quests/:id/evidence", (req, res) =>
  change(res, (s, a) => evidenceQuest(s, a, param(req), req.body)),
);
route("post", "/api/side-quests/:id/accept", (req, res) =>
  change(res, (s, a, w) => acceptQuest(s, a, w, param(req), req.body)),
);
route("post", "/api/help", (req, res) =>
  change(res, (s, a) => {
    const id = text(req.body.employee_id, "Сотрудник", 80);
    own(s, a, id);
    s.help.push({
      id: randomUUID(),
      employee_id: id,
      event_id: req.body.event_id || null,
      reason: text(req.body.reason, "Что мешает"),
      status: "open",
    });
    audit(s, a.id, "help.request", id);
    return { ok: true };
  }),
);
route("get", "/api/help", (_r, res) => {
  const { state: s, actor: a } = context(res);
  return { requests: s.help.filter((h) => canRead(s, a, h.employee_id)) };
});
route("post", "/api/help/:id/resolve", (req, res) =>
  change(res, (s, a) => {
    role(a, "manager", "advisor", "hr");
    const h = s.help.find((h) => h.id === param(req));
    requireThat(h, "Запрос не найден", 404);
    scope(s, a, h.employee_id);
    h.resolution = text(req.body.reason, "Решение");
    h.status = "resolved";
    audit(s, a.id, "help.resolve", h.id, h.resolution);
    return { ok: true };
  }),
);
route("post", "/api/assignments", (req, res) =>
  change(res, (s, a) => {
    role(a, "manager", "hr");
    const id = text(req.body.employee_id, "Сотрудник", 80);
    scope(s, a, id);
    const event = s.dataset.events.find(
      (e) => e.event_id === req.body.event_id,
    );
    requireThat(event, "Активность не найдена");
    const due = z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .parse(req.body.due_date);
    requireThat(
      validDate(due) && due >= s.as_of,
      "Укажите действительную дату дедлайна не раньше даты демо",
    );
    const employee = s.dataset.employees.find((e) => e.employee_id === id)!;
    requireThat(
      audienceAllows(event, employee),
      "Активность не подходит текущей роли/грейду",
    );
    requireThat(
      event.event_id === "EV_036" ||
        !s.dataset.history.some(
          (h) =>
            h.employee_id === id &&
            h.event_id === event.event_id &&
            h.status === "completed",
        ),
      "Активность уже завершена",
    );
    requireThat(
      !s.dataset.history.some(
        (h) =>
          h.employee_id === id &&
          h.event_id === event.event_id &&
          h.status !== "completed",
      ),
      "Уже есть незавершённое назначение",
    );
    s.dataset.history.push({
      record_id: "ASSIGN_" + randomUUID(),
      employee_id: id,
      event_id: event.event_id,
      date: s.as_of,
      due_date: due,
      status: "in_progress",
      completion_pct: 0,
      score: null,
      feedback_rating: null,
      assigned_by: a.role === "hr" ? "hr" : "manager",
    });
    audit(s, a.id, "assignment.create", id);
    return { ok: true };
  }),
);
route("get", "/api/hr/analytics", (_r, res) => {
  const { state: s, actor: a } = context(res);
  role(a, "hr", "manager", "supervisor");
  const employees = s.dataset.employees.filter((e) =>
    canRead(s, a, e.employee_id),
  );
  const ids = new Set(employees.map((e) => e.employee_id));
  const dataset = {
    ...s.dataset,
    employees,
    history: s.dataset.history.filter((h) => ids.has(h.employee_id)),
  };
  return buildAnalytics(
    dataset,
    employees.map((e) => profile(s, e.employee_id)),
    s.as_of,
  );
});
route("post", "/api/import/preview", (req, res) => {
  const { state: s, actor: a } = context(res);
  role(a, "hr");
  return localizeImportResult(validateImport(s.dataset, req.body), normalizeLocale(req.headers['accept-language']));
});
route("post", "/api/import/commit", (req, res) =>
  change(res, (s, a) => {
    role(a, "hr");
    const result = validateImport(s.dataset, req.body);
    requireThat(
      result.valid,
      "Импорт содержит ошибки. Сначала исправьте preview.",
    );
    s.dataset.employees.push(
      ...result.employees.filter(
        (e) =>
          !s.dataset.employees.some((old) => old.employee_id === e.employee_id),
      ),
    );
    s.dataset.history.push(
      ...result.history.filter(
        (h) => !s.dataset.history.some((old) => old.record_id === h.record_id),
      ),
    );
    for (const e of result.employees) {
      const p = profile(s, e.employee_id);
      s.lifetime_max[e.employee_id] ??= { ...p.skills };
      s.plans[e.employee_id] ??= {
        goal: p.goal,
        baseline_gap: p.total_gap,
        version: 1,
        weekly_budget: 4,
        items: [],
      };
      if (!s.advisor_assignments.advisor.includes(e.employee_id))
        s.advisor_assignments.advisor.push(e.employee_id);
    }
    // Imported history is a baseline, never a source of retroactive reward XP.
    for (const id of new Set(result.history.map(h => h.employee_id))) {
      const current = profile(s, id).skills;
      const maximum = s.lifetime_max[id] ??= {};
      for (const [skill, level] of Object.entries(current))
        maximum[skill] = Math.max(maximum[skill] ?? 0, level);
    }
    audit(s, a.id, "import.commit", "batch", JSON.stringify(result.counts));
    const localized = localizeImportResult(result, normalizeLocale(req.headers['accept-language']));
    return { ok: true, counts: result.counts, warnings: localized.warnings };
  }),
);
route("get", "/api/rewards", (_r, res) => {
  const { state: s, actor: a } = context(res);
  const ledger = s.ledger.filter((l) => l.employee_id === a.employee_id);
  return {
    balance: ledger.reduce((n, l) => n + l.amount, 0),
    earned: ledger.reduce((n, l) => n + Math.max(0, l.amount), 0),
    items: rewards,
    ledger,
  };
});
route("post", "/api/rewards/:id/redeem", (req, res) =>
  change(res, (s, a, w) => {
    role(a, "employee");
    const item = rewards.find((r) => r.id === param(req));
    requireThat(item, "Награда не найдена", 404);
    const key = text(req.body.idempotency_key, "Ключ операции", 100);
    const source = `redeem:${a.employee_id}:${key}`;
    const existing = s.ledger.find((l) => l.source === source);
    if (existing) {
      requireThat(
        existing.reward_id === item.id,
        "Ключ операции уже использован для другой награды",
        409,
        "IDEMPOTENCY_CONFLICT",
      );
      return { ok: true };
    }
    const balance = s.ledger
      .filter((l) => l.employee_id === a.employee_id)
      .reduce((n, l) => n + l.amount, 0);
    requireThat(balance >= item.cost, "Недостаточно баллов", 409, "BALANCE");
    requireThat(guard(w, source), "Операция уже обработана", 409);
    s.ledger.push({
      id: randomUUID(),
      employee_id: a.employee_id!,
      amount: -item.cost,
      source,
      reward_id: item.id,
      created_at: stamp(),
    });
    audit(s, a.id, "reward.redeem", item.id);
    return { ok: true };
  }),
);
route("get", "/api/audit", (_r, res) => {
  const { state: s, actor: a } = context(res);
  role(a, "hr", "supervisor");
  return { events: s.audit.slice(-200).reverse() };
});
app.use("/api", (req, res) =>
  res.status(404).json({
    code: "NOT_FOUND",
    user_message: serverMessage(normalizeLocale(req.headers['accept-language']), 'error.not_found'),
    message_key: 'error.not_found',
    retryable: false,
    request_id: randomUUID(),
  }),
);
export function errorHandler(
  err: any,
  req: express.Request,
  res: express.Response,
  _next: express.NextFunction,
) {
  const known = err instanceof AppError;
  const validation =
    err instanceof z.ZodError || err.type === "entity.parse.failed";
  const status = known
    ? err.status
    : validation
      ? 400
      : err.type === "entity.too.large"
        ? 413
        : 500;
  const locale = normalizeLocale(req.headers['accept-language']);
  const code = known ? err.code : validation ? 'VALIDATION' : status === 413 ? 'TOO_LARGE' : 'INTERNAL';
  const message_key = validation ? 'error.validation' : status === 413 ? 'error.too_large' : status === 500 ? 'error.internal' : err.message_key ?? errorMessageKey(code, status, err.message);
  const params = known && err.params ? err.params : undefined;
  res.status(status).json({
    code,
    user_message: serverMessage(locale, message_key, params),
    message_key,
    ...(params ? { params } : {}),
    retryable: status >= 500,
    request_id: randomUUID(),
  });
  if (status === 500)
    console.error(
      "request_failed",
      err?.name || "Error",
      err?.code || "unknown",
    );
}

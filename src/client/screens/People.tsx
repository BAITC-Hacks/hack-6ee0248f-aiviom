import React, { useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import type { Session } from "../api";
import { endpoint } from "../api";
import { useI18n } from "../i18n";
import {
  Dialog,
  Empty,
  Panel,
  Status,
  Submit,
  formatNum,
  type Action,
  useLoad,
} from "../ui";

function recordId(record: Record<string, unknown>): string {
  return String(record.id ?? record.request_id ?? record.event_id ?? "");
}
function stringValue(value: unknown): string {
  return value == null ? "" : String(value);
}

export function People({
  session,
  revision,
  action,
  onSwitch,
}: {
  session: Session;
  revision: number;
  action: Action;
  onSwitch: (id: string) => Promise<void>;
}) {
  const { locale, t, catalogText, enumText } = useI18n();
  const employeesLoad = useLoad(endpoint.employees, [
    revision,
    session.identity.id,
  ]);
  const catalogLoad = useLoad(endpoint.catalog, []);
  const helpLoad = useLoad(endpoint.helpRequests, [
    revision,
    session.identity.id,
  ]);
  const completionsLoad = useLoad(endpoint.completionRequests, [
    revision,
    session.identity.id,
  ]);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(30);
  const [activitySearch, setActivitySearch] = useState("");
  const [eventId, setEventId] = useState("");
  const [due, setDue] = useState("");
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState<{
    kind: "help" | "completion";
    id: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const employees = employeesLoad.data?.employees ?? [];
  const active =
    employees.find((item) => item.employee_id === selected) ?? employees[0];
  const profileLoad = useLoad(
    () =>
      active ? endpoint.profile(active.employee_id) : Promise.resolve(null),
    [active?.employee_id, revision],
  );
  const filtered = employees.filter((item) =>
    `${item.full_name} ${item.department} ${item.role}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  const visible = filtered.slice(0, visibleCount);
  const events = (catalogLoad.data?.events ?? []).filter((item) =>
    `${item.title} ${catalogText(item.event_id, "title", item.title)}`
      .toLocaleLowerCase()
      .includes(activitySearch.toLocaleLowerCase()),
  );
  const num = (value: number | null | undefined) => formatNum(locale, value);
  async function assign(event: React.FormEvent) {
    event.preventDefault();
    if (!active || !eventId || busy) return;
    setBusy(true);
    const result = await action(
      () => endpoint.assignment(active.employee_id, eventId, due),
      t("people.assigned"),
    );
    if (result) {
      setEventId("");
      setDue("");
      setActivitySearch("");
    }
    setBusy(false);
  }
  async function submitDecision(event: React.FormEvent) {
    event.preventDefault();
    if (!decision || !reason.trim() || busy) return;
    setBusy(true);
    const result = await action(
      () =>
        decision.kind === "help"
          ? endpoint.resolveHelp(decision.id, reason.trim())
          : endpoint.acceptCompletion(decision.id, reason.trim()),
      decision.kind === "help"
        ? t("people.helpResolved")
        : t("people.completionAccepted"),
    );
    if (result) {
      setDecision(null);
      setReason("");
    }
    setBusy(false);
  }
  return (
    <>
      <Status
        loading={employeesLoad.busy}
        error={employeesLoad.error}
        retry={employeesLoad.refresh}
      />
      <div className="content-grid">
        <div className="main-stack">
          <Panel
            title={
              session.identity.role === "manager"
                ? t("people.myTeam")
                : session.identity.role === "advisor"
                  ? t("people.mentees")
                  : t("people.employees")
            }
            aside={
              <span className="muted">
                {t("people.availableCount", { count: num(employees.length) })}
              </span>
            }
          >
            <label className="search-box">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">{t("people.search")}</span>
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setVisibleCount(30);
                }}
                placeholder={t("people.searchPlaceholder")}
              />
            </label>
            {filtered.length ? (
              <>
                <div className="people-list">
                  {visible.map((item) => (
                    <button
                      key={item.employee_id}
                      className={`person-row ${active?.employee_id === item.employee_id ? "selected" : ""}`}
                      onClick={() => setSelected(item.employee_id)}
                      aria-current={
                        active?.employee_id === item.employee_id
                          ? "true"
                          : undefined
                      }
                    >
                      <span className="avatar small-avatar" aria-hidden="true">
                        {item.full_name
                          .split(" ")
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join("")}
                      </span>
                      <span>
                        <strong>{item.full_name}</strong>
                        <small>
                          {catalogText(item.role, "title", item.role)} ·{" "}
                          {enumText("grade", item.grade)} ·{" "}
                          {catalogText(
                            item.department,
                            "title",
                            item.department,
                          )}
                        </small>
                      </span>
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  ))}
                </div>
                {filtered.length > visibleCount && (
                  <button
                    className="button secondary more-people"
                    onClick={() => setVisibleCount((value) => value + 30)}
                  >
                    {t("people.showMore", {
                      count: num(filtered.length - visibleCount),
                    })}
                  </button>
                )}
              </>
            ) : (
              <Empty
                title={t("people.notFound")}
                detail={t("people.tryAnother")}
              />
            )}
          </Panel>
          {session.identity.role === "manager" && (
            <Panel title={t("people.helpQueue")}>
              <Status
                loading={helpLoad.busy}
                error={helpLoad.error}
                retry={helpLoad.refresh}
              />
              {helpLoad.data?.requests.length ? (
                <div className="list">
                  {helpLoad.data.requests.map((record, index) => (
                    <div className="row-item" key={recordId(record) || index}>
                      <div>
                        <strong>
                          {t(`help.${stringValue(record.reason)}`)}
                        </strong>
                        <p>
                          {stringValue(record.employee_id)} ·{" "}
                          {enumText("status", stringValue(record.status))}
                        </p>
                      </div>
                      {record.status !== "resolved" && (
                        <button
                          className="button secondary small"
                          onClick={() =>
                            setDecision({ kind: "help", id: recordId(record) })
                          }
                        >
                          {t("people.resolve")}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <Empty title={t("people.noHelp")} />
              )}
            </Panel>
          )}
          {session.identity.role === "advisor" && (
            <Panel title={t("people.completionQueue")}>
              <Status
                loading={completionsLoad.busy}
                error={completionsLoad.error}
                retry={completionsLoad.refresh}
              />
              {completionsLoad.data?.requests.length ? (
                <div className="list">
                  {completionsLoad.data.requests.map((record, index) => (
                    <div className="row-item" key={recordId(record) || index}>
                      <div>
                        <strong>
                          {catalogText(
                            stringValue(record.event_id),
                            "title",
                            catalogLoad.data?.events.find(
                              (item) => item.event_id === record.event_id,
                            )?.title ?? stringValue(record.event_id),
                          )}
                        </strong>
                        <p>
                          {stringValue(record.employee_id)} ·{" "}
                          {stringValue(record.evidence)}
                        </p>
                      </div>
                      <button
                        className="button primary small"
                        onClick={() =>
                          setDecision({
                            kind: "completion",
                            id: recordId(record),
                          })
                        }
                      >
                        {t("people.confirm")}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty title={t("people.noCompletions")} />
              )}
            </Panel>
          )}
        </div>
        <div className="side-stack">
          {active && (
            <Panel title={t("people.profile")}>
              <Status
                loading={profileLoad.busy}
                error={profileLoad.error}
                retry={profileLoad.refresh}
              />
              {profileLoad.data && (
                <div className="person-detail">
                  <h3>{active.full_name}</h3>
                  <p>
                    {catalogText(active.department, "title", active.department)}{" "}
                    · {catalogText(active.role, "title", active.role)} ·{" "}
                    {enumText("grade", active.grade)}
                  </p>
                  <div className="metric-line">
                    <span>{t("people.goal")}</span>
                    <strong>
                      {profileLoad.data.goal
                        ? `${catalogText(profileLoad.data.goal.target_role, "title", profileLoad.data.goal.target_role)} · ${enumText("grade", profileLoad.data.goal.target_grade)}`
                        : t("path.noGoal")}
                    </strong>
                  </div>
                  <div className="metric-line">
                    <span>{t("path.coverage")}</span>
                    <strong>
                      {profileLoad.data.coverage == null
                        ? "—"
                        : `${num(profileLoad.data.coverage)}%`}
                    </strong>
                  </div>
                  <div className="metric-line">
                    <span>{t("path.weeklyBudget")}</span>
                    <strong>
                      {t("common.hours", {
                        count: num(profileLoad.data.weekly_budget),
                      })}
                    </strong>
                  </div>
                  <h4>{t("people.needsDevelopment")}</h4>
                  {profileLoad.data.gaps.some((gap) => gap.gap > 0) ? (
                    <ul className="simple-list">
                      {profileLoad.data.gaps
                        .filter((gap) => gap.gap > 0)
                        .slice(0, 6)
                        .map((gap) => (
                          <li key={gap.skill_id}>
                            {catalogText(gap.skill_id, "title", gap.name)}:{" "}
                            {num(gap.current)} → {num(gap.required)}
                            {gap.critical ? ` · ${t("path.criticalTag")}` : ""}
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="muted">{t("people.noGaps")}</p>
                  )}
                  {session.identity.role === "hr" && (
                    <button
                      className="button secondary small"
                      onClick={() => onSwitch(`employee:${active.employee_id}`)}
                    >
                      {t("people.openDemoProfile")}
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
            </Panel>
          )}
          {(session.identity.role === "manager" ||
            session.identity.role === "hr") &&
            active && (
              <Panel title={t("people.assignActivity")}>
                <form className="form-stack" onSubmit={assign}>
                  <label>
                    {t("people.activitySearch")}
                    <input
                      type="search"
                      value={activitySearch}
                      onChange={(event) =>
                        setActivitySearch(event.target.value)
                      }
                      placeholder={t("catalog.searchPlaceholder")}
                    />
                  </label>
                  <label>
                    {t("common.activity")}
                    <select
                      value={eventId}
                      onChange={(event) => setEventId(event.target.value)}
                      required
                    >
                      <option value="">{t("common.select")}</option>
                      {events.map((item) => (
                        <option key={item.event_id} value={item.event_id}>
                          {catalogText(item.event_id, "title", item.title)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("common.dueDate")}
                    <input
                      type="date"
                      value={due}
                      onChange={(event) => setDue(event.target.value)}
                      required
                    />
                  </label>
                  <Submit busy={busy}>{t("people.assign")}</Submit>
                </form>
              </Panel>
            )}
        </div>
      </div>
      {decision && (
        <Dialog
          title={
            decision.kind === "help" ? t("people.resolve") : t("people.confirm")
          }
          onClose={() => {
            setDecision(null);
            setReason("");
          }}
        >
          <form className="form-stack" onSubmit={submitDecision}>
            <label>
              {t("people.decisionReason")}
              <textarea
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
                autoFocus
              />
            </label>
            <div className="dialog-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setDecision(null);
                  setReason("");
                }}
              >
                {t("common.cancel")}
              </button>
              <Submit busy={busy}>
                {decision.kind === "help"
                  ? t("people.resolve")
                  : t("people.confirm")}
              </Submit>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}

import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import type { ConfirmedResult, Session } from "../api";
import { endpoint } from "../api";
import { useI18n } from "../i18n";
import { Select } from "../Select";
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
  inspectionEmployeeId,
}: {
  session: Session;
  revision: number;
  action: Action;
  onSwitch: (id: string) => Promise<void>;
  inspectionEmployeeId?: string | null;
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
  const [historyStatus, setHistoryStatus] = useState("all");
  const [lastConfirmation, setLastConfirmation] =
    useState<ConfirmedResult | null>(null);
  const appliedInspection = useRef<string | null>(null);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(30);
  const [eventId, setEventId] = useState("");
  const [due, setDue] = useState("");
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState<{
    kind: "help" | "completion";
    id: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const employees = employeesLoad.data?.employees ?? [];
  useEffect(() => {
    if (
      !inspectionEmployeeId ||
      appliedInspection.current === inspectionEmployeeId
    )
      return;
    setSelected(inspectionEmployeeId);
    const inspected = employees.find(
      (item) => item.employee_id === inspectionEmployeeId,
    );
    if (inspected) {
      setSearch(inspected.full_name);
      appliedInspection.current = inspectionEmployeeId;
    }
  }, [inspectionEmployeeId, employeesLoad.data]);
  const active =
    employees.find((item) => item.employee_id === selected) ?? employees[0];
  const profileLoad = useLoad(
    () =>
      active ? endpoint.profile(active.employee_id) : Promise.resolve(null),
    [active?.employee_id, revision],
  );
  const roadmapLoad = useLoad(
    () =>
      active ? endpoint.roadmap(active.employee_id) : Promise.resolve(null),
    [active?.employee_id, revision],
  );
  const filtered = employees.filter((item) =>
    `${item.full_name} ${item.department} ${item.role}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  const visible = filtered.slice(0, visibleCount);
  const events = catalogLoad.data?.events ?? [];
  const num = (value: number | null | undefined) => formatNum(locale, value);
  const targetProfile = catalogLoad.data?.role_profiles.find(
    (item) =>
      item.role === profileLoad.data?.goal?.target_role &&
      item.grade === profileLoad.data?.goal?.target_grade,
  );
  const skillPriority = (skillId: string) => {
    const current = profileLoad.data?.skills[skillId];
    const required = targetProfile?.required_skills[skillId];
    if (current != null && required != null && current < required)
      return targetProfile?.critical_skills.includes(skillId) ? 0 : 1;
    if (required != null) return 2;
    return current != null ? 3 : 4;
  };
  const allSkillIds = [
    ...new Set([
      ...(catalogLoad.data?.skills.map((skill) => skill.skill_id) ?? []),
      ...Object.keys(profileLoad.data?.skills ?? {}),
      ...Object.keys(targetProfile?.required_skills ?? {}),
    ]),
  ].sort(
    (left, right) =>
      skillPriority(left) - skillPriority(right) ||
      catalogText(left, "title", left).localeCompare(
        catalogText(right, "title", right),
        locale,
      ),
  );
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
      if (
        decision.kind === "completion" &&
        typeof result === "object" &&
        "result" in result &&
        result.result
      ) {
        setLastConfirmation(result.result as ConfirmedResult);
      }
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
      {lastConfirmation && (
        <section className="panel confirmed-result" aria-live="polite">
          <div className="panel-head">
            <h2>{t("path.confirmedResult")}</h2>
          </div>
          <p className="muted">
            {employees.find(
              (item) => item.employee_id === lastConfirmation.employee_id,
            )?.full_name ?? lastConfirmation.employee_id}
          </p>
          <div className="confirmed-result-grid">
            <div>
              <strong>{t("path.actualSkills")}</strong>
              {lastConfirmation.skills.map((skill) => (
                <p key={skill.skill_id}>
                  {catalogText(skill.skill_id, "title", skill.skill_id)}:{" "}
                  {num(skill.before)} → {num(skill.after)}
                </p>
              ))}
            </div>
            <div>
              <strong>{t("path.coverage")}</strong>
              <p>
                {lastConfirmation.coverage_before == null
                  ? "—"
                  : `${num(lastConfirmation.coverage_before)}%`}{" "}
                →{" "}
                {lastConfirmation.coverage_after == null
                  ? "—"
                  : `${num(lastConfirmation.coverage_after)}%`}
              </p>
            </div>
            <div>
              <strong>{t("path.roadmap")}</strong>
              <p>
                {lastConfirmation.next_event_id_before
                  ? catalogText(
                      lastConfirmation.next_event_id_before,
                      "title",
                      lastConfirmation.next_event_id_before,
                    )
                  : "—"}{" "}
                →{" "}
                {lastConfirmation.next_event_id_after
                  ? catalogText(
                      lastConfirmation.next_event_id_after,
                      "title",
                      lastConfirmation.next_event_id_after,
                    )
                  : "—"}
              </p>
            </div>
            <div>
              <strong>XP</strong>
              <p>+{num(lastConfirmation.xp_delta)}</p>
            </div>
          </div>
        </section>
      )}
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
                          {[
                            "time",
                            "format",
                            "value",
                            "familiar",
                            "other",
                          ].includes(stringValue(record.reason))
                            ? t(`help.${stringValue(record.reason)}`)
                            : catalogText(
                                "DEMO_HELP",
                                "reason",
                                stringValue(record.reason),
                              )}
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
                  <h4>{t("path.allSkills")}</h4>
                  <p className="muted skill-matrix-note">
                    {t("path.unassessedSkills")}
                  </p>
                  <div
                    className="skill-matrix-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label={t("path.allSkills")}
                  >
                    <div
                      className="skill-matrix"
                      role="table"
                      aria-label={t("path.allSkills")}
                    >
                      <div className="skill-matrix-head" role="row">
                        <span role="columnheader">{t("common.skill")}</span>
                        <span role="columnheader">
                          {t("path.currentLevel")}
                        </span>
                        <span role="columnheader">{t("path.required")}</span>
                      </div>
                      {allSkillIds.map((skillId) => {
                        const current = profileLoad.data?.skills[skillId];
                        const required =
                          targetProfile?.required_skills[skillId];
                        return (
                          <div
                            className="skill-matrix-row"
                            role="row"
                            key={skillId}
                          >
                            <span role="cell">
                              {catalogText(
                                skillId,
                                "title",
                                catalogLoad.data?.skills.find(
                                  (skill) => skill.skill_id === skillId,
                                )?.name ?? skillId,
                              )}{" "}
                              {targetProfile?.critical_skills.includes(
                                skillId,
                              ) && (
                                <span className="inline-critical">
                                  {t("path.criticalTag")}
                                </span>
                              )}
                            </span>
                            <strong role="cell">
                              {current == null ? "—" : num(current)}
                            </strong>
                            <span role="cell">
                              {required == null ? (
                                "—"
                              ) : (
                                <>
                                  {num(required)}
                                  {current != null && required > current && (
                                    <small>
                                      {t("path.gapAmount", {
                                        count: num(required - current),
                                      })}
                                    </small>
                                  )}
                                </>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <h4>{t("path.roadmap")}</h4>
                  <Status
                    loading={roadmapLoad.busy}
                    error={roadmapLoad.error}
                    retry={roadmapLoad.refresh}
                  />
                  {roadmapLoad.data && (
                    <div className="people-route">
                      {roadmapLoad.data.steps
                        .filter((step) => step.status !== "blocked")
                        .map((step, index) => (
                          <div
                            key={`${step.event_id}-${index}`}
                            className="people-route-step"
                          >
                            <strong>
                              {catalogText(
                                step.event_id,
                                "title",
                                events.find(
                                  (event) => event.event_id === step.event_id,
                                )?.title ?? step.event_id,
                              )}
                            </strong>
                            <small>
                              {enumText("status", step.status)} ·{" "}
                              {t("common.hours", {
                                count: num(
                                  events.find(
                                    (event) => event.event_id === step.event_id,
                                  )?.duration_hours,
                                ),
                              })}
                              {step.session ? ` · ${step.session}` : ""}
                            </small>
                          </div>
                        ))}
                      {!roadmapLoad.data.steps.some(
                        (step) => step.status !== "blocked",
                      ) && (
                        <p className="muted">
                          {profileLoad.data?.no_next_reason
                            ? t(`reason.${profileLoad.data.no_next_reason}`)
                            : t("path.noRouteSteps")}
                        </p>
                      )}
                    </div>
                  )}
                  <h4>{t("path.history")}</h4>
                  <label className="history-filter">
                    {t("path.filterHistory")}
                    <Select
                      label={t("path.filterHistory")}
                      value={historyStatus}
                      onChange={setHistoryStatus}
                      options={[
                        { value: "all", label: t("path.allStatuses") },
                        ...[
                          ...new Set(
                            profileLoad.data.history.map(
                              (record) => record.status,
                            ),
                          ),
                        ].map((status) => ({
                          value: status,
                          label: enumText("status", status),
                        })),
                      ]}
                    />
                  </label>
                  <div className="history-list" tabIndex={0}>
                    {profileLoad.data.history
                      .filter(
                        (record) =>
                          historyStatus === "all" ||
                          record.status === historyStatus,
                      )
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((record) => (
                        <div className="metric-line" key={record.record_id}>
                          <span>
                            {catalogText(
                              record.event_id,
                              "title",
                              events.find(
                                (event) => event.event_id === record.event_id,
                              )?.title ?? record.event_id,
                            )}
                            <small>
                              {record.date} ·{" "}
                              {enumText("status", record.status)}
                            </small>
                          </span>
                        </div>
                      ))}
                    {!profileLoad.data.history.length && (
                      <p className="muted">{t("path.noHistory")}</p>
                    )}
                    {!!profileLoad.data.history.length &&
                      !profileLoad.data.history.some(
                        (record) =>
                          historyStatus === "all" ||
                          record.status === historyStatus,
                      ) && (
                        <p className="muted">{t("path.noFilteredHistory")}</p>
                      )}
                  </div>
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
                    {t("common.activity")}
                    <Select
                      label={t("common.activity")}
                      value={eventId}
                      onChange={setEventId}
                      required
                      searchable
                      placeholder={t("common.select")}
                      options={events.map((item) => ({
                        value: item.event_id,
                        label: catalogText(item.event_id, "title", item.title),
                      }))}
                    />
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
                  <Submit busy={busy} disabled={!eventId}>
                    {t("people.assign")}
                  </Submit>
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

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleHelp,
  Clock3,
  Sparkles,
  X,
} from "lucide-react";
import type { Catalog, ExtendedProfile, Session } from "../api";
import { endpoint } from "../api";
import type {
  Preview,
  Recommendation,
  RecommendationResult,
} from "../../shared/types";
import { useI18n } from "../i18n";
import { Select } from "../Select";
import {
  Empty,
  Notice,
  Panel,
  Status,
  Submit,
  Tag,
  formatDate,
  formatNum,
  type Action,
  useLoad,
} from "../ui";

const gradeOrder = ["Junior", "Middle", "Senior", "Lead"];
type RichRecommendation = Recommendation & {
  summary?: string;
  facts?: { id: string; factor: string; label: string; value: string }[];
};

function ProgressMetric({
  label,
  value,
  detail,
  projected = false,
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
  projected?: boolean;
}) {
  return (
    <div className={`progress-metric ${projected ? "projected" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

export function EmployeePath({
  session,
  revision,
  action,
}: {
  session: Session;
  revision: number;
  action: Action;
}) {
  const { locale, t, catalogText, enumText } = useI18n();
  const id = session.identity.employee_id;
  const profileLoad = useLoad(
    () =>
      id
        ? endpoint.profile(id)
        : Promise.reject(new Error(t("path.profileMissing"))),
    [id, revision],
  );
  const roadmapLoad = useLoad(
    () =>
      id
        ? endpoint.roadmap(id)
        : Promise.reject(new Error(t("path.profileMissing"))),
    [id, revision],
  );
  const catalogLoad = useLoad(endpoint.catalog, []);
  const [recs, setRecs] = useState<RecommendationResult | null>(null);
  const [recBusy, setRecBusy] = useState(false);
  const [recError, setRecError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [evidence, setEvidence] = useState("");
  const [helpReason, setHelpReason] = useState("");
  const [showAllMilestones, setShowAllMilestones] = useState(false);
  const [goalRole, setGoalRole] = useState("");
  const [goalGrade, setGoalGrade] = useState("");
  const [budget, setBudget] = useState(4);
  const [saving, setSaving] = useState(false);
  const recSequence = useRef(0);
  const previewSequence = useRef(0);
  const profile = profileLoad.data;
  const catalog = catalogLoad.data;
  const roadmap = roadmapLoad.data;
  useEffect(() => {
    if (!profile) return;
    setGoalRole(profile.goal?.target_role ?? profile.employee.role);
    setGoalGrade(
      profile.goal?.target_grade ??
        gradeOrder[Math.min(gradeOrder.indexOf(profile.employee.grade) + 1, 3)],
    );
    setBudget(profile.weekly_budget ?? 4);
  }, [
    profile?.employee.employee_id,
    profile?.goal?.target_role,
    profile?.goal?.target_grade,
    profile?.weekly_budget,
  ]);
  useEffect(() => {
    recSequence.current += 1;
    previewSequence.current += 1;
    setRecs(null);
    setRecError("");
    setRecBusy(false);
    setPreview(null);
    setPreviewBusy(false);
  }, [id, revision, locale]);
  const byId = useMemo(
    () =>
      new Map((catalog?.events ?? []).map((event) => [event.event_id, event])),
    [catalog],
  );
  const selectedEvent = selected ? byId.get(selected) : null;
  const selectedCandidate = selected
    ? profile?.candidates.find(
        (candidate) => candidate.event.event_id === selected,
      )
    : null;
  const eventName = (eventId: string) => {
    const event = byId.get(eventId);
    return event ? catalogText(event.event_id, "title", event.title) : eventId;
  };
  const skillName = (skillId: string, fallback?: string) => {
    const skill = catalog?.skills.find((item) => item.skill_id === skillId);
    return catalogText(skillId, "title", fallback ?? skill?.name ?? skillId);
  };
  const fmt = (value: number | null | undefined) => formatNum(locale, value);
  const date = (value?: string | null) => formatDate(locale, value);

  async function loadRecs() {
    if (!id || recBusy) return;
    const sequence = ++recSequence.current;
    setRecBusy(true);
    setRecError("");
    try {
      const result = await endpoint.recommendations(id);
      if (sequence === recSequence.current) setRecs(result);
    } catch (cause) {
      if (sequence === recSequence.current)
        setRecError(
          cause instanceof Error
            ? cause.message
            : t("path.recommendationsUnavailable"),
        );
    } finally {
      if (sequence === recSequence.current) setRecBusy(false);
    }
  }
  async function showPreview(eventId: string) {
    if (!id) return;
    const sequence = ++previewSequence.current;
    setSelected(eventId);
    setPreview(null);
    setPreviewBusy(true);
    try {
      const result = await endpoint.preview(id, eventId);
      if (sequence === previewSequence.current) setPreview(result);
    } catch (cause) {
      if (sequence === previewSequence.current)
        await action(() => Promise.reject(cause), "", false);
    } finally {
      if (sequence === previewSequence.current) setPreviewBusy(false);
    }
  }
  async function saveGoal(event: React.FormEvent) {
    event.preventDefault();
    if (!id) return;
    setSaving(true);
    await action(
      () =>
        endpoint.goal(
          id,
          { target_role: goalRole, target_grade: goalGrade },
          budget,
        ),
      t("path.goalSaved"),
    );
    setSaving(false);
  }
  async function requestCompletion(event: React.FormEvent) {
    event.preventDefault();
    if (!id || !selected || !evidence.trim()) return;
    setSaving(true);
    const result = await action(
      () =>
        endpoint.completionRequest(
          id,
          selected,
          evidence.trim(),
          selectedCandidate?.session ?? undefined,
        ),
      t("path.evidenceSent"),
    );
    if (result) setEvidence("");
    setSaving(false);
  }
  async function requestHelp(event: React.FormEvent) {
    event.preventDefault();
    if (!id || !helpReason) return;
    setSaving(true);
    const result = await action(
      () => endpoint.help(id, helpReason, selected ?? undefined),
      t("path.helpSent"),
    );
    if (result) setHelpReason("");
    setSaving(false);
  }
  return (
    <>
      <Status
        loading={profileLoad.busy}
        error={profileLoad.error}
        retry={profileLoad.refresh}
      />
      {profile && (
        <>
          <section className="profile-hero" aria-label={t("path.profile")}>
            <div className="profile-identity">
              <span className="avatar" aria-hidden="true">
                {profile.employee.full_name
                  .split(" ")
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")}
              </span>
              <div>
                <h2>{profile.employee.full_name}</h2>
                <p>
                  {catalogText(
                    profile.employee.role,
                    "title",
                    profile.employee.role,
                  )}{" "}
                  · {enumText("grade", profile.employee.grade)} ·{" "}
                  {catalogText(
                    profile.employee.department,
                    "title",
                    profile.employee.department,
                  )}
                </p>
                <small>
                  {t("path.goalLabel")}:{" "}
                  {profile.goal
                    ? `${catalogText(profile.goal.target_role, "title", profile.goal.target_role)} · ${enumText("grade", profile.goal.target_grade)}`
                    : t("path.noGoal")}
                </small>
              </div>
            </div>
            <div className="profile-numbers">
              <ProgressMetric
                label={t("path.coverage")}
                value={
                  profile.coverage == null ? "—" : `${fmt(profile.coverage)}%`
                }
                detail={t("path.coverageExplain")}
              />
              <ProgressMetric
                label={t("path.critical")}
                value={`${fmt(profile.critical_met)} / ${fmt(profile.critical_total)}`}
                detail={t("path.criticalExplain")}
              />
              <ProgressMetric
                label={t("path.planProgress")}
                value={
                  profile.plan_progress == null
                    ? "—"
                    : `${fmt(profile.plan_progress)}%`
                }
                detail={t("path.planExplain")}
              />
            </div>
          </section>
          <div className="content-grid">
            <div className="main-stack">
              <Panel
                title={t("path.mandatory")}
                aside={<Tag tone="amber">{fmt(profile.mandatory.length)}</Tag>}
              >
                {profile.mandatory.length ? (
                  <div className="list">
                    {profile.mandatory.map((record) => (
                      <div className="row-item" key={record.record_id}>
                        <div>
                          <strong>{eventName(record.event_id)}</strong>
                          <p>
                            {enumText("status", record.status)}
                            {record.due_date
                              ? ` · ${t("common.due", { date: date(record.due_date) })}`
                              : ""}
                          </p>
                          <small>{t("path.mandatoryExplain")}</small>
                        </div>
                        <div className="inline-actions">
                          <button
                            className="button secondary small"
                            onClick={() => {
                              setSelected(record.event_id);
                              document
                                .getElementById("help-form")
                                ?.scrollIntoView({ block: "center" });
                            }}
                          >
                            {t("path.needHelp")}
                          </button>
                          {record.status !== "completed" && (
                            <button
                              className="button primary small"
                              onClick={() => showPreview(record.event_id)}
                            >
                              {t("path.submitResult")}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title={t("path.noMandatory")}
                    detail={t("path.noMandatoryExplain")}
                  />
                )}
              </Panel>
              <Panel
                title={t("path.recommendations")}
                aside={
                  <button
                    className="button secondary small"
                    disabled={recBusy}
                    onClick={loadRecs}
                  >
                    <Sparkles size={17} aria-hidden="true" />
                    {recs ? t("path.refreshRecs") : t("path.getRecs")}
                  </button>
                }
              >
                {recBusy && (
                  <div
                    className="skeleton-stack"
                    role="status"
                    aria-label={t("common.loading")}
                  >
                    <div />
                    <div />
                  </div>
                )}
                {recError && (
                  <Notice tone="error">
                    {recError}{" "}
                    <button className="text-button" onClick={loadRecs}>
                      {t("common.retry")}
                    </button>
                  </Notice>
                )}
                {!recs && !recBusy && !recError && (
                  <Empty
                    title={t("path.recsNotRequested")}
                    detail={t("path.recsNotRequestedExplain")}
                  />
                )}
                {recs && (
                  <>
                    <Notice
                      tone={
                        recs.mode === "live_ai" ||
                        recs.mode === "cached_live_ai"
                          ? "success"
                          : "warning"
                      }
                    >
                      {t(`recommendation.mode.${recs.mode}`)}
                    </Notice>
                    {recs.warnings.length > 0 && (
                      <details className="evidence-details">
                        <summary>{t("path.calculationNotes")}</summary>
                        <ul>
                          {recs.warnings.map((warning, index) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {recs.recommendations.length ? (
                      <div className="recommendations">
                        {recs.recommendations.slice(0, 3).map((item, index) => {
                          const recommendation = item as RichRecommendation;
                          const candidate = profile.candidates.find(
                            (value) => value.event.event_id === item.event_id,
                          );
                          const event =
                            candidate?.event ?? byId.get(item.event_id);
                          return (
                            <article
                              className="recommendation"
                              key={item.event_id}
                            >
                              <span
                                className="recommendation-index"
                                aria-hidden="true"
                              >
                                {index + 1}
                              </span>
                              <div className="recommendation-body">
                                <div className="recommendation-title">
                                  <h3>{eventName(item.event_id)}</h3>
                                  <Tag>
                                    {event
                                      ? t("common.hours", {
                                          count: fmt(event.duration_hours),
                                        })
                                      : "—"}
                                  </Tag>
                                </div>
                                <p>{recommendation.summary || item.reason}</p>
                                <details className="evidence-details">
                                  <summary>{t("path.verifiedReasons")}</summary>
                                  {recommendation.facts?.length ? (
                                    <dl className="fact-list">
                                      {recommendation.facts.map((fact) => (
                                        <React.Fragment key={fact.id}>
                                          <dt>{fact.label}</dt>
                                          <dd>{fact.value}</dd>
                                        </React.Fragment>
                                      ))}
                                    </dl>
                                  ) : (
                                    <ul>
                                      {item.factor_keys.map((factor) => (
                                        <li key={factor}>
                                          {t(`recommendation.factor.${factor}`)}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </details>
                                {item.alternative_event_id && (
                                  <div className="alternative">
                                    <strong>
                                      {t("path.alternative")}:{" "}
                                      {eventName(item.alternative_event_id)}
                                    </strong>
                                    <p>{item.alternative_reason}</p>
                                  </div>
                                )}
                                <div className="inline-actions">
                                  <button
                                    className="button secondary small"
                                    onClick={() => showPreview(item.event_id)}
                                  >
                                    {t("path.preview")}
                                  </button>
                                  <button
                                    className="button primary small"
                                    onClick={() =>
                                      id &&
                                      action(
                                        () => endpoint.plan(id, item.event_id),
                                        t("path.addedToPlan"),
                                      )
                                    }
                                  >
                                    {t("path.addToPlan")}
                                    <ArrowRight size={16} aria-hidden="true" />
                                  </button>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <Empty
                        title={t("path.noRecs")}
                        detail={
                          profile.no_next_reason
                            ? t(`reason.${profile.no_next_reason}`)
                            : t("path.checkGoal")
                        }
                      />
                    )}
                  </>
                )}
              </Panel>
              <Panel
                className="roadmap-panel"
                title={t("path.roadmap")}
                aside={
                  roadmap?.search_limited && (
                    <Tag tone="amber">{t("path.limitedSearch")}</Tag>
                  )
                }
              >
                <Status
                  loading={roadmapLoad.busy}
                  error={roadmapLoad.error}
                  retry={roadmapLoad.refresh}
                />
                {roadmap && (
                  <>
                    {roadmap.milestones.length ? (
                      <div className="milestone-list">
                        {(showAllMilestones
                          ? roadmap.milestones
                          : [
                              ...roadmap.milestones.filter(
                                (m) => m.status !== "met",
                              ),
                              ...roadmap.milestones.filter(
                                (m) => m.status === "met",
                              ),
                            ].slice(0, 5)
                        ).map((milestone, index) => (
                          <div className="milestone" key={milestone.skill_id}>
                            <span
                              className={`milestone-node ${milestone.status === "met" ? "done" : ""}`}
                            >
                              {milestone.status === "met" ? (
                                <Check size={16} aria-hidden="true" />
                              ) : (
                                index + 1
                              )}
                            </span>
                            <div>
                              <strong>
                                {skillName(milestone.skill_id, milestone.name)}
                              </strong>
                              <p>
                                {t("path.levelProgress", {
                                  current: fmt(milestone.current),
                                  required: fmt(milestone.required),
                                })}{" "}
                                {milestone.critical && (
                                  <Tag tone="amber">
                                    {t("path.criticalTag")}
                                  </Tag>
                                )}
                              </p>
                              <small>
                                {milestone.status === "met"
                                  ? t("path.confirmed")
                                  : milestone.event_ids.length
                                    ? `${t("path.possibleActivities")}: ${milestone.event_ids.map(eventName).join(", ")}`
                                    : t("path.noStep")}
                              </small>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty
                        title={
                          profile.no_next_reason === "goal_skills_met"
                            ? t("path.goalSkillsMet")
                            : t("path.noMilestones")
                        }
                        detail={t("path.roadmapRecalculates")}
                      />
                    )}
                    {roadmap.milestones.length > 5 && (
                      <button
                        className="text-button milestone-toggle"
                        onClick={() => setShowAllMilestones((value) => !value)}
                      >
                        {showAllMilestones
                          ? t("common.collapse")
                          : t("path.showAll", {
                              count: fmt(roadmap.milestones.length),
                            })}
                      </button>
                    )}
                    {roadmap.alternatives?.length ? (
                      <div className="alternative-list">
                        <h3>{t("path.practicalAlternatives")}</h3>
                        {roadmap.alternatives.map((quest) => (
                          <div className="row-item" key={quest.quest_id}>
                            <div>
                              <strong>
                                {catalogText(
                                  quest.quest_id,
                                  "title",
                                  quest.title,
                                )}
                              </strong>
                              <p>
                                {enumText("status", quest.status)} ·{" "}
                                {t("path.afterAcceptance")}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="roadmap-meta">
                      <span>
                        {t("path.routeHours", {
                          count: fmt(roadmap.plan_hours),
                        })}
                      </span>
                      <span>
                        {t("path.remainingGaps", {
                          count: fmt(roadmap.remaining_gaps.length),
                        })}
                      </span>
                    </div>
                    {roadmap.search_limited && (
                      <Notice tone="warning">{t("path.limitedExplain")}</Notice>
                    )}
                  </>
                )}
              </Panel>
            </div>
            <div className="side-stack">
              <Panel title={t("path.goalAndTime")}>
                <form className="form-stack" onSubmit={saveGoal}>
                  <label>
                    {t("path.targetRole")}
                    <Select
                      label={t("path.targetRole")}
                      value={goalRole}
                      onChange={setGoalRole}
                      required
                      options={[
                        ...new Set(
                          catalog?.role_profiles.map((item) => item.role) ?? [
                            profile.employee.role,
                          ],
                        ),
                      ].map((role) => ({
                        value: role,
                        label: catalogText(role, "title", role),
                      }))}
                    />
                  </label>
                  <label>
                    {t("path.targetGrade")}
                    <Select
                      label={t("path.targetGrade")}
                      value={goalGrade}
                      onChange={setGoalGrade}
                      options={gradeOrder.map((grade) => ({
                        value: grade,
                        label: enumText("grade", grade),
                      }))}
                    />
                  </label>
                  <label>
                    {t("path.weeklyHours")}
                    <input
                      type="number"
                      min="1"
                      max="40"
                      value={budget}
                      onChange={(event) =>
                        setBudget(Number(event.target.value))
                      }
                      required
                    />
                  </label>
                  <Submit busy={saving} disabled={!goalRole || !goalGrade}>
                    {t("path.saveGoal")}
                  </Submit>
                </form>
                <p className="fine-print">{t("path.noPromotionGuarantee")}</p>
              </Panel>
              <Panel title={t("path.myPlan")}>
                <div className="metric-line">
                  <span>{t("path.weeklyBudget")}</span>
                  <strong>
                    {t("common.hours", { count: fmt(profile.weekly_budget) })}
                  </strong>
                </div>
                <div className="metric-line">
                  <span>{t("path.plannedSteps")}</span>
                  <strong>{fmt(profile.plan_items.length)}</strong>
                </div>
                {profile.plan_items.length ? (
                  <ul className="simple-list">
                    {profile.plan_items.map((eventId) => (
                      <li key={eventId}>{eventName(eventId)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">{t("path.emptyPlan")}</p>
                )}
                <div className="metric-line">
                  <span>{t("path.personalLevel")}</span>
                  <strong>{fmt(profile.personal_level)}</strong>
                </div>
                <div className="metric-line">
                  <span>{t("path.balance")}</span>
                  <strong>{fmt(profile.balance)} XP</strong>
                </div>
              </Panel>
              <Panel title={t("path.needHelp")}>
                <form
                  id="help-form"
                  className="form-stack"
                  onSubmit={requestHelp}
                >
                  <label>
                    {t("path.reason")}
                    <Select
                      label={t("path.reason")}
                      value={helpReason}
                      onChange={setHelpReason}
                      required
                      placeholder={t("common.choose")}
                      options={[
                        "time",
                        "format",
                        "value",
                        "familiar",
                        "other",
                      ].map((key) => ({ value: key, label: t(`help.${key}`) }))}
                    />
                  </label>
                  <Submit busy={saving} disabled={!helpReason}>
                    {t("path.sendHelp")}
                  </Submit>
                </form>
                <p className="fine-print">{t("path.helpExplain")}</p>
              </Panel>
              <details className="panel collapsible-panel">
                <summary>{t("path.history")}</summary>
                <p className="muted">{t("path.historyExplain")}</p>
                {profile.history.length ? (
                  <div className="history-list">
                    {[...profile.history]
                      .reverse()
                      .slice(0, 8)
                      .map((record) => (
                        <div className="metric-line" key={record.record_id}>
                          <span>
                            {eventName(record.event_id)}
                            <small>
                              {date(record.date)} ·{" "}
                              {enumText("status", record.status)}
                            </small>
                          </span>
                          <strong>
                            {record.score == null ? "—" : fmt(record.score)}
                          </strong>
                        </div>
                      ))}
                  </div>
                ) : (
                  <Empty title={t("path.noHistory")} />
                )}
              </details>
            </div>
          </div>
          {selectedEvent && (
            <section
              id="activity-detail"
              className="detail-drawer"
              aria-label={t("path.activityDetail")}
            >
              <div className="drawer-head">
                <div>
                  <h2>
                    {catalogText(
                      selectedEvent.event_id,
                      "title",
                      selectedEvent.title,
                    )}
                  </h2>
                  <span className="preview-label">
                    {t("path.previewNoCredit")}
                  </span>
                </div>
                <button
                  className="icon-button"
                  aria-label={t("common.close")}
                  onClick={() => {
                    previewSequence.current++;
                    setSelected(null);
                    setPreview(null);
                  }}
                >
                  <X size={20} />
                </button>
              </div>
              <p>
                {catalogText(
                  selectedEvent.event_id,
                  "description",
                  selectedEvent.description,
                )}
              </p>
              <div className="detail-facts">
                <span>{enumText("format", selectedEvent.format)}</span>
                <span>
                  {t("common.hours", {
                    count: fmt(selectedEvent.duration_hours),
                  })}
                </span>
                <span>
                  {selectedCandidate?.session
                    ? date(selectedCandidate.session)
                    : t("path.sessionUnknown")}
                </span>
              </div>
              {selectedCandidate?.reasons.length ? (
                <Notice tone="warning">
                  {selectedCandidate.reasons
                    .map((reason) => enumText("reason", reason))
                    .join(" · ")}
                </Notice>
              ) : null}
              {previewBusy ? (
                <div
                  className="skeleton-stack"
                  role="status"
                  aria-label={t("common.loading")}
                >
                  <div />
                  <div />
                </div>
              ) : preview ? (
                <div className="preview-grid">
                  <div>
                    <h3>{t("path.skillPreview")}</h3>
                    {Object.entries(preview.deltas).length ? (
                      Object.entries(preview.deltas).map(([skill, delta]) => (
                        <div className="metric-line" key={skill}>
                          <span>{skillName(skill)}</span>
                          <strong>
                            {fmt(preview.before[skill])} →{" "}
                            {fmt(preview.after[skill])} <em>+{fmt(delta)}</em>
                          </strong>
                        </div>
                      ))
                    ) : (
                      <p className="muted">{t("path.noDirectGain")}</p>
                    )}
                  </div>
                  <div>
                    <h3>{t("path.routePreview")}</h3>
                    <div className="metric-line">
                      <span>{t("path.coverage")}</span>
                      <strong>
                        {fmt(preview.coverage_before)}% →{" "}
                        {fmt(preview.coverage_after)}%
                      </strong>
                    </div>
                    <p>
                      {preview.unlocked_event_ids.length
                        ? t("path.unlocked", {
                            names: preview.unlocked_event_ids
                              .map(eventName)
                              .join(", "),
                          })
                        : t("path.noUnlocked")}
                    </p>
                  </div>
                </div>
              ) : null}
              <form
                className="form-stack completion-form"
                onSubmit={requestCompletion}
              >
                <label>
                  {t("path.evidence")}
                  <textarea
                    value={evidence}
                    onChange={(event) => setEvidence(event.target.value)}
                    rows={3}
                    required
                  />
                </label>
                <Submit busy={saving}>{t("path.sendEvidence")}</Submit>
                <small>{t("path.creditAfterApproval")}</small>
              </form>
            </section>
          )}
        </>
      )}
    </>
  );
}

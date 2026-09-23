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
type RoadmapStep = {
  event_id: string;
  session: string | null;
  status: string;
  reason: string;
  title?: string;
  hours?: number;
  skill_changes?: {
    skill_id: string;
    name: string;
    before: number;
    after: number;
    required: number | null;
    gap_before: number | null;
    gap_after: number | null;
  }[];
  unlocks_event_ids?: string[];
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
  const [historyStatus, setHistoryStatus] = useState("all");
  const [recommendationsStale, setRecommendationsStale] = useState(false);
  const [pendingEventId, setPendingEventId] = useState<string | null>(null);
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
    setRecommendationsStale(Boolean(recs) || recommendationsStale);
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
  const nextStep = (before: string | null, after: string | null) =>
    before === after
      ? before
        ? t("path.nextStepUnchanged", { name: eventName(before) })
        : t("path.noStep")
      : `${before ? eventName(before) : "—"} → ${after ? eventName(after) : t("path.noStep")}`;
  const skillName = (skillId: string, fallback?: string) => {
    const skill = catalog?.skills.find((item) => item.skill_id === skillId);
    return catalogText(skillId, "title", fallback ?? skill?.name ?? skillId);
  };
  const fmt = (value: number | null | undefined) => formatNum(locale, value);
  const date = (value?: string | null) => formatDate(locale, value);
  const targetProfile = catalog?.role_profiles.find(
    (item) =>
      item.role === profile?.goal?.target_role &&
      item.grade === profile?.goal?.target_grade,
  );
  const skillPriority = (skillId: string) => {
    const current = profile?.skills[skillId] ?? 0;
    const required = targetProfile?.required_skills[skillId];
    if (required != null && current < required)
      return targetProfile?.critical_skills.includes(skillId) ? 0 : 1;
    if (required != null) return 2;
    return profile?.skills[skillId] != null ? 3 : 4;
  };
  const allSkillIds = [
    ...new Set([
      ...(catalog?.skills.map((skill) => skill.skill_id) ?? []),
      ...Object.keys(profile?.skills ?? {}),
      ...Object.keys(targetProfile?.required_skills ?? {}),
    ]),
  ].sort(
    (left, right) =>
      skillPriority(left) - skillPriority(right) ||
      skillName(left).localeCompare(skillName(right), locale),
  );
  const filteredHistory = [...(profile?.history ?? [])]
    .filter(
      (record) => historyStatus === "all" || record.status === historyStatus,
    )
    .sort(
      (left, right) =>
        right.date.localeCompare(left.date) ||
        right.record_id.localeCompare(left.record_id),
    );
  const confirmedResult = profile?.completion_results?.at(-1);
  const roadmapSteps = (roadmap?.steps ?? []) as RoadmapStep[];
  const plannedSteps = roadmapSteps.filter((step) => step.status !== "blocked");
  const blockedSteps = roadmapSteps.filter((step) => step.status === "blocked");

  async function loadRecs() {
    if (!id || recBusy) return;
    const sequence = ++recSequence.current;
    setRecBusy(true);
    setRecError("");
    try {
      const result = await endpoint.recommendations(id);
      if (sequence === recSequence.current) {
        setRecs(result);
        setRecommendationsStale(false);
      }
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
    if (result) {
      setEvidence("");
      setPendingEventId(selected);
    }
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
          {confirmedResult && (
            <Panel
              title={t("path.confirmedResult")}
              className="confirmed-result"
            >
              <p className="muted">
                {confirmedResult.event_id
                  ? eventName(confirmedResult.event_id)
                  : t("path.practicalAlternatives")}{" "}
                · {date(confirmedResult.confirmed_at)}
              </p>
              <div className="confirmed-result-grid">
                <div>
                  <strong>{t("path.actualSkills")}</strong>
                  {confirmedResult.skills.length ? (
                    confirmedResult.skills.map((skill) => (
                      <p key={skill.skill_id}>
                        {skillName(skill.skill_id)}: {fmt(skill.before)} →{" "}
                        {fmt(skill.after)}
                      </p>
                    ))
                  ) : (
                    <p>{t("path.noDirectGain")}</p>
                  )}
                </div>
                <div>
                  <strong>{t("path.coverage")}</strong>
                  <p>
                    {confirmedResult.coverage_before == null
                      ? "—"
                      : `${fmt(confirmedResult.coverage_before)}%`}{" "}
                    →{" "}
                    {confirmedResult.coverage_after == null
                      ? "—"
                      : `${fmt(confirmedResult.coverage_after)}%`}
                  </p>
                </div>
                <div>
                  <strong>{t("path.roadmap")}</strong>
                  <p>
                    {nextStep(
                      confirmedResult.next_event_id_before,
                      confirmedResult.next_event_id_after,
                    )}
                  </p>
                  {!!confirmedResult.unlocked_event_ids.length && (
                    <small>
                      {t("path.unlocked", {
                        names: confirmedResult.unlocked_event_ids
                          .map(eventName)
                          .join(", "),
                      })}
                    </small>
                  )}
                </div>
                <div>
                  <strong>XP</strong>
                  <p>+{fmt(confirmedResult.xp_delta)}</p>
                </div>
              </div>
            </Panel>
          )}
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
                {!recs &&
                  !recBusy &&
                  !recError &&
                  (recommendationsStale ? (
                    <Notice tone="warning">{t("path.recsNeedRefresh")}</Notice>
                  ) : (
                    <Empty
                      title={t("path.recsNotRequested")}
                      detail={t("path.recsNotRequestedExplain")}
                    />
                  ))}
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
                                {recommendation.facts?.length ? (
                                  <dl className="recommendation-facts">
                                    {[
                                      "grade",
                                      "skill_gap",
                                      "history",
                                      "target_requirements",
                                    ].map((factor) => {
                                      const fact = recommendation.facts?.find(
                                        (entry) => entry.factor === factor,
                                      );
                                      return fact ? (
                                        <div key={factor}>
                                          <dt>{fact.label}</dt>
                                          <dd>{fact.value}</dd>
                                        </div>
                                      ) : null;
                                    })}
                                  </dl>
                                ) : null}
                                <details className="evidence-details">
                                  <summary>{t("path.verifiedReasons")}</summary>
                                  <p>{item.reason}</p>
                                  {!recommendation.facts?.length && (
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
                    <div className="route-sequence">
                      <div className="route-origin">
                        <strong>{t("path.currentProfile")}</strong>
                        <span>
                          {catalogText(
                            profile.employee.role,
                            "title",
                            profile.employee.role,
                          )}{" "}
                          · {enumText("grade", profile.employee.grade)}
                        </span>
                      </div>
                      {plannedSteps.length ? (
                        plannedSteps.map((step, index) => {
                          const event = byId.get(step.event_id);
                          const changedSkillIds = (
                            step.skill_changes ?? []
                          ).map((change) => change.skill_id);
                          const linkedQuests =
                            roadmap.alternatives?.filter((quest) =>
                              quest.skill_ids.some((skill) =>
                                changedSkillIds.includes(skill),
                              ),
                            ) ?? [];
                          return (
                            <div
                              className="route-step"
                              key={`${step.event_id}-${index}`}
                            >
                              <span
                                className="route-connector"
                                aria-hidden="true"
                              >
                                <ArrowRight size={16} />
                              </span>
                              <div className="route-step-head">
                                <strong>
                                  {step.title
                                    ? catalogText(
                                        step.event_id,
                                        "title",
                                        step.title,
                                      )
                                    : eventName(step.event_id)}
                                </strong>
                                <Tag
                                  tone={
                                    step.status === "in_progress"
                                      ? "amber"
                                      : "neutral"
                                  }
                                >
                                  {enumText("status", step.status)}
                                </Tag>
                              </div>
                              <p className="route-step-meta">
                                {t("common.hours", {
                                  count: fmt(
                                    step.hours ?? event?.duration_hours,
                                  ),
                                })}
                                {step.session ? ` · ${date(step.session)}` : ""}
                              </p>
                              {(step.skill_changes ?? []).length ? (
                                <ul className="route-effects">
                                  {step.skill_changes?.map((change) => (
                                    <li key={change.skill_id}>
                                      {skillName(change.skill_id, change.name)}:{" "}
                                      {fmt(change.before)} → {fmt(change.after)}
                                      {change.required != null
                                        ? ` · ${t("path.requiredLevel", { level: fmt(change.required) })}`
                                        : ""}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="muted">
                                  {t("path.routePrerequisite")}
                                </p>
                              )}
                              {!!step.unlocks_event_ids?.length && (
                                <p className="route-unlocks">
                                  {t("path.unlocked", {
                                    names: step.unlocks_event_ids
                                      .map(eventName)
                                      .join(", "),
                                  })}
                                </p>
                              )}
                              {!!linkedQuests.length && (
                                <div className="route-alternatives">
                                  <small>{t("path.questAlternative")}</small>
                                  {linkedQuests.map((quest) => (
                                    <p key={quest.quest_id}>
                                      {catalogText(
                                        quest.quest_id,
                                        "title",
                                        quest.title,
                                      )}{" "}
                                      · {enumText("status", quest.status)} ·{" "}
                                      {t("path.afterAcceptance")}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <p className="muted">
                          {t(
                            profile.total_gap === 0
                              ? "path.goalSkillsMet"
                              : "path.noRouteSteps",
                          )}
                        </p>
                      )}
                      <div className="route-destination">
                        <span className="route-connector" aria-hidden="true">
                          <ArrowRight size={16} />
                        </span>
                        <strong>{t("path.targetRequirement")}</strong>
                        <span>
                          {profile.goal
                            ? `${catalogText(profile.goal.target_role, "title", profile.goal.target_role)} · ${enumText("grade", profile.goal.target_grade)}`
                            : t("path.noGoal")}
                        </span>
                      </div>
                    </div>
                    {!!blockedSteps.length && (
                      <details className="route-blocked">
                        <summary>
                          {t("path.blockedSteps", {
                            count: fmt(blockedSteps.length),
                          })}
                        </summary>
                        {blockedSteps.map((step) => (
                          <div
                            className="route-blocked-row"
                            key={step.event_id}
                          >
                            <strong>{eventName(step.event_id)}</strong>
                            <span>
                              {step.reason
                                .split(", ")
                                .map((reason) => t(`reason.${reason}`))
                                .join(" · ")}
                            </span>
                          </div>
                        ))}
                      </details>
                    )}
                    <h3 className="route-milestones-heading">
                      {t("path.skillMilestones")}
                    </h3>
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
                    {roadmap.alternatives?.filter(
                      (quest) =>
                        !plannedSteps.some((step) =>
                          step.skill_changes?.some((change) =>
                            quest.skill_ids.includes(change.skill_id),
                          ),
                        ),
                    ).length ? (
                      <div className="alternative-list">
                        <h3>{t("path.practicalAlternatives")}</h3>
                        {roadmap.alternatives
                          .filter(
                            (quest) =>
                              !plannedSteps.some((step) =>
                                step.skill_changes?.some((change) =>
                                  quest.skill_ids.includes(change.skill_id),
                                ),
                              ),
                          )
                          .map((quest) => (
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
                                  {quest.skill_ids
                                    .map((skill) => skillName(skill))
                                    .join(", ")}{" "}
                                  · {enumText("status", quest.status)} ·{" "}
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
              <Panel
                title={t("path.allSkills")}
                aside={<Tag>{fmt(allSkillIds.length)}</Tag>}
              >
                <p className="muted skill-matrix-note">
                  {t("path.missingSkillZero")}
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
                      <span role="columnheader">{t("path.currentLevel")}</span>
                      <span role="columnheader">{t("path.required")}</span>
                    </div>
                    {allSkillIds.map((skillId) => {
                      const current = profile.skills[skillId] ?? 0;
                      const required = targetProfile?.required_skills[skillId];
                      const critical =
                        targetProfile?.critical_skills.includes(skillId);
                      return (
                        <div
                          className="skill-matrix-row"
                          role="row"
                          key={skillId}
                        >
                          <span role="cell">
                            {skillName(skillId)}{" "}
                            {critical && (
                              <Tag tone="amber">{t("path.criticalTag")}</Tag>
                            )}
                          </span>
                          <strong role="cell">{fmt(current)}</strong>
                          <span role="cell">
                            {required == null ? (
                              "—"
                            ) : (
                              <>
                                {fmt(required)}
                                {required > current && (
                                  <small>
                                    {" "}
                                    {t("path.gapAmount", {
                                      count: fmt(required - current),
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
              </Panel>
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
              <Panel
                title={t("path.history")}
                aside={<Tag>{fmt(profile.history.length)}</Tag>}
              >
                <p className="muted">{t("path.historyExplain")}</p>
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
                          profile.history.map((record) => record.status),
                        ),
                      ].map((status) => ({
                        value: status,
                        label: enumText("status", status),
                      })),
                    ]}
                  />
                </label>
                {profile.history.length ? (
                  filteredHistory.length ? (
                    <div className="history-list" tabIndex={0}>
                      {filteredHistory.map((record) => (
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
                    <Empty title={t("path.noFilteredHistory")} />
                  )
                ) : (
                  <Empty title={t("path.noHistory")} />
                )}
              </Panel>
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
                {(pendingEventId === selected ||
                  profile.completion_requests?.some(
                    (request) =>
                      request.event_id === selected &&
                      request.status === "pending",
                  )) && (
                  <Notice tone="info">{t("path.awaitingAdvisor")}</Notice>
                )}
              </form>
            </section>
          )}
        </>
      )}
    </>
  );
}

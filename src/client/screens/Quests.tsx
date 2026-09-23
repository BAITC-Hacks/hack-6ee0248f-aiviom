import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Search } from "lucide-react";
import type { Quest, Session } from "../api";
import { endpoint } from "../api";
import { useI18n } from "../i18n";
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

type Seed = {
  title: string;
  description: string;
  source_url: string;
  skill_id: string;
} | null;
type QuestDraft = {
  title: string;
  description: string;
  deliverables: string;
  estimated_hours: number;
  source_url: string;
  skill_ids: string[];
  requires_resource: boolean;
  requires_policy: boolean;
};
const emptyDraft: QuestDraft = {
  title: "",
  description: "",
  deliverables: "",
  estimated_hours: 4,
  source_url: "",
  skill_ids: [],
  requires_resource: false,
  requires_policy: false,
};

export function Quests({
  session,
  revision,
  action,
  seed,
}: {
  session: Session;
  revision: number;
  action: Action;
  seed: Seed;
}) {
  const { locale, t, catalogText, enumText } = useI18n();
  const questsLoad = useLoad(endpoint.quests, [revision, session.identity.id]);
  const catalogLoad = useLoad(endpoint.catalog, []);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [skillQuery, setSkillQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<QuestDraft>(emptyDraft);
  const [reason, setReason] = useState("");
  const [criteria, setCriteria] = useState("");
  const [gainDraft, setGainDraft] = useState<
    Record<string, { gain: number; max_level: number }>
  >({});
  const [evidence, setEvidence] = useState("");
  const [requiresResource, setRequiresResource] = useState(false);
  const [requiresPolicy, setRequiresPolicy] = useState(false);
  const [revisionDraft, setRevisionDraft] = useState({
    title: "",
    description: "",
    deliverables: "",
  });
  const role = session.identity.role;
  const quests = questsLoad.data?.quests ?? [];
  const visible =
    filter === "all" ? quests : quests.filter((item) => item.status === filter);
  const quest = quests.find((item) => item.id === selected) ?? quests[0];
  const skills = catalogLoad.data?.skills ?? [];
  const skillMap = useMemo(
    () =>
      new Map(
        skills.map((skill) => [
          skill.skill_id,
          catalogText(skill.skill_id, "title", skill.name),
        ]),
      ),
    [skills, locale],
  );
  useEffect(() => {
    if (quest) setSelected(quest.id);
  }, [quest?.id]);
  useEffect(() => {
    if (seed)
      setForm((value) => ({
        ...value,
        title: seed.title,
        description: seed.description,
        source_url: seed.source_url,
        skill_ids: [seed.skill_id],
      }));
  }, [seed]);
  useEffect(() => {
    if (!quest) return;
    setCriteria(quest.criteria ?? "");
    setEvidence(quest.evidence ?? "");
    setRequiresResource(quest.requires_resource);
    setRequiresPolicy(quest.requires_policy);
    setRevisionDraft({
      title: quest.title,
      description: quest.description,
      deliverables: quest.deliverables,
    });
    setGainDraft(
      Object.fromEntries(
        quest.skill_ids.map((id) => {
          const existing = quest.gains.find((gain) => gain.skill_id === id);
          return [
            id,
            { gain: existing?.gain ?? 1, max_level: existing?.max_level ?? 5 },
          ];
        }),
      ),
    );
  }, [quest?.id]);
  const date = (value?: string | null) => formatDate(locale, value);
  const num = (value: number | null | undefined) => formatNum(locale, value);
  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !form.skill_ids.length) return;
    setBusy(true);
    const result = await action(
      () =>
        endpoint.createQuest({ ...form, source_url: form.source_url || null }),
      t("quests.created"),
    );
    if (result) setForm(emptyDraft);
    setBusy(false);
  }
  async function decide(
    kind: "review" | "resource" | "policy" | "accept",
    decision: string,
  ) {
    if (!quest || !reason.trim() || busy) return;
    setBusy(true);
    const body = {
      action: decision,
      reason: reason.trim(),
      criteria: criteria.trim(),
      gains: quest.skill_ids.map((skill_id) => ({
        skill_id,
        ...(gainDraft[skill_id] ?? { gain: 1, max_level: 5 }),
      })),
      requires_resource: requiresResource,
      requires_policy: requiresPolicy,
    };
    const work =
      kind === "review"
        ? () => endpoint.reviewQuest(quest.id, body)
        : kind === "resource"
          ? () => endpoint.resourceQuest(quest.id, body)
          : kind === "policy"
            ? () => endpoint.policyQuest(quest.id, body)
            : () => endpoint.acceptQuest(quest.id, reason.trim());
    const result = await action(work, t("quests.decisionSaved"));
    if (result) setReason("");
    setBusy(false);
  }
  async function sendEvidence(event: React.FormEvent) {
    event.preventDefault();
    if (!quest || !evidence.trim() || busy) return;
    setBusy(true);
    const result = await action(
      () => endpoint.evidenceQuest(quest.id, evidence.trim()),
      t("quests.evidenceSent"),
    );
    if (result) setEvidence("");
    setBusy(false);
  }
  async function resubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!quest || busy) return;
    setBusy(true);
    await action(
      () => endpoint.resubmitQuest(quest.id, revisionDraft),
      t("quests.resubmitted"),
    );
    setBusy(false);
  }
  return (
    <>
      <Status
        loading={questsLoad.busy}
        error={questsLoad.error}
        retry={questsLoad.refresh}
      />
      <div className="content-grid">
        <div className="main-stack">
          <Panel
            title={
              role === "employee" ? t("quests.myProjects") : t("quests.queue")
            }
            aside={<Tag>{num(quests.length)}</Tag>}
          >
            <div
              className="segmented"
              role="group"
              aria-label={t("quests.filter")}
            >
              {["all", ...new Set(quests.map((item) => item.status))].map(
                (status) => (
                  <button
                    key={status}
                    className={filter === status ? "active" : ""}
                    onClick={() => setFilter(status)}
                    aria-pressed={filter === status}
                  >
                    {status === "all"
                      ? t("common.all")
                      : enumText("status", status)}
                  </button>
                ),
              )}
            </div>
            {visible.length ? (
              <div className="quest-list">
                {visible.map((item) => (
                  <button
                    key={item.id}
                    className={`quest-row ${quest?.id === item.id ? "selected" : ""}`}
                    onClick={() => setSelected(item.id)}
                    aria-current={quest?.id === item.id ? "true" : undefined}
                  >
                    <div>
                      <strong>{item.title}</strong>
                      <span title={item.description}>{item.description}</span>
                    </div>
                    <Tag
                      tone={
                        item.status === "accepted"
                          ? "green"
                          : item.status === "rejected"
                            ? "red"
                            : item.status.includes("review")
                              ? "amber"
                              : "neutral"
                      }
                    >
                      {enumText("status", item.status)}
                    </Tag>
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                title={
                  filter === "all"
                    ? t("quests.noProjects")
                    : t("quests.noFiltered")
                }
                detail={
                  role === "employee"
                    ? t("quests.createHint")
                    : t("quests.queueHint")
                }
              />
            )}
          </Panel>
          {role === "employee" && (
            <Panel title={t("quests.propose")}>
              <form className="form-stack" onSubmit={create}>
                <label>
                  {t("common.title")}
                  <input
                    value={form.title}
                    onChange={(event) =>
                      setForm({ ...form, title: event.target.value })
                    }
                    required
                    maxLength={160}
                  />
                </label>
                <label>
                  {t("quests.workDescription")}
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      setForm({ ...form, description: event.target.value })
                    }
                    required
                    rows={3}
                  />
                </label>
                <label>
                  {t("quests.deliverables")}
                  <textarea
                    value={form.deliverables}
                    onChange={(event) =>
                      setForm({ ...form, deliverables: event.target.value })
                    }
                    required
                    rows={3}
                  />
                </label>
                <div className="form-pair">
                  <label>
                    {t("quests.estimatedHours")}
                    <input
                      type="number"
                      min="1"
                      max="200"
                      value={form.estimated_hours}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          estimated_hours: Number(event.target.value),
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    {t("quests.sourceUrl")}
                    <input
                      type="url"
                      value={form.source_url}
                      onChange={(event) =>
                        setForm({ ...form, source_url: event.target.value })
                      }
                      placeholder="https://"
                    />
                  </label>
                </div>
                <fieldset>
                  <legend>{t("quests.proposedSkills")}</legend>
                  <label className="search-box">
                    <Search size={18} aria-hidden="true" />
                    <span className="sr-only">{t("common.searchSkills")}</span>
                    <input
                      value={skillQuery}
                      onChange={(event) => setSkillQuery(event.target.value)}
                      placeholder={t("common.searchSkills")}
                    />
                  </label>
                  <div className="skill-picker">
                    {skills
                      .filter((skill) =>
                        `${skill.name} ${skillMap.get(skill.skill_id)}`
                          .toLocaleLowerCase()
                          .includes(skillQuery.toLocaleLowerCase()),
                      )
                      .map((skill) => (
                        <label key={skill.skill_id}>
                          <input
                            type="checkbox"
                            checked={form.skill_ids.includes(skill.skill_id)}
                            onChange={(event) =>
                              setForm({
                                ...form,
                                skill_ids: event.target.checked
                                  ? [...form.skill_ids, skill.skill_id]
                                  : form.skill_ids.filter(
                                      (id) => id !== skill.skill_id,
                                    ),
                              })
                            }
                          />
                          {skillMap.get(skill.skill_id)}
                        </label>
                      ))}
                  </div>
                </fieldset>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={form.requires_resource}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        requires_resource: event.target.checked,
                      })
                    }
                  />
                  {t("quests.needsResource")}
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={form.requires_policy}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        requires_policy: event.target.checked,
                      })
                    }
                  />
                  {t("quests.needsPolicy")}
                </label>
                {!form.skill_ids.length && (
                  <p className="field-hint">{t("quests.chooseSkill")}</p>
                )}
                <Submit busy={busy} disabled={!form.skill_ids.length}>
                  {t("quests.submitProposal")}
                </Submit>
              </form>
            </Panel>
          )}
        </div>
        <div className="side-stack">
          {quest ? (
            <Panel title={t("quests.detail")}>
              <div className="quest-detail">
                <Tag
                  tone={
                    quest.status === "accepted"
                      ? "green"
                      : quest.status === "rejected"
                        ? "red"
                        : "amber"
                  }
                >
                  {enumText("status", quest.status)}
                </Tag>
                <h3>{quest.title}</h3>
                <p>{quest.description}</p>
                <dl>
                  <dt>{t("quests.deliverables")}</dt>
                  <dd>{quest.deliverables}</dd>
                  <dt>{t("quests.skills")}</dt>
                  <dd>
                    {quest.skill_ids
                      .map((id) => skillMap.get(id) ?? id)
                      .join(", ") || t("common.unknown")}
                  </dd>
                  <dt>{t("quests.criteria")}</dt>
                  <dd>{quest.criteria || t("quests.criteriaPending")}</dd>
                  <dt>{t("quests.resources")}</dt>
                  <dd>
                    {quest.requires_resource
                      ? quest.resource_approved
                        ? t("quests.approved")
                        : t("quests.awaitingDecision")
                      : t("quests.notRequired")}
                  </dd>
                  <dt>{t("quests.policy")}</dt>
                  <dd>
                    {quest.requires_policy
                      ? quest.policy_approved
                        ? t("quests.approved")
                        : t("quests.awaitingDecision")
                      : t("quests.existingRule")}
                  </dd>
                  <dt>{t("quests.evidence")}</dt>
                  <dd>{quest.evidence || t("quests.notSubmitted")}</dd>
                </dl>
                {quest.source_url && (
                  <a href={quest.source_url} target="_blank" rel="noreferrer">
                    {t("quests.openSource")} ↗
                  </a>
                )}
                {quest.decisions?.length > 0 && (
                  <details className="decision-history">
                    <summary>
                      {t("quests.decisionHistory")} (
                      {num(quest.decisions.length)})
                    </summary>
                    {quest.decisions.map((decision, index) => (
                      <div key={index}>
                        <strong>{enumText("status", decision.action)}</strong> ·{" "}
                        {decision.reason}
                        <small>{date(decision.at)}</small>
                      </div>
                    ))}
                  </details>
                )}
              </div>
              {role === "employee" &&
                quest.status === "needs_revision" &&
                !quest.advisor_approved && (
                  <form className="form-stack separated" onSubmit={resubmit}>
                    <h3>{t("quests.reviseProposal")}</h3>
                    <label>
                      {t("common.title")}
                      <input
                        value={revisionDraft.title}
                        onChange={(event) =>
                          setRevisionDraft({
                            ...revisionDraft,
                            title: event.target.value,
                          })
                        }
                        required
                      />
                    </label>
                    <label>
                      {t("quests.workDescription")}
                      <textarea
                        rows={3}
                        value={revisionDraft.description}
                        onChange={(event) =>
                          setRevisionDraft({
                            ...revisionDraft,
                            description: event.target.value,
                          })
                        }
                        required
                      />
                    </label>
                    <label>
                      {t("quests.deliverables")}
                      <textarea
                        rows={3}
                        value={revisionDraft.deliverables}
                        onChange={(event) =>
                          setRevisionDraft({
                            ...revisionDraft,
                            deliverables: event.target.value,
                          })
                        }
                        required
                      />
                    </label>
                    <Submit busy={busy}>{t("quests.resubmit")}</Submit>
                  </form>
                )}
              {role === "employee" &&
                (["ready", "in_progress"].includes(quest.status) ||
                  (quest.status === "needs_revision" &&
                    quest.advisor_approved)) && (
                  <form
                    className="form-stack separated"
                    onSubmit={sendEvidence}
                  >
                    <label>
                      {t("quests.resultEvidence")}
                      <textarea
                        rows={4}
                        value={evidence}
                        onChange={(event) => setEvidence(event.target.value)}
                        required
                      />
                    </label>
                    <Submit busy={busy}>{t("quests.submitEvidence")}</Submit>
                  </form>
                )}
              {role === "advisor" &&
                ["submitted", "advisor_review", "needs_revision"].includes(
                  quest.status,
                ) && (
                  <div className="form-stack separated">
                    <label>
                      {t("quests.criteria")}
                      <textarea
                        rows={3}
                        value={criteria}
                        onChange={(event) => setCriteria(event.target.value)}
                        required
                      />
                    </label>
                    <fieldset>
                      <legend>{t("quests.gains")}</legend>
                      {quest.skill_ids.map((id) => (
                        <div className="gain-row" key={id}>
                          <strong>{skillMap.get(id) ?? id}</strong>
                          <label>
                            {t("quests.gain")}
                            <input
                              type="number"
                              min="1"
                              max="5"
                              value={gainDraft[id]?.gain ?? 1}
                              onChange={(event) =>
                                setGainDraft((value) => ({
                                  ...value,
                                  [id]: {
                                    ...(value[id] ?? { gain: 1, max_level: 5 }),
                                    gain: Number(event.target.value),
                                  },
                                }))
                              }
                            />
                          </label>
                          <label>
                            {t("quests.maxLevel")}
                            <input
                              type="number"
                              min="1"
                              max="5"
                              value={gainDraft[id]?.max_level ?? 5}
                              onChange={(event) =>
                                setGainDraft((value) => ({
                                  ...value,
                                  [id]: {
                                    ...(value[id] ?? { gain: 1, max_level: 5 }),
                                    max_level: Number(event.target.value),
                                  },
                                }))
                              }
                            />
                          </label>
                        </div>
                      ))}
                    </fieldset>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={requiresResource}
                        onChange={(event) =>
                          setRequiresResource(event.target.checked)
                        }
                      />
                      {t("quests.needsResource")}
                    </label>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={requiresPolicy}
                        onChange={(event) =>
                          setRequiresPolicy(event.target.checked)
                        }
                      />
                      {t("quests.needsPolicy")}
                    </label>
                    <label>
                      {t("quests.decisionReason")}
                      <textarea
                        rows={2}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        required
                      />
                    </label>
                    <div className="inline-actions">
                      <button
                        className="button primary small"
                        disabled={busy || !reason.trim() || !criteria.trim()}
                        onClick={() => decide("review", "approve")}
                      >
                        {t("quests.approve")}
                      </button>
                      <button
                        className="button secondary small"
                        disabled={busy || !reason.trim()}
                        onClick={() => decide("review", "revise")}
                      >
                        {t("quests.requestRevision")}
                      </button>
                      <button
                        className="button danger small"
                        disabled={busy || !reason.trim()}
                        onClick={() => decide("review", "reject")}
                      >
                        {t("quests.reject")}
                      </button>
                    </div>
                  </div>
                )}
              {role === "advisor" && quest.status === "evidence_submitted" && (
                <div className="form-stack separated">
                  <label>
                    {t("quests.decisionReason")}
                    <textarea
                      rows={2}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      required
                    />
                  </label>
                  <div className="inline-actions">
                    <button
                      className="button primary small"
                      disabled={busy || !reason.trim()}
                      onClick={() => decide("accept", "accept")}
                    >
                      {t("quests.acceptResult")}
                    </button>
                    <button
                      className="button secondary small"
                      disabled={busy || !reason.trim()}
                      onClick={() => decide("review", "revise")}
                    >
                      {t("quests.requestRevision")}
                    </button>
                    <button
                      className="button danger small"
                      disabled={busy || !reason.trim()}
                      onClick={() => decide("review", "reject")}
                    >
                      {t("quests.reject")}
                    </button>
                  </div>
                </div>
              )}
              {role === "manager" &&
                quest.requires_resource &&
                !quest.resource_approved && (
                  <div className="form-stack separated">
                    <label>
                      {t("quests.resourceReason")}
                      <textarea
                        rows={2}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        required
                      />
                    </label>
                    <div className="inline-actions">
                      <button
                        className="button primary small"
                        disabled={busy || !reason.trim()}
                        onClick={() => decide("resource", "approve")}
                      >
                        {t("quests.approveResource")}
                      </button>
                      <button
                        className="button danger small"
                        disabled={busy || !reason.trim()}
                        onClick={() => decide("resource", "reject")}
                      >
                        {t("quests.reject")}
                      </button>
                    </div>
                  </div>
                )}
              {role === "supervisor" &&
                quest.requires_policy &&
                !quest.policy_approved && (
                  <div className="form-stack separated">
                    <label>
                      {t("quests.policyReason")}
                      <textarea
                        rows={2}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        required
                      />
                    </label>
                    <div className="inline-actions">
                      <button
                        className="button primary small"
                        disabled={busy || !reason.trim()}
                        onClick={() => decide("policy", "approve")}
                      >
                        {t("quests.approvePolicy")}
                      </button>
                      <button
                        className="button danger small"
                        disabled={busy || !reason.trim()}
                        onClick={() => decide("policy", "reject")}
                      >
                        {t("quests.reject")}
                      </button>
                    </div>
                  </div>
                )}
            </Panel>
          ) : (
            <Panel title={t("quests.detail")}>
              <Empty title={t("quests.chooseProject")} />
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

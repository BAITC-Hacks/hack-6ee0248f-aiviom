import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import type { ExternalResults, Session } from "../api";
import { endpoint } from "../api";
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
  useLoad,
} from "../ui";

export function ExternalSearch({
  session,
  onPropose,
}: {
  session: Session;
  onPropose: (seed: {
    title: string;
    description: string;
    source_url: string;
    skill_id: string;
  }) => void;
}) {
  const { locale, t, catalogText, enumText } = useI18n();
  const catalogLoad = useLoad(endpoint.catalog, []);
  const profileLoad = useLoad(
    () =>
      session.identity.employee_id
        ? endpoint.profile(session.identity.employee_id)
        : Promise.resolve(null),
    [session.identity.employee_id],
  );
  const [skillId, setSkillId] = useState("");
  const [level, setLevel] = useState(2);
  const [format, setFormat] = useState<
    "any" | "online" | "offline" | "self_paced"
  >("any");
  const [results, setResults] = useState<ExternalResults | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  useEffect(() => {
    const top = profileLoad.data?.gaps.find((gap) => gap.gap > 0);
    if (top && !skillId) {
      setSkillId(top.skill_id);
      setLevel(top.required);
    }
  }, [profileLoad.data?.employee.employee_id]);
  useEffect(() => {
    sequence.current++;
    setResults(null);
    setError("");
    setBusy(false);
  }, [locale, skillId, level, format]);
  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (!skillId || busy) return;
    const current = ++sequence.current;
    setBusy(true);
    setError("");
    setResults(null);
    try {
      const next = await endpoint.externalSearch(
        skillId,
        level,
        locale,
        format === "any" ? undefined : format,
      );
      if (current === sequence.current) setResults(next);
    } catch (cause) {
      if (current === sequence.current)
        setError(
          cause instanceof Error
            ? cause.message
            : t("external.searchUnavailable"),
        );
    } finally {
      if (current === sequence.current) setBusy(false);
    }
  }
  const skills = catalogLoad.data?.skills ?? [];
  return (
    <div className="main-stack">
      <Panel title={t("external.searchBySkill")}>
        <p className="muted">{t("external.disclaimer")}</p>
        <form className="external-form" onSubmit={search}>
          <label>
            {t("common.skill")}
            <Select
              label={t("common.skill")}
              value={skillId}
              onChange={setSkillId}
              required
              searchable
              placeholder={t("external.chooseSkill")}
              options={skills.map((skill) => ({
                value: skill.skill_id,
                label: catalogText(skill.skill_id, "title", skill.name),
              }))}
            />
          </label>
          <label>
            {t("external.desiredLevel")}
            <input
              type="number"
              min="0"
              max="5"
              value={level}
              onChange={(event) => setLevel(Number(event.target.value))}
              required
            />
          </label>
          <label>
            {t("common.format")}
            <Select<typeof format>
              label={t("common.format")}
              value={format}
              onChange={setFormat}
              options={(
                ["any", "online", "offline", "self_paced"] as const
              ).map((value) => ({ value, label: enumText("format", value) }))}
            />
          </label>
          <Submit busy={busy} disabled={!skillId}>
            {t("external.searchSources")}
          </Submit>
        </form>
        <Status
          loading={catalogLoad.busy}
          error={catalogLoad.error}
          retry={catalogLoad.refresh}
        />
      </Panel>
      {busy && (
        <div
          className="skeleton-stack"
          role="status"
          aria-label={t("common.loading")}
        >
          <div />
          <div />
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {results && (
        <Panel
          title={t("external.sources")}
          aside={
            <Tag tone={results.mode === "live_search" ? "green" : "amber"}>
              {results.mode === "live_search"
                ? t("external.liveSearch")
                : t("external.searchUnavailable")}
            </Tag>
          }
        >
          {results.warning && <Notice tone="warning">{results.warning}</Notice>}
          {results.opportunities.length ? (
            <div className="external-results">
              {results.opportunities.map((opportunity, index) => (
                <article
                  key={`${opportunity.url}-${index}`}
                  className="external-result"
                >
                  <div>
                    <h3>{opportunity.title}</h3>
                    <p>{opportunity.excerpt}</p>
                    <div className="detail-facts">
                      <span>
                        {t("external.checkedAt", {
                          date: formatDate(locale, opportunity.checked_at),
                        })}
                      </span>
                      <span>{t("external.costUnknown")}</span>
                      <span>{t("external.timeUnknown")}</span>
                      <span>{t("external.notApproved")}</span>
                    </div>
                    <a href={opportunity.url} target="_blank" rel="noreferrer">
                      {t("external.openSource")} ↗
                    </a>
                  </div>
                  <button
                    className="button secondary small"
                    onClick={() =>
                      onPropose({
                        title: opportunity.title,
                        description: opportunity.excerpt,
                        source_url: opportunity.url,
                        skill_id: skillId,
                      })
                    }
                  >
                    {t("external.proposeAdvisor")}
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <Empty title={t("external.none")} detail={t("external.noneHint")} />
          )}
        </Panel>
      )}
    </div>
  );
}

import { useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import { endpoint } from "../api";
import { useI18n } from "../i18n";
import {
  Empty,
  Panel,
  Status,
  Tag,
  formatDate,
  formatNum,
  useLoad,
} from "../ui";

export function CatalogView() {
  const { locale, t, catalogText, enumText } = useI18n();
  const load = useLoad(endpoint.catalog, []);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const events = load.data?.events ?? [];
  const filtered = events.filter((event) =>
    `${event.title} ${catalogText(event.event_id, "title", event.title)} ${event.description} ${catalogText(event.event_id, "description", event.description)} ${event.type}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  );
  const active = events.find((event) => event.event_id === selected);
  const skills = new Map(
    (load.data?.skills ?? []).map((skill) => [
      skill.skill_id,
      catalogText(skill.skill_id, "title", skill.name),
    ]),
  );
  const num = (value: number | null | undefined) => formatNum(locale, value);
  return (
    <>
      <Status loading={load.busy} error={load.error} retry={load.refresh} />
      {load.data && (
        <div className="content-grid">
          <Panel
            title={t("catalog.activities")}
            aside={
              <span className="muted">
                {t("common.of", {
                  current: num(filtered.length),
                  total: num(events.length),
                })}
              </span>
            }
          >
            <label className="search-box">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">{t("catalog.searchLabel")}</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("catalog.searchPlaceholder")}
              />
            </label>
            {filtered.length ? (
              <div className="catalog-list">
                {filtered.map((event) => (
                  <button
                    key={event.event_id}
                    className={`catalog-row ${selected === event.event_id ? "selected" : ""}`}
                    onClick={() => setSelected(event.event_id)}
                  >
                    <div>
                      <strong>
                        {catalogText(event.event_id, "title", event.title)}
                      </strong>
                      <span>
                        {enumText("type", event.type)} ·{" "}
                        {enumText("format", event.format)} ·{" "}
                        {t("common.hours", {
                          count: num(event.duration_hours),
                        })}
                      </span>
                    </div>
                    {event.mandatory ? (
                      <Tag tone="amber">{t("catalog.mandatory")}</Tag>
                    ) : (
                      <ArrowRight size={17} aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                title={t("catalog.noResults")}
                detail={t("catalog.clearSearch")}
              />
            )}
          </Panel>
          <Panel title={t("catalog.details")}>
            {active ? (
              <div className="quest-detail">
                <h3>{catalogText(active.event_id, "title", active.title)}</h3>
                <p>
                  {catalogText(
                    active.event_id,
                    "description",
                    active.description,
                  )}
                </p>
                <dl>
                  <dt>{t("common.format")}</dt>
                  <dd>{enumText("format", active.format)}</dd>
                  <dt>{t("common.duration")}</dt>
                  <dd>
                    {t("common.hours", { count: num(active.duration_hours) })}
                  </dd>
                  <dt>{t("catalog.audience")}</dt>
                  <dd>
                    {active.target_roles
                      .map((role) => catalogText(role, "title", role))
                      .join(", ")}{" "}
                    ·{" "}
                    {active.target_grades
                      .map((grade) => enumText("grade", grade))
                      .join(", ")}
                  </dd>
                  <dt>{t("quests.skills")}</dt>
                  <dd>
                    {active.develops_skills
                      .map(
                        (gain) =>
                          `${skills.get(gain.skill_id) ?? gain.skill_id} (+${num(gain.gain)}, ${t("catalog.limit")} ${num(gain.max_level)})`,
                      )
                      .join(", ") || t("common.notSpecified")}
                  </dd>
                  <dt>{t("catalog.prerequisites")}</dt>
                  <dd>
                    {Object.entries(active.prerequisites)
                      .map(
                        ([id, level]) =>
                          `${skills.get(id) ?? id} ≥ ${num(level)}`,
                      )
                      .join(", ") || t("common.none")}
                  </dd>
                  <dt>{t("catalog.sessions")}</dt>
                  <dd>
                    {active.upcoming_sessions
                      .map((value) => formatDate(locale, value))
                      .join(", ") || t("common.notSpecified")}
                  </dd>
                </dl>
              </div>
            ) : (
              <Empty
                title={t("catalog.choose")}
                detail={t("catalog.chooseHint")}
              />
            )}
          </Panel>
        </div>
      )}
    </>
  );
}

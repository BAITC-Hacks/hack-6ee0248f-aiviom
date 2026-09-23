import type { Session } from "../api";
import { endpoint } from "../api";
import { useI18n } from "../i18n";
import {
  DataTable,
  Notice,
  Panel,
  Status,
  Tag,
  formatDate,
  formatNum,
  useLoad,
} from "../ui";

const asText = (value: unknown) => (value == null ? "" : String(value));
function importCounts(
  value: unknown,
): { employees?: number; history?: number } | null {
  try {
    const parsed: unknown = JSON.parse(asText(value));
    return parsed && typeof parsed === "object"
      ? (parsed as { employees?: number; history?: number })
      : null;
  } catch {
    return null;
  }
}
export function AuditView({
  session,
  revision,
}: {
  session: Session;
  revision: number;
}) {
  const { locale, t, catalogText, enumText } = useI18n();
  const load = useLoad(endpoint.audit, [revision, session.identity.id]);
  const catalogLoad = useLoad(endpoint.catalog, []);
  const rows = load.data?.events ?? [];
  const objectLabel = (row: Record<string, unknown>) => {
    const target = asText(
      row.object_title ??
        row.object_id ??
        row.entity_id ??
        row.target_id ??
        row.target,
    );
    if (target.startsWith("EV_")) {
      const event = catalogLoad.data?.events.find(
        (item) => item.event_id === target,
      );
      return event ? catalogText(target, "title", event.title) : target;
    }
    if (target === "mentor" || target === "project")
      return catalogText(target, "title", target);
    if (asText(row.action).startsWith("quest.")) return t("nav.quests");
    if (target === "batch") return t("import.title");
    return target;
  };
  return (
    <>
      <Status loading={load.busy} error={load.error} retry={load.refresh} />
      <Panel
        title={t("audit.title")}
        aside={<Tag>{formatNum(locale, rows.length)}</Tag>}
      >
        <DataTable
          rows={rows}
          empty={t("audit.empty")}
          columns={[
            {
              key: "date",
              title: t("audit.date"),
              render: (row) =>
                formatDate(
                  locale,
                  asText(row.created_at ?? row.at ?? row.date),
                ),
            },
            {
              key: "actor",
              title: t("audit.actor"),
              render: (row) => {
                const actor = asText(
                  row.actor_name ?? row.actor ?? row.actor_id,
                );
                const identity = session.identities.find(
                  (item) => item.id === actor,
                );
                if (!identity) return actor;
                if (identity.role !== "employee")
                  return enumText("role", identity.role);
                const name = identity.label.includes(" · ")
                  ? identity.label.split(" · ").slice(1).join(" · ")
                  : identity.label;
                return name || enumText("role", "employee");
              },
            },
            {
              key: "action",
              title: t("audit.action"),
              render: (row) => t(`audit.action.${asText(row.action)}`),
            },
            {
              key: "object",
              title: t("audit.object"),
              render: (row) => objectLabel(row),
            },
            {
              key: "reason",
              title: t("audit.reason"),
              render: (row) =>
                asText(row.action) === "import.commit"
                  ? t("import.applied")
                  : asText(row.reason),
            },
            {
              key: "details",
              title: t("audit.details"),
              render: (row) => (
                <details>
                  <summary>{t("common.details")}</summary>
                  <dl className="audit-details">
                    {asText(row.action) === "import.commit" &&
                      importCounts(row.reason) && (
                        <>
                          <div>
                            <dt>{t("import.newEmployees")}</dt>
                            <dd>
                              {formatNum(
                                locale,
                                importCounts(row.reason)?.employees,
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt>{t("import.historyRecords")}</dt>
                            <dd>
                              {formatNum(
                                locale,
                                importCounts(row.reason)?.history,
                              )}
                            </dd>
                          </div>
                        </>
                      )}
                    <div>
                      <dt>{t("audit.techDetails")}</dt>
                      <dd>{asText(row.target ?? row.id)}</dd>
                    </div>
                    {Object.entries(row)
                      .filter(
                        ([key]) =>
                          ![
                            "reason",
                            "actor_name",
                            "actor",
                            "actor_id",
                            "action",
                            "object_title",
                            "object_id",
                            "entity_id",
                            "target_id",
                            "target",
                            "created_at",
                            "at",
                            "date",
                          ].includes(key),
                      )
                      .map(([key, value]) => (
                        <div key={key}>
                          <dt>{t(`audit.field.${key}`)}</dt>
                          <dd>
                            {typeof value === "string" ||
                            typeof value === "number"
                              ? String(value)
                              : Array.isArray(value)
                                ? value.map(asText).join(", ")
                                : t("common.details")}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </details>
              ),
            },
          ]}
        />
      </Panel>
      <Notice>{t("audit.disclaimer")}</Notice>
    </>
  );
}

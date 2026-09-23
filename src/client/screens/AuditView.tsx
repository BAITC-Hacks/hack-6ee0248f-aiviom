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
export function AuditView({
  session,
  revision,
}: {
  session: Session;
  revision: number;
}) {
  const { locale, t, enumText } = useI18n();
  const load = useLoad(endpoint.audit, [revision, session.identity.id]);
  const rows = load.data?.events ?? [];
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
              render: (row) =>
                asText(row.actor_name ?? row.actor ?? row.actor_id),
            },
            {
              key: "action",
              title: t("audit.action"),
              render: (row) => t(`audit.action.${asText(row.action)}`),
            },
            {
              key: "object",
              title: t("audit.object"),
              render: (row) =>
                asText(
                  row.object_title ??
                    row.object_id ??
                    row.entity_id ??
                    row.target_id ??
                    row.target,
                ),
            },
            {
              key: "reason",
              title: t("audit.reason"),
              render: (row) => asText(row.reason),
            },
            {
              key: "details",
              title: t("audit.details"),
              render: (row) => (
                <details>
                  <summary>{t("common.details")}</summary>
                  <dl className="audit-details">
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

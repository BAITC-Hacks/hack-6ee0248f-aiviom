import React, { useRef, useState } from "react";
import { FileUp, Trash2 } from "lucide-react";
import { endpoint } from "../api";
import { useI18n } from "../i18n";
import {
  DataTable,
  Empty,
  Notice,
  Panel,
  Status,
  Tag,
  formatDate,
  formatNum,
  formatPercent,
  type Action,
  useLoad,
} from "../ui";

interface Analytics {
  as_of: string;
  scope: { profiles: number; history_records: number };
  skill_gaps: {
    skill_id: string;
    name: string;
    requiring: number;
    with_gap: number;
    frequency_pct: number | null;
    average_gap: number | null;
    critical_with_gap: number;
  }[];
  critical_gaps: { employees: number };
  completions: {
    total: number;
    completed: number;
    rate_pct: number | null;
    by_status: Record<string, number>;
  };
  no_show: { eligible: number; no_show: number; rate_pct: number | null };
  mandatory_overdue: { count: number };
  no_next_step: { total: number; by_reason: Record<string, number> };
  no_voluntary_completion_90d: { count: number };
  catalog_gaps: { skill_id: string; name: string; employees: number }[];
  event_groups: { event_id: string; title: string; employees: number }[];
  on_time: { eligible: number; on_time: number; rate_pct: number | null };
  caveats: string[];
  caveat_codes?: string[];
  no_next_employees?: {
    employee_id: string;
    full_name: string;
    reason: string;
  }[];
  mandatory_open?: {
    employee_id: string;
    event_id: string;
    title: string;
    due_date: string | null;
    status: string;
  }[];
  participation?: {
    event_id: string;
    title: string;
    total: number;
    completed: number;
    by_status: Record<string, number>;
  }[];
}
interface ImportError {
  row?: number;
  field?: string;
  message?: string;
  code?: string;
}
interface ImportPreview {
  valid?: boolean;
  counts?: { employees?: number; history?: number };
  errors?: ImportError[];
  warnings?: string[];
}
type UploadKind = "employees" | "history";
type Upload = { file: File; text: string } | null;

function FileSlot({
  label,
  accept,
  upload,
  busy,
  onFile,
  onRemove,
}: {
  label: string;
  accept: string;
  upload: Upload;
  busy: boolean;
  onFile: (file: File) => void;
  onRemove: () => void;
}) {
  const { t, formatNumber } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className={`file-slot ${dragging ? "dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!busy && event.dataTransfer.files[0])
          onFile(event.dataTransfer.files[0]);
      }}
    >
      <strong>{label}</strong>
      <p className="muted">{accept.includes("json") ? "JSON" : "CSV"}</p>
      {upload ? (
        <div className="file-chosen">
          <span title={upload.file.name}>
            {upload.file.name}
            <small>
              {t("common.fileSize", { size: formatNumber(upload.file.size) })}
            </small>
          </span>
          <button
            className="icon-button"
            type="button"
            disabled={busy}
            aria-label={t("common.removeFile")}
            onClick={onRemove}
          >
            <Trash2 size={18} />
          </button>
        </div>
      ) : (
        <p className="muted">{t("import.dropHint")}</p>
      )}
      <button
        type="button"
        className="button secondary"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        <FileUp size={18} />
        {upload ? t("common.replaceFile") : t("common.chooseFile")}
      </button>
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept={accept}
        aria-label={label}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}

export function Insights({
  revision,
  action,
}: {
  revision: number;
  action: Action;
}) {
  const { locale, t, catalogText, enumText } = useI18n();
  const dataLoad = useLoad(endpoint.analytics, [revision]);
  const [section, setSection] = useState<"overview" | "import">("overview");
  const [employees, setEmployees] = useState<Upload>(null);
  const [history, setHistory] = useState<Upload>(null);
  const [preview, setPreview] = useState<{
    result: ImportPreview;
    body: unknown;
    revision: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [fileError, setFileError] = useState("");
  const fileRevision = useRef(0);
  const fileRead = useRef<Record<UploadKind, number>>({
    employees: 0,
    history: 0,
  });
  const num = (value: number | null | undefined) => formatNum(locale, value);
  function invalidate() {
    fileRevision.current += 1;
    setPreview(null);
    setFileError("");
  }
  async function selectFile(kind: UploadKind, file: File) {
    invalidate();
    if (kind === "employees") setEmployees(null);
    else setHistory(null);
    const sequence = ++fileRead.current[kind];
    try {
      const text = await file.text();
      if (sequence !== fileRead.current[kind]) return;
      const upload = { file, text };
      if (kind === "employees") setEmployees(upload);
      else setHistory(upload);
    } catch {
      if (sequence === fileRead.current[kind])
        setFileError(t("import.readFailed"));
    }
  }
  function removeFile(kind: UploadKind) {
    invalidate();
    fileRead.current[kind]++;
    if (kind === "employees") setEmployees(null);
    else setHistory(null);
  }
  function importBody() {
    if (!employees) throw new Error(t("import.chooseEmployees"));
    let parsed: unknown;
    try {
      parsed = JSON.parse(employees.text);
    } catch {
      throw new Error(t("import.invalidJson"));
    }
    return { employees: parsed, history: history?.text ?? "" };
  }
  async function validate() {
    if (busy) return;
    const sequence = fileRevision.current;
    setBusy(true);
    setFileError("");
    try {
      const body = importBody();
      const result = (await endpoint.importPreview(body)) as ImportPreview;
      if (sequence === fileRevision.current)
        setPreview({ result, body, revision: sequence });
    } catch (cause) {
      if (sequence === fileRevision.current)
        setFileError(
          cause instanceof Error ? cause.message : t("import.validationFailed"),
        );
    } finally {
      setBusy(false);
    }
  }
  async function commit() {
    if (
      busy ||
      !preview ||
      !preview.result.valid ||
      preview.revision !== fileRevision.current
    )
      return;
    setBusy(true);
    const result = await action(
      () => endpoint.importCommit(preview.body),
      t("import.applied"),
    );
    if (result) {
      invalidate();
      setEmployees(null);
      setHistory(null);
    }
    setBusy(false);
  }
  const result = preview?.result;
  const rows = result?.errors ?? [];
  const warningRows = result?.warnings ?? [];
  const fieldLabel = (field: string) => {
    if (field.startsWith("skills."))
      return `${t("import.fieldSkills")}: ${catalogText(field.slice(7), "title", field.slice(7))}`;
    return t(`import.field.${field}`);
  };
  return (
    <div className="main-stack">
      <div
        className="section-tabs"
        role="tablist"
        aria-label={t("insights.section")}
      >
        <button
          role="tab"
          aria-selected={section === "overview"}
          className={section === "overview" ? "active" : ""}
          onClick={() => setSection("overview")}
        >
          {t("insights.overview")}
        </button>
        <button
          role="tab"
          aria-selected={section === "import"}
          className={section === "import" ? "active" : ""}
          onClick={() => setSection("import")}
        >
          {t("import.title")}
        </button>
      </div>
      {section === "overview" && (
        <>
          <Status
            loading={dataLoad.busy}
            error={dataLoad.error}
            retry={dataLoad.refresh}
          />
          {dataLoad.data && (
            <AnalyticsView value={dataLoad.data as unknown as Analytics} />
          )}
        </>
      )}
      {section === "import" && (
        <Panel title={t("import.title")}>
          <p className="muted">{t("import.hint")}</p>
          <div className="form-pair">
            <FileSlot
              label={t("import.employeesFile")}
              accept=".json,application/json"
              upload={employees}
              busy={busy}
              onFile={(file) => selectFile("employees", file)}
              onRemove={() => removeFile("employees")}
            />
            <FileSlot
              label={t("import.historyFile")}
              accept=".csv,text/csv"
              upload={history}
              busy={busy}
              onFile={(file) => selectFile("history", file)}
              onRemove={() => removeFile("history")}
            />
          </div>
          <div className="inline-actions">
            <button
              className="button secondary"
              disabled={busy || !employees}
              onClick={validate}
            >
              <FileUp size={18} />
              {t("import.validate")}
            </button>
            {result?.valid === true &&
              preview?.revision === fileRevision.current && (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={commit}
                >
                  {t("import.apply")}
                </button>
              )}
          </div>
          {fileError && <Notice tone="error">{fileError}</Notice>}
          {result && (
            <div className="import-preview">
              <Tag tone={result.valid ? "green" : "red"}>
                {result.valid ? t("import.valid") : t("import.invalid")}
              </Tag>
              <p>
                {t("import.newEmployees")}:{" "}
                <strong>{num(result.counts?.employees)}</strong> ·{" "}
                {t("import.historyRecords")}:{" "}
                <strong>{num(result.counts?.history)}</strong>
              </p>
              {rows.length > 0 && (
                <ul className="error-list">
                  {rows.map((item, index) => (
                    <li key={index}>
                      {t("import.errorInRow", {
                        row: num(item.row),
                        field: fieldLabel(item.field ?? ""),
                        reason: item.message ?? t("common.error"),
                      })}
                    </li>
                  ))}
                </ul>
              )}
              {warningRows.length > 0 && (
                <details>
                  <summary>
                    {t("import.warnings", { count: num(warningRows.length) })}
                  </summary>
                  <ul>
                    {warningRows.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

function AnalyticsView({ value }: { value: Analytics }) {
  const { locale, t, catalogText, enumText } = useI18n();
  const num = (value: number | null | undefined) => formatNum(locale, value);
  const pct = (value: number | null | undefined) =>
    formatPercent(locale, value, t("common.noData"));
  return (
    <>
      <div className="analytics-overview">
        <div>
          <span>{t("insights.profiles")}</span>
          <strong>{num(value.scope?.profiles)}</strong>
        </div>
        <div>
          <span>{t("insights.completed")}</span>
          <strong>
            {num(value.completions?.completed)}
            <small> / {num(value.completions?.total)}</small>
          </strong>
        </div>
        <div>
          <span>{t("insights.completionRate")}</span>
          <strong>{pct(value.completions?.rate_pct)}</strong>
        </div>
        <div>
          <span>{t("insights.criticalGap")}</span>
          <strong>{num(value.critical_gaps?.employees)}</strong>
        </div>
      </div>
      <div className="content-grid">
        <Panel title={t("insights.skillGaps")}>
          <DataTable
            rows={value.skill_gaps ?? []}
            empty={t("insights.noSkillGaps")}
            columns={[
              {
                key: "skill",
                title: t("common.skill"),
                render: (row) => catalogText(row.skill_id, "title", row.name),
              },
              {
                key: "gap",
                title: t("insights.withGap"),
                render: (row) =>
                  t("common.of", {
                    current: num(row.with_gap),
                    total: num(row.requiring),
                  }),
              },
              {
                key: "frequency",
                title: t("insights.frequency"),
                render: (row) => pct(row.frequency_pct),
              },
              {
                key: "average",
                title: t("insights.averageGap"),
                render: (row) => num(row.average_gap),
              },
              {
                key: "critical",
                title: t("insights.critical"),
                render: (row) => num(row.critical_with_gap),
              },
            ]}
          />
        </Panel>
        <Panel title={t("insights.blockers")}>
          <div className="metric-line">
            <span>{t("insights.noNextStep")}</span>
            <strong>{num(value.no_next_step?.total)}</strong>
          </div>
          <div className="metric-line">
            <span>{t("insights.mandatoryOverdue")}</span>
            <strong>{num(value.mandatory_overdue?.count)}</strong>
          </div>
          <div className="metric-line">
            <span>{t("insights.noVoluntary90")}</span>
            <strong>{num(value.no_voluntary_completion_90d?.count)}</strong>
          </div>
          <h3>{t("insights.blockerReasons")}</h3>
          {Object.entries(value.no_next_step?.by_reason ?? {}).length ? (
            <div>
              {Object.entries(value.no_next_step.by_reason).map(
                ([reason, count]) => (
                  <div className="metric-line" key={reason}>
                    <span>{t(`reason.${reason}`)}</span>
                    <strong>{num(count)}</strong>
                  </div>
                ),
              )}
            </div>
          ) : (
            <Empty title={t("insights.noBlockers")} />
          )}
        </Panel>
      </div>
      <div className="content-grid">
        <Panel title={t("insights.participation")}>
          <div className="metric-line">
            <span>{t("insights.completed")}</span>
            <strong>
              {t("common.of", {
                current: num(value.completions?.completed),
                total: num(value.completions?.total),
              })}{" "}
              · {pct(value.completions?.rate_pct)}
            </strong>
          </div>
          {Object.entries(value.completions?.by_status ?? {}).map(
            ([status, count]) => (
              <div className="metric-line" key={status}>
                <span>{enumText("status", status)}</span>
                <strong>{num(count)}</strong>
              </div>
            ),
          )}
          <h3>{t("insights.sessionsAndDates")}</h3>
          <div className="metric-line">
            <span>{t("insights.noShow")}</span>
            <strong>
              {t("common.of", {
                current: num(value.no_show?.no_show),
                total: num(value.no_show?.eligible),
              })}{" "}
              · {pct(value.no_show?.rate_pct)}
            </strong>
          </div>
          <div className="metric-line">
            <span>{t("insights.onTime")}</span>
            <strong>
              {t("common.of", {
                current: num(value.on_time?.on_time),
                total: num(value.on_time?.eligible),
              })}{" "}
              · {pct(value.on_time?.rate_pct)}
            </strong>
          </div>
        </Panel>
        <Panel title={t("insights.catalogGaps")}>
          <p className="muted">{t("insights.catalogGapHint")}</p>
          {value.catalog_gaps?.length ? (
            <div>
              {value.catalog_gaps.map((item) => (
                <div className="metric-line" key={item.skill_id}>
                  <span>{catalogText(item.skill_id, "title", item.name)}</span>
                  <strong>{num(item.employees)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <Empty title={t("insights.noCatalogGaps")} />
          )}
          <h3>{t("insights.eventGroups")}</h3>
          {value.event_groups?.length ? (
            <div>
              {value.event_groups.slice(0, 12).map((item) => (
                <div className="metric-line" key={item.event_id}>
                  <span>{catalogText(item.event_id, "title", item.title)}</span>
                  <strong>{num(item.employees)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <Empty title={t("insights.noGroups")} />
          )}
        </Panel>
      </div>
      {value.no_next_employees?.length ||
      value.mandatory_open?.length ||
      value.participation?.length ? (
        <Panel title={t("insights.records")}>
          <p className="muted">{t("insights.recordsHint")}</p>
          {!!value.no_next_employees?.length && (
            <details className="analytics-details">
              <summary>
                {t("insights.noNextEmployees")} ·{" "}
                {num(value.no_next_employees.length)}
              </summary>
              <DataTable
                rows={value.no_next_employees}
                empty={t("common.empty")}
                columns={[
                  {
                    key: "name",
                    title: t("common.employee"),
                    render: (row) => row.full_name,
                  },
                  {
                    key: "reason",
                    title: t("common.reason"),
                    render: (row) => t(`reason.${row.reason}`),
                  },
                ]}
              />
            </details>
          )}
          {!!value.mandatory_open?.length && (
            <details className="analytics-details">
              <summary>
                {t("insights.openMandatory")} ·{" "}
                {num(value.mandatory_open.length)}
              </summary>
              <DataTable
                rows={value.mandatory_open}
                empty={t("common.empty")}
                columns={[
                  {
                    key: "employee",
                    title: t("common.employee"),
                    render: (row) => row.employee_id,
                  },
                  {
                    key: "event",
                    title: t("common.activity"),
                    render: (row) =>
                      catalogText(row.event_id, "title", row.title),
                  },
                  {
                    key: "due",
                    title: t("common.dueDate"),
                    render: (row) => formatDate(locale, row.due_date),
                  },
                  {
                    key: "status",
                    title: t("common.status"),
                    render: (row) => enumText("status", row.status),
                  },
                ]}
              />
            </details>
          )}
          {!!value.participation?.length && (
            <details className="analytics-details">
              <summary>
                {t("insights.byActivity")} · {num(value.participation.length)}
              </summary>
              <DataTable
                rows={value.participation}
                empty={t("common.empty")}
                columns={[
                  {
                    key: "event",
                    title: t("common.activity"),
                    render: (row) =>
                      catalogText(row.event_id, "title", row.title),
                  },
                  {
                    key: "completed",
                    title: t("insights.completed"),
                    render: (row) => num(row.completed),
                  },
                  {
                    key: "total",
                    title: t("insights.totalRecords"),
                    render: (row) => num(row.total),
                  },
                  {
                    key: "other",
                    title: t("insights.otherStates"),
                    render: (row) =>
                      Object.entries(row.by_status)
                        .filter(([status]) => status !== "completed")
                        .map(
                          ([status, count]) =>
                            `${enumText("status", status)}: ${num(count)}`,
                        )
                        .join(" · "),
                  },
                ]}
              />
            </details>
          )}
        </Panel>
      ) : null}
      {!!value.caveat_codes?.length && (
        <Notice tone="warning">
          <strong>{t("insights.caveats")}:</strong>{" "}
          {value.caveat_codes
            .map((code) => t(`insights.caveat.${code}`))
            .join(" ")}
        </Notice>
      )}
    </>
  );
}

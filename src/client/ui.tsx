import React, { useEffect, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { useI18n } from "./i18n";

export type Action = <T>(
  work: () => Promise<T>,
  message: string,
  refresh?: boolean,
) => Promise<T | null>;

export function useLoad<T>(load: () => Promise<T>, deps: React.DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setError("");
    load()
      .then((value) => {
        if (active) setData(value);
      })
      .catch((cause) => {
        if (active)
          setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [...deps, tick]);
  return { data, error, busy, refresh: () => setTick((value) => value + 1) };
}

export function Notice({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "warning" | "error" | "success";
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`notice ${tone}`}
    >
      {children}
    </div>
  );
}

export function Status({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  const { t } = useI18n();
  if (loading)
    return (
      <div
        className="skeleton-stack"
        role="status"
        aria-label={t("common.loading")}
      >
        <div />
        <div />
        <div />
      </div>
    );
  if (error)
    return (
      <Notice tone="error">
        {error}{" "}
        <button className="text-button" onClick={retry}>
          {t("common.retry")}
        </button>
      </Notice>
    );
  return null;
}

export function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {detail && <p>{detail}</p>}
    </div>
  );
}

export function Panel({
  title,
  aside,
  children,
  className = "",
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Tag({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "green" | "amber" | "red";
}) {
  return <span className={`tag ${tone}`}>{children}</span>;
}

export function Submit({
  children,
  busy,
  disabled = false,
}: {
  children: React.ReactNode;
  busy: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      className="button primary"
      disabled={busy || disabled}
      aria-busy={busy}
    >
      {busy && <LoaderCircle size={18} className="spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const dialog = React.useRef<HTMLDialogElement>(null);
  const trigger = React.useRef<HTMLElement | null>(null);
  useEffect(() => {
    trigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const node = dialog.current;
    node?.showModal();
    return () => {
      node?.close();
      trigger.current?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="dialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function MetricLine({
  label,
  value,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="metric-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function DataTable<T>({
  rows,
  columns,
  empty,
}: {
  rows: T[];
  columns: {
    key: string;
    title: string;
    render: (row: T) => React.ReactNode;
  }[];
  empty: string;
}) {
  const { t } = useI18n();
  if (!rows.length) return <Empty title={empty} />;
  return (
    <div className="table-wrap">
      <div className="table-hint">{t("common.tableScroll")}</div>
      <div className="table-scroll" tabIndex={0}>
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th scope="col" key={column.key}>
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column.key}>{column.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function formatDate(locale: string, value?: string | null) {
  if (!value) return "—";
  const matched = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!matched) return value;
  return new Intl.DateTimeFormat(
    locale === "kk" ? "kk-KZ" : locale === "en" ? "en-GB" : "ru-RU",
    { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" },
  ).format(
    new Date(
      Date.UTC(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3])),
    ),
  );
}

export function formatNum(
  locale: string,
  value: number | null | undefined,
  maximumFractionDigits = 1,
) {
  return value == null || !Number.isFinite(value)
    ? "—"
    : new Intl.NumberFormat(
        locale === "kk" ? "kk-KZ" : locale === "en" ? "en-GB" : "ru-RU",
        { maximumFractionDigits },
      ).format(value);
}

export function formatPercent(
  locale: string,
  value: number | null | undefined,
  missing: string,
) {
  return value == null || !Number.isFinite(value)
    ? missing
    : `${formatNum(locale, value)}%`;
}

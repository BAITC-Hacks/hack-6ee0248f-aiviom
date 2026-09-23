import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  BookOpen,
  ChevronDown,
  Compass,
  Gift,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import type { Session } from "./api";
import { endpoint, setApiLocale } from "./api";
import { I18nProvider, useI18n } from "./i18n";
import {
  Dialog,
  Notice,
  Status,
  Tag,
  useLoad,
  formatDate,
  type Action,
} from "./ui";
import { EmployeePath } from "./screens/EmployeePath";
import { Quests } from "./screens/Quests";
import { People } from "./screens/People";
import { Insights } from "./screens/Insights";
import { CatalogView } from "./screens/CatalogView";
import { ExternalSearch } from "./screens/ExternalSearch";
import { RewardsView } from "./screens/RewardsView";
import { AuditView } from "./screens/AuditView";
import "./styles.css";

type Tab =
  | "path"
  | "quests"
  | "people"
  | "insights"
  | "catalog"
  | "external"
  | "rewards"
  | "audit";
const icons = {
  path: Compass,
  quests: Activity,
  people: Users,
  insights: LayoutDashboard,
  catalog: BookOpen,
  external: Search,
  rewards: Gift,
  audit: ShieldCheck,
};
const descriptions: Record<Tab, string> = {
  path: "page.path",
  quests: "page.quests",
  people: "page.people",
  insights: "page.insights",
  catalog: "page.catalog",
  external: "page.external",
  rewards: "page.rewards",
  audit: "page.audit",
};
function demoIdentityName(identity: Session["identity"]): string {
  if (identity.role !== "employee") return "";
  return identity.id === "employee" && identity.label.includes(" · ")
    ? identity.label.split(" · ").slice(1).join(" · ")
    : identity.label;
}

function App() {
  const { locale, setLocale, t } = useI18n();
  useEffect(() => {
    setApiLocale(locale);
  }, [locale]);
  const sessionLoad = useLoad(endpoint.session, []);
  const [session, setSession] = useState<Session | null>(null);
  const [tab, setTab] = useState<Tab>("path");
  const [demoOpen, setDemoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [flash, setFlash] = useState<{
    text: string;
    tone: "error" | "success";
  } | null>(null);
  const localeRef = useRef(locale);
  useEffect(() => {
    localeRef.current = locale;
    setFlash(null);
  }, [locale]);
  const [switching, setSwitching] = useState(false);
  const [asOf, setAsOf] = useState("");
  const [revision, setRevision] = useState(0);
  const [questDraft, setQuestDraft] = useState<{
    title: string;
    description: string;
    source_url: string;
    skill_id: string;
  } | null>(null);
  useEffect(() => {
    if (sessionLoad.data) {
      setSession(sessionLoad.data);
      setAsOf(sessionLoad.data.as_of);
    }
  }, [sessionLoad.data]);
  const role = session?.identity.role;
  const tabs: Tab[] =
    role === "employee"
      ? ["path", "quests", "catalog", "external", "rewards"]
      : role === "advisor" || role === "manager"
        ? ["people", "quests", "catalog"]
        : role === "hr"
          ? ["insights", "people", "quests", "catalog", "audit"]
          : ["audit", "quests", "catalog"];
  useEffect(() => {
    if (!tabs.includes(tab)) setTab(tabs[0]);
  }, [role]);
  const action: Action = useCallback(
    async (work, message, refresh = true) => {
      const requestLocale = locale;
      try {
        setFlash(null);
        const result = await work();
        if (message && requestLocale === localeRef.current)
          setFlash({ text: message, tone: "success" });
        if (refresh) setRevision((value) => value + 1);
        return result;
      } catch (cause) {
        if (requestLocale === localeRef.current)
          setFlash({
            text:
              cause instanceof Error ? cause.message : t("common.actionFailed"),
            tone: "error",
          });
        return null;
      }
    },
    [t, locale],
  );
  async function changeIdentity(identity_id: string) {
    setSwitching(true);
    const next = await action(
      () => endpoint.switchIdentity(identity_id),
      t("demo.roleChanged"),
      false,
    );
    if (next) {
      setSession(next);
      setAsOf(next.as_of);
      setRevision((value) => value + 1);
      setDemoOpen(false);
    }
    setSwitching(false);
  }
  async function reset() {
    setSwitching(true);
    const next = await action(endpoint.reset, t("demo.resetDone"), false);
    if (next) {
      setSession(next);
      setAsOf(next.as_of);
      setRevision((value) => value + 1);
      setResetOpen(false);
      setDemoOpen(false);
    }
    setSwitching(false);
  }
  async function changeDate(event: React.FormEvent) {
    event.preventDefault();
    const next = await action(
      () => endpoint.date(asOf),
      t("demo.dateDone"),
      false,
    );
    if (next) {
      setSession(next);
      setRevision((value) => value + 1);
    }
  }
  const navigate = (item: Tab) => {
    setTab(item);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  if (!session)
    return (
      <main className="boot">
        <img src="/brand/cq-mark.svg" alt="" width="48" height="48" />
        <h1>Career Quest</h1>
        <Status
          loading={sessionLoad.busy}
          error={sessionLoad.error}
          retry={sessionLoad.refresh}
        />
      </main>
    );
  const primary = tabs.slice(0, 3);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t("common.skipToContent")}
      </a>
      <aside className="sidebar">
        <div className="brand">
          <img src="/brand/cq-mark.svg" alt="" width="36" height="36" />
          <span>Career Quest</span>
        </div>
        <nav aria-label={t("nav.main")}>
          {tabs.map((item) => {
            const Icon = icons[item];
            return (
              <button
                key={item}
                className={`nav-link ${tab === item ? "active" : ""}`}
                onClick={() => navigate(item)}
                aria-current={tab === item ? "page" : undefined}
              >
                <Icon size={20} aria-hidden="true" />
                {t(`nav.${item}`)}
              </button>
            );
          })}
        </nav>
        <button className="sidebar-demo" onClick={() => setDemoOpen(true)}>
          <Settings2 size={18} aria-hidden="true" />
          {t("demo.title")}
        </button>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <button
            className="mobile-menu-button"
            onClick={() => setMenuOpen(true)}
            aria-label={t("nav.openMenu")}
          >
            <Menu size={23} />
          </button>
          <span className="topbar-brand">
            <img src="/brand/cq-mark.svg" alt="" width="28" height="28" />{" "}
            Career Quest
          </span>
          <div className="topbar-right">
            <div className="identity-chip">
              {session.identity.role === "employee" && (
                <strong title={demoIdentityName(session.identity)}>
                  {demoIdentityName(session.identity)}
                </strong>
              )}
              <Tag>{t(`role.${session.identity.role}`)}</Tag>
            </div>
            <label className="locale-picker">
              <span className="sr-only">{t("common.language")}</span>
              <select
                value={locale}
                onChange={(event) =>
                  setLocale(event.target.value as typeof locale)
                }
              >
                <option value="ru">Русский</option>
                <option value="kk">Қазақша</option>
                <option value="en">English</option>
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </label>
            <button
              className="icon-button demo-toggle"
              aria-label={t("demo.title")}
              onClick={() => setDemoOpen(true)}
            >
              <Settings2 size={20} />
            </button>
          </div>
        </header>
        <main id="main-content" className="content">
          <div className="page-heading">
            <div>
              <h1>{t(`nav.${tab}`)}</h1>
              <p>{t(descriptions[tab])}</p>
            </div>
            <span className="as-of">
              {t("common.asOf", { date: formatDate(locale, session.as_of) })}
            </span>
          </div>
          {flash && (
            <div className="flash">
              <Notice tone={flash.tone}>{flash.text}</Notice>
              <button
                className="icon-button"
                aria-label={t("common.dismiss")}
                onClick={() => setFlash(null)}
              >
                <X size={18} />
              </button>
            </div>
          )}
          {tab === "path" && (
            <EmployeePath
              session={session}
              revision={revision}
              action={action}
            />
          )}
          {tab === "quests" && (
            <Quests
              session={session}
              revision={revision}
              action={action}
              seed={questDraft}
            />
          )}
          {tab === "people" && (
            <People
              session={session}
              revision={revision}
              action={action}
              onSwitch={changeIdentity}
            />
          )}
          {tab === "insights" && (
            <Insights revision={revision} action={action} />
          )}
          {tab === "catalog" && <CatalogView />}
          {tab === "external" && (
            <ExternalSearch
              session={session}
              onPropose={(seed) => {
                setQuestDraft(seed);
                navigate("quests");
              }}
            />
          )}
          {tab === "rewards" && (
            <RewardsView revision={revision} action={action} />
          )}
          {tab === "audit" && (
            <AuditView session={session} revision={revision} />
          )}
        </main>
      </div>
      <nav className="mobile-nav" aria-label={t("nav.mobile")}>
        {primary.map((item) => {
          const Icon = icons[item];
          return (
            <button
              key={item}
              className={tab === item ? "active" : ""}
              aria-current={tab === item ? "page" : undefined}
              onClick={() => navigate(item)}
            >
              <Icon size={21} aria-hidden="true" />
              <span>{t(`nav.${item}`)}</span>
            </button>
          );
        })}
        <button
          className={primary.includes(tab) ? "" : "active"}
          onClick={() => setMenuOpen(true)}
        >
          <MoreHorizontal size={21} aria-hidden="true" />
          <span>{t("nav.more")}</span>
        </button>
      </nav>
      {menuOpen && (
        <Dialog title={t("nav.allSections")} onClose={() => setMenuOpen(false)}>
          <div className="menu-list">
            {tabs.map((item) => {
              const Icon = icons[item];
              return (
                <button
                  key={item}
                  className="menu-item"
                  onClick={() => navigate(item)}
                >
                  <Icon size={20} />
                  {t(`nav.${item}`)}
                </button>
              );
            })}
          </div>
          <button
            className="menu-item"
            onClick={() => {
              setMenuOpen(false);
              setDemoOpen(true);
            }}
          >
            <Settings2 size={20} />
            {t("demo.title")}
          </button>
        </Dialog>
      )}
      {demoOpen && (
        <Dialog title={t("demo.title")} onClose={() => setDemoOpen(false)}>
          <div className="form-stack">
            <p className="muted">{t("demo.explanation")}</p>
            <label>
              {t("demo.role")}
              <select
                disabled={switching}
                value={session.identity.id}
                onChange={(event) => changeIdentity(event.target.value)}
              >
                {!session.identities.some(
                  (item) => item.id === session.identity.id,
                ) && (
                  <option value={session.identity.id}>
                    {demoIdentityName(session.identity) ||
                      t(`role.${session.identity.role}`)}
                  </option>
                )}
                {session.identities.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.role === "employee"
                      ? `${demoIdentityName(item)} · ${t(`role.${item.role}`)}`
                      : t(`role.${item.role}`)}
                  </option>
                ))}
              </select>
            </label>
            <form className="form-stack" onSubmit={changeDate}>
              <label>
                {t("demo.date")}
                <input
                  type="date"
                  required
                  value={asOf}
                  onChange={(event) => setAsOf(event.target.value)}
                />
              </label>
              <button
                className="button secondary"
                disabled={switching || asOf === session.as_of}
              >
                {t("demo.applyDate")}
              </button>
            </form>
            <button
              className="button danger"
              onClick={() => {
                setDemoOpen(false);
                setResetOpen(true);
              }}
            >
              <RotateCcw size={18} />
              {t("demo.reset")}
            </button>
          </div>
        </Dialog>
      )}
      {resetOpen && (
        <Dialog title={t("demo.reset")} onClose={() => setResetOpen(false)}>
          <p>{t("demo.resetQuestion")}</p>
          <div className="dialog-actions">
            <button
              className="button secondary"
              onClick={() => setResetOpen(false)}
            >
              {t("common.cancel")}
            </button>
            <button
              className="button danger"
              disabled={switching}
              onClick={reset}
            >
              {t("demo.reset")}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>,
);

import { Gift } from "lucide-react";
import { endpoint } from "../api";
import { useI18n } from "../i18n";
import {
  DataTable,
  Empty,
  Notice,
  Panel,
  Status,
  formatDate,
  formatNum,
  type Action,
  useLoad,
} from "../ui";

const asText = (value: unknown) => (value == null ? "" : String(value));
export function RewardsView({
  revision,
  action,
}: {
  revision: number;
  action: Action;
}) {
  const { locale, t, catalogText } = useI18n();
  const load = useLoad(endpoint.rewards, [revision]);
  const num = (value: number | null | undefined) => formatNum(locale, value);
  return (
    <>
      <Status loading={load.busy} error={load.error} retry={load.refresh} />
      {load.data && (
        <>
          <section className="reward-summary">
            <Gift size={28} aria-hidden="true" />
            <div>
              <span>{t("rewards.balance")}</span>
              <strong>{num(load.data.balance)} XP</strong>
              <small>
                {t("rewards.earned", { amount: num(load.data.earned) })}
              </small>
            </div>
          </section>
          <div className="content-grid">
            <Panel title={t("rewards.available")}>
              {load.data.items.length ? (
                <div className="reward-list">
                  {load.data.items.map((item) => (
                    <div className="reward-row" key={item.id}>
                      <div>
                        <h3>{catalogText(item.id, "title", item.title)}</h3>
                        <p>
                          {catalogText(
                            item.id,
                            "description",
                            item.description,
                          )}
                        </p>
                        <strong>{num(item.cost)} XP</strong>
                      </div>
                      <div>
                        {load.data!.balance < item.cost && (
                          <p className="field-hint">
                            {t("rewards.insufficient")}
                          </p>
                        )}
                        <button
                          className="button secondary small"
                          disabled={load.data!.balance < item.cost}
                          onClick={() =>
                            action(
                              () => endpoint.redeem(item.id),
                              t("rewards.requested"),
                            )
                          }
                        >
                          {t("rewards.redeem")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty title={t("common.empty")} />
              )}
            </Panel>
            <Panel title={t("rewards.history")}>
              <DataTable
                rows={load.data.ledger}
                empty={t("common.empty")}
                columns={[
                  {
                    key: "date",
                    title: t("common.date"),
                    render: (row) =>
                      formatDate(
                        locale,
                        asText(row.created_at ?? row.at ?? row.date),
                      ),
                  },
                  {
                    key: "action",
                    title: t("common.action"),
                    render: (row) =>
                      t(
                        Number(row.amount) >= 0
                          ? "ledger.earned"
                          : "ledger.redeemed",
                      ),
                  },
                  {
                    key: "amount",
                    title: t("rewards.points"),
                    render: (row) => num(Number(row.amount ?? row.delta ?? 0)),
                  },
                  {
                    key: "reason",
                    title: t("common.reason"),
                    render: (row) =>
                      row.reward_id
                        ? catalogText(
                            asText(row.reward_id),
                            "title",
                            asText(row.reward_id),
                          )
                        : asText(row.reason ?? row.source ?? row.source_id),
                  },
                ]}
              />
            </Panel>
          </div>
          <Notice>{t("rewards.disclaimer")}</Notice>
        </>
      )}
    </>
  );
}

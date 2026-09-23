import { localeNames, useI18n, type Locale } from "./i18n";
import { Select } from "./Select";

export function LanguagePicker() {
  const { locale, setLocale, t } = useI18n();
  return (
    <Select<Locale>
      label={t("common.language")}
      options={(["ru", "kk", "en"] as Locale[]).map((value) => ({
        value,
        label: localeNames[value],
      }))}
      value={locale}
      onChange={setLocale}
      searchable={false}
    />
  );
}

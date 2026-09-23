import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import { localeNames, useI18n, type Locale } from "./i18n";

const languages: Locale[] = ["ru", "kk", "en"];

export function LanguagePicker() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(languages.indexOf(locale));
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useLayoutEffect(() => {
    if (open) optionRefs.current[active]?.focus();
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function choose(next: Locale) {
    setLocale(next);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const key = event.key;
    if (key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (key === "Tab") {
      setOpen(false);
    } else if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      setActive(
        (index) =>
          (index + (key === "ArrowDown" ? 1 : -1) + languages.length) %
          languages.length,
      );
    } else if (key === "Home" || key === "End") {
      event.preventDefault();
      setActive(key === "Home" ? 0 : languages.length - 1);
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      choose(languages[active]);
    }
  }

  return (
    <div className="locale-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="locale-trigger"
        aria-label={`${t("common.language")}: ${localeNames[locale]}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setActive(languages.indexOf(locale));
          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setActive(languages.indexOf(locale));
            setOpen(true);
          }
        }}
      >
        <span>{localeNames[locale]}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={id}
          className="locale-options"
          role="listbox"
          aria-label={t("common.language")}
          onKeyDown={onListKeyDown}
        >
          {languages.map((language, index) => (
            <button
              key={language}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              type="button"
              role="option"
              aria-selected={language === locale}
              tabIndex={index === active ? 0 : -1}
              className={`locale-option ${language === locale ? "selected" : ""}`}
              onFocus={() => setActive(index)}
              onClick={() => choose(language)}
            >
              <span>{localeNames[language]}</span>
              {language === locale && <Check size={16} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

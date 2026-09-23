import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, ChevronDown } from "lucide-react";
import { useI18n } from "./i18n";

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export function Select<T extends string = string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  required = false,
  name,
  placeholder,
  searchable,
}: {
  label: string;
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  placeholder?: string;
  searchable?: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const hasSearch = searchable ?? options.length > 8;
  const visible =
    hasSearch && query
      ? options.filter((option) =>
          option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
        )
      : options;
  const selected = options.find((option) => option.value === value);

  useLayoutEffect(() => {
    if (!open) return;
    if (hasSearch) search.current?.focus();
    else optionRefs.current[active]?.focus();
    // Opening focus is intentionally independent of active-option changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function start() {
    const bounds = root.current?.getBoundingClientRect();
    setAbove(
      Boolean(
        bounds && window.innerHeight - bounds.bottom < 280 && bounds.top > 280,
      ),
    );
    const current = options.findIndex(
      (option) => option.value === value && !option.disabled,
    );
    setQuery("");
    setActive(
      current >= 0
        ? current
        : Math.max(
            0,
            options.findIndex((option) => !option.disabled),
          ),
    );
    setOpen(true);
  }

  function move(direction: "next" | "previous" | "first" | "last") {
    if (!visible.length) return;
    let next = active;
    if (direction === "first")
      next = visible.findIndex((item) => !item.disabled);
    else if (direction === "last") {
      next = visible.length - 1;
      while (next >= 0 && visible[next].disabled) next -= 1;
    } else {
      const step = direction === "next" ? 1 : -1;
      for (let count = 0; count < visible.length; count += 1) {
        next = (next + step + visible.length) % visible.length;
        if (!visible[next].disabled) break;
      }
    }
    if (next < 0 || visible[next]?.disabled) return;
    setActive(next);
    requestAnimationFrame(() => optionRefs.current[next]?.focus());
  }

  function choose(option: SelectOption<T>) {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
    setQuery("");
    trigger.current?.focus();
  }

  function onPopupKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (event.target === search.current)
        move(event.key === "ArrowDown" ? "first" : "last");
      else move(event.key === "ArrowDown" ? "next" : "previous");
    } else if (
      (event.key === "Home" || event.key === "End") &&
      event.target !== search.current
    ) {
      event.preventDefault();
      move(event.key === "Home" ? "first" : "last");
    } else if (
      event.key === "Enter" ||
      (event.key === " " && event.target !== search.current)
    ) {
      event.preventDefault();
      const option = visible[active];
      if (option) choose(option);
    }
  }

  return (
    <div className="select-control" ref={root}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        ref={trigger}
        type="button"
        role="combobox"
        className="select-trigger"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : start())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) start();
          }
        }}
      >
        <span>{selected?.label ?? placeholder ?? t("common.select")}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          className={`select-popup ${above ? "above" : ""}`}
          onKeyDown={onPopupKeyDown}
        >
          {hasSearch && (
            <input
              ref={search}
              type="search"
              className="select-search"
              aria-label={t("common.search")}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
            />
          )}
          <div
            id={id}
            className="select-options"
            role="listbox"
            aria-label={label}
          >
            {visible.map((option, index) => (
              <button
                key={option.value}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                type="button"
                role="option"
                aria-selected={option.value === value}
                tabIndex={index === active ? 0 : -1}
                className={`select-option ${option.value === value ? "selected" : ""}`}
                disabled={option.disabled}
                onFocus={() => setActive(index)}
                onClick={() => choose(option)}
              >
                <span>{option.label}</span>
                {option.value === value && (
                  <Check size={16} aria-hidden="true" />
                )}
              </button>
            ))}
            {!visible.length && (
              <span className="select-empty">{t("common.empty")}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

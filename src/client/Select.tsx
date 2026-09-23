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
  const [placement, setPlacement] = useState({ above: false, maxHeight: 300 });
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

  function fitPopup() {
    const bounds = root.current?.getBoundingClientRect();
    if (!bounds) return;
    const dialog = root.current?.closest("dialog");
    const dialogBounds = dialog?.getBoundingClientRect();
    const dialogStyle = dialog ? getComputedStyle(dialog) : null;
    const viewportTop = window.visualViewport?.offsetTop ?? 0;
    const viewportBottom =
      viewportTop + (window.visualViewport?.height ?? window.innerHeight);
    const top = Math.max(
      viewportTop + 8,
      dialogBounds
        ? dialogBounds.top + (parseFloat(dialogStyle?.paddingTop ?? "0") || 8)
        : viewportTop + 8,
    );
    const bottom = Math.min(
      viewportBottom - 8,
      dialogBounds
        ? dialogBounds.bottom -
            (parseFloat(dialogStyle?.paddingBottom ?? "0") || 8)
        : viewportBottom - 8,
    );
    const aboveSpace = Math.max(0, bounds.top - top - 6);
    const belowSpace = Math.max(0, bottom - bounds.bottom - 6);
    const desiredHeight =
      8 + (hasSearch ? 52 : 0) + Math.min(options.length * 48, 300);
    const above = belowSpace < desiredHeight && aboveSpace > belowSpace;
    setPlacement({
      above,
      maxHeight: Math.max(44, Math.floor(above ? aboveSpace : belowSpace)),
    });
  }

  function start() {
    fitPopup();
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
      const scope = trigger.current?.closest("dialog") ?? document;
      const controls = Array.from(
        scope.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) =>
          element.getClientRects().length > 0 &&
          (!root.current?.contains(element) || element === trigger.current),
      );
      const current = trigger.current ? controls.indexOf(trigger.current) : -1;
      const next = controls[current + (event.shiftKey ? -1 : 1)];
      if (next) {
        event.preventDefault();
        next.focus();
      }
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
        aria-describedby={`${id}-value`}
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
        <span id={`${id}-value`}>
          {selected?.label ?? placeholder ?? t("common.select")}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          className={`select-popup ${placement.above ? "above" : ""}`}
          style={{ maxHeight: placement.maxHeight }}
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

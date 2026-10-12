import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import styles from "./FilterSelect.module.css";

export interface FilterOption {
  /** Shown beside the label, e.g. how many assets the choice has. */
  count?: number;
  label: string;
  value: string;
}

interface FilterSelectProps {
  /** Label of the "no filter" choice, listed first. */
  allLabel?: string;
  /** Adds a type-to-narrow box at the top of the list, for long lists. */
  isSearchable?: boolean;
  label: string;
  onChange: (value: string | null) => void;
  options: FilterOption[];
  /** The chosen option's value, or null for no filter. */
  value: string | null;
}

interface MenuPosition {
  left: number;
  maxHeight: number;
  minWidth: number;
  top: number;
}

const MENU_MAX_HEIGHT = 280;

/**
 * A drop-down in the app's own style: one row showing the filter's name
 * and current choice, opening a list to pick from. Works with the mouse
 * or the keyboard (arrows, Enter, Escape).
 */
export function FilterSelect({
  allLabel = "ALL",
  isSearchable = false,
  label,
  onChange,
  options,
  value
}: FilterSelectProps) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const choices: FilterOption[] = [{ label: allLabel, value: "" }, ...options];
  const selected = choices.find((choice) => choice.value === (value ?? "")) ?? choices[0];
  const normalizedQuery = query.trim().toLowerCase();
  const visibleChoices = normalizedQuery
    ? choices.filter((choice) => choice.label.toLowerCase().includes(normalizedQuery))
    : choices;

  function open() {
    const rect = buttonRef.current?.getBoundingClientRect();

    // Fixed to the viewport so the list is not clipped by the rail it sits in.
    if (rect) {
      setPosition({
        left: rect.left,
        maxHeight: Math.max(120, Math.min(MENU_MAX_HEIGHT, window.innerHeight - rect.bottom - 12)),
        minWidth: rect.width,
        top: rect.bottom + 2
      });
    }

    setQuery("");
    setActiveIndex(Math.max(0, choices.indexOf(selected)));
    setIsOpen(true);
  }

  function close({ returnFocus = false } = {}) {
    setIsOpen(false);

    if (returnFocus) {
      buttonRef.current?.focus();
    }
  }

  function choose(choice: FilterOption) {
    onChange(choice.value || null);
    close({ returnFocus: true });
  }

  // While open: a click anywhere else, or the page moving under the list, closes it.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleViewportChange(event: Event) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.getElementById(`${id}-option-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" });
    }
  }, [activeIndex, id, isOpen]);

  function handleKeyDown(event: KeyboardEvent) {
    if (!isOpen) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        open();
      }

      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        Math.max(0, Math.min(visibleChoices.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)))
      );
    } else if (event.key === "Enter") {
      event.preventDefault();

      if (visibleChoices[activeIndex]) {
        choose(visibleChoices[activeIndex]);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      close({ returnFocus: true });
    } else if (event.key === "Tab") {
      close();
    }
  }

  return (
    <div className={styles.filterSelect} ref={rootRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`${label}: ${selected.label}`}
        className={value === null ? styles.trigger : styles.triggerActive}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={handleKeyDown}
        ref={buttonRef}
        type="button"
      >
        <span className={styles.triggerLabel}>{label}</span>
        <span className={styles.triggerValue}>{selected.label}</span>
        <span aria-hidden="true" className={styles.caret}>
          {isOpen ? "▴" : "▾"}
        </span>
      </button>

      {isOpen && position ? (
        <div
          className={styles.menu}
          style={{ left: position.left, maxHeight: position.maxHeight, minWidth: position.minWidth, top: position.top }}
        >
          {isSearchable ? (
            <input
              aria-activedescendant={`${id}-option-${activeIndex}`}
              aria-label={`Narrow the ${label.toLowerCase()} list`}
              autoComplete="off"
              autoFocus
              className={styles.search}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="TYPE TO NARROW"
              type="text"
              value={query}
            />
          ) : null}
          <ul aria-label={label} className={styles.options} role="listbox">
            {visibleChoices.map((choice, index) => (
              <li
                aria-selected={choice.value === selected.value}
                className={
                  index === activeIndex
                    ? styles.optionActive
                    : choice.value === selected.value
                      ? styles.optionSelected
                      : styles.option
                }
                id={`${id}-option-${index}`}
                key={choice.value}
                onClick={() => choose(choice)}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
              >
                <span className={styles.optionLabel}>{choice.label}</span>
                {choice.count !== undefined ? <span className={styles.optionCount}>{choice.count}</span> : null}
              </li>
            ))}
            {visibleChoices.length === 0 ? <li className={styles.empty}>NO MATCHES</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

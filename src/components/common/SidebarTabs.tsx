import styles from "./SidebarTabs.module.css";

export interface SidebarTabOption<TValue extends string> {
  value: TValue;
  label: string;
  badge?: string;
}

interface SidebarTabsProps<TValue extends string> {
  ariaLabel: string;
  active: TValue;
  options: SidebarTabOption<TValue>[];
  onChange: (value: TValue) => void;
}

/**
 * Strict terminal-style segmented control. Renders flat buttons separated by
 * a single divider row; the active tab is marked by an amber 2px bottom
 * border (matching the design-system tab pattern in HeaderBar). No rounded
 * corners, no fill state on hover — text-only color shift.
 */
export function SidebarTabs<TValue extends string>({
  ariaLabel,
  active,
  options,
  onChange
}: SidebarTabsProps<TValue>) {
  return (
    <div
      aria-label={ariaLabel}
      className={styles.tabs}
      role="tablist"
    >
      {options.map((option) => {
        const isActive = option.value === active;
        return (
          <button
            aria-selected={isActive}
            className={isActive ? styles.tabActive : styles.tab}
            key={option.value}
            onClick={() => onChange(option.value)}
            role="tab"
            type="button"
          >
            <span className={styles.tabLabel}>{option.label}</span>
            {option.badge ? <span className={styles.tabBadge}>{option.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

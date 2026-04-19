import { useEffect, useState } from "react";
import { Panel } from "../components/common/Panel";
import styles from "./NotesPage.module.css";

const STORAGE_KEY = "atlas.notes.v1";

interface NotesPageProps {
  /** Called after every save so the parent can append an activity log entry. */
  onNoteSaved?: (byteCount: number) => void;
}

/**
 * Per-session scratchpad persisted to localStorage. No cloud sync,
 * no formatting, no backlinks — the point is a zero-friction place
 * to park a thought while you're in the middle of analysis. If the
 * user wants richer note-taking that belongs in a dedicated tool,
 * not bolted into a monitoring terminal.
 */
export function NotesPage({ onNoteSaved }: NotesPageProps) {
  const [content, setContent] = useState<string>("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Load on mount. Guard the access so SSR / non-browser test envs
  // (jsdom provides localStorage, but we still defend the happy path).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setContent(stored);
      }
    } catch {
      // Ignore — notes fall back to an empty buffer on load errors.
    }
  }, []);

  // Persist on change, debounced via rAF-ish setTimeout so rapid
  // typing doesn't thrash localStorage.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, content);
        const now = new Date().toISOString().slice(11, 19);
        setSavedAt(now);
        onNoteSaved?.(content.length);
      } catch {
        // Quota exceeded or storage disabled — show a stale `savedAt`.
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [content, onNoteSaved]);

  return (
    <div className={styles.page}>
      <Panel
        badge={savedAt ? `SAVED ${savedAt} · ${content.length} CHARS` : "UNSAVED"}
        title="SCRATCHPAD"
      >
        <textarea
          aria-label="Terminal notes scratchpad"
          className={styles.textarea}
          onChange={(event) => setContent(event.target.value)}
          placeholder="HYPOTHESES, PROMPTS, SYMBOLS TO REMEMBER..."
          spellCheck={false}
          value={content}
        />
      </Panel>
      <div className={styles.footer}>
        <span className={styles.footerLabel}>STORAGE</span>
        <span>localStorage · {STORAGE_KEY}</span>
        <span className={styles.separator}>|</span>
        <span>Autosave ≈ 300ms debounce</span>
      </div>
    </div>
  );
}

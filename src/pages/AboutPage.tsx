import { Panel } from "../components/common/Panel";
import styles from "./AboutPage.module.css";

/**
 * Static ABOUT page — project thesis, scope, and non-goals. Rendered
 * as plain prose inside a terminal-aesthetic panel. Content is
 * curated and lives in this file rather than a JSON doc because it
 * changes only on product-direction shifts, not on data refresh.
 */
export function AboutPage() {
  return (
    <div className={styles.page}>
      <Panel title="ATLAS / ABOUT">
        <div className={styles.lede}>
          <span className={styles.ledeTitle}>
            A MIDDLE EAST ENERGY INFRASTRUCTURE INTELLIGENCE TERMINAL
          </span>
          <span className={styles.ledeSubtitle}>
            Bloomberg MAP + FIRMS + JODI + oil analytics — free, open-source, focused on one region with real depth.
          </span>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>THESIS</h2>
          <p className={styles.body}>
            Given a disruption at chokepoint or asset X, what breaks in the
            physical supply chain, for how long, which refineries lose
            feedstock, and does the forward curve already know? Atlas answers
            that question in many forms — the map, the bypass scenario, the
            outage log, the market tape, the risk feed.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>SCOPE</h2>
          <ul className={styles.list}>
            <li>
              <span className={styles.listGlyph}>●</span>
              Geography: Middle East + adjacent transit corridors (Red Sea,
              Turkish Straits, Eastern Mediterranean).
            </li>
            <li>
              <span className={styles.listGlyph}>●</span>
              Assets: refineries, pipelines, oil &amp; gas fields, export
              terminals, chokepoints.
            </li>
            <li>
              <span className={styles.listGlyph}>●</span>
              Surfaces: a 3-column map workspace, a market tape, a
              quantitative bypass model, a risk/event feed, a FIRMS
              thermal-anomaly layer with a detection-count baseline.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>NON-GOALS</h2>
          <ul className={styles.list}>
            <li>
              <span className={styles.listGlyph}>○</span>
              Global coverage. Other terminals do that better — depth over breadth.
            </li>
            <li>
              <span className={styles.listGlyph}>○</span>
              A trading system. No order routing, no PnL, no portfolio accounting.
            </li>
            <li>
              <span className={styles.listGlyph}>○</span>
              A news aggregator. Event timelines are curated where they earn their place in the model.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>DATA INTEGRITY</h2>
          <p className={styles.body}>
            Every surface shows its source and last update timestamp. Live
            feeds fall back to static snapshots when API keys are missing,
            clearly labelled. Model outputs cite their constants. No
            fabrication — an unknown value renders as{" "}
            <code className={styles.code}>--</code>, never as a plausible-looking number.
          </p>
        </section>
      </Panel>
    </div>
  );
}

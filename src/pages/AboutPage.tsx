import type { DatasetCatalogEntry } from "../types/Infrastructure";
import styles from "./AboutPage.module.css";

interface AboutPageProps {
  /** Loaded layers; their source, licence and download date come from the data files. */
  catalog: DatasetCatalogEntry[];
}

export function AboutPage({ catalog }: AboutPageProps) {
  return (
    <div className={styles.page}>
      <div className={styles.lede}>
        <h1 className={styles.ledeTitle}>ATLAS / ABOUT</h1>
        <p className={styles.ledeSubtitle}>
          A map of Middle East oil and gas infrastructure, built from open datasets as a student project.
        </p>
      </div>

      <div className={styles.columns}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>HOW TO READ THE MAP</h2>
          <ul className={styles.list}>
            <li>Shape is the kind of asset: diamond refinery, triangle LNG terminal, dot field, line pipeline.</li>
            <li>Colour is the energy it handles: crude oil, natural gas, NGL, or mixed oil and gas.</li>
            <li>Refineries and LNG terminals are sized by capacity.</li>
            <li>Faded assets are proposed, under construction, idle or retired.</li>
            <li>A dashed pipeline stretch is a straight line between two places. The source gives where the pipeline
              starts and ends, not its route.</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>DATA SOURCES</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>LAYER</th>
                  <th>SOURCE</th>
                  <th>LICENCE</th>
                  <th>DOWNLOADED</th>
                  <th className={styles.numericCell}>RECORDS</th>
                </tr>
              </thead>
              <tbody>
                {catalog.map((dataset) => (
                  <tr key={dataset.id}>
                    <td className={styles.layerCell}>{dataset.title}</td>
                    <td>
                      {dataset.sourceUrl ? (
                        <a className={styles.link} href={dataset.sourceUrl} rel="noreferrer" target="_blank">
                          {dataset.source}
                        </a>
                      ) : (
                        dataset.source
                      )}
                    </td>
                    <td>{dataset.license ?? "--"}</td>
                    <td>{dataset.downloadDate}</td>
                    <td className={styles.numericCell}>{dataset.recordCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.body}>
            Basemaps: dark map © CARTO and © OpenStreetMap contributors; satellite imagery © Mapbox.
          </p>
        </section>
      </div>
    </div>
  );
}

import type { CrudeGrade, CrudeGradeSnapshot } from "../types/CrudeGrade";

// Middle East crude-grade reference table — P0 #11 in CLAUDE.md. Served
// from a checked-in static snapshot; there is no live equivalent (assay
// data only moves when operators publish new fact sheets, which is
// measured in months). Mode is always STATIC_SNAPSHOT so downstream UI
// can badge the table honestly per Data Integrity Rule #6.

const STATIC_SNAPSHOT_PATH = "/data/reference/crude_grades.json";

export async function loadCrudeGradeSnapshot(): Promise<CrudeGradeSnapshot> {
  const response = await fetch(STATIC_SNAPSHOT_PATH);

  if (!response.ok) {
    throw new Error(`Failed to load crude grade snapshot: ${response.status}`);
  }

  const payload = (await response.json()) as CrudeGradeSnapshot;
  const grades = normaliseGrades(payload.grades);

  if (grades.length === 0) {
    throw new Error("Crude grade snapshot is empty");
  }

  return {
    asOf: payload.asOf,
    mode: "STATIC_SNAPSHOT",
    source: payload.source,
    grades
  };
}

function normaliseGrades(raw: CrudeGrade[] | undefined): CrudeGrade[] {
  if (!raw) {
    return [];
  }

  return raw.filter((grade) => {
    return (
      typeof grade.id === "string" &&
      grade.id.length > 0 &&
      Number.isFinite(grade.apiGravity) &&
      Number.isFinite(grade.sulfurPct) &&
      Number.isFinite(grade.productionMbpd)
    );
  });
}

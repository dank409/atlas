import type { CrudeGrade, CrudeGradeSnapshot } from "../types/CrudeGrade";

// A small reference table kept in the repo; each grade names its own source.
const SNAPSHOT_PATH = "/data/reference/crude_grades.json";

export async function loadCrudeGradeSnapshot(): Promise<CrudeGradeSnapshot> {
  const response = await fetch(SNAPSHOT_PATH);

  if (!response.ok) {
    throw new Error(`Failed to load crude grade snapshot: ${response.status}`);
  }

  const payload = (await response.json()) as Partial<CrudeGradeSnapshot>;
  const grades = (payload.grades ?? []).filter(isCompleteGrade);

  if (grades.length === 0) {
    throw new Error("Crude grade snapshot is empty");
  }

  return {
    grades,
    source: payload.source ?? "--"
  };
}

// Rows missing an id or a numeric assay value are dropped rather than
// shown with a made-up zero.
function isCompleteGrade(grade: CrudeGrade) {
  return (
    typeof grade.id === "string" &&
    grade.id.length > 0 &&
    Number.isFinite(grade.apiGravity) &&
    Number.isFinite(grade.sulfurPct)
  );
}

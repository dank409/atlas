export interface CrudeGrade {
  id: string;
  name: string;
  producer: string;
  producerIso: string;
  apiGravity: number;
  sulfurPct: number;
  note: string;
  /** Where the API gravity and sulfur figures come from. */
  source: string;
}

export interface CrudeGradeSnapshot {
  source: string;
  grades: CrudeGrade[];
}

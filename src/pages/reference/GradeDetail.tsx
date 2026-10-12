import { DetailCard } from "../../components/common/DetailCard";
import type { CrudeGrade } from "../../types/CrudeGrade";
import type { InfrastructureAsset } from "../../types/Infrastructure";
import type { NavigateReference } from "../../types/View";
import { AssetLinkList, DetailSection, LinkChips } from "./referenceParts";

interface GradeDetailProps {
  /** Country code of the producer, when it has a country entry to link to. */
  countryCode: string | null;
  grade: CrudeGrade;
  /** Map assets in the producing country whose names appear in the grade's note. */
  mentionedAssets: InfrastructureAsset[];
  onNavigate: NavigateReference;
  onSelectAsset: (asset: InfrastructureAsset) => void;
  /** Other grades from the same producer. */
  siblingGrades: CrudeGrade[];
}

// Glossary entries that explain the fields on this card.
const RELATED_TERMS = ["API gravity", "Sulfur content"];

export function GradeDetail({
  countryCode,
  grade,
  mentionedAssets,
  onNavigate,
  onSelectAsset,
  siblingGrades
}: GradeDetailProps) {
  return (
    <DetailCard
      footer={`SOURCE: ${grade.source}`}
      kind="CRUDE GRADE"
      name={grade.name}
      rows={[
        {
          label: "Producer",
          onClick: countryCode ? () => onNavigate("countries", countryCode) : undefined,
          value: grade.producer
        },
        { label: "API gravity", value: `${grade.apiGravity.toFixed(1)}°` },
        { label: "Sulfur", value: `${grade.sulfurPct.toFixed(2)}%` },
        { isProse: true, label: "Note", value: grade.note }
      ]}
    >
      {mentionedAssets.length > 0 ? (
        <DetailSection title="NAMED IN THE NOTE, ON THE MAP">
          <AssetLinkList assets={mentionedAssets} limit={8} onSelectAsset={onSelectAsset} showType />
        </DetailSection>
      ) : null}

      <DetailSection title={`OTHER GRADES FROM ${grade.producer.toUpperCase()}`}>
        <LinkChips
          chips={siblingGrades.map((sibling) => ({
            id: sibling.id,
            label: sibling.name,
            onClick: () => onNavigate("grades", sibling.id)
          }))}
          emptyText="None in the table."
        />
      </DetailSection>

      <DetailSection title="TERMS EXPLAINED IN THE GLOSSARY">
        <LinkChips
          chips={RELATED_TERMS.map((term) => ({
            id: term,
            label: term,
            onClick: () => onNavigate("glossary", term)
          }))}
          emptyText="--"
        />
      </DetailSection>
    </DetailCard>
  );
}

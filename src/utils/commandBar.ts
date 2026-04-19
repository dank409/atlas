import type { DatasetId, InfrastructureAsset } from "../types/Infrastructure";
import type { ViewMode } from "../types/View";

export type TerminalCommandResolution =
  | {
      activityLabel: string;
      kind: "asset";
      assetId: string;
    }
  | {
      activityLabel: string;
      datasetId: DatasetId;
      kind: "dataset";
    }
  | {
      activityLabel: string;
      kind: "view";
      view: ViewMode;
    };

const VIEW_COMMANDS: Record<string, ViewMode> = {
  map: "map",
  markets: "markets",
  mkt: "markets",
  flows: "flows",
  chokes: "chokes",
  chokepoints: "chokes",
  events: "events",
  models: "models",
  scenario: "models",
  ais: "ais",
  alerts: "alerts",
  notes: "notes",
  ref: "reference",
  reference: "reference",
  grades: "reference",
  about: "about",
  data: "data"
};

const DATASET_COMMANDS: Array<{
  aliases: string[];
  datasetId: DatasetId;
  kindLabel: string;
}> = [
  { aliases: ["ref", "refinery", "refineries"], datasetId: "refineries", kindLabel: "REFINERY" },
  { aliases: ["pipe", "pipeline", "pipelines"], datasetId: "pipelines", kindLabel: "PIPELINE" },
  { aliases: ["fld", "field", "fields"], datasetId: "fields", kindLabel: "FIELD" },
  { aliases: ["lng", "term", "terminal", "terminals"], datasetId: "terminals", kindLabel: "TERMINAL" },
  { aliases: ["cp", "choke", "chokepoint", "chokepoints"], datasetId: "chokepoints", kindLabel: "CHOKEPOINT" }
];

export function resolveTerminalCommand(
  input: string,
  assets: InfrastructureAsset[]
): TerminalCommandResolution | null {
  const normalized = input.trim().replace(/\s+/g, " ").toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized in VIEW_COMMANDS) {
    const view = VIEW_COMMANDS[normalized];
    const activityLabel = `OPEN ${view.toUpperCase()}`;

    return {
      activityLabel,
      kind: "view",
      view
    };
  }

  const [commandToken, ...restTokens] = normalized.split(" ");
  const datasetCommand = DATASET_COMMANDS.find(({ aliases }) => aliases.includes(commandToken));

  if (!datasetCommand) {
    return null;
  }

  const query = restTokens.join(" ").trim();

  if (!query) {
    return {
      activityLabel: `FOCUS DATASET ${datasetCommand.datasetId.toUpperCase()}`,
      datasetId: datasetCommand.datasetId,
      kind: "dataset"
    };
  }

  const match = assets.find((asset) => {
    if (asset.datasetId !== datasetCommand.datasetId) {
      return false;
    }

    return [asset.name, asset.countryName, asset.country]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  if (!match) {
    return null;
  }

  // Avoid stuttering labels like "SELECT REFINERY RUWAIS REFINERY" when the
  // asset name already includes its kind.
  const upperName = match.name.toUpperCase();
  const activityLabel = upperName.includes(datasetCommand.kindLabel)
    ? `SELECT ${upperName}`
    : `SELECT ${datasetCommand.kindLabel} ${upperName}`;

  return {
    activityLabel,
    assetId: match.id,
    kind: "asset"
  };
}

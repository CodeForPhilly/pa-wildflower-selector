import type { Plant, PlacedPlant } from '../types/garden';
import type {
  GardenDesignV1,
  GardenDesignPlacementV1,
  GardenDesignPlantMetaV1,
} from '../types/gardenDesign';

export const GARDEN_DESIGN_SCHEMA = 'choose-native-plants.garden-design' as const;
export const GARDEN_DESIGN_VERSION = 1 as const;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);

const isString = (v: unknown): v is string => typeof v === 'string';

const coerceSnapIncrement = (v: unknown): number | undefined => {
  if (!isFiniteNumber(v)) return undefined;
  // Only support planner snap settings.
  if (v === 1 || v === 1.0) return 1.0;
  if (v === 0.5) return 0.5;
  return undefined;
};

/**
 * Make import tolerant of common LLM formatting issues:
 * - Markdown code fences (```json ... ```)
 * - Leading/trailing commentary
 */
export function extractJsonObjectText(input: string): string {
  const text = String(input ?? '').trim();
  if (!text) return '';

  // Strip common markdown code fences if the entire payload is fenced.
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) return fenced[1].trim();

  // If there is surrounding text, try extracting the first {...} block.
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1).trim();
  }

  return text;
}

export function roundToIncrement(value: number, inc: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(inc) || inc <= 0) return value;
  return Math.round(value / inc) * inc;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function buildGardenDesignV1(args: {
  gridWidthFt: number;
  gridHeightFt: number;
  snapIncrementFt: number;
  favoriteIds: string[];
  favoritePlants?: Plant[];
  placedPlants: PlacedPlant[];
  name?: string;
}): GardenDesignV1 {
  const plantsMeta: GardenDesignPlantMetaV1[] | undefined = args.favoritePlants?.length
    ? args.favoritePlants.map((p) => {
        const spreadNum = parseFloat(String(p['Spread (feet)']));
        const heightNum = parseFloat(String(p['Height (feet)']));
        return {
          plantId: p._id,
          commonName: String(p['Common Name'] ?? ''),
          scientificName: p['Scientific Name'] ? String(p['Scientific Name']) : undefined,
          family: p['Plant Family'] ? String(p['Plant Family']) : undefined,
          spreadFt: Number.isFinite(spreadNum) && spreadNum > 0 ? spreadNum : undefined,
          heightFt: Number.isFinite(heightNum) && heightNum > 0 ? heightNum : undefined,
        };
      })
    : undefined;

  const placements: GardenDesignPlacementV1[] = args.placedPlants.map((pp) => ({
    plantId: pp.plantId,
    centerXFt: pp.x + pp.width / 2,
    centerYFt: pp.y + pp.height / 2,
    sizeFt: pp.width, // width==height in this planner
  }));

  return {
    schema: GARDEN_DESIGN_SCHEMA,
    version: GARDEN_DESIGN_VERSION,
    name: args.name,
    createdAt: new Date().toISOString(),
    grid: {
      widthFt: args.gridWidthFt,
      heightFt: args.gridHeightFt,
      snapIncrementFt: args.snapIncrementFt,
    },
    favorites: args.favoriteIds,
    plants: plantsMeta,
    placements,
  };
}

export function stringifyGardenDesign(design: GardenDesignV1): string {
  return JSON.stringify(design, null, 2);
}

export function parseGardenDesignV1(text: string): { design: GardenDesignV1 } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonObjectText(text));
  } catch {
    return { error: 'Invalid JSON.' };
  }

  if (!isRecord(parsed)) return { error: 'Design must be a JSON object.' };
  if (parsed.schema !== GARDEN_DESIGN_SCHEMA) return { error: `Unsupported schema. Expected "${GARDEN_DESIGN_SCHEMA}".` };
  if (parsed.version !== 1) return { error: 'Unsupported version. Expected 1.' };

  const grid = parsed.grid;
  if (!isRecord(grid)) return { error: 'Missing or invalid "grid".' };
  if (!isFiniteNumber(grid.widthFt) || grid.widthFt <= 0) return { error: '"grid.widthFt" must be a positive number.' };
  if (!isFiniteNumber(grid.heightFt) || grid.heightFt <= 0) return { error: '"grid.heightFt" must be a positive number.' };
  if (grid.widthFt > 100 || grid.heightFt > 100) return { error: 'Grid dimensions must be at most 100ft × 100ft.' };

  const placementsRaw = parsed.placements;
  if (!Array.isArray(placementsRaw)) return { error: 'Missing or invalid "placements" array.' };
  for (const [i, p] of placementsRaw.entries()) {
    if (!isRecord(p)) return { error: `placements[${i}] must be an object.` };
    if (!isString(p.plantId) || !p.plantId) return { error: `placements[${i}].plantId must be a non-empty string.` };
    if (!isFiniteNumber(p.centerXFt)) return { error: `placements[${i}].centerXFt must be a number.` };
    if (!isFiniteNumber(p.centerYFt)) return { error: `placements[${i}].centerYFt must be a number.` };
    if (p.sizeFt !== undefined && (!isFiniteNumber(p.sizeFt) || p.sizeFt <= 0)) {
      return { error: `placements[${i}].sizeFt must be a positive number (or omitted).` };
    }
  }

  const favoritesRaw = parsed.favorites;
  if (favoritesRaw !== undefined) {
    if (!Array.isArray(favoritesRaw) || favoritesRaw.some((f) => !isString(f) || !f)) {
      return { error: '"favorites" must be an array of plantId strings (or omitted).' };
    }
  }

  const snap = coerceSnapIncrement(grid.snapIncrementFt);
  const design: GardenDesignV1 = {
    schema: GARDEN_DESIGN_SCHEMA,
    version: 1,
    name: isString(parsed.name) ? parsed.name : undefined,
    createdAt: isString(parsed.createdAt) ? parsed.createdAt : undefined,
    notes: isString(parsed.notes) ? parsed.notes : undefined,
    grid: {
      widthFt: grid.widthFt,
      heightFt: grid.heightFt,
      snapIncrementFt: snap,
    },
    favorites: favoritesRaw as string[] | undefined,
    plants: Array.isArray(parsed.plants) ? (parsed.plants as GardenDesignPlantMetaV1[]) : undefined,
    placements: placementsRaw as GardenDesignPlacementV1[],
  };

  return { design };
}





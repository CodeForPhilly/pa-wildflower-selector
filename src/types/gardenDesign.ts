export type GardenDesignSchemaId = 'choose-native-plants.garden-design';

export interface GardenDesignGridV1 {
  widthFt: number;
  heightFt: number;
  /**
   * Must match the planner snap settings (currently supports 1.0 or 0.5).
   */
  snapIncrementFt?: number;
}

export interface GardenDesignPlantMetaV1 {
  plantId: string;
  commonName?: string;
  scientificName?: string;
  spreadFt?: number;
  heightFt?: number;
  family?: string;
}

export interface GardenDesignPlacementV1 {
  plantId: string;
  /**
   * Center point in feet from the top-left corner.
   */
  centerXFt: number;
  /**
   * Center point in feet from the top-left corner.
   */
  centerYFt: number;
  /**
   * Diameter in feet. Optional (import can infer from plant spread when available).
   */
  sizeFt?: number;
}

export interface GardenDesignV1 {
  schema: GardenDesignSchemaId;
  version: 1;
  name?: string;
  createdAt?: string;
  grid: GardenDesignGridV1;
  /**
   * Plant IDs that should be favorited.
   */
  favorites?: string[];
  /**
   * Optional metadata to help humans/LLMs (ignored by importer unless needed).
   */
  plants?: GardenDesignPlantMetaV1[];
  placements: GardenDesignPlacementV1[];
  notes?: string;
}








































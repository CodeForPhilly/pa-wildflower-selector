export interface Plant {
  _id: string;
  "Common Name": string;
  "Scientific Name"?: string;
  "Spread (feet)": string | number;
  hasImage?: boolean;
  "Flowering Months"?: string;
  [key: string]: unknown; // Allow other plant properties
}

export interface PlacedPlant {
  id: string;
  plantId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GardenLayout {
  id: string;
  name: string;
  gridFt: {
    width: number;
    height: number;
  };
  cellFt: number;
  items: PlacedPlant[];
  updatedAt: number;
}

export interface StoragePayload {
  placedPlants: PlacedPlant[];
  selectedPlantId: string | null;
  gridWidth?: number;
  gridHeight?: number;
  gridTopPadding?: number;
  gridLeftPadding?: number;
  gridBottomPadding?: number;
  gridRightPadding?: number;
}

export interface GridCoords {
  x: number;
  y: number;
}

export interface Viewport {
  width: number;
  height: number;
}


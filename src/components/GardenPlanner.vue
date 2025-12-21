<template>
  <div class="garden-planner">
    <Header h1="Garden Planner" :large-h1="false" />

    <main class="planner-main">
      <PlannerToolbar
        :is3-d="show3D"
        :can-undo="canUndo"
        :can-redo="canRedo"
        :can-clear="placedPlants.length > 0"
        :summary-active="showSummary"
        :zoom="zoom"
        :grid-width="gridWidth"
        :grid-height="gridHeight"
        :snap-increment="snapIncrement"
        :label-mode="labelMode"
        @undo="undo"
        @redo="redo"
        @clear="clearLayout"
        @export="showDesignExport = true"
        @import="showDesignImport = true"
        @toggle-summary="handleSummaryToggle"
        @toggle-3d="toggle3D"
        @open-grid-editor="showGridEditor = true"
        @toggle-snap="toggleSnapIncrement"
        @zoom-out="zoom = Math.max(zoom - 0.1, 0.5)"
        @zoom-in="zoom = Math.min(zoom + 0.1, 2)"
        @zoom-reset="zoom = 1"
        @cycle-labels="cycleLabelMode"
      />

      <section class="workspace">
        <template v-if="show3D">
          <Garden3DView
            v-if="isClient"
            :placed-plants="placedPlants"
            :plant-by-id="plantById"
            :grid-width="gridWidth"
            :grid-height="gridHeight"
            :snap-increment="snapIncrement"
            :image-url="imageUrl"
            :favorite-plants="favoritePlants"
            :selected-plant-id="selectedPlantId"
            :is-mobile="isMobile"
            :loading="loading"
            :spread-feet-label="spreadFeetLabel"
            :spread-cells="spreadCells"
            :plant-counts="plantCounts"
            :label-mode="labelMode"
            :zoom="zoom"
            :add-row-top="addRowTop"
            :remove-row-top="removeRowTop"
            :add-row-bottom="addRowBottom"
            :remove-row-bottom="removeRowBottom"
            :add-column-left="addColumnLeft"
            :remove-column-left="removeColumnLeft"
            :add-column-right="addColumnRight"
            :remove-column-right="removeColumnRight"
            @update:zoom="zoom = $event"
            @move-placed="movePlant"
            @remove-placed="removePlaced"
            @select-plant="selectPlant"
            @place-plant="placePlant"
          />
        </template>
        <template v-else-if="!showSummary">
          <FavoritesTray
            :favorite-plants="favoritePlants"
            :selected-plant-id="selectedPlantId"
            :is-mobile="isMobile"
            :loading="loading"
            :image-url="imageUrl"
            :spread-feet-label="spreadFeetLabel"
            :spread-cells="spreadCells"
            :plant-counts="plantCounts"
            @select="selectPlant"
            @drag-start="handlePaletteDragStart"
          />

          <GardenCanvas
            ref="canvasRef"
            :placed-plants="placedPlants"
            :plant-by-id="plantById"
            :overlap-ids="overlapIds"
            :selected-plant-id="selectedPlantId"
            :selected-placed-plant-id="selectedPlacedPlantId"
            :is-mobile="isMobile"
            :image-url="imageUrl"
            :spread-feet-label="spreadFeetLabel"
            :place-plant="placePlant"
            :move-plant="movePlant"
            :remove-placed="removePlaced"
            :select-placed-plant="selectPlacedPlant"
            :grid-width="gridWidth"
            :grid-height="gridHeight"
            :snap-increment="snapIncrement"
            :zoom="zoom"
            @update:zoom="zoom = $event"
            :label-mode="labelMode"
            :add-row-top="addRowTop"
            :remove-row-top="removeRowTop"
            :add-row-bottom="addRowBottom"
            :remove-row-bottom="removeRowBottom"
            :add-column-left="addColumnLeft"
            :remove-column-left="removeColumnLeft"
            :add-column-right="addColumnRight"
            :remove-column-right="removeColumnRight"
          />
        </template>
        <template v-else>
          <GardenSummary
            :summary-data="summaryData"
            :grid-width="gridWidth"
            :grid-height="gridHeight"
            :favorite-plants="favoritePlants"
            :favorite-ids="favoriteIds"
          />
        </template>
      </section>
    </main>

    <GridSizeEditor
      :is-open="showGridEditor"
      :current-width="gridWidth"
      :current-height="gridHeight"
      :min-size="minGridSize"
      :placed-plants-count="placedPlants.length"
      @close="showGridEditor = false"
      @apply="handleGridSizeApply"
      @fit-to-plants="handleGridSizeFit"
    />

    <DesignIOEditor
      :is-open="showDesignExport"
      mode="export"
      :initial-text="exportDesignText"
      @close="showDesignExport = false"
    />
    <DesignIOEditor
      :is-open="showDesignImport"
      mode="import"
      initial-text=""
      @close="showDesignImport = false"
      @import="handleImportDesign"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, defineAsyncComponent, watch } from 'vue';
import { useGardenPlanner } from '../composables/useGardenPlanner';
import { useViewport } from '../composables/useViewport';
import Header from './Header.vue';
import FavoritesTray from './FavoritesTray.vue';
import GardenCanvas from './GardenCanvas.vue';
import GardenSummary from './GardenSummary.vue';
import GridSizeEditor from './GridSizeEditor.vue';
import DesignIOEditor from './DesignIOEditor.vue';
import PlannerToolbar from './PlannerToolbar.vue';
import type { PlacedPlant, Plant } from '../types/garden';
import { GARDEN_DESIGN_SCHEMA, GARDEN_DESIGN_VERSION } from '../lib/gardenDesign';

const Garden3DView = defineAsyncComponent({
  loader: () => {
    console.log('Loading Garden3DView component');
    return import('./Garden3DView.vue');
  },
  onError: (error, _retry, fail, attempts) => {
    const errAny = /** @type {any} */ (error);
    console.error('Garden3DView async load failed', {
      name: errAny?.name,
      message: errAny?.message,
      attempts
    });
    fail();
  },
});

interface Props {
  favorites?: boolean;
}

defineProps<Props>();

const { isMobile } = useViewport();
const canvasRef = ref<InstanceType<typeof GardenCanvas> | null>(null);
const showSummary = ref(false);
const showGridEditor = ref(false);
const zoom = ref(1);
const show3D = ref(false);
const isClient = ref(false);
const showDesignExport = ref(false);
const showDesignImport = ref(false);
type LabelMode = 'off' | 'all';
const labelMode = ref<LabelMode>('off');
const lastNonSummary3D = ref(false);

const {
  loading,
  favoritePlants,
  placedPlants,
  selectedPlantId,
  selectedPlacedPlantId,
  plantById,
  overlapIds,
  plantCounts,
  imageUrl,
  spreadFeetLabel,
  spreadCells,
  placePlant,
  movePlant,
  removePlaced,
  clearLayout,
  selectPlant,
  selectPlacedPlant,
  undo,
  canUndo,
  redo,
  canRedo,
  gridWidth,
  gridHeight,
  snapIncrement,
  favoriteIds,
  addRowTop,
  removeRowTop,
  addRowBottom,
  removeRowBottom,
  addColumnLeft,
  removeColumnLeft,
  addColumnRight,
  removeColumnRight,
  getMinGridSize,
  setGridSize,
  fitGridToPlants,
  toggleSnapIncrement,
  getExportDesignText,
  importDesignFromText,
} = useGardenPlanner();

const exportDesignText = computed(() => getExportDesignText());

const handleImportDesign = (text: string) => {
  const result = importDesignFromText(text);
  if (!result.success) {
    window.alert(result.error || 'Import failed.');
    return;
  }
  showDesignImport.value = false;
  showSummary.value = false;
};

const handlePaletteDragStart = (event: PointerEvent, plantId: string) => {
  // Forward the drag start to the canvas component
  if (canvasRef.value && 'startPaletteDrag' in canvasRef.value) {
    // Use bracket notation to avoid TypeScript type assertion that ESLint can't parse
    const canvas = canvasRef.value;
    const method = canvas['startPaletteDrag'];
    if (typeof method === 'function') {
      method.call(canvas, event, plantId);
    }
  }
};

const handleSummaryToggle = () => {
  if (showSummary.value) {
    // Turning summary off: restore the last non-summary mode
    showSummary.value = false;
    show3D.value = lastNonSummary3D.value;
    return;
  }
  // Turning summary on: remember current mode and switch to summary (always exits 3D)
  lastNonSummary3D.value = show3D.value;
  show3D.value = false;
  showSummary.value = true;
};

const toggle3D = () => {
  // Switching modes should always exit Summary (so the toolbar state matches the view).
  showSummary.value = false;
  show3D.value = !show3D.value;
  lastNonSummary3D.value = show3D.value;
};

const cycleLabelMode = () => {
  labelMode.value = labelMode.value === 'off' ? 'all' : 'off';
};

// Calculate center-point coordinates for a placed plant
const getCenterCoordinates = (placed: PlacedPlant): string => {
  const centerX = Math.round(placed.x + (placed.width / 2));
  const centerY = Math.round(placed.y + (placed.height / 2));
  return `${centerX},${centerY}`;
};

// Summary data computed property
const summaryData = computed(() => {
  // Calculate overall statistics
  const totalPlants = placedPlants.value.length;
  const uniqueSpeciesSet = new Set(placedPlants.value.map(p => p.plantId));
  const uniqueSpecies = uniqueSpeciesSet.size;

  // Group by Plant Family
  const familyMap = new Map<string, {
    plants: Map<string, {
      plantId: string;
      commonName: string;
      scientificName?: string;
      count: number;
      coordinates: string[];
    }>;
  }>();

  // Process each placed plant
  for (const placed of placedPlants.value) {
    const plant = plantById.value[placed.plantId];
    if (!plant) continue;

    const rawFamily = plant['Plant Family'];
    const plantFamily =
      typeof rawFamily === 'string' && rawFamily.trim().length > 0
        ? rawFamily
        : 'Unspecified';
    const centerCoord = getCenterCoordinates(placed);

    if (!familyMap.has(plantFamily)) {
      familyMap.set(plantFamily, { plants: new Map() });
    }

    const family = familyMap.get(plantFamily);
    if (!family) continue;
    
    if (!family.plants.has(placed.plantId)) {
      family.plants.set(placed.plantId, {
        plantId: placed.plantId,
        commonName: plant['Common Name'] || placed.plantId,
        scientificName: plant['Scientific Name'],
        count: 0,
        coordinates: [],
      });
    }

    const plantEntry = family.plants.get(placed.plantId);
    if (!plantEntry) continue;
    
    plantEntry.count++;
    plantEntry.coordinates.push(centerCoord);
  }

  // Convert to array format and calculate family statistics
  const families = Array.from(familyMap.entries()).map(([familyName, familyData]) => {
    const plants = Array.from(familyData.plants.values());
    const uniqueSpeciesCount = plants.length;
    const totalPlantCount = plants.reduce((sum, p) => sum + p.count, 0);

    return {
      family: familyName,
      uniqueSpeciesCount,
      totalPlantCount,
      plants: plants.sort((a, b) => {
        // Sort by common name
        return a.commonName.localeCompare(b.commonName);
      }),
    };
  });

  // Sort families by unique species count (descending)
  families.sort((a, b) => b.uniqueSpeciesCount - a.uniqueSpeciesCount);

  return {
    overallStats: {
      totalPlants,
      uniqueSpecies,
    },
    families,
  };
});

// Grid editor handlers
const minGridSize = computed(() => getMinGridSize());

const handleGridSizeApply = (width: number, height: number) => {
  const result = setGridSize(width, height);
  if (!result.success && result.error) {
    // Error is shown in the modal component
    console.error(result.error);
  }
};

const handleGridSizeFit = () => {
  fitGridToPlants();
};

// Keyboard shortcuts for zoom
const handleKeyDown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key === '=') {
    e.preventDefault();
    zoom.value = Math.min(zoom.value + 0.1, 2);
  } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
    e.preventDefault();
    zoom.value = Math.max(zoom.value - 0.1, 0.5);
  }
};

onMounted(() => {
  isClient.value = typeof window !== 'undefined';
  console.log('Garden planner mounted', { isClient: isClient.value });
  window.addEventListener('keydown', handleKeyDown);
});

watch([show3D, isClient], ([s3d, client]) => {
  console.log('3D view gating state changed', {
    show3D: s3d,
    isClient: client,
    shouldRender: !!(s3d && client)
  });
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
.planner-main {
  padding: 0 0 24px 0;
  width: 100%;
  height: calc(100vh - 80px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.toolbar {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: flex-start;
  margin-bottom: 16px;
  margin-left: 16px;
  margin-right: 16px;
  flex-wrap: wrap;
}

.toolbar-container {
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 16px;
  padding: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  flex: 1;
}

.toolbar-left {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-left: auto;
  text-align: right;
  font-family: Roboto;
}

.toolbar-zoom {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
}

.zoom-value {
  font-size: 14px;
  font-weight: 500;
  font-family: Roboto, sans-serif;
  color: #374151;
  min-width: 3rem;
  text-align: center;
}

.toolbar-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 14px;
  font-family: Roboto, sans-serif;
  font-weight: 500;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background-color: #fff;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.toolbar-button:hover:not(:disabled) {
  background-color: #f9fafb;
  border-color: #9ca3af;
}

.toolbar-button:active:not(:disabled) {
  background-color: #f3f4f6;
}

.toolbar-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toolbar-button .icon {
  flex-shrink: 0;
  stroke-width: 2;
}

.toolbar-button .button-text {
  display: inline;
}

.toolbar-button.clear-button {
  color: #dc2626;
  border-color: #dc2626;
  background-color: transparent;
}

.toolbar-button.clear-button:hover:not(:disabled) {
  color: #b91c1c;
  background-color: #fef2f2;
  border-color: #b91c1c;
}

.toolbar-button.summary-button {
  background-color: transparent;
}

.toolbar-button.summary-button.active {
  background-color: #16a34a;
  color: #fff;
  border-color: #16a34a;
}

.toolbar-button.summary-button.active:hover {
  background-color: #15803d;
  border-color: #15803d;
}

.snap-toggle-button {
  font-family: 'Roboto Mono', monospace;
}

.snap-value {
  font-weight: 600;
}

.grid-dimensions-button strong {
  font-weight: 600;
}

.workspace {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  height: 100%;
  margin-left: 16px;
  margin-right: 16px;
  position: relative;
}

/* Summary overlay removed: summary is a full view (same as 2D mode) */

/* Only apply flex to GardenSummary when shown, not to FavoritesTray */
.workspace > .garden-summary {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

@media screen and (max-width: 767px) {
  .planner-main {
    padding: 0 0 8px 0;
  }

  .toolbar {
    gap: 8px;
    margin-bottom: 8px;
    margin-left: 12px;
    margin-right: 12px;
    align-items: center;
  }
  
  .workspace {
    margin-left: 12px;
    margin-right: 12px;
  }

  .toolbar-container {
    padding: 6px;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }

  .toolbar-left {
    flex-wrap: wrap;
    gap: 6px;
  }

  .toolbar-right {
    flex-wrap: wrap;
    gap: 6px;
    margin-left: 0;
    text-align: left;
  }

  .toolbar-zoom {
    gap: 4px;
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
  }

  .toolbar-buttons {
    gap: 6px;
  }

  .toolbar-button {
    padding: 5px 10px;
    font-size: 13px;
  }

  .toolbar-button.icon-only {
    padding: 8px;
    min-width: 44px;
    min-height: 44px;
    justify-content: center;
  }

  .toolbar-button.icon-only .button-text {
    display: none;
  }

  .zoom-value {
    font-size: 12px;
    min-width: 2.5rem;
  }

  .grid-dimensions-button {
    font-size: 12px;
    padding: 5px 10px;
    line-height: 1.3;
  }
}
</style>

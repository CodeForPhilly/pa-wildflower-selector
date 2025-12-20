<template>
  <div class="garden-planner">
    <Header h1="Garden Planner" :large-h1="false" />

    <main class="planner-main">
      <section class="toolbar" aria-label="Planner toolbar">
        <div class="toolbar-container">
          <div class="toolbar-left">
            <button 
              class="toolbar-button icon-only" 
              @click="undo"
              :disabled="!canUndo"
              title="Undo"
            >
              <Undo2 :size="16" class="icon" />
              <span class="button-text">Undo</span>
            </button>
            <button 
              class="toolbar-button icon-only" 
              @click="redo"
              :disabled="!canRedo"
              title="Redo"
            >
              <Redo2 :size="16" class="icon" />
              <span class="button-text">Redo</span>
            </button>
            <button 
              class="toolbar-button clear-button icon-only" 
              @click="clearLayout"
              :disabled="placedPlants.length === 0"
            >
              <Trash2 :size="16" class="icon" />
              <span class="button-text">Clear</span>
            </button>
            <button 
              class="toolbar-button summary-button icon-only" 
              :class="{ 'active': showSummary }"
              @click="handleSummaryToggle"
              title="View Summary"
            >
              <Info :size="16" class="icon" />
              <span class="button-text">Summary</span>
            </button>
            <button
              class="toolbar-button icon-only"
              @click="open3D"
              title="View in 3D"
            >
              <Box :size="16" class="icon" />
              <span class="button-text">View in 3D</span>
            </button>
          </div>

          <div class="toolbar-right">
            <div class="toolbar-zoom">
              <button
                class="toolbar-button icon-only"
                @click="zoom = Math.max(zoom - 0.1, 0.5)"
                :disabled="zoom <= 0.5"
                title="Zoom Out (Ctrl+-)"
              >
                <ZoomOut :size="16" class="icon" />
              </button>
              <span class="zoom-value">{{ Math.round(zoom * 100) }}%</span>
              <button
                class="toolbar-button icon-only"
                @click="zoom = Math.min(zoom + 0.1, 2)"
                :disabled="zoom >= 2"
                title="Zoom In (Ctrl+=)"
              >
                <ZoomIn :size="16" class="icon" />
              </button>
              <button
                class="toolbar-button icon-only"
                @click="zoom = 1"
                :disabled="zoom === 1"
                title="Reset Zoom"
              >
                <RotateCcw :size="16" class="icon" />
              </button>
            </div>
            <button
              class="toolbar-button grid-dimensions-button"
              @click="showGridEditor = true"
              :title="`Current grid: ${gridWidth}ft × ${gridHeight}ft`"
            >
              Grid: <strong>{{ gridWidth }}</strong>ft × <strong>{{ gridHeight }}</strong>ft
            </button>
            <button
              class="toolbar-button snap-toggle-button"
              @click="toggleSnapIncrement"
              :title="`Toggle grid snap size (currently ${snapIncrement}ft)`"
            >
              <svg
                class="icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                style="width: 16px; height: 16px;"
              >
                <rect x="3" y="3" width="18" height="18" />
                <line x1="12" y1="3" x2="12" y2="21" />
                <line x1="3" y1="12" x2="21" y2="12" />
              </svg>
              <span class="snap-value">{{ snapIncrement }}ft</span>
            </button>
          </div>
        </div>
      </section>

      <section class="workspace">
        <template v-if="!showSummary">
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

    <!-- Client-only 3D viewer overlay -->
    <Garden3DView
      v-if="isClient && show3D"
      :placed-plants="placedPlants"
      :plant-by-id="plantById"
      :grid-width="gridWidth"
      :grid-height="gridHeight"
      :snap-increment="snapIncrement"
      :can-undo="canUndo"
      :can-redo="canRedo"
      :can-clear="placedPlants.length > 0"
      :image-url="imageUrl"
      :favorite-plants="favoritePlants"
      :selected-plant-id="selectedPlantId"
      :is-mobile="isMobile"
      :loading="loading"
      :spread-feet-label="spreadFeetLabel"
      :spread-cells="spreadCells"
      :plant-counts="plantCounts"
      @close="show3D = false"
      @undo="undo"
      @redo="redo"
      @clear="clearLayout"
      @set-grid-size="handleGridSizeApply"
      @fit-grid-to-plants="handleGridSizeFit"
      @toggle-snap-increment="toggleSnapIncrement"
      @move-placed="movePlant"
      @remove-placed="removePlaced"
      @select-plant="selectPlant"
      @place-plant="placePlant"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, defineAsyncComponent, watch } from 'vue';
import { Undo2, Redo2, Trash2, Info, ZoomIn, ZoomOut, RotateCcw, Box } from 'lucide-vue-next';
import { useGardenPlanner } from '../composables/useGardenPlanner';
import { useViewport } from '../composables/useViewport';
import Header from './Header.vue';
import FavoritesTray from './FavoritesTray.vue';
import GardenCanvas from './GardenCanvas.vue';
import GardenSummary from './GardenSummary.vue';
import GridSizeEditor from './GridSizeEditor.vue';
import type { PlacedPlant, Plant } from '../types/garden';

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
    fail(error);
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
} = useGardenPlanner();

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
  showSummary.value = !showSummary.value;
};

const open3D = () => {
  console.log('Opening 3D view', { isClient: isClient.value, show3D_before: show3D.value });
  show3D.value = true;
  console.log('3D view state updated', { isClient: isClient.value, show3D_after: show3D.value });
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
  padding: 0 16px 24px;
  max-width: 1400px;
  margin: 0 auto;
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
}

/* Only apply flex to GardenSummary when shown, not to FavoritesTray */
.workspace > .garden-summary {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

@media screen and (max-width: 767px) {
  .planner-main {
    padding: 0 12px 8px;
  }

  .toolbar {
    gap: 8px;
    margin-bottom: 8px;
    align-items: center;
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

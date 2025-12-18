<template>
  <div class="garden-planner">
    <Header h1="Garden Planner" :large-h1="false" />

    <main class="planner-main">
      <section class="toolbar" aria-label="Planner toolbar">
        <div class="size-controls">
          <button class="primary primary-bar small" @click="clearLayout">
            Clear Layout
          </button>
          <button 
            v-if="canRedo" 
            class="primary primary-bar small" 
            @click="redo"
            title="Redo"
          >
            Redo
          </button>
          <button 
            class="primary primary-bar small" 
            @click="handleSummaryToggle"
            :title="showSummary ? 'Back to Grid' : 'View Summary'"
          >
            {{ showSummary ? 'Back to Grid' : 'Summary' }}
          </button>
        </div>

        <div class="toolbar-right">
          <button
            class="snap-toggle-button"
            @click="toggleSnapIncrement"
            :title="`Snap to ${snapIncrement}ft increments`"
          >
            <span class="snap-icon">⊞</span>
            <span class="snap-value">{{ snapIncrement }}ft</span>
          </button>
          <button
            class="grid-dimensions-button"
            @click="showGridEditor = true"
            :title="`Current grid: ${gridWidth}ft × ${gridHeight}ft`"
          >
            Grid: <strong>{{ gridWidth }}</strong>ft × <strong>{{ gridHeight }}</strong>ft
          </button>
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
            :is-mobile="isMobile"
            :image-url="imageUrl"
            :spread-feet-label="spreadFeetLabel"
            :place-plant="placePlant"
            :move-plant="movePlant"
            :remove-placed="removePlaced"
            :grid-width="gridWidth"
            :grid-height="gridHeight"
            :snap-increment="snapIncrement"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useGardenPlanner } from '../composables/useGardenPlanner';
import { useViewport } from '../composables/useViewport';
import Header from './Header.vue';
import FavoritesTray from './FavoritesTray.vue';
import GardenCanvas from './GardenCanvas.vue';
import GardenSummary from './GardenSummary.vue';
import GridSizeEditor from './GridSizeEditor.vue';
import type { PlacedPlant, Plant } from '../types/garden';

interface Props {
  favorites?: boolean;
}

defineProps<Props>();

const { isMobile } = useViewport();
const canvasRef = ref<InstanceType<typeof GardenCanvas> | null>(null);
const showSummary = ref(false);
const showGridEditor = ref(false);

const {
  loading,
  favoritePlants,
  placedPlants,
  selectedPlantId,
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

    const plantFamily = (plant['Plant Family'] as string) || 'Unspecified';
    const centerCoord = getCenterCoordinates(placed);

    if (!familyMap.has(plantFamily)) {
      familyMap.set(plantFamily, { plants: new Map() });
    }

    const family = familyMap.get(plantFamily)!;
    if (!family.plants.has(placed.plantId)) {
      family.plants.set(placed.plantId, {
        plantId: placed.plantId,
        commonName: plant['Common Name'] || placed.plantId,
        scientificName: plant['Scientific Name'],
        count: 0,
        coordinates: [],
      });
    }

    const plantEntry = family.plants.get(placed.plantId)!;
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
  justify-content: space-between;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.size-controls {
  display: flex;
  gap: 12px;
  align-items: end;
  flex-wrap: wrap;
}

.toolbar-right {
  text-align: right;
  font-family: Roboto;
  display: flex;
  gap: 12px;
  align-items: center;
}

.snap-toggle-button {
  background-color: #fff3e0;
  color: #e65100;
  border: 1px solid #ffb74d;
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 14px;
  font-family: Roboto, sans-serif;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.1s, border-color 0.2s;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}

.snap-toggle-button:hover {
  background-color: #ffe0b2;
  border-color: #ff9800;
  transform: scale(1.02);
}

.snap-toggle-button:active {
  transform: scale(0.98);
}

.snap-icon {
  font-size: 16px;
  line-height: 1;
}

.snap-value {
  font-weight: 600;
}

.grid-dimensions-button {
  background-color: #e8f5e9;
  color: #2e7d32;
  border: none;
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 14px;
  font-family: Roboto, sans-serif;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.1s;
  white-space: nowrap;
}

.grid-dimensions-button:hover {
  background-color: #c8e6c9;
  transform: scale(1.02);
}

.grid-dimensions-button:active {
  transform: scale(0.98);
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

button.primary-bar.small {
  width: auto;
  max-width: none;
  margin: 0;
  padding: 10px 14px;
}

button.primary-bar.small.subtle {
  background-color: #1d2e26;
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

  .size-controls {
    gap: 6px;
  }

  .toolbar-right {
    text-align: left;
    flex: 1;
    min-width: 0;
    gap: 8px;
  }

  .snap-toggle-button {
    font-size: 12px;
    padding: 6px 12px;
    line-height: 1.3;
  }

  .snap-icon {
    font-size: 14px;
  }

  .grid-dimensions-button {
    font-size: 12px;
    padding: 6px 12px;
    line-height: 1.3;
  }

  button.primary-bar.small {
    padding: 8px 10px;
    font-size: 13px;
  }
}
</style>

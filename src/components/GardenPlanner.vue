<template>
  <div class="garden-planner">
    <Header h1="Garden Planner" :large-h1="false" />

    <main class="planner-main">
      <section class="toolbar" aria-label="Planner toolbar">
        <div class="size-controls">
          <button class="primary primary-bar small" @click="clearLayout">
            Clear Layout
          </button>
          <button class="primary primary-bar small subtle" @click="resetPlanner">
            Reset
          </button>
          <button 
            v-if="canUndo" 
            class="primary primary-bar small" 
            @click="undo"
            title="Undo"
          >
            Undo
          </button>
          <button 
            v-if="canRedo" 
            class="primary primary-bar small" 
            @click="redo"
            title="Redo"
          >
            Redo
          </button>
        </div>

        <div class="toolbar-right">
          <div class="grid-readout">
            Grid: <strong>10</strong>ft × <strong>10</strong>ft
          </div>
          <div class="tap-hint" v-if="isMobile">
            Tap a plant below, then tap the grid to place.
          </div>
        </div>
      </section>

      <section class="workspace" :class="{ mobile: isMobile }">
        <FavoritesTray
          :favorite-plants="favoritePlants"
          :selected-plant-id="selectedPlantId"
          :is-mobile="isMobile"
          :loading="loading"
          :image-url="imageUrl"
          :spread-feet-label="spreadFeetLabel"
          :spread-cells="spreadCells"
          @select="selectPlant"
          @drag-start="handlePaletteDragStart"
        />

        <GardenCanvas
          ref="canvasRef"
          :placed-plants="placedPlants"
          :plant-by-id="plantById"
          :overlap-ids="overlapIds"
          :popover-plant-id="popoverPlantId"
          :selected-plant-id="selectedPlantId"
          :is-mobile="isMobile"
          :image-url="imageUrl"
          :spread-feet-label="spreadFeetLabel"
          :place-plant="placePlant"
          :move-plant="movePlant"
          :remove-placed="removePlaced"
          :open-popover="openPopover"
          :close-popover="closePopover"
        />
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useGardenPlanner } from '../composables/useGardenPlanner';
import { useViewport } from '../composables/useViewport';
import Header from './Header.vue';
import FavoritesTray from './FavoritesTray.vue';
import GardenCanvas from './GardenCanvas.vue';

interface Props {
  favorites?: boolean;
}

defineProps<Props>();

const { isMobile } = useViewport();
const canvasRef = ref<InstanceType<typeof GardenCanvas> | null>(null);

const {
  loading,
  favoritePlants,
  placedPlants,
  selectedPlantId,
  popoverPlantId,
  plantById,
  overlapIds,
  imageUrl,
  spreadFeetLabel,
  spreadCells,
  placePlant,
  movePlant,
  removePlaced,
  clearLayout,
  resetPlanner,
  openPopover,
  closePopover,
  selectPlant,
  undo,
  redo,
  canUndo,
  canRedo,
} = useGardenPlanner();

const handlePaletteDragStart = (event: PointerEvent, plantId: string) => {
  // Forward the drag start to the canvas component
  if (canvasRef.value && 'startPaletteDrag' in canvasRef.value) {
    (canvasRef.value as { startPaletteDrag: (event: PointerEvent, plantId: string) => void }).startPaletteDrag(event, plantId);
  }
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
}

.grid-readout {
  font-size: 14px;
}

.tap-hint {
  margin-top: 6px;
  font-size: 13px;
  color: #1d2e26;
}

.workspace {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 16px;
  align-items: stretch;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  height: 100%;
}

.workspace.mobile {
  grid-template-columns: 1fr;
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
  .toolbar-right {
    text-align: left;
  }
}
</style>

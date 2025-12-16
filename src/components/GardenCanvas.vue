<template>
  <div class="grid-area" ref="gridAreaRef">
    <div class="grid-scroll">
      <div
        ref="gridRef"
        class="grid"
        :style="gridStyle"
        @click="handleGridClick"
        @pointerdown="handleGridPointerDown"
        aria-label="Garden planner grid"
        role="application"
      >
        <PlantCircle
          v-for="p in placedPlants"
          :key="p.id"
          :placed="p"
          :plant="plantById[p.plantId]"
          :is-overlapping="overlapIds.has(p.id)"
          :is-dragging="dragState.isDragging && dragState.plantId === p.id && dragState.dragType === 'move'"
          :cell-size="dynamicCellSize"
          :image-url="imageUrl"
          :is-mobile="isMobile"
          @drag-start="handlePlantDragStart"
          @delete="handleDelete"
        />

        <!-- Grid cell highlight showing where plant will snap -->
        <div
          v-if="dragState.isDragging && dragState.currentCoords"
          class="grid-highlight"
          :style="gridHighlightStyle"
        />

        <!-- Transparent drag preview following cursor -->
        <div
          v-if="dragState.isDragging && dragPreviewPlant"
          class="drag-preview"
          :style="dragPreviewStyle"
        >
          <div class="drag-preview-label">
            <div class="label-line common">{{ dragPreviewPlant['Common Name'] || dragState.plantId }}</div>
            <div v-if="dragPreviewPlant['Scientific Name']" class="label-line scientific">
              <i>{{ dragPreviewPlant['Scientific Name'] }}</i>
            </div>
          </div>
        </div>

      </div>
    </div>

    <div class="overlap-hint" v-if="placedPlants.length && overlapIds.size">
      Some plants overlap (outlined in red). Overlap is allowed, but may indicate crowding.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePointerDrag } from '../composables/usePointerDrag';
import PlantCircle from './PlantCircle.vue';
import type { PlacedPlant, Plant, GridCoords } from '../types/garden';

interface Props {
  placedPlants: PlacedPlant[];
  plantById: Record<string, Plant>;
  overlapIds: Set<string>;
  selectedPlantId: string | null;
  isMobile: boolean;
  imageUrl: (plant: Plant | undefined, preview: boolean) => string;
  spreadFeetLabel: (plant: Plant | undefined) => string;
  placePlant: (plantId: string, x: number, y: number) => void;
  movePlant: (placedId: string, x: number, y: number) => void;
  removePlaced: (id: string) => void;
}

const props = defineProps<Props>();

const gridRef = ref<HTMLElement | null>(null);
const gridAreaRef = ref<HTMLElement | null>(null);
const activeDrag = ref<{ type: 'place' | 'move'; plantId: string } | null>(null);

const dynamicCellSize = computed(() => {
  if (typeof window === 'undefined') return 36;
  
  const sidebarWidth = props.isMobile ? 0 : 340;
  const toolbarHeight = 100;
  const headerHeight = 80;
  const padding = 32;
  const gap = 16;
  const mainPadding = 32;
  
  const availableWidth = window.innerWidth - sidebarWidth - padding - gap - mainPadding * 2;
  const availableHeight = window.innerHeight - toolbarHeight - headerHeight - mainPadding * 2;
  
  const minDimension = Math.min(availableWidth, availableHeight);
  const cellSize = minDimension / 10;
  
  return Math.max(20, Math.min(80, cellSize));
});

const gridStyle = computed(() => {
  const cellSize = dynamicCellSize.value;
  const gridSize = 10 * cellSize;
  return {
    '--cell-size': `${cellSize}px`,
    width: `${gridSize}px`,
    height: `${gridSize}px`,
  };
});


const getGridCoords = (event: PointerEvent | MouseEvent): GridCoords | null => {
  const grid = gridRef.value;
  if (!grid || typeof window === 'undefined') return null;
  
  const rect = grid.getBoundingClientRect();
  const clientX = event.clientX;
  const clientY = event.clientY;
  const x = Math.floor((clientX - rect.left) / dynamicCellSize.value);
  const y = Math.floor((clientY - rect.top) / dynamicCellSize.value);
  
  return {
    x: Math.max(0, Math.min(9, x)),
    y: Math.max(0, Math.min(9, y)),
  };
};

const handleDragEnd = (coords: GridCoords, dragType: 'place' | 'move', plantId: string) => {
  const isCtrlHeld = dragState.value.ctrlKey;
  
  if (dragType === 'move' && isCtrlHeld) {
    // Ctrl+drag: duplicate the plant
    const placed = props.placedPlants.find(p => p.id === plantId);
    if (placed) {
      props.placePlant(placed.plantId, coords.x, coords.y);
    }
  } else if (dragType === 'move') {
    // Normal drag: move the plant
    props.movePlant(plantId, coords.x, coords.y);
  } else if (dragType === 'place') {
    props.placePlant(plantId, coords.x, coords.y);
  }
  activeDrag.value = null;
};

const { dragState, handlePointerDown: handlePointerDragStart } = usePointerDrag(
  gridRef,
  dynamicCellSize,
  handleDragEnd
);

// Expose method for palette to start drag
const startPaletteDrag = (event: PointerEvent, plantId: string) => {
  activeDrag.value = { type: 'place', plantId };
  handlePointerDragStart(event, 'place', plantId);
};

defineExpose({
  startPaletteDrag,
  gridRef,
});

const handleGridClick = (event: MouseEvent) => {
  if (props.isMobile && props.selectedPlantId) {
    const coords = getGridCoords(event);
    if (!coords) return;
    props.placePlant(props.selectedPlantId, coords.x, coords.y);
  }
};

const handleGridPointerDown = (event: PointerEvent) => {
  // If there's an active drag from palette, handle it
  if (activeDrag.value && event.isPrimary) {
    const coords = getGridCoords(event);
    if (coords) {
      handleDragEnd(coords, activeDrag.value.type, activeDrag.value.plantId);
    }
  }
};


const handlePlantDragStart = (event: PointerEvent, placedId: string) => {
  if (!props.isMobile && event.isPrimary) {
    handlePointerDragStart(event, 'move', placedId);
  }
};

const handleDelete = (placedId: string) => {
  props.removePlaced(placedId);
};

// Drag preview - transparent plant image following cursor
const dragPreviewPlant = computed(() => {
  if (!dragState.value.isDragging || !dragState.value.plantId) return null;
  
  if (dragState.value.dragType === 'place') {
    return props.plantById[dragState.value.plantId];
  } else if (dragState.value.dragType === 'move') {
    const placed = props.placedPlants.find(p => p.id === dragState.value.plantId);
    return placed ? props.plantById[placed.plantId] : null;
  }
  return null;
});

const dragPreviewSize = computed(() => {
  if (!dragPreviewPlant.value) return 1;
  const raw = dragPreviewPlant.value['Spread (feet)'];
  const num = parseFloat(String(raw));
  if (!Number.isFinite(num) || num <= 0) return 1;
  return Math.max(1, Math.round(num));
});

const dragPreviewStyle = computed(() => {
  if (!dragState.value.isDragging || !dragPreviewPlant.value || !dragState.value.currentCoords) return {};
  
  const coords = dragState.value.currentCoords;
  const size = dragPreviewSize.value;
  
  // Use same positioning as grid highlight - centered on target cells
  const adjustedX = Math.max(0, Math.min(coords.x, 10 - size));
  const adjustedY = Math.max(0, Math.min(coords.y, 10 - size));
  const sizePx = size * dynamicCellSize.value;
  
  return {
    width: `${sizePx}px`,
    height: `${sizePx}px`,
    left: `calc(${adjustedX} * var(--cell-size))`,
    top: `calc(${adjustedY} * var(--cell-size))`,
    'background-image': `linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.35) 70%, rgba(0, 0, 0, 0.35) 100%), url("${props.imageUrl(dragPreviewPlant.value, false)}")`,
  };
});

// Grid highlight style - shows target cells that will be occupied
const gridHighlightSize = computed(() => {
  return dragPreviewSize.value;
});

const gridHighlightStyle = computed(() => {
  if (!dragState.value.isDragging || !dragState.value.currentCoords) return {};
  
  const coords = dragState.value.currentCoords;
  const size = gridHighlightSize.value;
  
  // Ensure highlight fits within grid bounds
  const adjustedX = Math.max(0, Math.min(coords.x, 10 - size));
  const adjustedY = Math.max(0, Math.min(coords.y, 10 - size));
  
  return {
    left: `calc(${adjustedX} * var(--cell-size))`,
    top: `calc(${adjustedY} * var(--cell-size))`,
    width: `calc(${size} * var(--cell-size))`,
    height: `calc(${size} * var(--cell-size))`,
  };
});


</script>

<style scoped>
.grid-area {
  min-width: 0;
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.grid-scroll {
  overflow: auto;
  border-radius: 16px;
  border: 1px solid #e5e5e5;
  background: #f5f5f5;
  position: relative;
  width: 100%;
  height: 100%;
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  min-height: 400px;
  padding: 16px;
}

.grid {
  position: relative;
  background-color: #fff;
  min-width: 200px;
  min-height: 200px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  /* 1ft grid + 5ft grid */
  background-image:
    repeating-linear-gradient(
      to right,
      rgba(0, 0, 0, 0.08) 0,
      rgba(0, 0, 0, 0.08) 1px,
      transparent 1px,
      transparent var(--cell-size)
    ),
    repeating-linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.08) 0,
      rgba(0, 0, 0, 0.08) 1px,
      transparent 1px,
      transparent var(--cell-size)
    ),
    repeating-linear-gradient(
      to right,
      rgba(0, 0, 0, 0.18) 0,
      rgba(0, 0, 0, 0.18) 2px,
      transparent 2px,
      transparent calc(var(--cell-size) * 5)
    ),
    repeating-linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.18) 0,
      rgba(0, 0, 0, 0.18) 2px,
      transparent 2px,
      transparent calc(var(--cell-size) * 5)
    );
  background-position: 0 0;
  touch-action: none;
}

.overlap-hint {
  margin-top: 10px;
  font-family: Roboto;
  font-size: 13px;
  color: #6b1b1b;
}

button.primary-bar.small.danger {
  background-color: #b00020;
}

.grid-highlight {
  position: absolute;
  background-color: rgba(0, 0, 0, 0.4);
  border: 2px solid rgba(0, 0, 0, 0.6);
  pointer-events: none;
  z-index: 15;
  box-sizing: border-box;
  /* Show individual grid cells */
  background-image: 
    repeating-linear-gradient(
      to right,
      transparent 0,
      transparent calc(var(--cell-size) - 1px),
      rgba(0, 0, 0, 0.2) calc(var(--cell-size) - 1px),
      rgba(0, 0, 0, 0.2) var(--cell-size)
    ),
    repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent calc(var(--cell-size) - 1px),
      rgba(0, 0, 0, 0.2) calc(var(--cell-size) - 1px),
      rgba(0, 0, 0, 0.2) var(--cell-size)
    );
}

.drag-preview {
  position: absolute;
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  border: 2px solid rgba(183, 77, 21, 0.6);
  pointer-events: none;
  z-index: 16;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  opacity: 0.7;
}

.drag-preview-label {
  width: 100%;
  font-family: Roboto;
  font-size: 13px;
  color: #fff;
  padding: 12px 8px;
  line-height: 1.4;
  text-align: center;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9), 0 0 10px rgba(0, 0, 0, 0.6);
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.35) 70%, rgba(0, 0, 0, 0.35) 100%);
  margin-top: 25%;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
  box-sizing: border-box;
}

.drag-preview-label .label-line {
  display: block;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.drag-preview-label .label-line.common {
  font-size: 14px;
  font-weight: 500;
}

.drag-preview-label .label-line.scientific {
  font-size: 0.85em;
  margin-top: 3px;
  opacity: 0.95;
  max-width: 100%;
  white-space: normal;
}

.drag-preview-label .label-line.scientific i {
  font-style: italic;
}
</style>


<template>
  <div class="grid-area" ref="gridAreaRef">
      <div class="grid-scroll">
        <div class="grid-scroll-inner">
          <div class="grid-wrapper" :style="gridWrapperStyle">
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
          :is-selected="selectedPlacedPlantId === p.id"
          :cell-size="dynamicCellSize"
          :image-url="imageUrl"
          :is-mobile="isMobile"
          :snap-increment="snapIncrement"
          :grid-width="gridWidth"
          :grid-height="gridHeight"
          @drag-start="handlePlantDragStart"
          @delete="handleDelete"
          @select="handlePlantSelect"
          @move="handlePlantMove"
          @duplicate="handleDuplicate"
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
          class="drag-preview-wrapper"
          :style="dragPreviewWrapperStyle"
        >
          <!-- Duplicate icon shown when Ctrl is held during drag -->
          <div 
            v-if="dragState.dragType === 'move' && dragState.ctrlKey"
            class="drag-duplicate-icon"
          >
            <Copy :size="18" />
          </div>
          <div class="drag-preview" :style="dragPreviewStyle">
            <div class="drag-preview-label">
              <div class="label-line common">{{ dragPreviewPlant['Common Name'] || dragState.plantId }}</div>
              <div v-if="dragPreviewPlant['Scientific Name']" class="label-line scientific">
                <i>{{ dragPreviewPlant['Scientific Name'] }}</i>
              </div>
            </div>
          </div>
        </div>

        <!-- Overlap warning - positioned on canvas -->
        <div 
          v-if="placedPlants.length && overlapIds.size"
          class="overlap-hint"
        >
          Some plants overlap (crowding risk)
        </div>
      </div>

      <!-- Top Controls -->
      <div class="resize-controls top">
        <button
          class="resize-button"
          @click="addRowTop"
          title="Add row to top"
          aria-label="Add row to top"
        >
          <span class="resize-icon">+</span>
        </button>
        <button
          class="resize-button"
          @click="removeRowTop"
          title="Remove row from top"
          aria-label="Remove row from top"
        >
          <span class="resize-icon">−</span>
        </button>
      </div>

      <!-- Left Controls -->
      <div class="resize-controls left">
        <button
          class="resize-button"
          @click="addColumnLeft"
          title="Add column to left"
          aria-label="Add column to left"
        >
          <span class="resize-icon">+</span>
        </button>
        <button
          class="resize-button"
          @click="removeColumnLeft"
          title="Remove column from left"
          aria-label="Remove column from left"
        >
          <span class="resize-icon">−</span>
        </button>
      </div>

      <!-- Right Controls -->
      <div class="resize-controls right">
        <button
          class="resize-button"
          @click="addColumnRight"
          title="Add column to right"
          aria-label="Add column to right"
        >
          <span class="resize-icon">+</span>
        </button>
        <button
          class="resize-button"
          @click="removeColumnRight"
          title="Remove column from right"
          aria-label="Remove column from right"
        >
          <span class="resize-icon">−</span>
        </button>
      </div>

      <!-- Bottom Controls -->
      <div class="resize-controls bottom">
        <button
          class="resize-button"
          @click="addRowBottom"
          title="Add row to bottom"
          aria-label="Add row to bottom"
        >
          <span class="resize-icon">+</span>
        </button>
        <button
          class="resize-button"
          @click="removeRowBottom"
          title="Remove row from bottom"
          aria-label="Remove row from bottom"
        >
          <span class="resize-icon">−</span>
        </button>
      </div>
        </div>
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Copy } from 'lucide-vue-next';
import { usePointerDrag } from '../composables/usePointerDrag';
import PlantCircle from './PlantCircle.vue';
import type { PlacedPlant, Plant, GridCoords } from '../types/garden';

interface Props {
  placedPlants: PlacedPlant[];
  plantById: Record<string, Plant>;
  overlapIds: Set<string>;
  selectedPlantId: string | null;
  selectedPlacedPlantId: string | null;
  isMobile: boolean;
  imageUrl: (plant: Plant | undefined, preview: boolean) => string;
  spreadFeetLabel: (plant: Plant | undefined) => string;
  placePlant: (plantId: string, x: number, y: number) => void;
  movePlant: (placedId: string, x: number, y: number) => void;
  removePlaced: (id: string) => void;
  selectPlacedPlant: (placedId: string | null) => void;
  gridWidth: number;
  gridHeight: number;
  snapIncrement: number;
  zoom?: number;
  addRowTop: () => void;
  removeRowTop: () => void;
  addRowBottom: () => void;
  removeRowBottom: () => void;
  addColumnLeft: () => void;
  removeColumnLeft: () => void;
  addColumnRight: () => void;
  removeColumnRight: () => void;
}

const props = defineProps<Props>();

const gridRef = ref<HTMLElement | null>(null);
const gridAreaRef = ref<HTMLElement | null>(null);
const activeDrag = ref<{ type: 'place' | 'move'; plantId: string } | null>(null);

const dynamicCellSize = computed(() => {
  if (typeof window === 'undefined') return 36;
  
  const toolbarHeight = props.isMobile ? 60 : 100;
  const headerHeight = 80;
  const padding = props.isMobile ? 12 : 16;
  const gap = props.isMobile ? 8 : 12;
  const mainPadding = props.isMobile ? 12 : 16;
  // Estimate favorites tray height - compact on all sizes
  const favoritesTrayHeight = 120;
  
  const availableWidth = window.innerWidth - mainPadding * 2 - padding * 2;
  const availableHeight = window.innerHeight - toolbarHeight - headerHeight - mainPadding * 2 - favoritesTrayHeight - gap;
  
  // Use width as primary constraint to fill screen width
  const cellSize = availableWidth / props.gridWidth;
  
  // But don't exceed height constraint
  const maxCellSizeFromHeight = availableHeight / props.gridHeight;
  
  return Math.max(20, Math.min(cellSize, maxCellSizeFromHeight, 80));
});

const gridStyle = computed(() => {
  const cellSize = dynamicCellSize.value;
  const gridWidthPx = props.gridWidth * cellSize;
  const gridHeightPx = props.gridHeight * cellSize;
  return {
    '--cell-size': `${cellSize}px`,
    width: `${gridWidthPx}px`,
    height: `${gridHeightPx}px`,
  };
});

const gridWrapperStyle = computed(() => {
  const zoomValue = props.zoom ?? 1;
  return {
    transform: `scale(${zoomValue})`,
    transformOrigin: 'center center',
  };
});

// Check if plants would be clipped by decreasing width/height
const canDecreaseWidth = computed(() => {
  if (props.gridWidth <= 1) return false;
  return !props.placedPlants.some(plant => plant.x + plant.width > props.gridWidth - 1);
});

const canDecreaseHeight = computed(() => {
  if (props.gridHeight <= 1) return false;
  return !props.placedPlants.some(plant => plant.y + plant.height > props.gridHeight - 1);
});


const getGridCoords = (event: PointerEvent | MouseEvent, allowOutsideBounds = false): GridCoords | null => {
  const grid = gridRef.value;
  if (!grid || typeof window === 'undefined') return null;
  
  const rect = grid.getBoundingClientRect();
  const clientX = event.clientX;
  const clientY = event.clientY;
  
  // Convert pixel position to feet
  const xFeet = (clientX - rect.left) / dynamicCellSize.value;
  const yFeet = (clientY - rect.top) / dynamicCellSize.value;
  
  // Snap to the specified increment (0.5 or 1.0 ft)
  const snapToIncrement = (value: number, increment: number): number => {
    return Math.round(value / increment) * increment;
  };
  
  const snappedX = snapToIncrement(xFeet, props.snapIncrement);
  const snappedY = snapToIncrement(yFeet, props.snapIncrement);
  
  if (allowOutsideBounds) {
    // Allow coordinates outside grid bounds (for automatic grid expansion)
    // Still ensure non-negative coordinates
    return {
      x: Math.max(0, snappedX),
      y: Math.max(0, snappedY),
    };
  }
  
  // Ensure coordinates are within grid bounds
  // For decimal snap, allow up to gridWidth/gridHeight (exclusive)
  const maxX = props.gridWidth - props.snapIncrement;
  const maxY = props.gridHeight - props.snapIncrement;
  
  return {
    x: Math.max(0, Math.min(maxX, snappedX)),
    y: Math.max(0, Math.min(maxY, snappedY)),
  };
};

const getPlantSize = (plantId: string): number => {
  const plant = props.plantById[plantId];
  if (!plant) return 1;
  const raw = plant['Spread (feet)'];
  const num = parseFloat(String(raw));
  return Number.isFinite(num) && num > 0 ? Math.max(1, Math.round(num)) : 1;
};

const handleDragEnd = (coords: GridCoords, dragType: 'place' | 'move', plantId: string) => {
  const isCtrlHeld = dragState.value.ctrlKey;
  
  // coords now represent the top-left corner where the plant should be placed
  // No additional adjustment needed
  const finalX = coords.x;
  const finalY = coords.y;
  
  if (dragType === 'move' && isCtrlHeld) {
    // Ctrl+drag: duplicate the plant
    const placed = props.placedPlants.find(p => p.id === plantId);
    if (placed) {
      props.placePlant(placed.plantId, finalX, finalY);
    }
  } else if (dragType === 'move') {
    // Normal drag: move the plant
    props.movePlant(plantId, finalX, finalY);
  } else if (dragType === 'place') {
    props.placePlant(plantId, finalX, finalY);
  }
  activeDrag.value = null;
};

const { dragState, handlePointerDown: handlePointerDragStart } = usePointerDrag(
  gridRef,
  dynamicCellSize,
  computed(() => props.gridWidth),
  computed(() => props.gridHeight),
  computed(() => props.snapIncrement),
  handleDragEnd,
  getPlantSize
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
  // Deselect any selected plant when clicking on empty grid
  if (props.selectedPlacedPlantId && !props.isMobile) {
    props.selectPlacedPlant(null);
  }
  
  if (props.isMobile && props.selectedPlantId) {
    // Allow coordinates outside bounds for mobile clicks to enable automatic grid expansion
    const coords = getGridCoords(event, true);
    if (!coords) return;
    props.placePlant(props.selectedPlantId, coords.x, coords.y);
  }
};

const handleGridPointerDown = (event: PointerEvent) => {
  // If there's an active drag from palette, handle it
  if (activeDrag.value && event.isPrimary) {
    // Allow coordinates outside bounds when placing (for automatic grid expansion)
    const allowOutside = activeDrag.value.type === 'place';
    const coords = getGridCoords(event, allowOutside);
    if (coords) {
      handleDragEnd(coords, activeDrag.value.type, activeDrag.value.plantId);
    }
  }
};

const handlePlantDragStart = (event: PointerEvent, placedId: string) => {
  if (event.isPrimary) {
    // Calculate offset from plant's actual position for precise cursor tracking
    const placed = props.placedPlants.find(p => p.id === placedId);
    if (!placed || !gridRef.value) {
      handlePointerDragStart(event, 'move', placedId);
      return;
    }
    
    const grid = gridRef.value;
    const rect = grid.getBoundingClientRect();
    
    // Calculate cursor position relative to grid
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    
    // Calculate plant's position in pixels (relative to grid)
    const plantX = placed.x * dynamicCellSize.value;
    const plantY = placed.y * dynamicCellSize.value;
    
    // Calculate offset from cursor to plant's top-left corner (in grid-relative pixels)
    const offsetX = cursorX - plantX;
    const offsetY = cursorY - plantY;
    
    // Pass offset to drag handler
    handlePointerDragStart(event, 'move', placedId, offsetX, offsetY);
  }
};

const handleDelete = (placedId: string) => {
  props.removePlaced(placedId);
  // Clear selection if deleted plant was selected
  if (props.selectedPlacedPlantId === placedId) {
    props.selectPlacedPlant(null);
  }
};

const handlePlantSelect = (placedId: string) => {
  props.selectPlacedPlant(placedId);
};

const handlePlantMove = (placedId: string, x: number, y: number) => {
  props.movePlant(placedId, x, y);
};

const handleDuplicate = (placedId: string) => {
  const placed = props.placedPlants.find(p => p.id === placedId);
  if (placed) {
    // Place duplicate at an offset position (one snap increment to the right and down)
    // Allow grid to expand if needed, so don't clamp to current grid bounds
    const newX = placed.x + props.snapIncrement;
    const newY = placed.y + props.snapIncrement;
    props.placePlant(placed.plantId, newX, newY);
  }
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
  
  const size = dragPreviewSize.value;
  const sizePx = size * dynamicCellSize.value;
  
  return {
    width: `${sizePx}px`,
    height: `${sizePx}px`,
    'background-image': `linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.35) 70%, rgba(0, 0, 0, 0.35) 100%), url("${props.imageUrl(dragPreviewPlant.value, false)}")`,
  };
});

const dragPreviewWrapperStyle = computed(() => {
  if (!dragState.value.isDragging || !gridRef.value) return {};
  
  const grid = gridRef.value;
  const rect = grid.getBoundingClientRect();
  
  // Calculate cursor position relative to grid
  const cursorX = dragState.value.pointerX - rect.left;
  const cursorY = dragState.value.pointerY - rect.top;
  
  // Calculate where the drag preview should be positioned
  let previewX, previewY;
  
  if (dragState.value.dragType === 'place') {
    // For placing new plants, center the preview on the cursor
    const size = dragPreviewSize.value;
    const sizePx = size * dynamicCellSize.value;
    previewX = cursorX - (sizePx / 2);
    previewY = cursorY - (sizePx / 2);
  } else {
    // For move operations, use stored offset to maintain relative position
    previewX = cursorX - dragState.value.offsetX;
    previewY = cursorY - dragState.value.offsetY;
  }
  
  return {
    position: 'absolute',
    left: `${previewX}px`,
    top: `${previewY}px`,
    pointerEvents: 'none',
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
  const sizePx = size * dynamicCellSize.value;
  
  // coordinates already represent the top-left corner where the plant will be placed
  const snappedPixelX = coords.x * dynamicCellSize.value;
  const snappedPixelY = coords.y * dynamicCellSize.value;
  
  return {
    left: `${snappedPixelX}px`,
    top: `${snappedPixelY}px`,
    width: `${sizePx}px`,
    height: `${sizePx}px`,
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
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 48px;
}

.grid-scroll-inner {
  position: relative;
  margin: 0 auto;
  min-width: fit-content;
  min-height: fit-content;
}

.grid-wrapper {
  transition: transform 0.1s ease-out;
  position: relative;
  display: inline-block;
  margin: 0 auto;
}

@media screen and (max-width: 767px) {
  .grid-scroll {
    border-radius: 12px;
    padding: 32px 4px 4px 40px;
    min-height: 200px;
  }
}

.grid {
  margin: 0 auto;
}

.grid {
  position: relative;
  background-color: #fff;
  min-width: 200px;
  min-height: 200px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.15);
  /* 1ft grid lines */
  background-image:
    repeating-linear-gradient(
      to right,
      rgba(0, 0, 0, 0.15) 0,
      rgba(0, 0, 0, 0.15) 1px,
      transparent 1px,
      transparent var(--cell-size)
    ),
    repeating-linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.15) 0,
      rgba(0, 0, 0, 0.15) 1px,
      transparent 1px,
      transparent var(--cell-size)
    );
  background-position: 0 0;
  touch-action: none;
}

.overlap-hint {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(200, 40, 40, 0.4);
  border-left: 3px solid rgba(200, 40, 40, 0.85);
  border-radius: 4px;
  padding: 6px 10px;
  font-family: Roboto;
  font-size: 12px;
  color: #6b1b1b;
  z-index: 10;
  pointer-events: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  white-space: nowrap;
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

.drag-preview-wrapper {
  position: absolute;
  pointer-events: none;
  z-index: 16;
}

.drag-preview {
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  border: 2px solid rgba(183, 77, 21, 0.6);
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
  padding: 10px 8px;
  line-height: 1.4;
  text-align: center;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9), 0 0 10px rgba(0, 0, 0, 0.6);
  margin-top: 25%;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
  box-sizing: border-box;

  /* Match 2D label readability treatment */
  background: rgba(17, 24, 39, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 12px;
  backdrop-filter: blur(6px);
  max-width: calc(100% - 12px);
  margin-left: auto;
  margin-right: auto;
}

.drag-preview-label .label-line {
  display: block;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.drag-preview-label .label-line.common {
  font-size: 15px;
  font-weight: 700;
}

.drag-preview-label .label-line.scientific {
  font-size: 12px;
  margin-top: 3px;
  opacity: 0.95;
  max-width: 100%;
  white-space: normal;
}

.drag-preview-label .label-line.scientific i {
  font-style: italic;
}

.drag-duplicate-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.3);
  background-color: rgba(255, 255, 255, 0.95);
  color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 18;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  pointer-events: none;
}

.drag-duplicate-icon svg {
  stroke-width: 2.5;
  color: #000;
  stroke: #000;
}

@media screen and (max-width: 767px) {
  .drag-duplicate-icon {
    width: 32px;
    height: 32px;
  }
  
  .drag-duplicate-icon svg {
    width: 16px;
    height: 16px;
  }
}

.resize-controls {
  position: absolute;
  display: flex;
  gap: 4px;
  z-index: 10;
  pointer-events: auto;
}

.resize-controls.top {
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  flex-direction: row;
}

.resize-controls.bottom {
  bottom: -40px;
  left: 50%;
  transform: translateX(-50%);
  flex-direction: row;
}

.resize-controls.left {
  left: -40px;
  top: 50%;
  transform: translateY(-50%);
  flex-direction: column;
}

.resize-controls.right {
  right: -40px;
  top: 50%;
  transform: translateY(-50%);
  flex-direction: column;
}

.resize-button {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #fff;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  font-size: 18px;
  font-weight: 500;
  color: #374151;
  transition: all 0.2s;
  padding: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.resize-button:hover {
  background-color: #f9fafb;
  border-color: #9ca3af;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

.resize-button:active {
  background-color: #f3f4f6;
}

.resize-icon {
  line-height: 1;
  display: block;
}

@media screen and (max-width: 767px) {
  .resize-controls.top {
    top: 4px;
  }

  .resize-controls.left {
    left: 4px;
  }

  .resize-controls.right {
    right: 4px;
  }

  .resize-controls.bottom {
    bottom: 4px;
  }

  .resize-button {
    width: 28px;
    height: 28px;
    font-size: 16px;
  }
}
</style>

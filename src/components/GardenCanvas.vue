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
          :is-popover-open="popoverPlantId === p.id"
          :cell-size="dynamicCellSize"
          :image-url="imageUrl"
          @click="handlePlantClick"
          @drag-start="handlePlantDragStart"
        />

        <div
          v-if="popoverPlaced"
          class="popover"
          :style="popoverStyle"
          @click.stop
        >
          <div class="popover-title">
            {{ (plantById[popoverPlaced.plantId]?.['Common Name']) || popoverPlaced.plantId }}
          </div>
          <div class="popover-row" v-if="plantById[popoverPlaced.plantId]?.['Flowering Months']">
            Bloom: {{ plantById[popoverPlaced.plantId]!['Flowering Months'] }}
          </div>
          <div class="popover-row">
            Spread: {{ spreadFeetLabel(plantById[popoverPlaced.plantId]) }}ft ({{ popoverPlaced.width }} cell<span v-if="popoverPlaced.width !== 1">s</span>)
          </div>
          <div class="popover-actions">
            <button class="primary primary-bar small danger" @click="handleRemove">
              Remove
            </button>
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { usePointerDrag } from '../composables/usePointerDrag';
import PlantCircle from './PlantCircle.vue';
import type { PlacedPlant, Plant, GridCoords } from '../types/garden';

interface Props {
  placedPlants: PlacedPlant[];
  plantById: Record<string, Plant>;
  overlapIds: Set<string>;
  popoverPlantId: string | null;
  selectedPlantId: string | null;
  isMobile: boolean;
  imageUrl: (plant: Plant | undefined, preview: boolean) => string;
  spreadFeetLabel: (plant: Plant | undefined) => string;
  placePlant: (plantId: string, x: number, y: number) => void;
  movePlant: (placedId: string, x: number, y: number) => void;
  removePlaced: (id: string) => void;
  openPopover: (id: string) => void;
  closePopover: () => void;
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

const popoverPlaced = computed(() => {
  if (!props.popoverPlantId) return null;
  return props.placedPlants.find((p) => p.id === props.popoverPlantId) || null;
});

const popoverStyle = computed(() => {
  const p = popoverPlaced.value;
  if (!p) return {};
  return {
    left: `calc(${p.x} * var(--cell-size))`,
    top: `calc(${p.y} * var(--cell-size))`,
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
  if (dragType === 'move') {
    props.movePlant(plantId, coords.x, coords.y);
  } else if (dragType === 'place') {
    props.placePlant(plantId, coords.x, coords.y);
  }
  activeDrag.value = null;
};

const { handlePointerDown: handlePointerDragStart } = usePointerDrag(
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
    return;
  }
  props.closePopover();
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

const handlePlantClick = (placedId: string) => {
  props.openPopover(placedId);
};

const handlePlantDragStart = (event: PointerEvent, placedId: string) => {
  if (!props.isMobile && event.isPrimary) {
    handlePointerDragStart(event, 'move', placedId);
  }
};

const handleRemove = () => {
  if (popoverPlaced.value) {
    props.removePlaced(popoverPlaced.value.id);
  }
};

const handleDocumentClick = (event: Event) => {
  if (!gridAreaRef.value) return;
  if (gridAreaRef.value.contains(event.target as Node)) return;
  props.closePopover();
};

onMounted(() => {
  if (typeof document !== 'undefined') {
    document.addEventListener('click', handleDocumentClick, { passive: true });
  }
});

onBeforeUnmount(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('click', handleDocumentClick);
  }
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

.popover {
  position: absolute;
  transform: translate(8px, 8px);
  width: 240px;
  max-width: 80vw;
  background: #fff;
  border-radius: 14px;
  border: 1px solid #e5e5e5;
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.16);
  padding: 12px;
  z-index: 20;
}

.popover-title {
  font-family: Roboto;
  font-weight: 700;
  margin-bottom: 6px;
  color: #1d2e26;
}

.popover-row {
  font-family: Roboto;
  font-size: 13px;
  color: #333;
  margin-top: 4px;
}

.popover-actions {
  margin-top: 10px;
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
</style>


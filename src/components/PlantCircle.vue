<template>
  <div
    ref="plantRef"
    class="placed"
    :class="{
      overlapping: isOverlapping,
      dragging: isDragging,
      selected: isSelected
    }"
    :style="placedStyle"
    tabindex="0"
    @click="handleClick"
    @pointerdown="handlePointerDown"
    @dblclick="handleDoubleClick"
    @keydown="handleKeyDown"
  >
    <div v-if="showLabel" class="placed-label">
      <!-- Coordinate badge above common name -->
      <div class="coordinate-badge">
        {{ centerPosition }}
      </div>
      <div class="label-line common">{{ plantName }}</div>
      <div v-if="scientificName" class="label-line scientific">
        <i>{{ scientificName }}</i>
      </div>
    </div>
    
    <!-- Action buttons shown when selected -->
    <div v-if="isSelected && !isDragging" class="plant-actions">
      <button
        class="action-button duplicate-button"
        @click.stop="handleDuplicate"
        @pointerdown.stop
        @pointerup.stop
        title="Duplicate plant"
        aria-label="Duplicate plant"
      >
        <Copy :size="18" />
      </button>
      <button
        class="action-button delete-button"
        @click.stop="handleDeleteClick"
        @pointerdown.stop
        @pointerup.stop
        title="Delete plant"
        aria-label="Delete plant"
      >
        <Trash2 :size="18" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { Copy, Trash2 } from 'lucide-vue-next';
import type { PlacedPlant, Plant } from '../types/garden';


interface Emits {
  (e: 'drag-start', event: PointerEvent, placedId: string): void;
  (e: 'delete', placedId: string): void;
  (e: 'select', placedId: string): void;
  (e: 'deselect'): void;
  (e: 'move', placedId: string, x: number, y: number): void;
  (e: 'duplicate', placedId: string): void;
}

interface Props {
  placed: PlacedPlant;
  plant: Plant | undefined;
  isOverlapping: boolean;
  isDragging?: boolean;
  isSelected?: boolean;
  showLabel?: boolean;
  cellSize: number;
  imageUrl: (plant: Plant | undefined, preview: boolean) => string;
  isMobile: boolean;
  snapIncrement: number;
  gridWidth: number;
  gridHeight: number;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const plantRef = ref<HTMLElement | null>(null);

// Focus the plant when it becomes selected
watch(() => props.isSelected, (isSelected) => {
  if (isSelected && plantRef.value) {
    nextTick(() => {
      plantRef.value?.focus();
    });
  }
});

const plantName = computed(() => {
  return props.plant?.['Common Name'] || props.placed.plantId;
});

const scientificName = computed(() => {
  return props.plant?.['Scientific Name'] || null;
});

// Calculate center position in grid coordinates (top-left is 0,0 anchor)
const centerPosition = computed(() => {
  const centerX = props.placed.x + (props.placed.width / 2);
  const centerY = props.placed.y + (props.placed.height / 2);
  
  // Format based on snap increment
  const formatCoord = (value: number, increment: number): string => {
    if (increment === 0.5) {
      // Show one decimal place for 0.5ft snap, but remove .0 for whole numbers
      if (value % 1 === 0) {
        return Math.round(value).toString();
      } else {
        return value.toFixed(1);
      }
    } else {
      // Show whole numbers for 1ft snap
      return Math.round(value).toString();
    }
  };
  
  return `${formatCoord(centerX, props.snapIncrement)},${formatCoord(centerY, props.snapIncrement)}`;
});

const placedStyle = computed(() => {
  return {
    '--x': props.placed.x,
    '--y': props.placed.y,
    '--w': props.placed.width,
    '--h': props.placed.height,
    'background-image': `linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.35) 70%, rgba(0, 0, 0, 0.35) 100%), url("${props.imageUrl(props.plant, false)}")`,
  };
});

// Track for double-tap on mobile
let lastTapTime = 0;
let tapTimeout: number | null = null;
let dragStartTime = 0;
let dragStartPos: { x: number; y: number } | null = null;
let hasMoved = false;
let isClicking = false;

const handlePointerDown = (event: PointerEvent) => {
  if (event.isPrimary) {
    // Don't preventDefault here - let click events fire
    // On mobile, detect double-tap or drag
    if (props.isMobile) {
      const currentTime = Date.now();
      const tapLength = currentTime - lastTapTime;
      
      if (tapLength < 300 && tapLength > 0 && !hasMoved) {
        // Double tap detected (only if no movement occurred)
        if (tapTimeout) {
          clearTimeout(tapTimeout);
          tapTimeout = null;
        }
        event.preventDefault();
        event.stopPropagation();
        emit('delete', props.placed.id);
        lastTapTime = 0;
        hasMoved = false;
        dragStartPos = null;
      } else {
        // Single tap - track for potential drag or double-tap
        lastTapTime = currentTime;
        dragStartTime = currentTime;
        dragStartPos = { x: event.clientX, y: event.clientY };
        hasMoved = false;
        
        // Set up listeners to detect drag vs tap
        const handleMove = (moveEvent: PointerEvent) => {
          if (!dragStartPos) return;
          
          const moveDistance = Math.sqrt(
            Math.pow(moveEvent.clientX - dragStartPos.x, 2) + 
            Math.pow(moveEvent.clientY - dragStartPos.y, 2)
          );
          
          // If moved more than 5px, it's a drag
          if (moveDistance > 5) {
            hasMoved = true;
            if (tapTimeout) {
              clearTimeout(tapTimeout);
              tapTimeout = null;
            }
            // Start drag
            emit('drag-start', event, props.placed.id);
            document.removeEventListener('pointermove', handleMove);
            document.removeEventListener('pointerup', handleUp);
          }
        };
        
        const handleUp = (upEvent: PointerEvent) => {
          document.removeEventListener('pointermove', handleMove);
          document.removeEventListener('pointerup', handleUp);
          
          // If no movement, treat as a tap-to-select (mobile)
          if (!hasMoved) {
            // Prevent the grid click/placement behavior from also firing.
            upEvent.preventDefault();
            upEvent.stopPropagation();

            // Toggle selection; selected state controls showing duplicate/trash buttons.
            emit('select', props.placed.id);

            // Focus the plant element for accessibility (safe no-op if not focusable on mobile).
            nextTick(() => {
              plantRef.value?.focus();
            });
          }
          
          dragStartPos = null;
        };
        
        document.addEventListener('pointermove', handleMove);
        document.addEventListener('pointerup', handleUp);
      }
    } else {
      // Desktop: detect drag vs click
      dragStartTime = Date.now();
      dragStartPos = { x: event.clientX, y: event.clientY };
      hasMoved = false;
      isClicking = true;
      
      const handleMove = (moveEvent: PointerEvent) => {
        if (!dragStartPos) return;
        
        const moveDistance = Math.sqrt(
          Math.pow(moveEvent.clientX - dragStartPos.x, 2) + 
          Math.pow(moveEvent.clientY - dragStartPos.y, 2)
        );
        
        // If moved more than 5px, it's a drag
        if (moveDistance > 5) {
          hasMoved = true;
          isClicking = false;
          // Start drag - now we can preventDefault to stop click
          event.preventDefault();
          emit('drag-start', event, props.placed.id);
          document.removeEventListener('pointermove', handleMove);
          document.removeEventListener('pointerup', handleUp);
        }
      };
      
      const handleUp = (upEvent: PointerEvent) => {
        document.removeEventListener('pointermove', handleMove);
        document.removeEventListener('pointerup', handleUp);
        
        // Don't handle selection here - let the click event handle it
        // But prevent grid click if it was just a click
        if (!hasMoved) {
          upEvent.stopPropagation();
        }
        
        dragStartPos = null;
      };
      
      document.addEventListener('pointermove', handleMove);
      document.addEventListener('pointerup', handleUp);
    }
  }
};

const handleClick = (event: MouseEvent) => {
  // Only handle click if it wasn't part of a drag (on desktop)
  if (!props.isMobile) {
    // Check if this was a real click (not a drag end)
    // hasMoved will be false if it was just a click
    if (!hasMoved) {
      event.preventDefault();
      event.stopPropagation();
      emit('select', props.placed.id);
      // Focus the plant element
      nextTick(() => {
        if (plantRef.value) {
          plantRef.value.focus();
        }
      });
    }
    // Reset the flag after handling
    hasMoved = false;
  }
};

const handleKeyDown = (event: KeyboardEvent) => {
  // Only handle keyboard events if this plant is selected
  if (!props.isSelected) return;
  
  // Handle arrow keys for movement
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault();
    
    let newX = props.placed.x;
    let newY = props.placed.y;
    const moveDistance = props.snapIncrement;
    
    switch (event.key) {
      case 'ArrowUp':
        newY = Math.max(0, props.placed.y - moveDistance);
        break;
      case 'ArrowDown':
        newY = Math.min(props.gridHeight - props.placed.height, props.placed.y + moveDistance);
        break;
      case 'ArrowLeft':
        newX = Math.max(0, props.placed.x - moveDistance);
        break;
      case 'ArrowRight':
        newX = Math.min(props.gridWidth - props.placed.width, props.placed.x + moveDistance);
        break;
    }
    
    // Only move if position actually changed
    if (newX !== props.placed.x || newY !== props.placed.y) {
      emit('move', props.placed.id, newX, newY);
    }
  }
  
  // Handle delete key
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    emit('delete', props.placed.id);
  }
  
  // Handle Enter/Esc to deselect
  if (event.key === 'Enter' || event.key === 'Escape') {
    event.preventDefault();
    emit('deselect');
  }
};

const handleDoubleClick = (event: MouseEvent) => {
  // Desktop: double-click to delete
  if (!props.isMobile) {
    event.preventDefault();
    emit('delete', props.placed.id);
  }
};

const handleDuplicate = () => {
  emit('duplicate', props.placed.id);
};

const handleDeleteClick = () => {
  emit('delete', props.placed.id);
};
</script>

<style scoped>
.placed {
  position: absolute;
  left: calc(var(--x) * var(--cell-size, 36px));
  top: calc(var(--y) * var(--cell-size, 36px));
  width: calc(var(--w) * var(--cell-size, 36px));
  height: calc(var(--h) * var(--cell-size, 36px));
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  border: 2px solid rgba(183, 77, 21, 0.6);
  cursor: move;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  touch-action: none;
}

.placed.overlapping {
  border-color: rgba(220, 30, 30, 1);
  border-style: dashed;
  animation: pulseOverlap 1.75s ease-in-out infinite;
}

.placed.dragging {
  opacity: 0.4;
  pointer-events: none;
}

.placed.selected {
  box-shadow: 0 0 0 4px rgba(0, 0, 0, 1), 0 0 0 6px rgba(255, 255, 255, 0.8);
  z-index: 20;
}

.placed:focus {
  outline: none;
}

.placed:focus.selected {
  box-shadow: 0 0 0 4px rgba(0, 0, 0, 1), 0 0 0 6px rgba(255, 255, 255, 0.8);
}

.placed-label {
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
  pointer-events: none;

  /* Improve readability over bright photos while keeping the same layout */
  background: rgba(17, 24, 39, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 12px;
  backdrop-filter: blur(6px);
  max-width: calc(100% - 12px);
  margin-left: auto;
  margin-right: auto;
}

.label-line {
  display: block;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.label-line.common {
  font-size: 15px;
  font-weight: 700;
}

.label-line.scientific {
  font-size: 12px;
  margin-top: 3px;
  opacity: 0.95;
  max-width: 100%;
  white-space: normal;
}

.label-line.scientific i {
  font-style: italic;
}

.coordinate-badge {
  display: inline-block;
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Roboto Mono', monospace;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  text-shadow: none;
  white-space: nowrap;
  pointer-events: none;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  margin-bottom: 4px;
}

@keyframes pulseOverlap {
  0%, 100% {
    border-width: 2px;
    box-shadow: 0 0 0 2px rgba(220, 30, 30, 0.3);
  }
  50% {
    border-width: 6px;
    box-shadow: 0 0 0 5px rgba(220, 30, 30, 0.5);
  }
}

.plant-actions {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  gap: 6px;
  z-index: 25;
  pointer-events: auto;
}

.action-button {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid rgba(0, 0, 0, 0.3);
  background-color: rgba(255, 255, 255, 0.95);
  color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(4px);
  padding: 0;
}

.action-button:hover {
  background-color: rgba(255, 255, 255, 1);
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  border-color: rgba(0, 0, 0, 0.5);
}

.action-button:active {
  transform: scale(0.95);
}

.action-button.duplicate-button:hover {
  background-color: rgba(76, 175, 80, 0.95);
  border-color: rgba(76, 175, 80, 0.8);
}

.action-button.duplicate-button:hover svg {
  color: #000;
  stroke: #000;
}

.action-button.delete-button:hover {
  background-color: rgba(220, 30, 30, 0.95);
  border-color: rgba(220, 30, 30, 0.8);
}

.action-button.delete-button:hover svg {
  color: #000;
  stroke: #000;
}

.action-button svg {
  stroke-width: 2.5;
  color: #000;
  stroke: #000;
}

@media screen and (max-width: 767px) {
  .coordinate-badge {
    font-size: 10px;
    padding: 2px 5px;
    margin-bottom: 3px;
  }
  
  .plant-actions {
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    gap: 4px;
  }
  
  .action-button {
    width: 32px;
    height: 32px;
  }
  
  .action-button svg {
    width: 16px;
    height: 16px;
  }
}
</style>


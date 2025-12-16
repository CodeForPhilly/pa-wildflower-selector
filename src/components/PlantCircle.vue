<template>
  <div
    class="placed"
    :class="{
      overlapping: isOverlapping,
      popoverOpen: isPopoverOpen,
      dragging: isDragging
    }"
    :style="placedStyle"
    @pointerdown="handlePointerDown"
    @click.stop="handleClick"
  >
    <div class="placed-label">
      {{ plantName }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { PlacedPlant, Plant } from '../types/garden';

interface Props {
  placed: PlacedPlant;
  plant: Plant | undefined;
  isOverlapping: boolean;
  isPopoverOpen: boolean;
  isDragging?: boolean;
  cellSize: number;
  imageUrl: (plant: Plant | undefined, preview: boolean) => string;
}

interface Emits {
  (e: 'click', placedId: string): void;
  (e: 'drag-start', event: PointerEvent, placedId: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const plantName = computed(() => {
  return props.plant?.['Common Name'] || props.placed.plantId;
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

const handleClick = () => {
  emit('click', props.placed.id);
};

const handlePointerDown = (event: PointerEvent) => {
  if (event.isPrimary) {
    emit('drag-start', event, props.placed.id);
  }
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
  align-items: flex-end;
  overflow: hidden;
  touch-action: none;
}

.placed.overlapping {
  border-color: rgba(200, 40, 40, 0.85);
  box-shadow: 0 0 0 2px rgba(200, 40, 40, 0.15);
}

.placed.popoverOpen {
  box-shadow: 0 0 0 3px rgba(183, 77, 21, 0.15);
}

.placed.dragging {
  opacity: 0.4;
  pointer-events: none;
}

.placed-label {
  width: 100%;
  font-family: Roboto;
  font-size: 12px;
  color: #fff;
  padding: 8px 10px;
  line-height: 1.2;
}
</style>


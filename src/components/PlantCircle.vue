<template>
  <div
    class="placed"
    :class="{
      overlapping: isOverlapping,
      dragging: isDragging
    }"
    :style="placedStyle"
    @pointerdown="handlePointerDown"
  >
    <div class="placed-label">
      <div class="label-line common">{{ plantName }}</div>
      <div v-if="scientificName" class="label-line scientific">
        <i>{{ scientificName }}</i>
      </div>
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
  isDragging?: boolean;
  cellSize: number;
  imageUrl: (plant: Plant | undefined, preview: boolean) => string;
}

interface Emits {
  (e: 'drag-start', event: PointerEvent, placedId: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const plantName = computed(() => {
  return props.plant?.['Common Name'] || props.placed.plantId;
});

const scientificName = computed(() => {
  return props.plant?.['Scientific Name'] || null;
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
  align-items: center;
  justify-content: center;
  overflow: hidden;
  touch-action: none;
}

.placed.overlapping {
  border-color: rgba(200, 40, 40, 0.85);
  box-shadow: 0 0 0 2px rgba(200, 40, 40, 0.15);
}

.placed.dragging {
  opacity: 0.4;
  pointer-events: none;
}

.placed-label {
  width: 100%;
  font-family: Roboto;
  font-size: 13px;
  color: #fff;
  padding: 12px 8px;
  line-height: 1.4;
  text-align: center;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9), 0 0 10px rgba(0, 0, 0, 0.6);
  margin-top: 25%;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
  box-sizing: border-box;
}

.label-line {
  display: block;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.label-line.common {
  font-size: 14px;
  font-weight: 500;
}

.label-line.scientific {
  font-size: 0.85em;
  margin-top: 3px;
  opacity: 0.95;
  max-width: 100%;
  white-space: normal;
}

.label-line.scientific i {
  font-style: italic;
}
</style>


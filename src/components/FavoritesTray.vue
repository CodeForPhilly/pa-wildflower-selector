<template>
  <aside class="palette" :class="{ mobile: isMobile }" aria-label="Plant palette">
    <div class="palette-header">
      <h2>Favorites</h2>
      <div class="palette-subtitle" v-if="favoritePlants.length">
        Drag (desktop) or tap-to-place (mobile)
      </div>
      <div class="palette-subtitle" v-else-if="!loading">
        No favorites yet. Add favorites first.
      </div>
    </div>

    <div class="palette-items" role="list">
      <button
        v-for="plant in favoritePlants"
        :key="plant._id"
        type="button"
        role="listitem"
        class="palette-item"
        :class="{ active: plant._id === selectedPlantId }"
        @click="handleClick(plant._id)"
        @pointerdown="handlePointerDown($event, plant._id)"
        :title="plant['Common Name'] || plant._id"
      >
        <span class="thumb" :style="thumbStyle(plant)"></span>
        <span class="info">
          <span class="name">{{ plant['Common Name'] || plant._id }}</span>
          <span class="meta">
            Spread: {{ spreadFeetLabel(plant) }}ft ({{ spreadCells(plant) }} cell<span v-if="spreadCells(plant) !== 1">s</span>)
          </span>
        </span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { Plant } from '../types/garden';

interface Props {
  favoritePlants: Plant[];
  selectedPlantId: string | null;
  isMobile: boolean;
  loading: boolean;
  imageUrl: (plant: Plant | undefined, preview: boolean) => string;
  spreadFeetLabel: (plant: Plant | undefined) => string;
  spreadCells: (plant: Plant | undefined) => number;
}

interface Emits {
  (e: 'select', plantId: string | null): void;
  (e: 'drag-start', event: PointerEvent, plantId: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const handleClick = (plantId: string) => {
  if (props.isMobile) {
    emit('select', props.selectedPlantId === plantId ? null : plantId);
  }
};

const handlePointerDown = (event: PointerEvent, plantId: string) => {
  if (!props.isMobile && event.isPrimary) {
    emit('drag-start', event, plantId);
  }
};

const thumbStyle = (plant: Plant) => {
  return {
    'background-image': `url("${props.imageUrl(plant, true)}")`,
  };
};
</script>

<style scoped>
.palette {
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 16px;
  padding: 12px;
}

.palette.mobile {
  position: sticky;
  bottom: 0;
  z-index: 10;
  border-radius: 16px 16px 0 0;
  padding-bottom: 8px;
}

.palette-header h2 {
  margin: 0;
  font-family: Arvo;
  font-size: 18px;
}

.palette-subtitle {
  margin-top: 4px;
  font-family: Roboto;
  font-size: 13px;
  color: #555;
}

.palette-items {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: visible;
  padding-right: 4px;
}

.palette.mobile .palette-items {
  max-height: none;
  overflow-x: visible;
  overflow-y: visible;
  flex-direction: row;
  padding-bottom: 6px;
}

.palette-item {
  display: flex;
  gap: 10px;
  align-items: center;
  border: 1px solid #eee;
  border-radius: 14px;
  background: #fcf9f4;
  padding: 10px;
  cursor: pointer;
  text-align: left;
  min-width: 260px;
  touch-action: none;
}

.palette.mobile .palette-item {
  min-width: 240px;
}

.palette-item.active {
  border-color: #b74d15;
  box-shadow: 0 0 0 2px rgba(183, 77, 21, 0.18);
}

.thumb {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background-size: cover;
  background-position: center;
  flex: 0 0 auto;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.name {
  font-family: Roboto;
  font-size: 14px;
  font-weight: 600;
  color: #1d2e26;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  font-family: Roboto;
  font-size: 12px;
  color: #666;
}
</style>


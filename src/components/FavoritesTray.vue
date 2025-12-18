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
            {{ spreadFeetLabel(plant) }}ft Spread
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
  padding: 8px;
  flex-shrink: 0;
}

.palette.mobile {
  padding: 6px 8px;
  max-height: 120px;
  overflow-y: hidden;
}

.palette-header h2 {
  margin: 0;
  font-family: Arvo;
  font-size: 16px;
}

.palette.mobile .palette-header {
  margin-bottom: 4px;
}

.palette.mobile .palette-header h2 {
  font-size: 14px;
}

.palette-subtitle {
  margin-top: 2px;
  font-family: Roboto;
  font-size: 11px;
  color: #555;
  line-height: 1.2;
}

.palette.mobile .palette-subtitle {
  font-size: 10px;
  margin-top: 1px;
}

.palette-items {
  margin-top: 6px;
  display: flex;
  flex-direction: row;
  gap: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 4px;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
}

.palette-items::-webkit-scrollbar {
  height: 4px;
}

.palette-items::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 2px;
}

.palette.mobile .palette-items::-webkit-scrollbar {
  height: 4px;
}

.palette.mobile .palette-items::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 2px;
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
  touch-action: none;
}

.palette.mobile .palette-item {
  padding: 8px;
  gap: 8px;
  flex-shrink: 0;
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

.palette.mobile .thumb {
  width: 40px;
  height: 40px;
  border-radius: 10px;
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

.palette.mobile .name {
  font-size: 13px;
}

.meta {
  font-family: Roboto;
  font-size: 12px;
  color: #666;
}

.palette.mobile .meta {
  font-size: 11px;
  line-height: 1.2;
}
</style>


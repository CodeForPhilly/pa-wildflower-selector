<template>
  <section class="toolbar" aria-label="Planner toolbar">
    <div class="toolbar-container">
      <div class="toolbar-left">
        <button
          class="toolbar-button icon-only"
          @click="$emit('undo')"
          :disabled="!canUndo"
          title="Undo"
        >
          <Undo2 :size="16" class="icon" />
          <span class="button-text">Undo</span>
        </button>
        <button
          class="toolbar-button icon-only"
          @click="$emit('redo')"
          :disabled="!canRedo"
          title="Redo"
        >
          <Redo2 :size="16" class="icon" />
          <span class="button-text">Redo</span>
        </button>
        <button
          class="toolbar-button clear-button icon-only"
          @click="$emit('clear')"
          :disabled="!canClear"
          title="Clear"
        >
          <Trash2 :size="16" class="icon" />
          <span class="button-text">Clear</span>
        </button>

        <button class="toolbar-button icon-only" @click="$emit('export')" title="Export Design">
          <Download :size="16" class="icon" />
          <span class="button-text">Export</span>
        </button>
        <button class="toolbar-button icon-only" @click="$emit('import')" title="Import Design">
          <Upload :size="16" class="icon" />
          <span class="button-text">Import</span>
        </button>

        <button class="toolbar-button icon-only" @click="$emit('toggle-3d')" :title="is3D ? 'View in 2D' : 'View in 3D'">
          <Grid3x3 v-if="is3D" :size="16" class="icon" />
          <Box v-else :size="16" class="icon" />
          <span class="button-text">{{ is3D ? 'View in 2D' : 'View in 3D' }}</span>
        </button>

        <button
          class="toolbar-button summary-button icon-only"
          :class="{ active: summaryActive }"
          @click="$emit('toggle-summary')"
          title="View Summary"
        >
          <Info :size="16" class="icon" />
          <span class="button-text">Summary</span>
        </button>
      </div>

      <div class="toolbar-right">
        <button class="toolbar-button icon-only" @click="$emit('cycle-labels')" :title="`Labels: ${labelsLabel}`">
          <Tag :size="16" class="icon" />
          <span class="button-text">Labels: {{ labelsLabel }}</span>
        </button>

        <div class="toolbar-zoom">
          <button
            class="toolbar-button icon-only"
            @click="$emit('zoom-out')"
            :disabled="zoom <= 0.5"
            title="Zoom Out"
          >
            <ZoomOut :size="16" class="icon" />
          </button>
          <span class="zoom-value">{{ Math.round(zoom * 100) }}%</span>
          <button
            class="toolbar-button icon-only"
            @click="$emit('zoom-in')"
            :disabled="zoom >= 2"
            title="Zoom In"
          >
            <ZoomIn :size="16" class="icon" />
          </button>
          <button
            class="toolbar-button icon-only"
            @click="$emit('zoom-reset')"
            :disabled="zoom === 1"
            title="Reset Zoom"
          >
            <RotateCcw :size="16" class="icon" />
          </button>
        </div>

        <button
          class="toolbar-button grid-dimensions-button"
          @click="$emit('open-grid-editor')"
          :title="`Current grid: ${gridWidth}ft × ${gridHeight}ft`"
        >
          Grid: <strong>{{ gridWidth }}</strong>ft × <strong>{{ gridHeight }}</strong>ft
        </button>

        <button class="toolbar-button snap-toggle-button" @click="$emit('toggle-snap')" :title="`Toggle grid snap size (currently ${snapIncrement}ft)`">
          <svg
            class="icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            style="width: 16px; height: 16px;"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" />
            <line x1="12" y1="3" x2="12" y2="21" />
            <line x1="3" y1="12" x2="21" y2="12" />
          </svg>
          <span class="snap-value">{{ snapIncrement }}ft</span>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  Undo2,
  Redo2,
  Trash2,
  Info,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Box,
  Download,
  Upload,
  Grid3x3,
  Tag,
} from 'lucide-vue-next';

type LabelMode = 'off' | 'selected' | 'all';

const props = defineProps<{
  is3D: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canClear: boolean;
  summaryActive?: boolean;
  zoom: number;
  gridWidth: number;
  gridHeight: number;
  snapIncrement: number;
  labelMode: LabelMode;
}>();

defineEmits<{
  (e: 'undo'): void;
  (e: 'redo'): void;
  (e: 'clear'): void;
  (e: 'export'): void;
  (e: 'import'): void;
  (e: 'toggle-summary'): void;
  (e: 'toggle-3d'): void;
  (e: 'open-grid-editor'): void;
  (e: 'toggle-snap'): void;
  (e: 'zoom-in'): void;
  (e: 'zoom-out'): void;
  (e: 'zoom-reset'): void;
  (e: 'cycle-labels'): void;
}>();

const labelsLabel = computed(() => {
  if (props.labelMode === 'off') return 'Off';
  if (props.labelMode === 'all') return 'All';
  return 'Selected';
});
</script>

<style scoped>
.toolbar {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: flex-start;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.toolbar-container {
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 16px;
  padding: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  flex: 1;
}

.toolbar-left {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.toolbar-right {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-left: auto;
  text-align: right;
  font-family: Roboto;
}

.toolbar-zoom {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-shrink: 0;
}

.zoom-value {
  font-size: 14px;
  font-weight: 500;
  font-family: Roboto, sans-serif;
  color: #374151;
  min-width: 3rem;
  text-align: center;
}

.toolbar-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 14px;
  font-family: Roboto, sans-serif;
  font-weight: 500;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background-color: #fff;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.toolbar-button:hover:not(:disabled) {
  background-color: #f9fafb;
  border-color: #9ca3af;
}

.toolbar-button:active:not(:disabled) {
  background-color: #f3f4f6;
}

.toolbar-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toolbar-button .icon {
  flex-shrink: 0;
  stroke-width: 2;
}

.toolbar-button .button-text {
  display: inline;
}

.toolbar-button.clear-button {
  color: #dc2626;
  border-color: #dc2626;
  background-color: transparent;
}

.toolbar-button.clear-button:hover:not(:disabled) {
  color: #b91c1c;
  background-color: #fef2f2;
  border-color: #b91c1c;
}

.toolbar-button.summary-button {
  background-color: transparent;
}

.toolbar-button.summary-button.active {
  background-color: #16a34a;
  color: #fff;
  border-color: #16a34a;
}

.toolbar-button.summary-button.active:hover {
  background-color: #15803d;
  border-color: #15803d;
}

.snap-toggle-button {
  font-family: 'Roboto Mono', monospace;
}

.snap-value {
  font-weight: 600;
}

.grid-dimensions-button strong {
  font-weight: 600;
}

@media screen and (max-width: 767px) {
  .toolbar {
    gap: 8px;
    margin-bottom: 8px;
    align-items: center;
  }

  .toolbar-container {
    padding: 6px;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }

  .toolbar-left {
    flex-wrap: wrap;
    gap: 6px;
  }

  .toolbar-right {
    flex-wrap: wrap;
    gap: 6px;
    margin-left: 0;
    text-align: left;
  }

  .toolbar-zoom {
    gap: 4px;
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
  }

  .toolbar-button {
    padding: 5px 10px;
    font-size: 13px;
  }

  .toolbar-button.icon-only {
    padding: 8px;
    min-width: 44px;
    min-height: 44px;
    justify-content: center;
  }

  .toolbar-button.icon-only .button-text {
    display: none;
  }

  .zoom-value {
    font-size: 12px;
    min-width: 2.5rem;
  }

  .grid-dimensions-button {
    font-size: 12px;
    padding: 5px 10px;
    line-height: 1.3;
  }
}
</style>





<template>
  <div class="garden-planner">
    <Header h1="Garden Planner" :large-h1="false" />

    <main class="planner-main">
      <section class="toolbar" aria-label="Planner toolbar">
        <div class="size-controls">
          <label class="size-field">
            <span class="label">Width (ft)</span>
            <input
              type="number"
              min="1"
              step="1"
              v-model.number="userBaseWidth"
              @change="normalizeBaseSizes"
            />
          </label>
          <label class="size-field">
            <span class="label">Height (ft)</span>
            <input
              type="number"
              min="1"
              step="1"
              v-model.number="userBaseHeight"
              @change="normalizeBaseSizes"
            />
          </label>
          <button class="primary primary-bar small" @click="clearLayout">
            Clear Layout
          </button>
          <button class="primary primary-bar small subtle" @click="resetPlanner">
            Reset
          </button>
        </div>

        <div class="toolbar-right">
          <div class="grid-readout">
            Grid: <strong>{{ effectiveWidth }}</strong>ft ×
            <strong>{{ effectiveHeight }}</strong>ft
          </div>
          <div class="tap-hint" v-if="isMobile">
            Tap a plant below, then tap the grid to place.
          </div>
        </div>
      </section>

      <section class="workspace" :class="{ mobile: isMobile }">
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
              :draggable="!isMobile"
              @dragstart="onPaletteDragStart($event, plant._id)"
              @click="onPaletteClick(plant._id)"
              :title="plant['Common Name'] || plant._id"
            >
              <span class="thumb" :style="thumbStyle(plant)"></span>
              <span class="info">
                <span class="name">{{ plant["Common Name"] || plant._id }}</span>
                <span class="meta">
                  Spread: {{ spreadFeetLabel(plant) }}ft ({{ spreadCells(plant) }} cell<span v-if="spreadCells(plant) !== 1">s</span>)
                </span>
              </span>
            </button>
          </div>
        </aside>

        <div class="grid-area">
          <div class="grid-scroll">
            <div
              ref="grid"
              class="grid"
              :style="gridStyle"
              @click="onGridClick"
              @dragover.prevent="onGridDragOver"
              @drop.prevent="onGridDrop"
              aria-label="Garden planner grid"
              role="application"
            >
              <div
                v-for="p in placedPlants"
                :key="p.id"
                class="placed"
                :class="{
                  overlapping: overlapIds.has(p.id),
                  popoverOpen: popoverPlantId === p.id
                }"
                :style="placedStyle(p)"
                :draggable="!isMobile"
                @dragstart="onPlacedDragStart($event, p.id)"
                @dragend="onPlacedDragEnd"
                @click.stop="openPopover(p.id)"
              >
                <div class="placed-label">
                  {{ (plantById[p.plantId] && plantById[p.plantId]["Common Name"]) || p.plantId }}
                </div>
              </div>

              <div
                v-if="popoverPlaced"
                class="popover"
                :style="popoverStyle(popoverPlaced)"
                @click.stop
              >
                <div class="popover-title">
                  {{ (plantById[popoverPlaced.plantId] && plantById[popoverPlaced.plantId]["Common Name"]) || popoverPlaced.plantId }}
                </div>
                <div class="popover-row" v-if="plantById[popoverPlaced.plantId] && plantById[popoverPlaced.plantId]['Flowering Months']">
                  Bloom: {{ plantById[popoverPlaced.plantId]["Flowering Months"] }}
                </div>
                <div class="popover-row">
                  Spread: {{ spreadFeetLabel(plantById[popoverPlaced.plantId]) }}ft ({{ popoverPlaced.width }} cell<span v-if="popoverPlaced.width !== 1">s</span>)
                </div>
                <div class="popover-actions">
                  <button class="primary primary-bar small danger" @click="removePlaced(popoverPlaced.id)">
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
      </section>
    </main>
  </div>
</template>

<script>
import qs from "qs";
import Header from "./Header.vue";

const STORAGE_KEY = "gardenPlanner:v1";

export default {
  name: "GardenPlanner",
  components: { Header },
  props: {
    favorites: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    return {
      loading: false,
      loadError: null,
      favoritePlants: [],

      // userBase* is the user-editable size. The rendered size is effective* which can grow.
      userBaseWidth: 10,
      userBaseHeight: 8,

      placedPlants: [],
      selectedPlantId: null, // mobile tap-to-place selection

      viewportWidth: 1024,
      popoverPlantId: null,
      draggingPlantId: null,

      saveTimeoutId: null,
      hasLoadedFromStorage: false,
      hasAppliedInitialSizing: false,
    };
  },
  computed: {
    isMobile() {
      return this.viewportWidth <= 767;
    },
    favoriteIds() {
      const fav = this.$store && this.$store.state && this.$store.state.favorites;
      if (!fav) return [];
      // Vuex stores favorites as a Set
      return [...fav];
    },
    plantById() {
      const map = {};
      for (const p of this.favoritePlants) {
        map[p._id] = p;
      }
      return map;
    },
    largestFavoriteCells() {
      let max = 1;
      for (const p of this.favoritePlants) {
        max = Math.max(max, this.spreadCells(p));
      }
      return max;
    },
    effectiveWidth() {
      let maxX = 0;
      for (const p of this.placedPlants) {
        maxX = Math.max(maxX, p.x + p.width);
      }
      return Math.max(this.userBaseWidth || 1, maxX || 0, 1);
    },
    effectiveHeight() {
      let maxY = 0;
      for (const p of this.placedPlants) {
        maxY = Math.max(maxY, p.y + p.height);
      }
      return Math.max(this.userBaseHeight || 1, maxY || 0, 1);
    },
    overlapIds() {
      const overlaps = new Set();
      const items = this.placedPlants || [];
      for (let i = 0; i < items.length; i++) {
        const a = items[i];
        for (let j = i + 1; j < items.length; j++) {
          const b = items[j];
          if (this.rectsOverlap(a, b)) {
            overlaps.add(a.id);
            overlaps.add(b.id);
          }
        }
      }
      return overlaps;
    },
    popoverPlaced() {
      if (!this.popoverPlantId) return null;
      return this.placedPlants.find((p) => p.id === this.popoverPlantId) || null;
    },
    gridStyle() {
      return {
        "--cols": this.effectiveWidth,
        "--rows": this.effectiveHeight,
      };
    },
  },
  watch: {
    favoriteIds() {
      this.fetchFavorites();
    },
    placedPlants: {
      deep: true,
      handler() {
        this.scheduleSave();
      },
    },
    userBaseWidth() {
      this.scheduleSave();
    },
    userBaseHeight() {
      this.scheduleSave();
    },
    favoritePlants() {
      // If we didn't load from storage, apply initial sizing once favorites arrive.
      if (!this.hasLoadedFromStorage && !this.hasAppliedInitialSizing) {
        this.applyInitialSizingFromFavorites();
      }
    },
  },
  mounted() {
    if (typeof window !== "undefined") {
      this.viewportWidth = window.innerWidth;
      window.addEventListener("resize", this.onResize, { passive: true });
      document.addEventListener("click", this.onDocumentClick, { passive: true });
    }

    this.loadFromStorage();
    this.fetchFavorites();
  },
  beforeUnmount() {
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", this.onResize);
      document.removeEventListener("click", this.onDocumentClick);
    }
    if (this.saveTimeoutId) {
      clearTimeout(this.saveTimeoutId);
      this.saveTimeoutId = null;
    }
  },
  methods: {
    onResize() {
      this.viewportWidth = window.innerWidth;
    },
    onDocumentClick(event) {
      if (!this.$el) return;
      if (this.$el.contains(event.target)) return;
      this.popoverPlantId = null;
    },
    normalizeBaseSizes() {
      const w = parseInt(this.userBaseWidth, 10);
      const h = parseInt(this.userBaseHeight, 10);
      this.userBaseWidth = Number.isFinite(w) && w > 0 ? w : 1;
      this.userBaseHeight = Number.isFinite(h) && h > 0 ? h : 1;
    },
    rectsOverlap(a, b) {
      // AABB overlap (grid units)
      const ax2 = a.x + a.width;
      const ay2 = a.y + a.height;
      const bx2 = b.x + b.width;
      const by2 = b.y + b.height;
      return a.x < bx2 && ax2 > b.x && a.y < by2 && ay2 > b.y;
    },
    imageUrl(plant, preview) {
      if (!plant) return "/assets/images/missing-image.png";
      if (plant.hasImage) {
        if (preview) {
          return `/images/${plant._id}.preview.jpg`;
        }
        return `/images/${plant._id}.jpg`;
      }
      return "/assets/images/missing-image.png";
    },
    thumbStyle(plant) {
      return {
        "background-image": `url("${this.imageUrl(plant, true)}")`,
      };
    },
    spreadFeetLabel(plant) {
      if (!plant) return "1";
      const raw = plant["Spread (feet)"];
      const num = parseFloat(raw);
      if (!Number.isFinite(num) || num <= 0) return "1";
      // Keep original precision display (but avoid long floats)
      const text = raw && raw.toString ? raw.toString() : `${num}`;
      return text;
    },
    spreadCells(plant) {
      if (!plant) return 1;
      const raw = plant["Spread (feet)"];
      const num = parseFloat(raw);
      if (!Number.isFinite(num) || num <= 0) return 1;
      return Math.max(1, Math.round(num));
    },
    computeInitialBaseSizes() {
      const largest = this.largestFavoriteCells || 1;
      if (this.isMobile) {
        // Taller-than-wide, ideal ratio 4:5 (w:h). Implemented via: h = ceil(w * 5/4)
        const baseWidth = Math.max(8, largest);
        const baseHeight = Math.max(10, Math.ceil((baseWidth * 5) / 4));
        return { width: baseWidth, height: baseHeight };
      }
      // Desktop/iPad: wider-than-tall, ideal ratio 5:4 (w:h). Implemented via: w = ceil(h * 5/4)
      const baseHeight = Math.max(8, largest);
      const baseWidth = Math.max(10, Math.ceil((baseHeight * 5) / 4));
      return { width: baseWidth, height: baseHeight };
    },
    applyInitialSizingFromFavorites() {
      const { width, height } = this.computeInitialBaseSizes();
      this.userBaseWidth = width;
      this.userBaseHeight = height;
          this.hasAppliedInitialSizing = true;
    },
    loadFromStorage() {
      if (typeof window === "undefined") return;
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          if (Number.isFinite(parsed.userBaseWidth)) this.userBaseWidth = parsed.userBaseWidth;
          if (Number.isFinite(parsed.userBaseHeight)) this.userBaseHeight = parsed.userBaseHeight;
          if (Array.isArray(parsed.placedPlants)) this.placedPlants = parsed.placedPlants;
          if (typeof parsed.selectedPlantId === "string" || parsed.selectedPlantId === null) {
            this.selectedPlantId = parsed.selectedPlantId;
          }
          this.hasLoadedFromStorage = true;
        }
      } catch (e) {
        // ignore corrupt storage
      }
    },
    scheduleSave() {
      if (typeof window === "undefined") return;
      if (this.saveTimeoutId) clearTimeout(this.saveTimeoutId);
      this.saveTimeoutId = setTimeout(() => {
        try {
          const payload = {
            userBaseWidth: this.userBaseWidth,
            userBaseHeight: this.userBaseHeight,
            placedPlants: this.placedPlants,
            selectedPlantId: this.selectedPlantId,
          };
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch (e) {
          // ignore quota/storage errors
        }
      }, 150);
    },
    async fetchFavorites() {
      this.loading = true;
      this.loadError = null;
      try {
        if (!this.favoriteIds.length) {
          this.favoritePlants = [];
          if (!this.hasLoadedFromStorage && !this.hasAppliedInitialSizing) {
            // fallback defaults
            this.applyInitialSizingFromFavorites();
          }
          return;
        }
        const params = {
          favorites: this.favoriteIds,
          sort: "Sort by Common Name (A-Z)",
        };
        const response = await fetch("/api/v1/plants?" + qs.stringify(params));
        const data = await response.json();
        this.favoritePlants = (data && data.results) || [];
      } catch (e) {
        this.loadError = e;
        this.favoritePlants = [];
      } finally {
        this.loading = false;
      }
    },
    onPaletteClick(plantId) {
      if (!this.isMobile) return;
      this.selectedPlantId = this.selectedPlantId === plantId ? null : plantId;
    },
    onPaletteDragStart(event, plantId) {
      if (this.isMobile) return;
      if (!event || !event.dataTransfer) return;
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("text/plain", plantId);
    },
    onPlacedDragStart(event, placedId) {
      if (this.isMobile) return;
      if (!event || !event.dataTransfer) return;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", `move:${placedId}`);
      // Store the dragged plant ID for dragend handling
      this.draggingPlantId = placedId;
      // Prevent popover from opening when starting drag
      event.stopPropagation();
    },
    onPlacedDragEnd() {
      // Reset dragging state
      this.draggingPlantId = null;
      // If drop didn't complete (dropEffect is 'none'), the plant wasn't moved
      // This is just for cleanup - the actual move happens in onGridDrop
    },
    onGridDragOver(event) {
      event.preventDefault();
      // Allow drop by setting dropEffect based on the drag operation
      if (event.dataTransfer) {
        // Check if this is a move (from placed plant) or copy (from palette)
        const effectAllowed = event.dataTransfer.effectAllowed;
        if (effectAllowed === "move" || effectAllowed === "all") {
          event.dataTransfer.dropEffect = "move";
        } else if (effectAllowed === "copy" || effectAllowed === "copyMove") {
          event.dataTransfer.dropEffect = "copy";
        } else {
          event.dataTransfer.dropEffect = "move";
        }
      }
    },
    gridCoordsFromEvent(event) {
      const grid = this.$refs.grid;
      if (!grid || typeof window === "undefined") return null;
      const rect = grid.getBoundingClientRect();
      const styles = window.getComputedStyle(grid);
      const cellSizeRaw = styles.getPropertyValue("--cell-size").trim();
      const cellSize = parseFloat(cellSizeRaw) || 36;
      const x = Math.floor((event.clientX - rect.left) / cellSize);
      const y = Math.floor((event.clientY - rect.top) / cellSize);
      return { x: Math.max(0, x), y: Math.max(0, y) };
    },
    onGridDrop(event) {
      event.preventDefault();
      event.stopPropagation();
      const data = event.dataTransfer && event.dataTransfer.getData("text/plain");
      if (!data) return;
      const coords = this.gridCoordsFromEvent(event);
      if (!coords) return;
      
      // Check if this is moving an existing plant or placing a new one
      if (data.startsWith("move:")) {
        const plantId = data.replace("move:", "");
        const plant = this.placedPlants.find((p) => p.id === plantId);
        // Only move if the position actually changed
        if (plant && (plant.x !== coords.x || plant.y !== coords.y)) {
          this.movePlant(plantId, coords.x, coords.y);
        }
      } else {
        // New plant placement
        this.placePlant(data, coords.x, coords.y);
      }
    },
    onGridClick(event) {
      if (this.isMobile && this.selectedPlantId) {
        const coords = this.gridCoordsFromEvent(event);
        if (!coords) return;
        this.placePlant(this.selectedPlantId, coords.x, coords.y);
        return;
      }
      // clicking empty grid closes popover
      this.popoverPlantId = null;
    },
    placePlant(plantId, x, y) {
      const plant = this.plantById[plantId];
      const size = this.spreadCells(plant);
      const id = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const placed = {
        id,
        plantId,
        x,
        y,
        width: size,
        height: size,
      };

      // Grow base size (never shrink) so the plane expands as needed and persists.
      this.userBaseWidth = Math.max(this.userBaseWidth, x + size);
      this.userBaseHeight = Math.max(this.userBaseHeight, y + size);

      this.placedPlants = [...this.placedPlants, placed];
    },
    placedStyle(p) {
      const plant = this.plantById[p.plantId];
      return {
        "--x": p.x,
        "--y": p.y,
        "--w": p.width,
        "--h": p.height,
        "background-image": `linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.35) 70%, rgba(0, 0, 0, 0.35) 100%), url("${this.imageUrl(
          plant,
          false
        )}")`,
      };
    },
    popoverStyle(p) {
      // anchor near top-left of the placed plant
      return {
        left: `calc(${p.x} * var(--cell-size))`,
        top: `calc(${p.y} * var(--cell-size))`,
      };
    },
    openPopover(id) {
      this.popoverPlantId = id;
    },
    movePlant(placedId, x, y) {
      const plant = this.placedPlants.find((p) => p.id === placedId);
      if (!plant) return;
      
      // Update position
      plant.x = x;
      plant.y = y;
      
      // Grow base size if needed
      this.userBaseWidth = Math.max(this.userBaseWidth, x + plant.width);
      this.userBaseHeight = Math.max(this.userBaseHeight, y + plant.height);
      
      // Trigger reactivity
      this.placedPlants = [...this.placedPlants];
    },
    removePlaced(id) {
      this.placedPlants = this.placedPlants.filter((p) => p.id !== id);
      if (this.popoverPlantId === id) {
        this.popoverPlantId = null;
      }
    },
    clearLayout() {
      this.placedPlants = [];
      this.popoverPlantId = null;
    },
    resetPlanner() {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
          // ignore
        }
      }
      this.hasLoadedFromStorage = false;
      this.hasAppliedInitialSizing = false;
      this.selectedPlantId = null;
      this.clearLayout();
      // Re-apply sizing (will use favorites if already loaded; otherwise will run when favorites arrive)
      if (this.favoritePlants.length) {
        this.applyInitialSizingFromFavorites();
      }
    },
  },
};
</script>

<style scoped>
.planner-main {
  padding: 0 16px 24px;
  max-width: 1400px;
  margin: 0 auto;
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

.size-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-family: Roboto;
  font-size: 14px;
}

.size-field input {
  width: 96px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid #d3d3d3;
  background: #fff;
  font-size: 16px;
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
  align-items: start;
}

.workspace.mobile {
  grid-template-columns: 1fr;
}

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
  max-height: 65vh;
  overflow: auto;
  padding-right: 4px;
}

.workspace.mobile .palette-items {
  max-height: none;
  overflow-x: auto;
  overflow-y: hidden;
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
}

.workspace.mobile .palette-item {
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

.grid-area {
  min-width: 0;
}

.grid-scroll {
  overflow: auto;
  border-radius: 16px;
  border: 1px solid #e5e5e5;
  background: #fff;
}

.grid {
  position: relative;
  --cell-size: 36px;
  width: calc(var(--cols) * var(--cell-size));
  height: calc(var(--rows) * var(--cell-size));
  min-width: 100%;
  min-height: 420px;
  background-color: #fff;
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
}

.placed {
  position: absolute;
  left: calc(var(--x) * var(--cell-size));
  top: calc(var(--y) * var(--cell-size));
  width: calc(var(--w) * var(--cell-size));
  height: calc(var(--h) * var(--cell-size));
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  border: 2px solid rgba(183, 77, 21, 0.6);
  cursor: move;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
}

.placed.overlapping {
  border-color: rgba(200, 40, 40, 0.85);
  box-shadow: 0 0 0 2px rgba(200, 40, 40, 0.15);
}

.placed.popoverOpen {
  box-shadow: 0 0 0 3px rgba(183, 77, 21, 0.15);
}

.placed-label {
  width: 100%;
  font-family: Roboto;
  font-size: 12px;
  color: #fff;
  padding: 8px 10px;
  line-height: 1.2;
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

button.primary-bar.small {
  width: auto;
  max-width: none;
  margin: 0;
  padding: 10px 14px;
}

button.primary-bar.small.subtle {
  background-color: #1d2e26;
}

button.primary-bar.small.danger {
  background-color: #b00020;
}

@media screen and (max-width: 767px) {
  .grid {
    --cell-size: 30px;
    min-height: 380px;
  }
  .toolbar-right {
    text-align: left;
  }
}
</style>




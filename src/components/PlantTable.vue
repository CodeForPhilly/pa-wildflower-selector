<template>
  <section class="plant-table-section" aria-label="Plant results table">
    <div class="table-options">
      <p>Scroll sideways to compare more fields.</p>
      <div class="column-picker">
        <button
          type="button"
          class="column-picker-button"
          aria-haspopup="true"
          :aria-expanded="columnsOpen"
          @click="columnsOpen = !columnsOpen"
        >
          <span class="material-icons" aria-hidden="true">view_column</span>
          Columns
        </button>
        <div v-if="columnsOpen" class="column-picker-menu">
          <div class="column-picker-heading">
            <strong>Choose columns</strong>
            <button type="button" class="column-reset" @click="$emit('reset-columns')">
              Reset
            </button>
          </div>
          <small>Names and favorites are always shown.</small>
          <label v-for="column in optionalColumns" :key="column.key">
            <input
              type="checkbox"
              :checked="selectedColumns.includes(column.key)"
              @change="$emit('toggle-column', column.key)"
            />
            {{ column.label }}
          </label>
        </div>
      </div>
    </div>

    <div class="mobile-table-header" aria-hidden="true">
      <div ref="mobileHeaderRow" class="mobile-table-header-row">
        <div class="favorite-column"></div>
        <div class="common-name-column">Common name</div>
        <div class="scientific-name-column">Scientific name</div>
        <div v-for="column in visibleColumns" :key="column.key" :class="`${column.key}-column`">
          {{ column.label }}
        </div>
      </div>
    </div>

    <div class="plant-table-scroll" tabindex="0" @scroll="handleTableScroll">
      <table class="plant-table">
        <thead>
          <tr>
            <th class="favorite-column"><span class="visually-hidden">Favorite</span></th>
            <th class="common-name-column">Common name</th>
            <th class="scientific-name-column">Scientific name</th>
            <th v-for="column in visibleColumns" :key="column.key" :class="`${column.key}-column`">
              {{ column.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="plant in plants" :key="plant._id">
            <td class="favorite-column">
              <button
                type="button"
                class="table-favorite"
                :aria-label="
                  isFavorite(plant._id)
                    ? `Remove ${plant['Common Name']} from favorites`
                    : `Add ${plant['Common Name']} to favorites`
                "
                @click="$emit('toggle-favorite', plant._id)"
              >
                <span class="material-icons" aria-hidden="true">
                  {{ isFavorite(plant._id) ? "favorite" : "favorite_outline" }}
                </span>
              </button>
            </td>
            <td class="common-name-column">
              <button type="button" class="plant-name-link" @click="$emit('open-plant', plant)">
                {{ displayValue(plant["Common Name"]) }}
              </button>
            </td>
            <td class="scientific-name-column">
              <button
                type="button"
                class="plant-name-link scientific-name"
                @click="$emit('open-plant', plant)"
              >
                {{ displayValue(plant["Scientific Name"]) }}
              </button>
            </td>
            <td v-for="column in visibleColumns" :key="column.key" :class="`${column.key}-column`">
              {{ formatColumnValue(plant, column) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script>
export const PLANT_TABLE_COLUMNS = [
  { key: "height", label: "Height", fields: ["Height (feet)"], suffix: " ft" },
  { key: "sun", label: "Sun", fields: ["Sun Exposure Flags"] },
  { key: "moisture", label: "Moisture", fields: ["Soil Moisture Flags"] },
  { key: "plantType", label: "Plant type", fields: ["Plant Type Flags"] },
  { key: "lifeCycle", label: "Life cycle", fields: ["Life Cycle Flags"] },
  { key: "flowering", label: "Flowers", fields: ["Flowering Months"] },
  { key: "spread", label: "Spread", fields: ["Spread (feet)"], suffix: " ft" },
  { key: "family", label: "Family", fields: ["Plant Family", "Family"] },
  { key: "flowerColor", label: "Flower color", fields: ["Flower Color Flags", "Flower Color"] },
];

export const DEFAULT_PLANT_TABLE_COLUMNS = ["height", "sun", "moisture"];

export default {
  name: "PlantTable",
  props: {
    plants: { type: Array, default: () => [] },
    favorites: { type: Object, required: true },
    selectedColumns: { type: Array, default: () => DEFAULT_PLANT_TABLE_COLUMNS },
  },
  emits: ["open-plant", "toggle-favorite", "toggle-column", "reset-columns"],
  data() {
    return {
      columnsOpen: false,
    };
  },
  created() {
    this.tableScrollFrame = null;
    this.pendingTableScrollLeft = 0;
  },
  beforeUnmount() {
    if (this.tableScrollFrame) {
      window.cancelAnimationFrame(this.tableScrollFrame);
    }
  },
  computed: {
    optionalColumns() {
      return PLANT_TABLE_COLUMNS;
    },
    visibleColumns() {
      return PLANT_TABLE_COLUMNS.filter((column) => this.selectedColumns.includes(column.key));
    },
  },
  methods: {
    isFavorite(id) {
      return this.favorites.has(id);
    },
    displayValue(value) {
      if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
      return value === null || value === undefined || value === "" ? "—" : String(value);
    },
    formatColumnValue(plant, column) {
      const field = column.fields.find((name) => {
        const value = plant[name];
        return value !== null && value !== undefined && value !== "";
      });
      if (!field) return "—";
      const value = this.displayValue(plant[field]);
      return value === "—" || !column.suffix ? value : `${value}${column.suffix}`;
    },
    handleTableScroll(event) {
      this.pendingTableScrollLeft = event.target.scrollLeft;
      if (this.tableScrollFrame) return;

      this.tableScrollFrame = window.requestAnimationFrame(() => {
        const headerRow = this.$refs.mobileHeaderRow;
        if (headerRow) {
          headerRow.style.transform = `translateX(-${this.pendingTableScrollLeft}px)`;
        }
        this.tableScrollFrame = null;
      });
    },
  },
};
</script>

<style scoped>
.plant-table-section {
  width: 100%;
  min-width: 0;
  font-family: Roboto, sans-serif;
}
.table-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.table-options > p {
  margin: 0;
  color: rgba(0, 0, 0, 0.62);
  font-size: 12px;
}
.column-picker {
  position: relative;
  flex: 0 0 auto;
}
.column-picker-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 7px 12px;
  color: #1d2e26;
  background: #fff;
  border: 1px solid rgba(29, 46, 38, 0.35);
  border-radius: 9px;
  font: 700 13px Roboto, sans-serif;
  cursor: pointer;
}
.column-picker-button .material-icons {
  font-size: 19px;
}
.column-picker-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  width: min(280px, calc(100vw - 32px));
  padding: 14px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.16);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
}
.column-picker-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.column-picker-menu small {
  display: block;
  margin: 2px 0 10px;
  color: #666;
}
.column-picker-menu label {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 36px;
  cursor: pointer;
}
.column-picker-menu input {
  width: 18px;
  height: 18px;
  accent-color: #b74d15;
}
.column-reset {
  padding: 5px;
  color: #b74d15;
  background: transparent;
  border: 0;
  font: 700 12px Roboto, sans-serif;
  cursor: pointer;
}
.plant-table-scroll {
  width: 100%;
  overflow-x: auto;
  border: 1px solid rgba(29, 46, 38, 0.18);
  border-radius: 12px;
  background: #fff;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
}
.plant-table-scroll:focus-visible {
  outline: 3px solid rgba(183, 77, 21, 0.28);
  outline-offset: 2px;
}
.mobile-table-header {
  position: sticky;
  top: 0;
  z-index: 8;
  display: block;
  width: 100%;
  overflow: hidden;
  color: #42534b;
  background: #f3f1eb;
  border: 1px solid rgba(29, 46, 38, 0.18);
  border-bottom: 0;
  border-radius: 12px 12px 0 0;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.mobile-table-header-row {
  display: flex;
  width: 720px;
  min-width: 720px;
  will-change: transform;
}
.mobile-table-header-row > div {
  flex: 0 0 auto;
  padding: 12px;
  border-bottom: 1px solid rgba(29, 46, 38, 0.11);
}
.mobile-table-header-row > .favorite-column {
  display: block;
  background: #f3f1eb;
}
.plant-table {
  width: 100%;
  min-width: 720px;
  margin: 0;
  border-collapse: separate;
  border-spacing: 0;
  color: #1d2e26;
  font-size: 14px;
}
.plant-table th,
.plant-table td {
  padding: 12px;
  text-align: left;
  vertical-align: middle;
  border: 0;
  border-bottom: 1px solid rgba(29, 46, 38, 0.11);
}
.plant-table th {
  position: sticky;
  top: 0;
  z-index: 2;
  color: #42534b;
  background: #f3f1eb;
  font-size: 12px;
  white-space: nowrap;
}
@media (max-width: 899px) {
  .plant-table-scroll {
    border-top: 0;
    border-radius: 0 0 12px 12px;
  }
  .plant-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
}
.plant-table tbody tr:last-child td {
  border-bottom: 0;
}
.plant-table tbody tr:hover td {
  background: #fbf8f2;
}
.favorite-column {
  position: sticky;
  left: 0;
  z-index: 3;
  width: 48px;
  min-width: 48px;
  padding: 4px !important;
  text-align: center !important;
  background: #fff;
}
th.favorite-column {
  z-index: 4;
  background: #f3f1eb;
}
.common-name-column {
  min-width: 160px;
  font-weight: 700;
}
.scientific-name-column {
  min-width: 170px;
}
.height-column,
.spread-column {
  min-width: 86px;
  white-space: nowrap;
}
.sun-column,
.moisture-column,
.lifeCycle-column,
.plantType-column,
.flowerColor-column {
  min-width: 120px;
}
.flowering-column,
.family-column {
  min-width: 150px;
}
.table-favorite {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  color: #b74d15;
  background: transparent;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}
.table-favorite:hover,
.table-favorite:focus-visible {
  background: rgba(183, 77, 21, 0.09);
}
.table-favorite:focus-visible,
.plant-name-link:focus-visible {
  outline: 3px solid rgba(183, 77, 21, 0.3);
  outline-offset: 1px;
}
.plant-name-link {
  padding: 0;
  color: #1d2e26;
  background: transparent;
  border: 0;
  font: inherit;
  font-weight: inherit;
  text-align: left;
  text-decoration: underline;
  text-decoration-color: rgba(183, 77, 21, 0.45);
  text-underline-offset: 3px;
  cursor: pointer;
}
.plant-name-link:hover {
  color: #b74d15;
}
.plant-name-link.scientific-name {
  font-style: italic;
  font-weight: 400;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@media (min-width: 900px) {
  .mobile-table-header {
    display: none;
  }
  .plant-table-scroll {
    overflow: visible;
  }
  .table-options > p {
    visibility: hidden;
  }
}
</style>

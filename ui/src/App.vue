<template>
  <div>
    <header>
      <h1>Choose Native Plants PA</h1>
    </header>
    <main>
      <div v-if="!filtersOpen">
        <button class="primary primary-bar" @click=openFilters>Filter</button>
        <div class="chips" v-if="activeFilters.length">
          <button class="chip" v-for="chip in chips" v-bind:key="chip.key" @click="removeChip(chip)">
            {{ chip.label }} <span class="material-icons">close</span>
          </button>
          <button class="text clear" @click="removeAll">Clear all</button>
        </div>
        <div class="sort">
          <button @click="toggleSort" class="list-button">
            <span class="label">Sort By</span>
            <span class="value">{{ sortLabel(sort) }}</span>
            <span class="material-icons">{{ sortOpen ? 'arrow_drop_up' : 'arrow_drop_down' }}</span>
          </button>
          <menu :style="{ visibility: sortOpen ? 'visible' : 'hidden' }" class="list-menu">
            <li v-for="sort in sorts" v-bind:key="sort.value" @click="setSort(sort)" @keydown.enter="setSort(sort)" tabindex="0">{{ sort.label }}</li>
          </menu>
        </div>
      </div>
      <form v-if="filtersOpen" class="filters" id="form" @submit.prevent="submit">
        <div class="controls">
          <input v-model="q" id="q" type="search" class="search" placeholder="🔎" />
          <button class="primary primary-bar" type="submit">Apply</button>
        </div>
        <fieldset v-for="filter in filters" :key="filter.name" :class="filterClass(filter)">
          <h3 @click="toggleFilter(filter)">
            {{ filter.label || filter.name }}
            <span class="material-icons">{{ filterIsOpen[filter.name] ? 'arrow_drop_up' : 'arrow_drop_down' }}</span>
          </h3>
          <template v-if="filterIsOpen[filter.name]">
            <template v-if="filter.range">
              <Range :double="filter.double" :exponent="filter.exponent" :choices="filter.choices" :min="filter.min" :max="filter.max" v-model="filterValues[filter.name]" />
            </template>
            <template v-else>
              <label v-for="choice in filter.choices" :key="choice">
                <span class="filter-contents">
                  <Checkbox :disabled="!filterCounts[filter.name][choice]" v-model="filterValues[filter.name]" :value="choice" />
                  <span class="text">{{ choice }} ({{ filterCounts[filter.name][choice] || 0 }})</span>
                </span>
                <span v-if="filter.color" :style="flowerColorStyle(choice)" class="color-example" />
              </label>
            </template>
          </template>
        </fieldset>
      </form>
      <h4>Total matches: {{ total }}</h4>
      <article class="plants">
        <article v-for="result in results" :key="result._id" class="plant-preview">
          <img class="photo" :src="imageUrl(result)" />
          <h4 class="common-name">{{ result['Common Name'] }}</h4>
          <h5 class="scientific-name">{{ result['Scientific Name'] }}</h5>
          <div class="plant-controls">
            <button class="text"><span class="material-icons material-align">info</span> More Info</button>
            <button class="text"><span class="material-icons material-align">favorite</span></button>
          </div>
        </article>
      </article>
<!--        
      <table>
        <tr>
          <th>Common Name</th><th>Scientific Name</th><th>Credit</th><th>Flower Color</th><th>Average Height (ft)</th><th>Soil Moisture</th><th>Image</th>
        </tr>
        <tr v-for="result in results" :key="result._id">
          <td>{{ result['Common Name'] }}</td>
          <td>{{ result['Scientific Name'] }}</td>
          <td><span v-html="result.attribution" /></td>
          <td>{{ result['Flower Color'] }}</td>
          <td>{{ result['Average Height'] }}</td>
          <td>{{ result['Soil Moisture'] }}</td>
          <td></td>
        </tr>
      </table>
-->
    <div ref="next"></div>
    </main>
  </div>
</template>

<script>
import qs from 'qs';
import Range from './components/Range.vue';
import Checkbox from './components/Checkbox.vue';

export default {
  name: 'App',
  components: {
    Range, Checkbox
  },
  data() {
    const filters = [
      {
        name: 'Superplant',
        label: 'Super Plant',
        choices: [ 'Super Plant' ],
        value: [],
        array: true,
        counts: {},
        initiallyOpen: true
      },
      {
        name: 'Sun Exposure Flags',
        label: 'Sun Exposure',
        value: [],
        array: true,
        counts: {}
      },
      {
        name: 'Soil Moisture Flags',
        label: 'Soil Moisture',
        value: [],
        array: true,
        counts: {}
      },
      {
        name: 'Plant Type Flags',
        label: 'Plant Type',
        value: [],
        array: true,
        counts: {}
      },
      {
        name: 'Life Cycle Flags',
        label: 'Life Cycle',
        value: [],
        array: true,
        counts: {}
      },
      {
        name: 'Pollinator Flags',
        label: 'Pollinators',
        value: [],
        array: true,
        counts: {}
      },
      {
        name: 'Flower Color Flags',
        label: 'Flower Color',
        value: [],
        array: true,
        counts: {},
        color: true
      },
      {
        name: 'Flowering Months',
        range: true,
        double: true,
        choices: [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ],
        min: 0,
        max: 11,
        exponent: 1.0,
        value: {
          min: 0,
          max: 11
        }
      },
      {
        name: 'Height (feet)',
        range: true,
        double: false,
        choices: [],
        min: 0,
        max: 0,
        exponent: 3.0,
        value: {
          min: 0,
          max: 0
        }
      }
    ];
    const sorts = Object.entries({
        'Sort by Common Name (A-Z)': 'Common Name (A-Z)',
        'Sort by Common Name (Z-A)': 'Common Name (Z-A)',
        'Sort by Scientific Name (A-Z)': 'Scientific Name (A-Z)',
        'Sort by Scientific Name (Z-A)': 'Scientific Name (Z-A)'
      }).map(([ value, label ]) => ({ value, label }));
    return {
      initializing: true,
      results: [],
      total: 0,
      q: '',
      sort: 'Sort by Common Name (A-Z)',
      filters,
      filterValues: Object.fromEntries(filters.map(filter => {
        const value = [ filter.name, filter.value ];
        filter.default = filter.value;
        delete filter.value;
        return value;
      })),
      filterIsOpen: Object.fromEntries(filters.map(filter => [
        filter.name, filter.initiallyOpen || false
      ])),
      filterCounts: Object.fromEntries(filters.map(filter => [ filter.name, {} ])),
      filtersOpen: false,
      updatingCounts: false,
      sorts,
      sortOpen: false
    };
  },
  computed: {
    chips() {
      const chips = [];
      for (const filter of this.activeFilters) {
        const value = this.filterValues[filter.name];
        if (filter.array) {
          value.forEach(item => {
            chips.push({
              name: filter.name,
              label: item,
              key: filter.name + ':' + item
            });
          })
        } else if (filter.range) {
          chips.push({
            name: filter.name,
            label: filter.label || filter.name,
            key: filter.name
          });
        } else {
          chips.push({
            name: filter.name,
            label: value,
            key: filter.name
          });
        }
      }
      return chips;
    },
    activeFilters() {
      const result = this.filters.filter(filter => {
        const value = this.filterValues[filter.name];
        if (filter.range) {
          if ((value.min !== filter.min) || (value.max !== filter.max)) {
            return true;
          }
        } else if (filter.array) {
          return value.length > 0;
        } else {
          return value !== filter.default;
        }
      });
      return result;
    }
  },
  watch: {
    sort() {
      this.submit();
    },
    filterValues: {
      handler() {
        this.updateCounts();
      },
      deep: true
    }
  },
  mounted() {
    const observer = new IntersectionObserver(this.loadMoreIfNeeded);
    observer.observe(this.$refs.next);
    this.submit();
  },
  methods: {
    imageUrl(result) {
      return `/images/${result._id}.jpg`;
    },
    openFilters() {
      this.filtersOpen = true;
    },
    async submit() {
      this.page = 1;
      this.loadedAll = false;
      this.results = [];
      this.total = 0;
      await this.fetchPage();
      this.filtersOpen = false;
    },
    async updateCounts() {
      // Debounce so we don't refresh like mad when dragging a range end
      if (this.updatingCounts) {
        if (this.updatingCountsTimeout) {
          clearTimeout(this.updatingCountsTimeout);
        }
        this.updatingCountsTimeout = setTimeout(() => this.updateCounts(), 250);
        return;
      }
      this.updatingCounts = true;
      try {
        const params = {
          ...this.filterValues,
          q: this.q,
          sort: this.sort
        };
        if (this.initializing) {
          return;
        }
        const response = await fetch('/plants?' + qs.stringify(params));
        const data = await response.json();
        this.filterCounts = data.counts;
      } finally {
        this.updatingCounts = false;
      }
    },
    async fetchPage() {
      this.loading = true;
      const params = {
        ...this.filterValues,
        q: this.q,
        sort: this.sort,
        page: this.page
      };
      if (this.initializing) {
        // Don't send a bogus query for min 0 max 0
        delete params['Height (feet)'];
      }
      const response = await fetch('/plants?' + qs.stringify(params));
      const data = await response.json();
      this.filterCounts = data.counts;
      for (const filter of this.filters) {
        filter.choices = data.choices[filter.name];
      }
      if (!data.results.length) {
        this.loadedAll = true;
      }
      data.results.forEach(datum => this.results.push(datum));
      this.total = data.total;
      if (this.initializing) {
        const height = this.filters.find(filter => filter.name === 'Height (feet)');
        height.min = 0;
        const heights = data.choices['Height (feet)'];
        height.max = heights[heights.length - 1];
        this.filterValues['Height (feet)'].max = height.max;
        this.initializing = false;
      }
      this.loading = false;
      // In case one page doesn't fill the screen
      setTimeout(this.loadMoreIfNeeded, 500);
    },
    async loadMoreIfNeeded() {
      // Stay a full screen ahead
      if (!this.loadedAll && !this.loading && (window.scrollY + window.innerHeight * 2 > document.body.clientHeight)) {
        // this.$refs.afterTable.getBoundingClientRect().top)) {
        this.page++;
        await this.fetchPage();
      }
    },
    removeChip(chip) {
      const filter = this.filters.find(filter => filter.name === chip.name);
      if (filter.array) {
        this.filterValues[chip.name] = this.filterValues[chip.name].filter(value => value !== chip.label);
      } else {
        this.filterValues[chip.name] = filter.default;
      }
      this.submit();
    },
    removeAll() {
      for (const filter of this.filters) {
        this.filterValues[filter.name] = filter.default;
      }
      this.submit();
    },
    toggleSort() {
      this.sortOpen = !this.sortOpen;
    },
    setSort(sort) {
      this.sort = sort.value;
      this.sortOpen = false;
    },
    sortLabel(sort) {
      return this.sorts.find(_sort => _sort.value === sort).label;
    },
    filterClass(filter) {
      if (this.filterIsOpen[filter.name]) {
        return 'active';
      } else {
        return null;
      }
    },
    toggleFilter(filter) {
      this.filterIsOpen[filter.name] = !this.filterIsOpen[filter.name];
    },
    flowerColorStyle(choice) {
      return {
        'background-color': choice
      };
    }
  }
}

</script>

<style>
@font-face {
  font-family: Arvo;
  src: url("/fonts/Arvo-Regular.ttf") format("truetype");
}
@font-face {
  font-family: Arvo;
  font-weight: 700;
  font-style: normal;
  src: url("/fonts/Arvo-Bold.ttf") format("truetype");
}
@font-face {
  font-family: Arvo;
  font-style: italic;
  src: url("/fonts/Arvo-Italic.ttf") format("truetype");
}
@font-face {
  font-family: Arvo;
  font-weight: 700;
  font-style: italic;
  src: url("/fonts/Arvo-BoldItalic.ttf") format("truetype");
}

@font-face {
  font-family: Roboto;
  src: url("/fonts/Roboto-Regular.ttf") format("truetype");
}
@font-face {
  font-family: Roboto;
  font-weight: 700;
  font-style: normal;
  src: url("/fonts/Roboto-Bold.ttf") format("truetype");
}
@font-face {
  font-family: Roboto;
  font-style: italic;
  src: url("/fonts/Roboto-Italic.ttf") format("truetype");
}
@font-face {
  font-family: Roboto;
  font-weight: 700;
  font-style: italic;
  src: url("/fonts/Roboto-BoldItalic.ttf") format("truetype");
}

@font-face {
  font-family: Lato;
  src: url("/fonts/Lato-Regular.ttf") format("truetype");
}
@font-face {
  font-family: Lato;
  font-weight: 700;
  font-style: normal;
  src: url("/fonts/Lato-Bold.ttf") format("truetype");
}
@font-face {
  font-family: Lato;
  font-style: italic;
  src: url("/fonts/Lato-Italic.ttf") format("truetype");
}
@font-face {
  font-family: Lato;
  font-weight: 700;
  font-style: italic;
  src: url("/fonts/Lato-BoldItalic.ttf") format("truetype");
}
@font-face {
  font-family: 'Material Icons';
  font-style: normal;
  font-weight: 400;
  src: url("/fonts/MaterialIcons-Regular.ttf") format("truetype");
}
.material-icons {
  font-family: 'Material Icons';
  font-weight: normal;
  font-style: normal;
  display: inline-block;
  line-height: 1;
  text-transform: none;
  letter-spacing: normal;
  word-wrap: normal;
  white-space: nowrap;
  direction: ltr;

  /* Support for all WebKit browsers. */
  -webkit-font-smoothing: antialiased;
  /* Support for Safari and Chrome. */
  text-rendering: optimizeLegibility;

  /* Support for Firefox. */
  -moz-osx-font-smoothing: grayscale;

  /* Support for IE. */
  font-feature-settings: 'liga';

  vertical-align: middle;
  
  font-size: 120%;
}

.material-align {
  display: inline-flex;
  vertical-align: bottom;  
}

#app {
  font-family: Roboto;
  margin: auto;
  background-color: #FCF9F4;
  padding: 32px;
}

.controls {
  position: sticky;
  z-index: 100;
  /* Sticky offset */
  top: 0;
  background-color: #FCF9F4;
}

button {
  background-color: #FCF9F4;
  color: #B74D15;
  border: 1px solid #B74D15;
  border-radius: 8px;
  padding: 12px;
  font-size: 17px;
}

button.primary {
  background-color: #B74D15;
  color: #FCF9F4;
}

button.text {
  background-color: inherit;
  color: inherit;
  font-family: inherit;
  font-size: inherit;
  border: none;
  padding: 5px;
  border-radius: 0;
}

.primary-bar {
  display: block;
  width: 100%;
  margin-bottom: 11px;
}

.sort {
  /* Shrinkwrap the contents */
  display: inline-block;
}

.list-button {
  position: relative;
  display: flex;
  flex-direction: row;
  width: 100%;
}

.list-button .label {
  position: absolute;
  font-size: 80%;
  top: calc(-8px + -0.25em);
  padding: 4px;
  background-color: #FCF9F4;
}

menu {
  position: absolute;
  z-index: 100;
  background-color: #FCF9F4;
  display: flex;
  flex-direction: column;
  padding-inline-start: 0;
  color: #B74D15;
  border: 1px solid #b74e15;
  border-radius: 8px;
  font-size: 17px;
  margin: 0;
}

menu li {
  cursor: pointer;
  list-style: none;
  line-height: 2;
  color: black;
  padding: 0 12px;
}

menu li:first-child {
  border-radius: 9px 9px 0 0;
  background-clip: padding-box;
}

menu li:last-child {
  border-radius: 0 0 9px 9px;
  background-clip: padding-box;
}

menu li:focus {
  color: #B74D15;
  background-color: #ffebcc;
}

menu li:hover {
  color: #B74D15;
  background-color: #ffebcc;
}

.chips {
  margin-bottom: 32px;
}

.chip {
  border-radius: 30px;
  margin-right: 8px;
}

h1 {
  font-family: Arvo;
  font-weight: 400;
  font-size: 20px;
  text-align: center; 
}

.color-example {
  display: inline-block;
  width: 24px;
  height: 24px;
  border: 1px solid black;
  border-radius: 12px;
}

label {
  display: inline-block;
  font-size: 17px;
  margin: 1em 2em 1em 0;
}
input {
  display: inline-block;
}
img {
  max-width: 500px;
  display: block;
}
table {
  margin-top: 2em;
}
td, th {
  padding: 1em;
  border: 1px solid #def;
}

.range span.min, .range span.max {
  display: inline-block;
  border-radius: 1em;
  width: 1em;
  height: 1em;
  color: blue;
  cursor: pointer;
}
.range span.between {
  display: inline-block;
  width: 1em;
  height: 1em;
  color: gray;
}
.plants {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 8px;
  flex-direction: column;
}
.plant-preview {
  position: relative;
  border-radius: 8px;
}
.photo {
  object-fit: cover;
  width: 100%;
  aspect-ratio: 1/1;
  border-radius: 8px 8px 0 0;
}
.common-name {
  position: absolute;
  bottom: 68px;
  left: 16px;
  margin: 0;
  padding: 0;
  font-size: 14px;
  font-weight: normal;
  font-family: Roboto;
  color: white;
}
.scientific-name {
  position: absolute;
  bottom: 52px;
  left: 16px;
  margin: 0;
  padding: 0;
  font-size: 12px;
  font-style: italic;
  font-weight: normal;
  font-family: Roboto;
  color: white;
}
.plant-controls {
  font-family: Lato;
  font-size: 14px;
  border: 1px solid #B74D15;
  border-top: none;
  border-radius: 0 0 8px 8px;
  color: #B74D15;
  padding: 4px 16px 8px;
  display: flex;
  justify-content: space-between;
}
.filters {
  display: flex;
  flex-direction: column;
  max-width: 350px;
  margin: auto;
}
.filters fieldset {
  background-color: white;
  display: flex;
  flex-direction: column;
  color: #1D2E26;
  border: 1px solid #1D2E26;
  border-radius: 8px;
  margin-bottom: 24px;
  padding: 16px 10px;
}
.filters fieldset label {
  display: flex;
  justify-content: space-between;
}
.filters fieldset:last-child {
  margin-bottom: 0;
}
.filters fieldset {
  background-color: #FBECD0;
}

.filters fieldset.active {
  background-color: white;
}

.filters fieldset h3 {
  font-size: 18px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  font-family: Lato;
  margin: 0;
  letter-spacing: 0.1em;
  font-weight: normal;
}
.filters fieldset.active h3 {
  color: #1D2E26;
  font-weight: bold;
  margin-bottom: 24px;
}
.filters fieldset input {
  border: 0;
  padding: 0;
  font-size: inherit;
}
.search {
  display: block;
  height: 64px;
  font-size: 24px;
  padding: 16px;
  margin-bottom: 8px;
  width: 100%;
}
.text {
  display: inline-block;
  transform: translateY(-0.3em);
  margin-left: 8px;
  user-select: none;
}
@media all and (max-width: 480px) {
  #app {
    padding: 0;
  }
  .plant-controls {
    font-size: 12px;
  }
  .plants {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px;
    flex-direction: column;
  }
}

</style>

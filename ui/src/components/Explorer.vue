<template>
  <div>
    <Header :h1="favorites ? 'Favorite List' : 'Choose Native Plants PA'">
      <template v-slot:after-bar>
        <p class="not-large-help">
          <router-link to="/questions">Not sure where to start?<br />Answer 5 questions</router-link>
        </p>
        <p class="large-help">
          Filter your preferences to find native shrubs, plants and flowers in Pennsylvania. Not sure where to start? <router-link to="/questions">Answer 5 questions</router-link>
        </p>
      </template>
    </Header>
    <main :class="{ 'filters-open': filtersOpen }">
      <div v-if="questions" class="questions">
        <form :class="questionClasses(index)" v-for="questionDetail, index in questionDetails" :key="index">
          <fieldset>
            <h4>{{ questionDetail.title }}</h4>
            <label v-for="choice in questionDetail.filter.choices" :key="choice">
              <span class="filter-contents">
                <Checkbox :disabled="!filterCounts[questionDetail.filter.name][choice]" v-model="filterValues[questionDetail.filter.name]" :value="choice" />
                <span class="text">{{ choice }} ({{ filterCounts[questionDetail.filter.name][choice] || 0 }})</span>
              </span>
              <img :src="`/assets/images/${choice}.svg`" class="choice-icon" />
            </label>
            <div class="question-buttons">
              <button v-if="index > 0" @click.prevent="question = index - 1">Back</button>
              <button v-if="index + 1 < questionDetails.length" @click.prevent="nextQuestion">Next Question</button>
              <button v-else @click="endQuestions">View Plants</button>
            </div>
          </fieldset>
        </form>
      </div>
      <template v-else>
        <div class="controls">
          <div class="filter-toggle-and-sort">
            <button v-if="!favorites" class="primary primary-bar filter" @click=openFilters>Filter</button>
            <div class="chips" v-if="!favorites && activeFilters.length">
              <button class="chip" v-for="chip in chips" v-bind:key="chip.key" @click="removeChip(chip)">
                {{ chip.label }} <span class="material-icons">close</span>
              </button>
              <button class="text clear" @click="clearAll">Clear all</button>
            </div>
            <div class="sort-and-favorites">
              <button class="favorites" v-if="!favorites" @click="$router.push('/favorite-list')">Favorite List</button>
              <div class="sort">
                <button @click.stop="toggleSort" :class="sortButtonClasses">
                  <span class="label">Sort By</span>
                  <span class="value">{{ sortLabel(sort) }}</span>
                  <span class="material-icons">{{ sortIsOpen ? 'arrow_drop_up' : 'arrow_drop_down' }}</span>
                </button>
                <Menu :open="sortIsOpen" :choices="sorts" v-model="sort" @close="toggleSort" />
              </div>
            </div>
          </div>
          <form v-if="!favorites" class="filters" id="form" @submit.prevent="submit">
            <div class="inner-controls">
              <input v-model="q" id="q" type="search" class="search" placeholder="🔎" />
              <div class="go">
                <button class="primary primary-bar clear" @click="clearAll">Clear</button>
                <button class="primary primary-bar apply" type="submit">Apply</button>
              </div>
              <button class="primary primary-bar search-submit" type="submit">Search</button>
            </div>
            <fieldset v-for="filter in filters" :key="filter.name" :class="filterClass(filter)">
              <button class="fieldset-toggle" @click.prevent="toggleFilter(filter)">
                {{ filter.label || filter.name }}
                <span class="material-icons">{{ filterIsOpen[filter.name] ? 'arrow_drop_up' : 'arrow_drop_down' }}</span>
              </button>
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
                    <img v-else :src="`/assets/images/${choice}.svg`" class="choice-icon" />
                  </label>
                </template>
              </template>
            </fieldset>
          </form>
        </div>
        <article class="plants">
          <article v-for="result in results" :key="result._id" class="plant-preview-wrapper">
            <div class="plant-preview">
              <img class="photo" :src="imageUrl(result)" />
              <h4 class="common-name">{{ result['Common Name'] }}</h4>
              <h5 class="scientific-name">{{ result['Scientific Name'] }}</h5>
              <button @click="toggleFavorite(result._id)" class="favorite-large text"><span class="material-icons material-align">{{ renderFavorite(result._id) }}</span></button>
              <div class="plant-controls-wrapper">
                <div class="plant-controls">
                  <button class="text"><span class="material-icons material-align info">info_outline</span> More Info</button>
                  <button @click="toggleFavorite(result._id)" class="favorite-regular text"><span class="material-icons material-align">{{ renderFavorite(result._id) }}</span></button>
                </div>
              </div>
            </div>
          </article>
          <!-- Placeholders to ensure minimum number of cells so the grid does not
            provide huge plant previews when there are only 3 plants on desktop -->
          <article v-for="extra in extras" :key="extra.id" class="extra"></article>
        </article>
      </template>
    </main>
    <!-- Useful if we go back to using an observer for infinite scroll -->
    <div ref="next"></div>
  </div>
</template>

<script>
import qs from 'qs';
import Range from './Range.vue';
import Checkbox from './Checkbox.vue';
import Header from './Header.vue';
import Menu from './Menu.vue';

export default {
  name: 'App',
  components: {
    Range, Checkbox, Header, Menu
  },
  props: {
    favorites: {
      type: Boolean,
      default: false
    },
    questions: {
      type: Boolean,
      default: false
    }
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

    this.defaultFilterValues = getDefaultFilterValues(filters);

    return {
      results: [],
      total: 0,
      q: '',
      sort: 'Sort by Common Name (A-Z)',
      filters,
      filterValues: {...this.defaultFilterValues},
      filterIsOpen: Object.fromEntries(filters.map(filter => [
        filter.name, filter.initiallyOpen || false
      ])),
      filterCounts: Object.fromEntries(filters.map(filter => [ filter.name, {} ])),
      filtersOpen: false,
      updatingCounts: false,
      sorts,
      sortIsOpen: false,
      question: 0,
      questionDetails: [
        {
          filter: filters.find(filter => filter.name === 'Plant Type Flags'),
          title: 'What type of plants do you want?'
        },
        {
          filter: filters.find(filter => filter.name === 'Life Cycle Flags'),
          title: 'What life cycle do you want?'
        },
        {
          filter: filters.find(filter => filter.name === 'Sun Exposure Flags'),
          title: 'How much sun exposure does your planting site get?'
        },
        {
          filter: filters.find(filter => filter.name === 'Soil Moisture Flags'),
          title: 'How wet is the soil?'
        },
        {
          filter: filters.find(filter => filter.name === 'Pollinator Flags'),
          title: 'What pollinators do you want to attract?'
        },
        {
          filter: filters.find(filter => filter.name === 'Superplant'),
          title: 'You can further refine your search to only include Super Plants.'
        }
      ]
    };
  },
  computed: {
    extras() {
      const min = Math.floor((window.innerWidth - 300) / 200);
      let extras = [];
      for (let i = 0; (i <= min); i++) {
        extras.push({ _id: i });
      }
      return extras;
    },
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
    },
    sortButtonClasses() {
      return {
        'list-button': true
      };
      // Creates unresolved design issues
      // ...(this.favorites && {
      //   primary: true,
      //   'primary-bar': true
      // })
    }
  },
  watch: {
    favorites() {
      this.determineFilterCounts();
    },
    questions() {
      if (this.questions) {
        this.filterValues = {...this.defaultFilterValues};
        this.determineFilterCounts();
        this.question = 0;
      }
    },
    sortIsOpen() {
      this.$store.commit('setSortIsOpen', this.sortIsOpen);
    },
    sort() {
      this.submit();
    },
    filterValues: {
      handler() {
        if (this.isDesktop()) {
          this.submit();
        } else {
          this.updateCounts();
        }
      },
      deep: true
    }
  },
  async mounted() {
    await this.determineFilterCounts();
  },
  destroy() {
    document.body.removeEventListener('click', this.bodyClick);
  },
  methods: {
    async determineFilterCounts() {
      this.initializing = true;
      if (!this.determinedFilterCounts) {
        const response = await fetch('/plants?results=0&total=0');
        const data = await response.json();
        this.filterCounts = data.counts;
        for (const filter of this.filters) {
          filter.choices = data.choices[filter.name];
        }
        const height = this.filters.find(filter => filter.name === 'Height (feet)');
        height.min = 0;
        const heights = data.choices['Height (feet)'];
        height.max = heights[heights.length - 1];
        this.filterValues['Height (feet)'].max = height.max;
        this.determinedFilterCounts = true;
      }
      this.initializing = false;
      this.submit();
    },
    imageUrl(result) {
      if (result.hasImage) {
        return `/images/${result._id}.preview.jpg`;
      } else {
        return '/assets/images/missing-image.png';
      }
    },
    openFilters() {
      this.filtersOpen = true;
    },
    submit() {
      if (this.loading) {
        // Prevent race condition
        setTimeout(this.submit, 500);
        return;
      }
      if (this.submitTimeout) {
        clearTimeout(this.submitTimeout);
        this.submitTimeout = null;
      }
      this.submitTimeout = setTimeout(submit.bind(this), 250);
      function submit() {
        this.page = 0;
        this.loadedAll = false;
        this.results = [];
        this.total = 0;
        this.restartLoadMoreIfNeeded();
        this.filtersOpen = false;
        this.submitTimeout = null;
      }
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
      const params = this.favorites ? {
        favorites: [...this.$store.state.favorites],
        sort: this.sort
      } : {
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
      if (!this.favorites) {
        this.filterCounts = data.counts;
        for (const filter of this.filters) {
          filter.choices = data.choices[filter.name];
        }
      }
      if ((!data.results.length) || this.favorites) {
        this.loadedAll = true;
      }
      data.results.forEach(datum => this.results.push(datum));
      this.total = data.total;
      this.loading = false;
    },
    async restartLoadMoreIfNeeded() {
      if (this.loadTimeout) {
        clearTimeout(this.loadTimeout);
      }
      this.loadTimeout = setTimeout(loadMoreIfNeeded.bind(this), 500);
      async function loadMoreIfNeeded() {
        // Stay a full screen ahead
        if (!this.loadedAll && !this.loading && (window.scrollY + window.innerHeight * 3 > document.body.clientHeight)) {
          // this.$refs.afterTable.getBoundingClientRect().top)) {
          this.page++;
          await this.fetchPage();
        }
        this.loadTimeout = setTimeout(loadMoreIfNeeded.bind(this), 500);
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
    clearAll() {
      for (const filter of this.filters) {
        this.filterValues[filter.name] = filter.default;
      }
      this.submit();
    },
    toggleSort() {
      this.sortIsOpen = !this.sortIsOpen;
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
      const customColors = {
        Cream: '#FFFDD0',
        Lilac: '#C8A2C8',
        Rose: '#FF0080'
      }
      return {
        'background-color': customColors[choice] || choice
      };
    },
    isDesktop() {
      // Must match CSS media query below
      return window.innerWidth >= 1280;
    },
    toggleFavorite(_id) {
      this.$store.commit('toggleFavorite', _id);
      if (this.favorites) {
        this.results = this.results.filter(result => result._id !== _id);
      }
    },
    renderFavorite(_id) {
      return this.$store.state.favorites.has(_id) ? 'favorite' : 'favorite_outline';
    },
    questionClasses(index) {
      if (this.question === index) {
        return 'filters question active-question';
      } else {
        return 'filters question inactive-question';
      }
    },
    nextQuestion() {
      this.question = this.question + 1;
    },
    endQuestions() {
      for (const questionDetail of this.questionDetails) {
        this.filterIsOpen[questionDetail.filter.name] = true;
      }
      this.filtersOpen = true;
      this.$router.push('/');
    }
  }
}

function getDefaultFilterValues(filters) {
  return Object.fromEntries(filters.map(filter => {
    const value = [ filter.name, filter.value ];
    filter.default = filter.value;
    delete filter.value;
    return value;
  }));
}
</script>

<style scoped>

#app {
  font-family: Roboto;
  margin: auto;
  background-color: #FCF9F4;
  padding: 32px;
}

.inner-controls {
  position: sticky;
  z-index: 100;
  /* Sticky offset */
  top: 0;
  background-color: #FCF9F4;
}

.inner-controls .go {
  display: flex;
  gap: 16px;
}

.inner-controls button.clear {
  color: #B74D15;
  background-color: inherit;
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

.chips button.clear {
  text-decoration: underline;
  font-size: 12px;
  transform: translate(0, 0);
}

.primary-bar {
  display: block;
  width: 100%;
  max-width: 350px;
  margin: auto;
  margin-bottom: 11px;
}

.sort-and-favorites {
  max-width: 350px;
  margin: auto;
  display: flex;
  justify-content: space-between;
}

button.favorites {
  /* Because gap doesn't seem to work in flex */
  margin-right: 16px;
}

.sort-and-favorites > * {
  flex-grow: 1.0;
}

.list-button {
  position: relative;
  display: flex;
  flex-direction: row;
  width: 100%;
}

.list-button > *:last-child {
  margin-left: auto;
}

.list-button .label {
  position: absolute;
  font-size: 80%;
  top: calc(-8px + -0.25em);
  padding: 4px;
  background-color: #FCF9F4;
}

.primary.list-button .label {
  background-color: #B74D15;
  color: #FCF9F4;
}

.sort {
  position: relative;
}

.chips {
  margin-bottom: 32px;
  text-align: center;
  line-height: 1.5;
}

.chip {
  display: inline-block;
  border-radius: 30px;
  margin: 8px 8px 8px 0;
}

h1 {
  font-family: Arvo;
  font-weight: 400;
  font-size: 32px;
  text-align: center;
  margin-bottom: 2em;
}

.color-example {
  display: inline-block;
  width: 24px;
  height: 24px;
  border: 1px solid black;
  border-radius: 12px;
}

.choice-icon {
  display: inline-block;
  width: 24px;
  height: 24px;
}

label {
  display: inline-block;
  font-size: 16px;
  margin: 0 0 16px 0;
}

label .text {
  transform: translate(0, 3px);
}

label:last-child {
  margin: 0;
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
  grid-template-columns: repeat(auto-fit, minmax(248px, 1fr));
  gap: 8px;
  flex-direction: column;
}
.plant-preview-wrapper {
  position: relative;
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
.plant-controls-wrapper {
  position: absolute;
  width: 100%;
  bottom: 0px;
  background-color: white;
}
.plant-controls {
  width: 100%;
  font-family: Lato;
  font-size: 14px;
  border: 1px solid #B74D15;
  border-top: none;
  border-radius: 0 0 8px 8px;
  color: #B74D15;
  padding: 8px 8px 2px;
  display: flex;
  justify-content: space-between;
}
.plant-controls .info {
  transform: translate(0, 1px);
}
.plant-controls .text {
  margin: 0;
  letter-spacing: 0.1em;
}
.favorite-large {
  display: none;
}
.filters {
  flex-direction: column;
  max-width: 350px;
  margin: auto;
  margin-bottom: 100%;
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

.filters fieldset .fieldset-toggle {
  font-size: 18px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  font-family: Lato;
  margin: 0;
  letter-spacing: 0.1em;
  font-weight: normal;
  background-color: inherit;
  color: inherit;
  border: none;
  border-radius: 0;
  padding: 0;
}
.filters fieldset.active .fieldset-toggle {
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
  padding-left: 8px;
  user-select: none;
}
.filters {
  display: none;
}
.filters-open .filter-toggle-and-sort {
  display: none;
}
.filters-open .filters {
  display: flex;
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
.search-submit {
  /* Mobile and medium use all in one apply button */
  display: none;
}
.filter-contents {
  user-select: none;
  display: flex;
}
.large-help {
  display: none;
  text-align: center;
}
.not-large-help {
  max-width: 320px;
  text-align: center;
  width: 50%;
  margin: auto;
  font-size: 12px;
  line-height: 16px;
  font-family: Roboto;
}
.not-large-help a {
  color: inherit;
}

.total-matches {
  text-align: center;
}

.questions {
  display: flex;
  margin: auto;
}

.question {
  flex-grow: 1.0;
}

.inactive-question {
  display: none;
}

.question-buttons {
  display: flex;
}

.question-buttons > * {
  flex-basis: 0;
  flex-grow: 1.0;
}

.question-buttons > * {
  margin-right: 16px;
}

.question-buttons > *:last-child {
  margin-right: 0;
}

@media all and (min-width: 1280px) {
  .large-help {
    display: block;
    text-align: center;
    width: 50%;
    font-size: 20px;
    line-height: 30px;
    font-family: Roboto;
    margin: auto;
  }
  .not-large-help {
    display: none;
    margin: auto;
    text-align: center;
  }
  .large-help a {
    color: inherit;
  }
  h1 {
    font-size: 60px;
  }
  main {
    display: flex;
    justify-content: space-between;
    gap: 32px;
    padding: 0 16px;
  }
  .apply {
    display: none;
  }
  .search-submit {
    /* At large size this button is just for the search field
      (in appearance — does the same darn thing but there's
      autosubmit at this size too) */
    display: block;
    margin-bottom: 24px;
  }
  main .controls {
    width: 320px;
    letter-spacing: 0.1em;
  }
  main .controls button {
    letter-spacing: 0.1em;
  }
  .inner-controls {
    position: static;
    z-index: auto;
    top: auto;
  }
  .inner-controls .clear {
    /* Chips have one and it is always visible at this size */
    display: none;
  }
  .filters fieldset {
    padding: 16px;
  }
  main .plants {
    flex-grow: 1.0;
    gap: 32px;
  }
  .filter {
    display: none;
  }
  .filter-toggle-and-sort {
    padding: 0 0 24px;
  }
  .filters-open .filter-toggle-and-sort {
    display: block;
  }
  .filters {
    display: flex;
  }
  .filters.inactive-question {
    display: none;
  }
  .search {
    margin-bottom: 24px;
    font-size: 16px;
    padding: 16px;
    border-radius: 8px;
    border: 1px solid black;
    height: auto;
    background-color: inherit;
  }
  .plant-controls-wrapper {
    background-color: #B74D15;
  }
  .plant-controls {
    color: white;
  }
  .favorite-regular {
    display: none;
  }
  .favorite-large.text {
    display: block;
    position: absolute;
    bottom: 48px;
    right: 16px;
    margin: 0;
    padding: 0;
    font-size: 24px;
    font-weight: normal;
    color: white;
  }
  button.text {
    letter-spacing: 0.1em;
  }
  .common-name {
    font-size: 14px;
  }
  .scientific-name {
    font-size: 14px;
  }
}

</style>

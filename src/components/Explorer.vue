<template>
  <div>
    <Header :h1="favorites ? 'Favorites' : null">
      <template v-slot:after-bar>
        <div class="two-up">
          <div class="two-up-text">
            <h2>
              Native plants promote a healthier ecosystem in your garden
            </h2>
            <p>
              Find which native shrubs, plants and flowers from <strong>Pennsylvania</strong>
              have the right conditions to flourish in your garden. Use the quick search option
              or side filters to get started. Detailed instructions are found <router-link to="/how-to-use#the-directions">here</router-link>
            </p>
          </div>
          <div :style="`background-image: url(/assets/images/two-up/${Math.floor(Math.random() * 17)}.jpg`"></div>
        </div>
      </template>
    </Header>
    <div class="search-desktop-parent" v-if="!(questions || favorites)">
      <form class="search-desktop" @submit.prevent="submit">
        <span class="material-icons">search</span>
        <input v-model="q" id="q" placeholder="Search plant name" />
        <button type="submit" class="text" :disabled="q.length == 0"><span class="material-icons">chevron_right</span></button>
      </form>
    </div>
    <article v-if="selected" class="selected">
      <div class="modal-bar">
        <span class="title">More Info</span>
        <router-link to="/" class="material-icons router-button close-nav">close</router-link>
      </div>
      <div class="two-up">
        <div class="two-up-text">
          <h1>{{ selected['Common Name'] }}</h1>
          <button @click="toggleFavorite(selected._id)" class="favorite-large text"><span class="material-icons material-align">{{ renderFavorite(selected._id) }}</span></button>
          <h2>{{ selected['Scientific Name'] }}</h2>
          <h3>Available at these stores:</h3>
          <p>{{ selected['Local Names'] }}</p>
          <p><a v-for="storeLink in storeLinks" :key="storeLink.url" :href="storeLink.url" class="store-link">{{ storeLink.label }}</a></p>
          <h3>Mentioned in these articles:</h3>
          <p>{{ selected['Article Names'] }}</p>
          <p v-if="selected['Flowering Months']">
            Flowering Months:
            {{ selected['Flowering Months'] }}
          </p>
          <p v-if="selected['Height (feet)']">
            Height: {{ selected['Height (feet)'] }} feet
          </p>
          <div class="chips flags">
            <span class="chip" v-for="flag in flags" v-bind:key="flag.key">
              <img v-if="!flag.color" :src="`/assets/images/${flag.svg}.svg`" class="choice-icon" />
              <span v-else class="chip-color" :style="chipColor(flag)"></span>
              <span class="chip-label">{{ flag.label }}</span>
            </span>
          </div>
        </div>
        <div :style="selectedImageStyle(selected)"></div>
      </div>
    </article>
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
            <div class="sort-and-favorites">
              <button class="favorites" v-if="!favorites" @click="$router.push('/favorites')">Favorites</button>
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
              <input v-model="q" id="q" type="search" class="search-mobile" placeholder="🔎" />
              <div class="go">
                <button class="primary primary-bar clear" @click="clearAll">Clear</button>
                <button class="primary primary-bar apply" type="submit">Apply</button>
              </div>
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
        <div class="chips-and-plants">
          <div class="chips" v-if="!favorites && chips.length">
            <button class="chip" v-for="chip in chips" v-bind:key="chip.key" @click="removeChip(chip)">
              <img v-if="!chip.color" :src="`/assets/images/${chip.svg}.svg`" class="choice-icon" />
              <span v-else class="chip-color" :style="chipColor(chip)"></span>
              <span class="chip-label">{{ chip.label }}</span><span class="material-icons">close</span>
            </button>
            <button class="text clear" @click="clearAll">Clear all</button>
          </div>
          <article class="plants">
            <article v-for="result in results" :key="result._id" class="plant-preview-wrapper">
              <div class="plant-preview">
                <img class="photo" :src="imageUrl(result, true)" />
                <h4 class="common-name">{{ result['Common Name'] }}</h4>
                <h5 class="scientific-name">{{ result['Scientific Name'] }}</h5>
                <button @click="toggleFavorite(result._id)" class="favorite-large text"><span class="material-icons material-align">{{ renderFavorite(result._id) }}</span></button>
                <div class="plant-controls-wrapper">
                  <div class="plant-controls">
                    <router-link :to="`/plants/${result['Scientific Name']}`" tag="button" class="text">
                      <span class="material-icons material-align info">info_outline</span> More Info
                    </router-link>
                    <button @click="toggleFavorite(result._id)" class="favorite-regular text"><span class="material-icons material-align">{{ renderFavorite(result._id) }}</span></button>
                  </div>
                </div>
              </div>
            </article>
            <!-- Placeholders to ensure minimum number of cells so the grid does not
              provide huge plant previews when there are only 3 plants on desktop -->
            <article v-for="extra in extras" :key="extra.id" class="extra"></article>
          </article>
        </div>
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
  name: 'Explorer',
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
        name: 'Availability Flags',
        label: 'Availability',
        value: [],
        array: true,
        counts: {}
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
	'Sort by Recommendation Score': 'Recommendation Score',
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
      activeSearch: '',
      sort: 'Sort by Recommendation Score',
      filters,
      filterValues: {...this.defaultFilterValues},
      filterIsOpen: Object.fromEntries(filters.map(filter => [
        filter.name, filter.initiallyOpen || false
      ])),
      filterCounts: Object.fromEntries(filters.map(filter => [ filter.name, {} ])),
      filtersOpen: false,
      updatingCounts: false,
      selected: null,
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
          filter: filters.find(filter => filter.name === 'Availability Flags'),
          title: 'Where would you like to purchase your plants?'
        },
        {
          filter: filters.find(filter => filter.name === 'Superplant'),
          title: 'You can further refine your search to only include Super Plants.'
        }
      ]
    };
  },
  computed: {
    selectedName() {
      return this.$route.params.name;
    },
    extras() {
      if (typeof window === 'undefined') {
        return [];
      }
      const min = Math.floor((window.innerWidth - 300) / 200);
      let extras = [];
      for (let i = 0; (i <= min); i++) {
        extras.push({ _id: i });
      }
      return extras;
    },
    chips() {
      return this.getChips(true);
    },
    flags() {
      return this.getChips(false);
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
    },
    storeLinks() {
      return this.selected['Online Names'].split(',').map(url => url.trim()).map(url => ({
        label: url,
        url
      }));
    }
  },
  watch: {
    selectedName() {
      this.fetchSelectedIfNeeded();
    },
    favorites() {
      this.determineFilterCountsAndSubmit();
    },
    questions() {
      if (this.questions) {
        this.filterValues = {...this.defaultFilterValues};
        this.determineFilterCountsAndSubmit();
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
  // Server only
  async serverPrefetch() {
    await this.determineFilterCountsAndSubmit();
    await this.fetchPage();
  },
  // Browser only
  async mounted() {
    await this.determineFilterCountsAndSubmit();
    await this.fetchSelectedIfNeeded();
    console.log(JSON.stringify(this.selected, null, '  '));
  },
  destroy() {
    document.body.removeEventListener('click', this.bodyClick);
  },
  methods: {
    getChips(active) {
      const chips = [];
      if (active && this.activeSearch.length) {
        chips.push({
          name: 'Search',
          label: this.activeSearch,
          key: 'Search',
          svg: 'Search'
        });
      }
      for (const filter of (active ? this.activeFilters : this.filters)) {
        let value = active ? this.filterValues[filter.name] : this.selected[filter.name];
        console.log(value);
        if (filter.array) {
          value = value || [];
          if (value === true) {
            value = [ filter.label ];
          }
          console.log(`value of ${filter.name} is`, value);
          if (filter.name === 'Flower Color Flags') {
            value.forEach(item => {
              chips.push({
                name: filter.name,
                label: item,
                color: item,
                key: filter.name + ':' + item
              });
            });
          } else {
            value.forEach(item => {
              chips.push({
                name: filter.name,
                label: item,
                svg: item,
                key: filter.name + ':' + item
              });
            });
          }
        } else if (filter.range) {
          if (active) {
            chips.push({
              name: filter.name,
              svg: filter.name,
              label: filter.label || filter.name,
              key: filter.name
            });
          }
        } else {
          chips.push({
            name: filter.name,
            label: value,
            svg: filter.name,
            key: filter.name
          });
        }
      }
      console.log(JSON.stringify(chips));
      return chips;
    },
    selectedImageStyle(selected) {
      const style = `background-image: url("${this.imageUrl(selected, false)}")`;
      console.log(style);
      return style;
    },
    async fetchSelectedIfNeeded() {
      if (!this.selectedName) {
        this.selected = null;
        this.$store.commit('setSelectedIsOpen', false);
      } else {
        // Could be optimized away in some cases, but not all
        // (direct links from Google for example), so let's stick to
        // what definitely works for now
        const response = await fetch(`/api/v1/plants/${this.selectedName}`);
        this.selected = await response.json();
        this.$store.commit('setSelectedIsOpen', true);
      }
    },
    async determineFilterCountsAndSubmit() {
      await this.determineFilterCounts();
      this.submit();
    },
    async determineFilterCounts() {
      this.initializing = true;
      if (!this.determinedFilterCounts) {
        const response = await fetch('/api/v1/plants?results=0&total=0');
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
    imageUrl(result, preview) {
      if (result.hasImage) {
        if (preview) {
          return `/images/${result._id}.preview.jpg`;
        } else {
          return `/images/${result._id}.jpg`;
        }
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
        const response = await fetch('/api/v1/plants?' + qs.stringify(params));
        const data = await response.json();
        this.filterCounts = data.counts;
        this.activeSearch = this.q;
      } finally {
        this.updatingCounts = false;
      }
    },
    async fetchPage() {
      this.loading = true;
      if (this.favorites && !([...this.$store.state.favorites].length)) {
        // Avoid a query that would result in seeing all of the plants
        // in the database as "favorites"
        this.results = [];
        this.loadedAll = true;
        this.total = 0;
        this.loading = false;
        return;
      }
      const params = this.favorites ? {
        favorites: [...this.$store.state.favorites],
        sort: this.sort
      } : {
        ...this.filterValues,
        q: this.q,
        sort: this.sort,
        page: this.page
      };
      this.activeSearch = this.q;
      if (this.initializing) {
        // Don't send a bogus query for min 0 max 0
        delete params['Height (feet)'];
      }
      const response = await fetch('/api/v1/plants?' + qs.stringify(params));
      const data = await response.json();
      if (!this.favorites) {
        this.filterCounts = data.counts;
        for (const filter of this.filters) {
          filter.choices = data.choices[filter.name];
        }
      }
      if ((!data.results.length) || this.favorites || this.questions) {
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
        if ((typeof window) === 'undefined') {
          // server side, not appropriate
          return;
        }
        if (!this.$el.closest('body')) {
          // Component unmounted, don't waste energy
          return;
        }
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
      if (chip.name === 'Search') {
        this.q = '';
      } else {
        const filter = this.filters.find(filter => filter.name === chip.name);
        if (filter.array) {
          this.filterValues[chip.name] = this.filterValues[chip.name].filter(value => value !== chip.label);
        } else {
          this.filterValues[chip.name] = filter.default;
        }
      }
      this.submit();
    },
    clearAll() {
      for (const filter of this.filters) {
        this.filterValues[filter.name] = filter.default;
      }
      this.q = '';
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
    chipColor(chip) {
      if (chip.color) {
        return this.flowerColorStyle(chip.color);
      } else {
        return '';
      }
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

main {
  padding: 0 32px;
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
  font-size: 16px;
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
  margin-bottom: 16px;
}

button.favorites {
  width: 100%;
  display: block;
  margin-bottom: 24px;
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
  text-align: left;
  line-height: 1.5;
  height: 4em;
  white-space: nowrap;
  overflow: scroll;
  /* https://stackoverflow.com/questions/36230944/prevent-flex-items-from-overflowing-a-container */
  min-width: 0;
}

.chip {
  display: inline-block;
  border-radius: 30px;
  margin: 8px 8px 8px 0;
  letter-spacing: 0.1em;
}

.chip img {
  /* Tinted to match our text color: https://codepen.io/sosuke/pen/Pjoqqp */
  filter: invert(41%) sepia(98%) saturate(5459%) hue-rotate(19deg) brightness(89%) contrast(84%);
  width: 24px;
  height: 24px;
  padding: 2px;
  margin-right: 8px;
  border-radius: 50%;
  border: 1px solid #B74D15;
  vertical-align: middle;
}

.chip-color {
  display: inline-block;
  width: 24px;
  height: 24px;
  margin-right: 8px;
  border-radius: 50%;
  border: 1px solid #B74D15;
  vertical-align: middle;
}

.chip-label, .chip .material-icons {
  display: inline-block;
  transform: translate(0, 2px);
}

.chip .material-icons {
  margin-left: 8px;
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
.chips-and-plants {
  flex-grow: 1.0;
  min-width: 0;
}
.plants {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(248px, 1fr));
  gap: 8px;
  align-content: start;
}
.plant-preview-wrapper {
  position: relative;
  aspect-ratio: 1/1;
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
  bottom: 74px;
  left: 16px;
  margin: 0;
  padding: 0;
  font-size: 14px;
  font-weight: normal;
  font-family: Lato;
  color: white;
}
.scientific-name {
  position: absolute;
  bottom: 56px;
  left: 16px;
  margin: 0;
  padding: 0;
  font-size: 12px;
  font-style: italic;
  font-weight: normal;
  font-family: Lato;
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
  padding: 16px 8px 0 4px;
  height: 48px;
  display: flex;
  justify-content: space-between;
}
.plant-controls .text {
  margin: 0;
  letter-spacing: 0.1em;
}
.plant-controls a.text {
  color: white;
  text-decoration: none;
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
.search-mobile {
  display: block;
  height: 64px;
  font-size: 24px;
  padding: 16px;
  margin-bottom: 8px;
  width: 100%;
}
.search-desktop-parent {
  display: none;
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

.selected {
  position: fixed;
  top: 0px;
  left: 0px;
  width: 100%;
  height: 100vh;
  background-color: #fcf9f4;
  z-index: 200;
}

.two-up {
  display: flex;
}

.two-up-text {
  padding: 40px;
  position: relative;
}

.two-up h2 {
  font-family: Arvo;
  font-weight: normal;
  font-size: 36px;
  max-width: 460px;
  line-height: 48px;
  margin: 0;
  padding: 0;
}

.two-up p {
  max-width: 560px;
  color: #1D2E26;
  font-size: 16px;
  font-family: Roboto;
  font-weight: normal;
  line-height: 24px;
}

.two-up p a {
  color: #B74D15;
}

.two-up > * {
  color: #B74D15;
  flex-grow: 1.0;
  flex-basis: 0;
  height: 380px;
  background-color: white;
  background-size: cover;
  background-position: center;
}

.selected .two-up > * {
  height: 736px;
  background-color: #FCF9F4;
  color: black;
}

.selected h1, .selected h2, .selected h3, selected h4 {
  font-family: Roboto;
  text-align: left;
}

.selected h1 {
  font-size: 40px;
  margin: 0 0 12px 0;
}

.selected h2 {
  font-size: 24px;
  margin: 0 0 32px 0;
}

.selected h3 {
  font-size: 24px;
  font-weight: 500;
  margin: 0 0 8px 0;
}

.selected p {
  font-size: 20px;
  margin: 0 0 16px 0;
}

.selected .two-up-text {
  overflow: scroll;
}

.two-up .chips {
  max-width: 560px;
  overflow: visible;
  white-space: normal;
}

.two-up .chips .chip {
  white-space: normal;
  letter-spacing: 0;
  color: #B74D15;
  font-family: Roboto;
  font-size: 16px;
  margin-right: 24px;
}

.two-up a.store-link {
  color: inherit;
  text-decoration: none;
}

.store-link::after {
  content: ', ';
}

.store-link:last-child::after {
  content: '';
}

@media all and (min-width: 1280px) {
  .sort-and-favorites {
    margin-bottom: 0;
    display: block;
  }
  .large-help {
    display: block;
    text-align: center;
    width: 600px;
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
  }
  .apply {
    display: none;
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
  .search-mobile {
    display: none;
  }
  .search-desktop-parent {
    display: flex;
    justify-content: right;
    padding: 24px 32px;
  }
  .search-desktop {
    display: flex;
    min-width: 400px;
    padding: 16px;
    border-radius: 8px;
    border: 1px solid #1D2E26;
  }
  .search-desktop button {
    padding: 0;
  }
  .search-desktop button:disabled {
    opacity: 0.5;
  }
  .search-desktop .material-icons {
    padding: 0 8px;
  }
  .search-desktop input {
    font-size: 16px;
    height: auto;
    background-color: inherit;
    padding: 0;
    border: 0;
    width: 100%;
  }
  .search-desktop input:focus {
    outline: none;
  }
  .search-desktop::placeholder {
    font-style: italic;
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
  .selected .favorite-large.text {
    top: 48px;
    right: 32px;
    font-size: 40px;
    height: 48px;
    color: #B74D15;
  }
  button.text {
    letter-spacing: 0.1em;
  }
  .common-name {
    font-size: 16px;
  }
  .scientific-name {
    font-size: 16px;
  }
  .modal-bar {
    padding: 12px;
    height: 48px;
    text-align: center;
    border-bottom: 1px solid black;
    position: relative;
  }
  .modal-bar .title {
    margin-top: 8px;
    font-family: Arvo;
    font-size: 20px;
    line-height: 24px;
    font-weight: normal;
    vertical-align: middle;
  }
  .modal-bar .close-nav {
    position: absolute;
    font-size: 40px;
    right: 8px;
    text-decoration: none;
    color: black;
    transform: translate(0, -8px);
  }
  .selected {
    flex-direction: row;
    height: 66vh;
  }
  .selected .info {
    order: 1;
    flex-basis: 0;
    flex-grow: 1;
  }
  .selected .photo {
    order: 2;
    flex-basis: 0;
    flex-grow: 1;
  }
}

</style>

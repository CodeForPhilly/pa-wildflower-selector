<template>
  <div>
    <form id="form" @submit.prevent="submit">
      <fieldset>
        <select v-model="sort">
          <option>Sort by Common Name (A-Z)</option>
          <option>Sort by Common Name (Z-A)</option>
          <option>Sort by Scientific Name (A-Z)</option>
          <option>Sort by Scientific Name (Z-A)</option>
          <option>Sort by Flower Color</option>
          <option>Sort by Height (L-H)</option>
          <option>Sort by Height (H-L)</option>
        </select>
      </fieldset>
      <fieldset v-for="filter in filters" :key="filter.name">
        <template v-if="filter.range">
          <legend>{{ filter.label || filter.name }}</legend>
          <Range :double="filter.double" :exponent="filter.exponent" :choices="filter.choices" :min="filter.min" :max="filter.max" v-model="filterValues[filter.name]" />
        </template>
        <template v-else>
          <legend>{{ filter.label || filter.name }}</legend>
          <label v-for="choice in filter.choices" :key="choice">
            <input v-model="filterValues[filter.name]" :value="choice" type="checkbox" />
            {{ choice }}
          </label>
        </template>
      </fieldset>
      <fieldset>
        <label for="q">Search</label>
        <input v-model="q" id="q" type="search" />
      </fieldset>
      <button type="submit">Go</button>
    </form>
    <h4>Total matches: {{ total }}</h4>
    <p v-if="sortFilterLabel">Only plants whose {{ sortFilterLabel }} is known are included. To see all matching plants, sort by name.</p>
    <table>
      <tr>
        <th>Common Name</th><th>Scientific Name</th><th>Credit</th><th>Flower Color</th><th>Average Height (ft)</th><th>Image</th>
      </tr>
      <tr v-for="result in results" :key="result._id">
        <td>{{ result['Common Name'] }}</td>
        <td>{{ result['Scientific Name'] }}</td>
        <td><span v-html="result.attribution" /></td>
        <td>{{ result['Flower Color'] }}</td>
        <td>{{ result['Average Height'] }}</td>
        <td><img class="photo" :src="imageUrl(result)" /></td>
      </tr>
    </table>
    <div ref="afterTable"></div>
  </div>
</template>

<script>
import qs from 'qs';
import Range from './components/Range.vue';

export default {
  name: 'App',
  components: {
    Range
  },
  data() {
    const filters = [
      {
        name: 'Sun Exposure Flags',
        label: 'Sun Exposure',
        value: [],
        array: true
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
        },
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
      },
      {
        name: 'Soil Moisture Flags',
        label: 'Soil Moisture',
        value: [],
        array: true
      },
      {
        name: 'Plant Type Flags',
        label: 'Plant Type',
        value: [],
        array: true
      },
      {
        name: 'Pollinator Flags',
        label: 'Pollinators',
        value: [],
        array: true
      },
      {
        name: 'Superplant',
        choices: [ true ],
        value: []
      }
    ];
    return {
      initializing: true,
      results: [],
      total: 0,
      q: '',
      sort: 'Sort by Common Name (A-Z)',
      filters,
      filterValues: Object.fromEntries(filters.map(filter => {
        const value = [ filter.name, filter.value ];
        delete filter.value;
        return value;
      }))
    };
  },
  computed: {
    sortFilterLabel() {
      return {
        'Sort by Flower Color': 'flower color',
        'Sort by Height (L-H)': 'height',
        'Sort by Height (H-L)': 'height'
      }[this.sort];
    }
  },
  watch: {
    sort() {
      this.submit();
    }
  },
  // If we decide to autosubmit on all changes, we can deep watch filterValues
  // filterValues: {
  //   handler() {
  //     this.submit();
  //   },
  //   deep: true
  // }
  mounted() {
    const observer = new IntersectionObserver(this.loadMoreIfNeeded);
    observer.observe(this.$refs.afterTable);
    this.submit();
  },
  methods: {
    imageUrl(result) {
      return `/images/${result._id}.jpg`;
    },
    async submit() {
      this.page = 1;
      this.loadedAll = false;
      this.results = [];
      this.total = 0;
      return this.fetchPage();
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
      if (!this.loadedAll && !this.loading && (window.scrollY + window.innerHeight > document.body.clientHeight)) {
        // this.$refs.afterTable.getBoundingClientRect().top)) {
        this.page++;
        await this.fetchPage();
      }
    }
  }
}
</script>

<style>
#app {
  font-family: Helvetica;
  max-width: 800px;
  margin: auto;
}
label {
  display: inline-block;
  margin-right: 2em;
}
input {
  display: inline-block;
  margin-right: 2em;
  height: 2em;
}
img {
  max-width: 500px;
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
.photo {
  height: 150px;
}
</style>

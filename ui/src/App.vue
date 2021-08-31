<template>
  <div>
    <form id="form" @submit.prevent="submit">
      <fieldset v-for="filter in filters" :key="filter.name">
        <template v-if="filter.range">
          <legend>{{ filter.label || filter.name }}</legend>
          <DoubleRange :choices="filter.choices" :min="filter.min" :max="filter.max" v-model="filter.value" />
        </template>
        <template v-else>
          <legend>{{ filter.label || filter.name }}</legend>
          <label v-for="choice in filter.choices" :key="choice">
            <input v-model="filter.value" :value="choice" type="checkbox" />
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
    <h4>Total matches: {{ results.length }}</h4>
    <table>
      <tr>
        <th>Common Name</th><th>Scientific Name</th><th>Credit</th><th>Image</th>
      </tr>
      <tr v-for="result in results" :key="result._id">
        <td>{{ result['Common Name'] }}</td>
        <td>{{ result['Scientific Name'] }}</td>
        <td><span v-html="result.attribution" /></td>
        <td><img :src="imageUrl(result)" /></td>
      </tr>
    </table>
  </div>
</template>

<script>
import qs from 'qs';
import DoubleRange from './components/DoubleRange.vue';

export default {
  name: 'App',
  components: {
    DoubleRange
  },
  data() {
    return {
      initializing: true,
      results: [],
      q: '',
      filters: [
        {
          name: 'Sun Exposure',
          commaSeparated: true,
          value: []
        },
        {
          name: 'Flowering Months',
          range: true,
          choices: [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ],
          min: 0,
          max: 11,
          value: {
            min: 0,
            max: 11
          }
        },
        {
          name: 'Height (feet)',
          range: true,
          choices: [],
          min: 0,
          max: 0,
          value: {
            min: 0,
            max: 0
          }
        },
        {
          name: 'Soil Moisture',
          commaSeparated: true,
          value: []
        },
        {
          name: 'Plant Type',
          value: [],
          commaSeparated: true
        },
        {
          name: 'Pollinators',
          commaOrSemicolonSeparated: true,
          value: [],

        },
        {
          name: 'Common Family',
          value: []
        }
      ]
    };
  },
  mounted() {
    this.submit();
  },
  methods: {
    imageUrl(result) {
      return `/images/${result._id}.jpg`;
    },
    async submit() {
      const params = {
        ...Object.fromEntries(this.filters.map(filter => [ filter.name, filter.value ])),
        q: this.q
      };
      const response = await fetch('/plants?' + qs.stringify(params));
      const data = await response.json();
      for (const filter of this.filters) {
        filter.choices = data.choices[filter.name];
      }
      this.results = data.results;
      if (this.initializing) {
        const height = this.filters.find(filter => filter.name === 'Height (feet)');
        height.min = 0;
        const heights = data.choices['Height (feet)'];
        height.max = heights[heights.length - 1];
        height.value.min = 0;
        height.value.max = height.max;
        this.initializing = false;
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
</style>

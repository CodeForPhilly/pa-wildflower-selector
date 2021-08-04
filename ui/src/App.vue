<template>
  <div>
    <form id="form" @submit.prevent="submit">
      <fieldset v-for="filter in filters" :key="filter.name">
        <!--
        <template v-if="filter.range">
          <legend>{{ filter.name }}</legend>
          <label>
            <input type="range" min="filter.min" max="filter.max" step="1" v-model="filter.value" />
            {{ choice }}
          </label>
        </template>      
        <template v-else>
          -->
          <legend>{{ filter.name }}</legend>
          <label v-for="choice in filter.choices" :key="choice">
            <input v-model="filter.value" :value="choice" type="checkbox" />
            {{ choice }}
          </label>
        <!--
        </template>
        -->
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

export default {
  name: 'App',
  data() {
    return {
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
          value: []
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
      console.log('CHOICES:', data.choices);
      for (const filter of this.filters) {
        filter.choices = data.choices[filter.name];
      }
      this.results = data.results;
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
</style>

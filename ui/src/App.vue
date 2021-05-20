<template>
  <form id="form" @submit.prevent="submit">
    <fieldset>
      <label for="q">Search</label>
      <input v-model="q" id="q" type="search" />
      <button type="submit">Go</button>
    </fieldset>
  </form>
  <table>
    <tr>
      <th>Common Name</th><th>Scientific Name</th><th>Image</th>
    </tr>
    <tr v-for="result in results" :key="result._id">
      <td>{{ result['Common Name'] }}</td>
      <td>{{ result['Scientific Name'] }}</td>
      <td><img :src="imageUrl(result)" /></td>
    </tr>
  </table>
</template>

<script>

export default {
  name: 'App',
  data() {
    return {
      results: [],
      q: ''
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
      const response = await fetch('/plants?' + new URLSearchParams({
        q: this.q
      }));
      const data = await response.json();
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

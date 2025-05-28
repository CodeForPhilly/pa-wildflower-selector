<template>
  <div class="search-input">
    <input
      ref="input"
      v-model="text"
      type="text"
      placeholder="Type to filter"
      @input="onInput"
    />
    <div v-if="showSuggestions" class="suggestions">
      <div
        v-for="suggestion in filtered"
        :key="suggestion"
        class="suggestion"
        @click="select(suggestion)"
      >
        {{ suggestion }}
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    suggestions: Array
  },
  emits: ['select'],
  data() {
    return {
      text: '',
      show: false
    };
  },
  computed: {
    filtered() {
      if (this.text.length < 2) return [];
      const t = this.text.toLowerCase();
      return this.suggestions.filter(s => s.toLowerCase().includes(t));
    },
    showSuggestions() {
      return this.filtered.length > 0 && this.show;
    }
  },
  mounted() {
    this.$refs.input.focus();
  },
  methods: {
    onInput() {
      this.show = true;
    },
    select(val) {
      this.$emit('select', val);
      this.text = '';
      this.show = false;
    }
  }
};
</script>

<style scoped>
.search-input {
  padding: 16px;
}
.search-input input {
  width: 100%;
  font-size: 16px;
  padding: 8px;
  border: 1px solid #1d2e26;
  border-radius: 8px;
}
.suggestions {
  margin-top: 8px;
  border: 1px solid #ccc;
  border-radius: 8px;
  max-height: 200px;
  overflow: auto;
}
.suggestion {
  padding: 12px 16px;
  cursor: pointer;
}
.suggestion:hover {
  background: #ffebcc;
}
</style>

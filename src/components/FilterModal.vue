<template>
  <transition name="modal-fade">
    <div v-if="open" class="filter-modal" @keydown.esc="$emit('close')">
      <div class="modal-bar">
        <span class="title">Filter</span>
        <button class="close" @click="$emit('close')">✕</button>
      </div>
      <SearchInput
        :suggestions="suggestions"
        @select="addChip"
      />
      <ChipList :chips="chips" @remove="removeChip" />
    </div>
  </transition>
</template>

<script>
import SearchInput from './SearchInput.vue';
import ChipList from './ChipList.vue';
import suggestionRules from '../suggestionRules';

export default {
  components: { SearchInput, ChipList },
  props: {
    open: Boolean
  },
  emits: ['close', 'update:query'],
  data() {
    return {
      chips: []
    };
  },
  computed: {
    suggestions() {
      return Object.keys(suggestionRules);
    },
    query() {
      const q = {};
      for (const chip of this.chips) {
        const { field, value } = suggestionRules[chip];
        if (Array.isArray(q[field])) {
          q[field].push(value);
        } else if (q[field]) {
          q[field] = [q[field], value];
        } else {
          q[field] = Array.isArray(value) ? [...value] : value;
        }
      }
      return q;
    }
  },
  watch: {
    query: {
      handler(newVal) {
        this.$emit('update:query', newVal);
      },
      deep: true
    },
    open(val) {
      if (val) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
  },
  methods: {
    addChip(label) {
      if (!this.chips.includes(label)) {
        this.chips.push(label);
      }
    },
    removeChip(label) {
      const idx = this.chips.indexOf(label);
      if (idx !== -1) {
        this.chips.splice(idx, 1);
      }
    }
  }
};
</script>

<style scoped>
.filter-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: #fcf9f4;
  z-index: 1200;
  display: flex;
  flex-direction: column;
}
.modal-bar {
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  height: 56px;
  border-bottom: 1px solid #1d2e26;
}
.modal-bar .title {
  font-family: Arvo;
  font-size: 20px;
}
.modal-bar .close {
  position: absolute;
  right: 16px;
  top: 16px;
  background: none;
  border: none;
  font-size: 24px;
}
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all 0.3s ease;
}
.modal-fade-enter,
.modal-fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>

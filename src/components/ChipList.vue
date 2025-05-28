<template>
  <div class="chip-list">
    <transition-group name="chip" tag="div" class="chips">
      <span
        v-for="chip in chips"
        :key="chip"
        class="chip"
      >
        {{ chip }}
        <button class="remove" @click="$emit('remove', chip)">✕</button>
      </span>
    </transition-group>
  </div>
</template>

<script>
export default {
  props: {
    chips: Array
  },
  emits: ['remove']
};
</script>

<style scoped>
.chip-list {
  padding: 8px 16px;
  overflow-x: auto;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.chip {
  display: inline-flex;
  align-items: center;
  background: #b74d15;
  color: white;
  border-radius: 16px;
  padding: 4px 8px;
  font-size: 14px;
}
.chip .remove {
  background: none;
  border: none;
  color: inherit;
  margin-left: 4px;
  font-size: 16px;
}
.chip-enter-active,
.chip-leave-active {
  transition: all 0.2s ease;
}
.chip-enter-from,
.chip-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>

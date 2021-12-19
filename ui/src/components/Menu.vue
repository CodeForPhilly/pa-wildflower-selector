<template>
  <menu :style="{ visibility: open ? 'visible' : 'hidden' }">
    <li :class="choiceClass(choice.value)" v-for="choice in choices" v-bind:key="choice.value" @click="setValue(choice.value)" @keydown.enter="setValue(choice.value)" tabindex="0">{{ choice.label }}</li>
  </menu>
</template>

<script>
export default {
  events: [ 'update:modelValue', 'close' ],
  props: {
    choices: Array,
    modelValue: String,
    open: Boolean
  },
  mounted() {
    document.body.addEventListener('click', this.bodyClick);
    document.body.addEventListener('keydown', this.bodyKey);
  },
  destroy() {
    document.body.removeEventListener('click', this.bodyClick);
    document.body.removeEventListener('keydown', this.bodyKey);
  },
  methods: {
    setValue(value) {
      this.$emit('update:modelValue', value);
      this.$emit('close');
    },
    bodyKey(e) {
      if (e.key === 'Escape') {
        if (this.open) {
          this.$emit('close');
        }
      }
    },
    bodyClick() {
      if (this.open) {
        this.$emit('close');
      }
    },
    choiceClass(value) {
      if (this.modelValue === value) {
        return 'active';
      } else {
        return '';
      }
    }
  }
};
</script>

<style scoped>
menu {
  position: absolute;
  z-index: 100;
  right: 0;
  background-color: #FCF9F4;
  display: flex;
  flex-direction: column;
  padding-inline-start: 0;
  border-radius: 8px;
  font-size: 16px;
  border-radius: 16px;
  margin: 0;
}

menu li {
  cursor: pointer;
  list-style: none;
  line-height: 2;
  color: black;
  padding: 0 12px;
  border-bottom: 1px solid #aaa;
}

menu li:first-child {
  border-radius: 9px 9px 0 0;
  background-clip: padding-box;
}

menu li:last-child {
  border-radius: 0 0 9px 9px;
  background-clip: padding-box;
  border-bottom: none;
}

menu li:focus {
  color: #B74D15;
  background-color: #ffebcc;
}

menu li:hover {
  color: #B74D15;
  background-color: #ffebcc;
}
</style>
<template>
  <button tabIndex="0" :class="classes" @click.prevent="onClick" />
</template>

<script>
export default {
  props: {
    modelValue: {
      type: Array,
      required: true
    },
    disabled: {
      type: Boolean,
      required: false,
      default: false
    },
    value: {
      type: String,
      required: true
    }
  },
  emits: [ 'update:modelValue' ],
  computed: {
    classes() {
      if (this.modelValue.includes(this.value)) {
        return 'checkbox checked';
      } else {
        return 'checkbox';
      }
    }
  },
  methods: {
    onClick() {
      const newValue = this.modelValue.filter(value => value !== this.value);
      if (!this.modelValue.includes(this.value)) {
        newValue.push(this.value);
      }
      this.$emit('update:modelValue', newValue);
    }
  }
};
</script>

<style scoped>
  .filter-contents {
    user-select: none;    
  }
  .checkbox {
    display: inline-block;
    background-color: white;
    width: 24px;
    height: 24px;
    border: 1px solid black;
    cursor: pointer;
    border-radius: 0;
    padding: 0;
  }
  .checkbox.checked {
    background-color: black;
  }
</style>
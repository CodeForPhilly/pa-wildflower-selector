<template>
  <span tabIndex="-1" :class="classes" @click="onClick" />
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
      console.log(this.modelValue);
      const newValue = this.modelValue.filter(value => value !== this.value);
      if (!this.modelValue.includes(this.value)) {
        newValue.push(this.value);
      }
      this.$emit('update:modelValue', newValue);
      console.log(JSON.stringify(newValue));
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
  }
  .checkbox.checked {
    background-color: black;
  }
</style>
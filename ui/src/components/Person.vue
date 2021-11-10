<template>
  <div>
    <img v-if="image" :src="`/images/${image}.jpg`" :alt="alt" />
    <slot></slot>
  </div>
</template>

<script>
export default {
  props: {
    image: {
      type: String,
      default: null
    },
    alt: {
      type: String,
      default: ''
    }
  }
}
</script>

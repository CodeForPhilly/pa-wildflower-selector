<template>
  <div>
    <main>
      <h1>{{ title }}</h1>
      <slot></slot>
    </main>
  </div>
</template>

<script>
export default {
  props: {
    title: String
  }
};
</script>

<style scoped>
  
</style>
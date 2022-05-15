<template>
  <a class="up" @click.prevent="scrollToTop"><span class="material-icons">keyboard_arrow_up</span></a>
</template>

<script>
export default {
  methods: {
    scrollToTop() {
      window.scrollTo(0, 0);
    }
  }
}
</script>

<style scoped>
.up {
  display: block;
  text-align: center;
}
.up {
  text-decoration: none;
  border-bottom: none;
  color: black;
}
</style>
<template>
  <div class="person-wrapper">
    <div class="person-text">
      <slot></slot>
    </div>
    <img v-if="image" :src="`/assets/images/${image}.jpg`" :alt="alt" />
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

<style>
  .person-wrapper {
    position: relative;
    background-color: #d2871500;
    transition: background-color 1s;
  }
  .person-wrapper:hover {
    background-color: #d28715ff;
    transition: background-color 1s;
  }
  .person-wrapper img {
    pointer-events: none;
    display: block;
    object-fit: cover;
    width: 100%;
    aspect-ratio: 1/1;
    transition: opacity 1s;
  }
  .person-wrapper:hover img {
    opacity: 0;
    transition: opacity 1s;
  }
  .person-wrapper .person-text {
    position: absolute;
    opacity: 0;
    width: 100%;
    line-height: 1.5;
    font-size: 16px;
    text-align: center;
    top: 50%;
    transform: translateY(-50%);
    margin: 0;
    transition: opacity 1s;
  }
  .person-wrapper .person-text h4 {
    text-transform: uppercase;
  }
  .person-wrapper:hover .person-text {
    opacity: 1.0;
    transition: opacity 1s;
  }
</style>
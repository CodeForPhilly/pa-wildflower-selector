<template>
  <div class="page">
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

<style>
  .page {
    font-family: "Roboto";
    font-size: 20px;
    font-weight: 400;
    color: #1D2E26;
    line-height: 2;
  }
  .page main > * {
    margin: auto;
    max-width: 1024px;
    padding: 0 16px;
  }
  @media screen and (max-width: 799px) {
    .page main > * {
      padding: 0;
    }
  }
  .page a {
    color: inherit;
    text-decoration: none;
    border-bottom: 1px solid #1D2E26;
  }
  .page h1 {
    font-family: "Arvo";
    font-weight: 300;
    font-size: 64px;
  }
  .page menu {
    font-size: 32px;
    font-weight: normal;
  }
  .page h3 {
    font-size: 64px;
  }
  .facing {
    display: flex;
  }
  .facing > * {
    flex-basis: 0;
    flex-grow: 1.0;
  }
  .page .wave {
    stroke: blue;
  }
</style>
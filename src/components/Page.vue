<template>
  <div>
    <Header :h1="h1" />
    <div class="page">
      <main>
        <slot></slot>
      </main>
    </div>
  </div>
</template>

<script>
import Header from './Header.vue';

export default {
  props: {
    title: String,
    h1: String
  },
  components: {
    Header
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
    max-width: 1279px;
    padding: 0 16px;
  }
  @media screen and (max-width: 799px) {
    .page main > * {
      padding: 8px;
    }
  }
  .page a {
    color: inherit;
    text-decoration: none;
    border-bottom: 1px solid #1D2E26;
  }
  .page menu {
    margin-top: 48px;
    font-size: 32px;
    font-weight: normal;
  }
  .page h3 {
    font-size: 64px;
  }
  @media screen and (max-width: 799px) {
    .page h3 {
      font-size: 48px;
    }
  }
  .facing {
    display: flex;
  }
  .facing > * {
    flex-basis: 0;
    flex-grow: 1.0;
  }
  @media screen and (max-width: 799px) {
    .facing {
      display: block;
    }
  }
  p {
    font-weight: 300;
  }
  .page h4 {
    text-transform: uppercase;
  }
  .page main > .tone {
    background-color: #B74D15;
    display: flex;
    flex-direction: column;
    max-width: 100%;
    padding: 0;
    color: white;
  }
  .page main > .tone.light {
    background-color: #FA9271;
    color: #1D2E26;
  }
  .tone > * {
    margin: auto;
    max-width: 1279px;
    padding: 0 16px;
  }
  .tone > .carrier-wave {
    display: flex;
    width: 100%;
    overflow: hidden;
    padding: 0;
    margin: 0;
    border: 0;
    max-width: 100%;
  }
  .tone > .carrier-wave .wave {
    width: 100%;
  }
  @media screen and (max-width: 799px) {
    .tone > .carrier-wave .wave {
      width: 200%;
    }
  }
</style>
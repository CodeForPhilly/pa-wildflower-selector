<template>
  <div :class="classes">
    <div class="modal-cover"></div>
    <router-view />
  </div>
</template>

<script>
export default {
  computed: {
    classes() {
      return {
        outer: true,
        'nav-is-open': this.$store.state.navIsOpen,
        'menu-is-open': this.$store.state.navIsOpen || this.$store.state.sortIsOpen
      };
    }
  }
};
</script>

<style>
html {
  box-sizing: border-box;
}
.modal-cover {
  display: none;
}
.outer {
  position: relative;
  padding-top: 48px;
}

.menu-is-open .modal-cover {
  display: block;
  position: fixed;
  width: 100%;
  height: 200%;
  opacity: 0.5;
  z-index: 100;
  top: -48px;
  background-color: black;
}
*, *:before, *:after {
  box-sizing: inherit;
}
@font-face {
  font-family: Arvo;
  src: url("/assets/fonts/Arvo-Regular.ttf") format("truetype");
}
@font-face {
  font-family: Arvo;
  font-weight: 700;
  font-style: normal;
  src: url("/assets/fonts/Arvo-Bold.ttf") format("truetype");
}
@font-face {
  font-family: Arvo;
  font-style: italic;
  src: url("/assets/fonts/Arvo-Italic.ttf") format("truetype");
}
@font-face {
  font-family: Arvo;
  font-weight: 700;
  font-style: italic;
  src: url("/assets/fonts/Arvo-BoldItalic.ttf") format("truetype");
}

@font-face {
  font-family: Roboto;
  src: url("/assets/fonts/Roboto-Regular.ttf") format("truetype");
}
@font-face {
  font-family: Roboto;
  font-weight: 700;
  font-style: normal;
  src: url("/assets/fonts/Roboto-Bold.ttf") format("truetype");
}
@font-face {
  font-family: Roboto;
  font-style: italic;
  src: url("/assets/fonts/Roboto-Italic.ttf") format("truetype");
}
@font-face {
  font-family: Roboto;
  src: url("/assets/fonts/Roboto-Regular.ttf") format("truetype");
}

@font-face {
  font-family: Roboto;
  font-weight: 300;
  font-style: normal;
  src: url("/assets/fonts/Roboto-Light.ttf") format("truetype");
}
@font-face {
  font-family: Roboto;
  font-weight: 300;
  font-style: italic;
  src: url("/assets/fonts/Roboto-LightItalic.ttf") format("truetype");
}

@font-face {
  font-family: Lato;
  src: url("/assets/fonts/Lato-Regular.ttf") format("truetype");
}
@font-face {
  font-family: Lato;
  font-weight: 700;
  font-style: normal;
  src: url("/assets/fonts/Lato-Bold.ttf") format("truetype");
}
@font-face {
  font-family: Lato;
  font-style: italic;
  src: url("/assets/fonts/Lato-Italic.ttf") format("truetype");
}
@font-face {
  font-family: Lato;
  font-weight: 700;
  font-style: italic;
  src: url("/assets/fonts/Lato-BoldItalic.ttf") format("truetype");
}
@font-face {
  font-family: 'Material Icons';
  font-style: normal;
  font-weight: 400;
  src: url("/assets/fonts/MaterialIcons-Regular.ttf") format("truetype");
}

body {
  background-color: #fcf9f4;
  padding: 0;
  margin: 0;
}

.material-icons {
  font-family: 'Material Icons';
  font-weight: normal;
  font-style: normal;
  display: inline-block;
  line-height: 1;
  text-transform: none;
  letter-spacing: normal;
  word-wrap: normal;
  white-space: nowrap;
  direction: ltr;

  /* Support for all WebKit browsers. */
  -webkit-font-smoothing: antialiased;
  /* Support for Safari and Chrome. */
  text-rendering: optimizeLegibility;

  /* Support for Firefox. */
  -moz-osx-font-smoothing: grayscale;

  /* Support for IE. */
  font-feature-settings: 'liga';

  vertical-align: middle;
  
  font-size: 120%;
}

.material-align {
  display: inline-flex;
  vertical-align: bottom;  
}
</style>
<template>
  <div>
    <header>
      <nav :class="{ 'main-nav': true, 'mobile-visible': navIsOpen }">
        <div class="custom-nav">
          <router-link class="logo-parent" to="/"><img class="logo" src="/assets/images/logo.png" alt="Choose Native Plants PA" /></router-link>
          <button @click="openNav" class="material-icons router-button open-nav">menu</button>
          <button @click="closeNav" class="material-icons router-button close-nav">close</button>
        </div>
        <menu>
          <router-link to="/people-page">People Page</router-link>
          <router-link to="/how-to-use">How to Use</router-link>
        </menu>
      </nav>
    </header>
    <router-view />
  </div>
</template>

<script>

export default {
  data() {
    return {
      navIsOpen: false
    };
  },
  watch:{
    $route () {
      this.closeNav();
    }
  },
  methods: {
    openNav() {
      this.navIsOpen = true;
    },
    closeNav() {
      this.navIsOpen = false;
    }
  }
};

</script>

<style>
html {
  box-sizing: border-box;
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

#app {
  margin-top: 24px;
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

header {
  padding-bottom: 32px;
  border-bottom: 2px solid #d3d3d3;
}

.main-nav {
  display: flex;
  justify-content: space-between;
}

.custom-nav {
  padding: 0 16px;
  display: flex;
  justify-content: space-between;
  flex-grow: 1.0;
}

.logo-parent {
  position: relative;
}

.logo {
  width: 120px;
  height: auto;
  position: relative;
  top: 50%;
  transform: translateY(-50%);  
}

.main-nav menu {
  display: flex;
  margin: 0;
  padding-right: 16px;
}

.main-nav menu {
  font-family: Roboto;
  font-weight: 400;
  font-size: 20px;
}

.main-nav menu a {
  padding: 34px 18px;
  margin: 2px;
  color: #54595f;
  text-decoration: none;
  /* Match background to take up same space as on hover */
  border-bottom: 3px solid #fcf9f4;
}

.router-button {
  border: 0;
  background: none;
  font-size: 36px;
}

.main-nav menu a:hover {
  color: #B74D15;
  border-bottom: 3px solid #B74D15;
}

.main-nav menu a.router-link-exact-active {
  color: #1D2E26;
  border-bottom: 3px solid #1D2E26;
}

.main-nav .open-nav, .main-nav .close-nav {
  display: none;
}

@media screen and (max-width: 799px) {
  .main-nav {
    position: relative;
  }
  .main-nav .close-nav {
    display: none;
  }
  .main-nav.mobile-visible .close-nav {
    display: inline;
  }
  .main-nav .open-nav {
    display: inline;
  }
  .main-nav.mobile-visible .open-nav {
    display: none;
  }
  .main-nav menu {
    display: none;
  }
  .main-nav.mobile-visible menu {
    display: block;
    position: absolute;
    left: 0px;
    top: 96px;
    background-color: #fcf9f4;
    width: 100%;
    padding: 0;
  }
  .main-nav.mobile-visible menu a {
    display: block;
    margin: 0;
    padding: 16px;
    font-size: 16px;
    background-color: #fcf9f4;
    border-bottom: none;
    text-transform: none;
    text-align: center;
    border-bottom: 1px solid #aaa;
  }
  .main-nav.mobile-visible a.router-link-exact-active {
    border-bottom: none;
    background-color: #ededed;
  }
}
</style>
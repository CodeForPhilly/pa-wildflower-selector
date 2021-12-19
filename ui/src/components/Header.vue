<template>
  <header>
    <nav :class="{ 'main-nav': true }">
      <div class="custom-nav">
        <router-link class="logo-parent" to="/">
          <button v-if="$route.name !== 'Home'" class="material-icons router-button logo-substitute">chevron_left</button>
          <img class="logo" src="/assets/images/logo.png" alt="Choose Native Plants PA" />
        </router-link>
        <h1>{{ h1 }}</h1>
        <button @click="openNav" class="material-icons router-button open-nav">menu</button>
        <menu>
          <button @click="closeNav" class="material-icons router-button close-nav">close</button>
          <router-link to="/people-page">People Page</router-link>
          <router-link to="/how-to-use">How to Use</router-link>
          <div class="copyright">© 2021 Choose Native Plants - PA</div>
        </menu>
      </div>
      <slot name="before-bar"></slot>
    </nav>
    <h1>{{ h1 }}</h1>
    <slot name="after-bar"></slot>
  </header>
</template>

<script>
export default {
  props: {
    h1: {
      type: String,
      required: false,
      default: null
    }
  },
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
      this.$store.commit('setNavIsOpen', true);
    },
    closeNav() {
      this.$store.commit('setNavIsOpen', false);
    }
  }
};
</script>

<style scoped>
header {
  padding-bottom: 24px;
}

.main-nav {
  padding-bottom: 32px;
  border-bottom: 2px solid #d3d3d3;
  /* TODO reduce this when we have more text to make this space look good */
  margin-bottom: 32px;
}

.custom-nav {
  padding: 0 16px;
  display: flex;
  justify-content: space-between;
  flex-grow: 1.0;
  align-items: center;
}

.custom-nav > * {
  flex-basis: 0;
  flex-grow: 1;
}

header > h1 {
  display: none;
}

.custom-nav > h1 {
  text-align: center;
  font-family: Arvo;
  font-size: 20px;
  font-weight: normal;
  flex-basis: auto;
  margin: 0;
}

.logo-parent {
  position: relative;
}

.logo {
  display: none;
}

.main-nav menu {
  display: flex;
  margin: 0;
  padding-inline-start: 0;
  justify-content: flex-end;
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

.main-nav .open-nav {
  display: none;
}

menu .copyright {
  padding: 18px 0;
  font-size: 12px;
  text-align: center;
}

@media screen and (max-width: 1279px) {
  .main-nav {
    position: relative;
  }
  .main-nav .close-nav {
    display: none;
  }
  .nav-is-open .main-nav .close-nav {
    display: block;
    text-align: right;
    width: 100%;
    padding-right: 24px;
    background-color: #fcf9f4;
    padding-bottom: 32px;
  }
  .main-nav .open-nav {
    display: inline;
    text-align: right;
  }
  .nav-is-open .main-nav .open-nav {
    visibility: hidden;
  }
  .main-nav menu {
    display: none;
  }
  .nav-is-open .main-nav menu {
    display: block;
    position: absolute;
    left: 20%;
    top: -24px;
    width: 80%;
    height: 100vh;
    background-color: #fcf9f4;
    padding: 32px 0 0 0;
    border-radius: 16px 0 0 0;
    z-index: 200;
  }
  .nav-is-open .main-nav menu a {
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
  .nav-is-open .main-nav a.router-link-exact-active {
    border-bottom: none;
    background-color: #ededed;
  }
}

@media all and (min-width: 1280px) {
  .main-nav .close-nav {
    display: none;
  }
  .main-nav {
    border-bottom: none;
  }
  .logo {
    width: 160px;
    height: auto;
    position: relative;
    display: block;
  }
  .logo-substitute {
    display: none;
  }
  .custom-nav > h1 {
    display: none;
  }
  header > h1 {
    display: block;
    text-align: center;
    font-family: "Arvo";
    font-weight: 300;
    font-size: 64px;
    margin-bottom: 16px;
  }
  menu .copyright {
    display: none;
  }
}
</style>
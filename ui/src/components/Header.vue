<template>
  <header>
    <nav :class="{ 'main-nav': true, 'mobile-visible': navIsOpen }">
      <div class="custom-nav">
        <router-link class="logo-parent" to="/">
          <button v-if="$route.name !== 'Home'" class="material-icons router-button logo-substitute">chevron_left</button>
          <img class="logo" src="/assets/images/logo.png" alt="Choose Native Plants PA" />
        </router-link>
        <h1>{{ h1 }}</h1>
        <button @click="openNav" class="material-icons router-button open-nav">menu</button>
        <button @click="closeNav" class="material-icons router-button close-nav">close</button>
        <menu>
          <router-link to="/people-page">People Page</router-link>
          <router-link to="/how-to-use">How to Use</router-link>
          <div class="copyright">© 2021 Choose Native Plants - PA</div>
        </menu>
      </div>
      <h1>{{ h1 }}</h1>
    </nav>
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
      this.navIsOpen = true;
    },
    closeNav() {
      this.navIsOpen = false;
    }
  }
};
</script>

<style scoped>
header {
  padding-bottom: 24px;
  border-bottom: 2px solid #d3d3d3;
  /* TODO reduce this when we have more text to make this space look good */
  margin-bottom: 36px;
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

.main-nav > h1 {
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

.main-nav .open-nav, .main-nav .close-nav {
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
  .main-nav.mobile-visible .close-nav {
    display: inline;
    text-align: right;
  }
  .main-nav .open-nav {
    display: inline;
    text-align: right;
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
    top: 32px;
    background-color: #fcf9f4;
    width: 100%;
    padding: 16px 0 0 0;
    z-index: 1;
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

@media all and (min-width: 1280px) {
  header {
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
  .main-nav > h1 {
    display: block;
    text-align: center;
    font-family: "Arvo";
    font-weight: 300;
    font-size: 64px;
  }
  menu .copyright {
    display: none;
  }
}
</style>
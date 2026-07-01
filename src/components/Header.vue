<template>
  <header>
    <nav :class="{ 'main-nav': true, seamless: seamless }">
      <div class="custom-nav">
        <router-link class="logo-parent" to="/">
          <button v-if="$route.name !== 'Home'" class="material-icons router-button logo-substitute">chevron_left</button>
          <span v-else></span>
          <h1>
            <span class="text">
              Choose<br />Native<br />Plants
            </span>
            <img class="logo" src="/assets/images/logo.svg" />
          </h1>
        </router-link>
        <h1 class="local-h1" v-if="h1">{{ h1 || 'Choose Native Plants' }}</h1>
        <button @click="openNav" class="material-icons router-button open-nav">menu</button>
        <menu>
          <button @click="closeNav" class="material-icons router-button close-nav">close</button>
          <span class="regular-links">
            <router-link to="/">Plants</router-link>
            <router-link to="/favorites">Favorites</router-link>
            <router-link to="/planner">Planner</router-link>
            <router-link to="/map">Nurseries</router-link>
            <router-link to="/people-page">About</router-link>
            <a
              class="github-link"
              href="https://github.com/CodeForPhilly/pa-wildflower-selector"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View Choose Native Plants on GitHub"
              title="View source on GitHub"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.23c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.57-.29-5.27-1.28-5.27-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.16 1.18A10.9 10.9 0 0 1 12 6.13c.98 0 1.95.13 2.87.39 2.2-1.49 3.16-1.18 3.16-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.71 5.38-5.29 5.67.42.36.79 1.07.79 2.16v3.24c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .7Z"/>
              </svg>
            </a>
          </span>
          <div class="copyright">© 2025 Choose Native Plants - USA</div>
        </menu>
      </div>
      <slot name="before-bar"></slot>
    </nav>
    <h1 :class="{ 'last-h1': true, 'large-h1': largeH1 !== false }" v-if="h1">{{ h1 }}</h1>
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
    },
    largeH1: {
      type: Boolean,
      required: false,
      default: true
    },
    seamless: {
      type: Boolean,
      required: false,
      default: false
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

.questions-page header {
  padding-bottom: 0;
}

.main-nav {
  padding-bottom: 20px;
  border-bottom: 2px solid #d3d3d3;
  margin-bottom: 16px;
}

.main-nav.seamless {
  margin-bottom: 0;
}

.questions-page .main-nav {
  margin-bottom: 0;
  padding-bottom: 16px;
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

a.logo-parent {
  position: relative;
  border-bottom: none;
  text-decoration: none;
  color: black;
}

a.logo-parent h1 {
  display: none;
}

.logo {
  display: none;
  margin-left: 10px;
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
  padding: 8px 0px;
  margin: 20px 20px;
  color: #1D2E26;
  text-decoration: none;
  /* Match background to take up same space as on hover */
  border-bottom: 2px solid #B74D15;
}

.main-nav menu a.github-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  margin: 20px 0 20px 4px;
  vertical-align: middle;
  color: currentColor;
  border: 0;
  border-radius: 50%;
  opacity: 0.62;
  transition: opacity 160ms ease, background-color 160ms ease;
}

.github-link svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

.main-nav menu a.github-link:hover,
.main-nav menu a.github-link:focus-visible {
  border: 0;
  background-color: rgba(255, 255, 255, 0.14);
  opacity: 1;
  outline: none;
}

.router-button {
  border: 0;
  background: none;
  font-size: 36px;
}

.main-nav menu a:hover {
  border-bottom: 2px solid white;
}

.main-nav menu a.router-link-exact-active {
  border-bottom: 2px solid white;
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
    color: black;
  }
  .main-nav .open-nav {
    display: inline;
    text-align: right;
    color: black;
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
    z-index: 1100;
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
  .nav-is-open .main-nav menu a.github-link {
    display: flex;
    width: 44px;
    height: 44px;
    margin: 20px auto 4px;
    padding: 0;
    border: 0;
    opacity: 0.55;
  }
  .nav-is-open .main-nav menu a.github-link:hover,
  .nav-is-open .main-nav menu a.github-link:focus-visible {
    background-color: rgba(29, 46, 38, 0.08);
  }
  a .logo-substitute {
    color: black;
  }
}

@media all and (min-width: 1280px) {
  header {
    background-color: #B74D15;
    color: white;
    padding: 0;
  }
  .main-nav .close-nav {
    display: none;
  }
  .main-nav {
    border-bottom: none;
    padding: 0;
    margin: 0;
    height: 120px;
  }
  a.logo-parent h1 {
    display: flex;
  }
  h1 {
    font-family: Arvo;
    font-size: 24px;
    line-height: 30px;
    font-weight: normal;
    height: 80px;
    display: flex;
  }
  h1 .text {
    margin-top: 5px;
    text-decoration: none;
    color: white;
    border-bottom-style: none;
  }
  .questions-page header .local-h1 {
    display: none;
  }
  .questions-page header .last-h1 {
    display: none;
  }
  .logo {
    height: 100%;
    display: inline-block;
    transform: translate(-16px, 0);
  }
  .logo-substitute {
    display: none;
    color: black;
  }
  .custom-nav {
    padding: 0 40px;
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
  menu .regular-links a:last-child {
    margin-right: 0;
  }
  .main-nav menu a {
    color: white;
  }
  .last-h1 {
    display: none;
  }
  .last-h1.large-h1 {
    display: block;
  }
}
</style>

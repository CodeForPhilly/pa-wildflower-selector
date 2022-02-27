import Explorer from "../components/Explorer.vue";
import PeoplePage from "../components/PeoplePage.vue";
import HowToUsePage from "../components/HowToUsePage.vue";
import { createRouter } from "vue-router";

const routes = [
  {
    path: "/",
    name: "Home",
    component: Explorer
  },
  {
    path: '/plants/:name',
    component: Explorer
  },
  {
    path: "/favorites",
    name: "Favorite List",
    component: Explorer,
    props: {
      favorites: true
    }
  },
  {
    path: "/quick-search",
    name: "Quick Search",
    component: Explorer,
    props: {
      questions: true
    }
  },
  {
    path: "/people-page",
    name: "People Page",
    component: PeoplePage
  },
  {
    path: "/how-to-use",
    name: "How to Use",
    component: HowToUsePage
  }
];

export default ({ history }) => {
  return createRouter({
    history,
    routes,
    // Enable anchors https://forum.vuejs.org/t/vue-router-navigate-or-scroll-to-anchors-anchors-not-working/108218/2
    scrollBehavior(to) {
      if (to.hash) {
        return {
          el: to.hash
        };
      }
    }
  });
};

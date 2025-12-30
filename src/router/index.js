import Explorer from "../components/Explorer.vue";
import PeoplePage from "../components/PeoplePage.vue";
import Map from "../components/Map.vue";
import GardenPlanner from "../components/GardenPlanner.vue";
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
    path: "/people-page",
    name: "About",
    component: PeoplePage
  },
  {
    path: "/map",
    name: "Nurseries",
    component: Map
  },
  {
    path: "/planner",
    name: "Garden Planner",
    component: GardenPlanner,
    props: {
      favorites: true
    }
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

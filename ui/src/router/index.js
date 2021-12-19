import { createWebHistory, createRouter } from "vue-router";
import Explorer from "../components/Explorer.vue";
import PeoplePage from "../components/PeoplePage.vue";
import HowToUsePage from "../components/HowToUsePage.vue";

const routes = [
  {
    path: "/",
    name: "Home",
    component: Explorer
  },
  {
    path: "/favorite-list",
    name: "Favorite List",
    component: Explorer,
    props: {
      favorites: true
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

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
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
    path: "/favorite-list",
    name: "Favorite List",
    component: Explorer,
    props: {
      favorites: true
    }
  },
  {
    path: "/questions",
    name: "Answer 5 Questions",
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
  console.log(history);
  return createRouter({
    history,
    routes
  });
};

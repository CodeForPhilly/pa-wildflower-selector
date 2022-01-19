import { createSSRApp } from 'vue';
import App from './App.vue';
import routerFactory from './router';
import storeFactory from './store';
import { createWebHistory } from "vue-router";

// Browser-only logic for the store

const favorites = getFavoritesFromLocalStorage();

const store = storeFactory({ favorites });

store.subscribe((mutation, state) => {
  if (mutation.type === 'toggleFavorite') {
    localStorage.setItem('favorites', JSON.stringify([...state.favorites]));
  }
});

window.addEventListener('storage', () => {
  store.commit('setFavorites', getFavoritesFromLocalStorage());
});

const router = routerFactory({ history: createWebHistory() });
console.log('router is:', router);
createSSRApp(App).use(router).use(store).mount('#app');

function getFavoritesFromLocalStorage() {
  return new Set(JSON.parse(localStorage.getItem('favorites') || '[]'));
}

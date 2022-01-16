import { createSSRApp } from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';
import { createWebHistory } from "vue-router";

// Browser-only logic for the store

store.subscribe((mutation, state) => {
  if (mutation.type === 'toggleFavorite') {
    localStorage.setItem('favorites', JSON.stringify([...state.favorites]));
  }
});

window.addEventListener('storage', () => {
  store.commit('setFavorites', getFavoritesFromLocalStorage());
});

const favorites = getFavoritesFromLocalStorage();

createSSRApp(App).use(router({ history: createWebHistory() })).use(store({ favorites })).mount('#app');

function getFavoritesFromLocalStorage() {
  return new Set(JSON.parse(localStorage.getItem('favorites') || '[]'));
}

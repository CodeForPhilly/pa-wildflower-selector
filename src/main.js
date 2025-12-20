import { createSSRApp } from 'vue';
import App from './App.vue';
import routerFactory from './router';
import storeFactory from './store';
import { createWebHistory } from "vue-router";
// @ts-ignore - project TS tooling struggles with modern package exports; runtime bundling works.
import Tres, { extend } from '@tresjs/core';
// @ts-ignore - project TS tooling struggles with modern package exports; runtime bundling works.
import * as THREE from 'three';

// Register ALL Three.js classes with Tres globally
extend(THREE);

// Initialize with empty favorites for SSR consistency
// This ensures the initial state matches what the server renders
const initialFavorites = new Set();
const store = storeFactory({ favorites: initialFavorites });

// Create the app and router
const app = createSSRApp(App);
const router = routerFactory({ history: createWebHistory() });

// Mount the app first
app.use(router).use(store).use(Tres).mount('#app');

// After the app is mounted and hydration is complete, we can safely access localStorage
// and update the state without causing hydration mismatches
if (typeof window !== 'undefined') {
  // Use a small timeout to ensure hydration is complete
  setTimeout(() => {
    // Now it's safe to load favorites from localStorage
    const favorites = getFavoritesFromLocalStorage();
    if (favorites.size > 0) {
      store.commit('setFavorites', favorites);
    }
    
    // Set up localStorage sync for future changes
    store.subscribe((mutation, state) => {
      if (mutation.type === 'toggleFavorite') {
        localStorage.setItem('favorites', JSON.stringify([...state.favorites]));
      }
    });
    
    window.addEventListener('storage', () => {
      store.commit('setFavorites', getFavoritesFromLocalStorage());
    });
  }, 0);
}

function getFavoritesFromLocalStorage() {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem('favorites') || '[]'));
  } catch (e) {
    console.error('Error parsing favorites from localStorage:', e);
    return new Set();
  }
}

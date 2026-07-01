import { createSSRApp } from 'vue';
import App from './App.vue';
import routerFactory from './router';
import storeFactory from './store';
import { createWebHistory } from "vue-router";
// @ts-ignore - project TS tooling struggles with modern package exports; runtime bundling works.
import Tres, { extend } from '@tresjs/core';
// @ts-ignore - project TS tooling struggles with modern package exports; runtime bundling works.
import * as THREE from 'three';
import { initAnalytics, trackEvent, trackPageView } from './lib/analytics';

// Register ALL Three.js classes with Tres globally
extend(THREE);

// Initialize with empty favorites for SSR consistency
// This ensures the initial state matches what the server renders
const initialFavorites = new Set();
const store = storeFactory({ favorites: initialFavorites });

// Create the app and router
const app = createSSRApp(App);
const router = routerFactory({ history: createWebHistory() });

initAnalytics();
router.afterEach((to) => {
  trackPageView(to);
});

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

    // Load photo mode (Habitat/Studio) from localStorage
    const photoMode = getPhotoModeFromLocalStorage();
    if (photoMode) {
      store.commit('setPhotoMode', photoMode);
    }
    
    // Set up localStorage sync for future changes
    store.subscribe((mutation, state) => {
      if (
        mutation.type === 'toggleFavorite' ||
        mutation.type === 'addFavorites' ||
        mutation.type === 'clearFavorites'
      ) {
        localStorage.setItem('favorites', JSON.stringify([...state.favorites]));
      }

      if (mutation.type === 'toggleFavorite') {
        trackEvent(
          state.favorites.has(mutation.payload) ? 'favorite_added' : 'favorite_removed',
          { favorite_count: state.favorites.size, method: 'single' }
        );
      } else if (mutation.type === 'addFavorites') {
        const ids = Array.isArray(mutation.payload) ? mutation.payload : [mutation.payload];
        trackEvent('favorites_added', {
          item_count: ids.filter(Boolean).length,
          favorite_count: state.favorites.size,
          method: ids.length > 1 ? 'bulk' : 'single',
        });
      } else if (mutation.type === 'clearFavorites') {
        trackEvent('favorites_cleared');
      }

      if (mutation.type === 'setPhotoMode') {
        localStorage.setItem('photoMode', JSON.stringify(state.photoMode));
        trackEvent('photo_mode_changed', { photo_mode: state.photoMode });
      }
    });
    
    window.addEventListener('storage', () => {
      store.commit('setFavorites', getFavoritesFromLocalStorage());
      const pm = getPhotoModeFromLocalStorage();
      if (pm) store.commit('setPhotoMode', pm);
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

function getPhotoModeFromLocalStorage() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('photoMode');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed === 'studio' ? 'studio' : 'habitat';
  } catch (e) {
    // ignore corrupt storage
    return null;
  }
}

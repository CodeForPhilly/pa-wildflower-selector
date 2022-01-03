import { createStore } from 'vuex'

const store = createStore({
  state () {
    return {
      navIsOpen: false,
      sortIsOpen: false,
      selectedIsOpen: false,
      favorites: getFavoritesFromLocalStorage()
    }
  },
  mutations: {
    setNavIsOpen (state, navIsOpen) {
      state.navIsOpen = navIsOpen;
    },
    setSortIsOpen (state, sortIsOpen) {
      state.sortIsOpen = sortIsOpen;
    },
    setSelectedIsOpen (state, selectedIsOpen) {
      state.selectedIsOpen = selectedIsOpen;
    },
    toggleFavorite (state, plantId) {
      if (state.favorites.has(plantId)) {
        state.favorites.delete(plantId);
      } else {
        state.favorites.add(plantId);
      }
    },
    setFavorites (state, favorites) {
      state.favorites = favorites;
    }
  }
});

store.subscribe((mutation, state) => {
  if (mutation.type === 'toggleFavorite') {
    localStorage.setItem('favorites', JSON.stringify([...state.favorites]));
  }
});

// Changed in another tab
window.addEventListener('storage', () => {
  store.commit('setFavorites', getFavoritesFromLocalStorage());
});

export default store;

function getFavoritesFromLocalStorage() {
  return new Set(JSON.parse(localStorage.getItem('favorites') || '[]'));
}

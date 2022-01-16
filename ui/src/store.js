import { createStore } from 'vuex';

export default ({ favorites }) => {
  return createStore({
    state () {
      return {
        navIsOpen: false,
        sortIsOpen: false,
        selectedIsOpen: false,
        favorites
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
};

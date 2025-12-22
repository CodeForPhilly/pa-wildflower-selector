import { createStore } from 'vuex';

export default ({ favorites }) => {
  return createStore({
    state () {
      return {
        navIsOpen: false,
        sortIsOpen: false,
        monthIsOpen: false,
        selectedIsOpen: false,
        photoMode: 'habitat', // 'habitat' | 'studio'
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
      setMonthIsOpen (state, monthIsOpen) {
        state.monthIsOpen = monthIsOpen;
      },
      setPhotoMode (state, photoMode) {
        // Guard to keep state consistent even if localStorage is corrupted
        state.photoMode = photoMode === 'studio' ? 'studio' : 'habitat';
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

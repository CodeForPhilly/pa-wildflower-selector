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
        // NOTE: mutate via replacement so Vue/Vuex reactivity reliably notices Set changes
        const next = new Set(state.favorites);
        if (next.has(plantId)) {
          next.delete(plantId);
        } else {
          next.add(plantId);
        }
        state.favorites = next;
      },
      addFavorites (state, plantIds) {
        if (!plantIds) return;
        const ids = Array.isArray(plantIds) ? plantIds : [plantIds];
        const next = new Set(state.favorites);
        for (const id of ids) {
          if (id) next.add(id);
        }
        state.favorites = next;
      },
      clearFavorites (state) {
        state.favorites = new Set();
      },
      setFavorites (state, favorites) {
        state.favorites = favorites;
      }
    }
  });
};

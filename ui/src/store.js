import { createStore } from 'vuex'

export default createStore({
  state () {
    return {
      navIsOpen: false
    }
  },
  mutations: {
    setNavIsOpen (state, navIsOpen) {
      console.log(arguments);
      state.navIsOpen = navIsOpen;
    }
  }
});

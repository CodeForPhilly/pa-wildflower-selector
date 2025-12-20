declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

// ESM-first packages; our Vue TS tooling can fail to resolve them even though webpack can bundle them.
declare module '@tresjs/core';


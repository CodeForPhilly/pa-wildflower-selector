const { createSSRApp } = require('vue');
const { renderToString } = require('@vue/server-renderer');
// @ts-ignore - project TS tooling struggles with modern package exports; runtime bundling works.
import Tres from '@tresjs/core';
import router from './router';
import store from './store';
import { createMemoryHistory } from "vue-router";
import App from './App.vue';
import nodeFetch from 'node-fetch';

export default async ({ port, url }) => {
  // Shim to allow fetch calls to ourselves on the server side
  global.fetch = (url) => {
    return nodeFetch(`http://localhost:${port}${url}`);
  };
  const app = createSSRApp(App);
  const routerInstance = router({ history: createMemoryHistory() });
  app.use(routerInstance);
  app.use(store({ favorites: new Set() }));
  app.use(Tres);
  await routerInstance.push(url);
  await routerInstance.isReady();
  return renderToString(app);
}

const { createSSRApp } = require('vue');
const { renderToString } = require('@vue/server-renderer');
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
  await routerInstance.push(url);
  await routerInstance.isReady();
  return renderToString(app);
}

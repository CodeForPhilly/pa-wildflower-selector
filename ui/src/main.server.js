const { createSSRApp } = require('vue');
const { renderToString } = require('@vue/server-renderer');
import router from './router';
import store from './store';
import { createMemoryHistory } from "vue-router";
import App from './App.vue';
import nodeFetch from 'node-fetch';

console.log('top level code');

export default async ({ port }) => {
  console.log('IN THE FUNCTION');
  // Shim to allow fetch calls to ourselves on the server side
  global.fetch = (url) => {
    return nodeFetch(`http://localhost:${port}${url}`);
  };
  const app = createSSRApp(App);
  app.use(router({ history: createMemoryHistory() }));
  app.use(store({ favorites: new Set() }));
  return renderToString(app);
}

const { WebpackManifestPlugin } = require("webpack-manifest-plugin");
const nodeExternals = require("webpack-node-externals");

module.exports = {
  // TresJS ships modern syntax (e.g. ?? / optional chaining) that webpack 4 can't parse.
  // Vue CLI will run these deps through Babel when listed here.
  transpileDependencies: ['@tresjs/core'],
  devServer: {
    // Vue dev server port (defaults to 8080)
    port: process.env.VUE_DEV_PORT || 8080,
    // Proxy API requests to Node.js server
    // Uses PORT from .env or defaults to 3000
    proxy: `http://localhost:${process.env.PORT || 3000}`
  },
  filenameHashing: false,
  chainWebpack: webpackConfig => {
    // This project uses TypeScript primarily inside Vue SFCs. Vue CLI 4's eslint-loader
    // isn't configured to parse `<script lang="ts">` in .vue files (especially in SSR builds),
    // so we exclude TS + Vue files from ESLint in all modes.
    webpackConfig.module
      .rule('eslint')
      .exclude
      .add(/\.ts$/)
      .add(/\.tsx$/)
      .add(/\.vue$/);

    // Node 20+ makes fork-ts-checker-webpack-plugin-v5 crash due to Performance API changes.
    // The project doesn't rely on strict TS builds (TS is primarily for SFC authoring),
    // so we disable it to keep builds/dev working on modern Node.
    const nodeMajor = Number.parseInt((process.versions.node || '0').split('.')[0], 10);
    if (Number.isFinite(nodeMajor) && nodeMajor >= 20) {
      webpackConfig.plugins.delete('fork-ts-checker');
    }

    // Override TypeScript plugin's default entry point to use main.js
    // The project uses JavaScript for the main entry, TypeScript only for components
    if (!process.env.SSR) {
      webpackConfig.entry('app').clear().add('./src/main.js');

      return;
    }

    webpackConfig
      .entry("app")
      .clear()
      .add("./src/main.server.js");

    webpackConfig.target("node");
    webpackConfig.output.libraryTarget("commonjs2");

    webpackConfig
      .plugin("manifest")
      .use(new WebpackManifestPlugin({ fileName: "ssr-manifest.json" }));

    webpackConfig.externals(nodeExternals({ allowlist: /\.(css|vue)$/ }));

    webpackConfig.optimization.minimize(false);
    webpackConfig.optimization.splitChunks(false);

    webpackConfig.plugins.delete("hmr");
    webpackConfig.plugins.delete("preload");
    webpackConfig.plugins.delete("prefetch");
    webpackConfig.plugins.delete("progress");
    // webpackConfig.plugins.delete("friendly-errors");
    
  }
};

const { WebpackManifestPlugin } = require("webpack-manifest-plugin");
const nodeExternals = require("webpack-node-externals");

module.exports = {
  devServer: {
    // Vue dev server port (defaults to 8080)
    port: process.env.VUE_DEV_PORT || 8080,
    // Proxy API requests to Node.js server
    // Uses PORT from .env or defaults to 3000
    proxy: `http://localhost:${process.env.PORT || 3000}`
  },
  filenameHashing: false,
  chainWebpack: webpackConfig => {
    // Override TypeScript plugin's default entry point to use main.js
    // The project uses JavaScript for the main entry, TypeScript only for components
    if (!process.env.SSR) {
      webpackConfig.entry('app').clear().add('./src/main.js');
      
      // Exclude TypeScript files and Vue files from ESLint - TypeScript compiler handles them
      webpackConfig.module
        .rule('eslint')
        .exclude
        .add(/\.ts$/)
        .add(/\.tsx$/)
        .add(/\.vue$/);
      
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

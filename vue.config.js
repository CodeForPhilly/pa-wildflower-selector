const webpack = require('webpack');
const { WebpackManifestPlugin } = require("webpack-manifest-plugin");
const nodeExternals = require("webpack-node-externals");

module.exports = {
  publicPath: process.env.NODE_ENV === 'production'
    ? '/public/'
    : '/',
  devServer: {
    proxy: 'http://localhost:3001'
  },
  filenameHashing: false,
  chainWebpack: webpackConfig => {
    if (!process.env.SSR) {
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

    // Add the configureWebpack section here
    webpackConfig
      .plugin("source-map")
      .use(new webpack.SourceMapDevToolPlugin({ filename: '[name].js.map' }));
  }
};
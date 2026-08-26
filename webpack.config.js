const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = (env, argv) => {
  const isDev = argv.mode === "development";

  return {
    entry: {
      Hub: "./src/Hub/Hub.tsx",
      Control: "./src/Control/Control.tsx",
      Action: "./src/Action/Action.tsx",
    },
    output: {
      filename: "[name]/[name].js",
      path: path.resolve(__dirname, "dist"),
      clean: true,
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js"],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
        {
          test: /\.scss$/,
          use: [
            isDev ? "style-loader" : MiniCssExtractPlugin.loader,
            "css-loader",
            { loader: "sass-loader", options: { api: "modern" } },
          ],
        },
        {
          test: /\.css$/,
          use: [
            isDev ? "style-loader" : MiniCssExtractPlugin.loader,
            "css-loader",
          ],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "./src/Hub/Hub.html",
        filename: "Hub/Hub.html",
        chunks: ["Hub"],
      }),
      new HtmlWebpackPlugin({
        template: "./src/Control/Control.html",
        filename: "Control/Control.html",
        chunks: ["Control"],
      }),
      new HtmlWebpackPlugin({
        template: "./src/Action/Action.html",
        filename: "Action/Action.html",
        chunks: ["Action"],
      }),
      new MiniCssExtractPlugin({ filename: "[name]/[name].css" }),
      new CopyWebpackPlugin({
        patterns: [{ from: "static", to: ".", noErrorOnMissing: true }],
      }),
    ],
    devtool: isDev ? "source-map" : false,
  };
};

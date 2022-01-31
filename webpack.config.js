const HtmlWebpackPlugin = require("html-webpack-plugin")
const path = require("path")
const webpack = require("webpack")

module.exports = {
    entry: { core: "./src/index.js" },
    output: {
        filename: "main.bundle.js",
        path: path.resolve(__dirname, "dist"),
        library: {
            type: "umd",
            export: "default",
            name: "printeff",
        },
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ["@babel/preset-env"],
                    },
                },
            },
            {
                test: /\.css$/i,
                use: [
                    // Creates `style` nodes from JS strings
                    "style-loader",
                    // Translates CSS into CommonJS
                    "css-loader",
                ],
            },
        ],
    },
    devServer: {
        liveReload: true,
        watchFiles: __dirname + "/src",
        open: false,
        hot: false,
        static: ["public", "dist"],
        devMiddleware: {
            writeToDisk: true,
        },
        client: {
            overlay: true,
        },
    },
}

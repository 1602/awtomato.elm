const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack'),
    path = require('path'),
    env = require('./util/env'),
    HtmlWebpackPlugin = require('html-webpack-plugin'),
    WriteFilePlugin = require('write-file-webpack-plugin');

module.exports = {
    entry: {
        'content-script': './src/content-script.js',
        panel: './src/panel.js',
        sidebar: './src/sidebar.js',
        background: './src/background.js',
        devtools: './src/devtools.js',
        playground: './src/playground.js',
    },

    output: {
        path: path.join(__dirname, 'dist'),
        filename: '[name].js',
        publicPath: 'http://localhost:3000/',
    },

    resolve: {
        modules: ['node_modules'],
        extensions: ['.js', '.elm'],
    },

    module: {
        noParse: /\.elm$/,
        rules: [{
            test: /\.elm$/,
            exclude: [/elm-stuff/, /node_modules/],
            use: [{
                loader: 'elm-hot-loader',
            }, {
                loader: 'elm-webpack-loader',
                options: {
                    verbose: true,
                    warn: true,
                    debug: true,
                    // cache: true,
                    forceWatch: true,
                    cwd: path.join(__dirname),
                },
            }],
        }],
    },

    plugins: [
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(env.NODE_ENV),
        }),
        // new webpack.optimize.OccurenceOrderPlugin(),
        new HtmlWebpackPlugin({
            template: './static/background.html',
            filename: 'background.html',
            chunks: ['background'],
        }),
        new HtmlWebpackPlugin({
            template: './static/devtools.html',
            filename: 'automation-devtools.html',
            chunks: ['devtools'],
        }),
        new HtmlWebpackPlugin({
            template: './static/playground.html',
            filename: 'playground.html',
            chunks: ['playground'],
        }),
        new HtmlWebpackPlugin({
            template: './static/panel.html',
            filename: 'panel.html',
            chunks: ['panel'],
        }),
        new HtmlWebpackPlugin({
            template: './static/sidebar.html',
            filename: 'sidebar.html',
            chunks: ['sidebar'],
        }),
        new CopyWebpackPlugin([
          { from: 'src/assets', to: 'assets' },
        ]),
        new WriteFilePlugin(),

    ],

    chromeExtensionBoilerplate: {
        notHotReload: ['content-script'],
    },

    devServer: {
        stats: 'info',
    },
};

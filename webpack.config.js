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
    },

    output: {
        path: path.join(__dirname, 'dist'),
        filename: '[name].js',
        publicPath: 'http://localhost:3000/',
    },

    resolve: {
    //modulesDirectories: ['node_modules'],
        extensions: ['.js', '.elm'],
    },

    module: {
        loaders: [
            {
                test: /\.html$/,
                exclude: /node_modules/,
                loader: 'file-loader?name=[name].[ext]',
            },
            {
                test: /\.elm$/,
                exclude: [/elm-stuff/, /node_modules/],
                loader: 'elm-hot-loader!elm-webpack-loader?debug=true',
        // loader: 'elm-hot-loader!elm-webpack-loader'
            },
        ],

        noParse: /\.elm$/,
    },

    plugins: [
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify(env.NODE_ENV),
        }),
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
        stats: 'none',
    },
};

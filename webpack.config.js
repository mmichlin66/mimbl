const dev_ifdefLoaderOptions =
{
    DEBUG: true,
    USE_STATS: true,
    VERBOSE_COMP: false,
    VERBOSE_NODE: false,
    REMOVE_EVENT_LISTENERS: false
};

const prod_ifdefLoaderOptions =
{
    DEBUG: false,
    USE_STATS: false,
    VERBOSE_COMP: false,
    VERBOSE_NODE: false,
    REMOVE_EVENT_LISTENERS: false
};



function config( outFileName, mode, devtool, ifdefLoaderOptions)
{
    return {
        entry: "./lib/mimblTypes.js",

        output:
        {
            filename: outFileName,
            path: __dirname + "/lib",
            library: 'mimbl',
            libraryTarget: 'umd',
            globalObject: 'this'
        },

        mode: mode,
        devtool: devtool,
        resolve: { extensions: [".js"] },

        module:
        {
            rules:
            [
                { test: /\.js$/, use: [{ loader: "ifdef-loader", options: ifdefLoaderOptions }] },
                { enforce: "pre", test: /\.js$/, loader: "source-map-loader" }
            ]
        },

        externals:
        {
            mimcss: { root: 'mimcss', commonjs2: 'mimcss', commonjs: 'mimcss', amd: 'mimcss' },
        }
    }
}



module.exports =
[
    config( "mimbl.dev.js", "development", "#inline-source-map", dev_ifdefLoaderOptions),
    config( "mimbl.js", "production", undefined, prod_ifdefLoaderOptions),
];




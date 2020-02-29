let isProd = process.argv.indexOf('-p') !== -1;
let mode = isProd ? "production" : "development";
let devtool = isProd ? "source-map" : "#inline-source-map";
let outputFilename = isProd ? "mimbl.js" : "mimbl.dev.js";
let minimize = isProd ? true : false;


// define preprocessor variables for ifdef-loader
const ifdefLoaderOptions =
{
    DEBUG: !isProd,
    USE_STATS: !isProd,
    VERBOSE_COMP: false,
    VERBOSE_NODE: false,
    REMOVE_EVENT_LISTENERS: false

    //"ifdef-verbose": true,       // add this for verbose output
    //"ifdef-triple-slash": false  // add this to use double slash comment instead of default triple slash
};



module.exports =
{
    entry: "./src/mimblTypes.ts",

    output:
    {
        filename: outputFilename,
        path: __dirname + "/lib",
		library: 'mimbl',
		libraryTarget: 'umd',
		globalObject: 'this'
    },

    mode: mode,

    // Enable sourcemaps for debugging webpack's output.
    devtool: devtool,

    resolve:
    {
        // Add '.ts' and '.tsx' as resolvable extensions.
        extensions: [".ts", ".tsx", ".js"]
    },

    module:
    {
        rules:
        [
            // All files with a '.ts' or '.tsx' extension will be handled by 'awesome-typescript-loader'.
            //{ test: /\.tsx?$/, loader: "awesome-typescript-loader" },
            {
                test: /\.tsx?$/,
                use:
                [
                    //{ loader: "awesome-typescript-loader" },
                    { loader: "ts-loader" },
                    { loader: "ifdef-loader", options: ifdefLoaderOptions }
                ]
            },

            // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
            { enforce: "pre", test: /\.js$/, loader: "source-map-loader" }
        ]
    },

    // When importing a module whose path matches one of the following, just
    // assume a corresponding global variable exists and use that instead.
    // This is important because it allows us to avoid bundling all of our
    // dependencies, which allows browsers to cache those libraries between builds.
    externals:
    {
        mimcss: { root: 'mimcss', commonjs2: 'mimcss', commonjs: 'mimcss', amd: 'mimcss' },
    }
};
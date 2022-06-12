const { ESBuildMinifyPlugin } = require('esbuild-loader');

function useEsbuildMinify(config, options) {
	const { minimizer } = config.optimization;
	const terserIndex = minimizer.findIndex(
		minifier => minifier.constructor.name === 'TerserPlugin',
	);
	
	minimizer.splice(terserIndex, 1, new ESBuildMinifyPlugin(options));
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  webpack: (config, { webpack }) => {
    config.plugins.push(
			new webpack.ProvidePlugin({
				React: 'react',
			}),
		);

    useEsbuildMinify(config);

    config.module.rules.push({
      test: /\.tsx?$/,
      loader: 'esbuild-loader',
      options: {
        loader: 'tsx',  // Or 'ts' if you don't need tsx
        target: 'es2015'
      }
    });

    return config;
  },
}

module.exports = nextConfig

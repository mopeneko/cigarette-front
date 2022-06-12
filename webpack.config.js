module.exports = {
    module: {
      rules: [
       {
         test: /\.tsx?$/,
         loader: 'esbuild-loader',
         options: {
           loader: 'tsx',  // Or 'ts' if you don't need tsx
           target: 'es2015'
         }
       },
      ]
    },
  }

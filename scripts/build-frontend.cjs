const path = require('path');
const { Parcel } = require('@parcel/core');

// Explicitly target browsers even though this project also declares a Node engine.
const bundler = new Parcel({
  entries: path.join(__dirname, '../public/js/index.js'),
  defaultConfig: require.resolve('@parcel/config-default'),
  mode: process.argv.includes('--watch') ? 'development' : 'production',
  shouldDisableCache: true,
  targets: {
    browser: {
      context: 'browser',
      distDir: path.join(__dirname, '../public/js/dist'),
      distEntry: 'index.js',
      outputFormat: 'global',
      includeNodeModules: true,
      engines: { browsers: ['defaults'] },
      sourceMap: false
    }
  }
});

(async () => {
  if (process.argv.includes('--watch')) {
    await bundler.watch((error, event) => {
      if (error || event.type === 'buildFailure') {
        console.error(error || event.diagnostics);
      } else if (event.type === 'buildSuccess') {
        console.log('Browser JavaScript rebuilt.');
      }
    });
  } else {
    await bundler.run();
    console.log('Browser JavaScript built successfully.');
  }
})().catch(error => {
  console.error(error.diagnostics || error.message);
  process.exitCode = 1;
});

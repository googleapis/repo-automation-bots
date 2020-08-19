const path = require('path');

module.exports = {
  entry: './build/tsc-compiled/firestore.js',
  output: {
    path: path.resolve(__dirname, 'build/webpack-compiled'),
    filename: 'bundle.js'
  }
};
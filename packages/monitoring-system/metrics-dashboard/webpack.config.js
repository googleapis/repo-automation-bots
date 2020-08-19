const path = require('path');

module.exports = {
  entry: './build-tsc/ts/firestore.js',
  output: {
    path: path.resolve(__dirname, 'public/js'),
    filename: 'bundle.js'
  }
};
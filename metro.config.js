const { assetExts } = require('metro-config/src/defaults/defaults');

module.exports = {
  resolver: {
    assetExts: [
      ...assetExts,
      "txt",
    ]
  }
};

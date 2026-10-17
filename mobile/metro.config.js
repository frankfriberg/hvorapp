const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const repoRoot = path.resolve(__dirname, "..");

const config = getDefaultConfig(__dirname);

// The grid math, pin geometry and arena SVGs live in the web app's tree and
// are shared, so Metro must be able to read files above this folder.
config.watchFolders = [repoRoot];
// Files up there still resolve packages, such as the asset registry an SVG
// pulls in, from this app's node_modules.
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];

module.exports = config;

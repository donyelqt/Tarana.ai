/**
 * Metro resolver wiring for tarana-mobile.
 *
 * `tarana-mobile/tsconfig.json` maps `tarana-web/*` → `../src/lib/*` for
 * type-checking, but Metro does not read tsconfig paths — without the
 * `extraNodeModules` entry below, `import ... from 'tarana-web/...'`
 * (e.g. tarana-mobile/src/supabase.ts) fails at bundle time with
 * "Unable to resolve module".
 *
 * `watchFolders` includes the repo root because the remapped files live
 * outside the Metro project root. Node resolution then walks up to the root
 * `node_modules` for shared deps (e.g. `@supabase/supabase-js`) — the blockList
 * below keeps build outputs (not packages) out of the crawl.
 *
 * Known limit, not handled here: if remapped web files ever import `react`,
 * Metro may resolve the root copy instead of tarana-mobile's, causing
 * duplicate-React hooks breakage. Revisit with an explicit `react` /
 * `react-native` alias if UI logic (not just clients) gets shared.
 *
 * NativeWind: the config starts from Expo's defaults (via getDefaultConfig,
 * which supplies resolver.sourceExts and friends) and is wrapped with
 * withNativeWind. Do NOT export a bare object: react-native-css-interop
 * appends "css" to `config.resolver.sourceExts`, and on a bare object that
 * list starts empty — wiping the js/ts defaults and breaking entry
 * resolution ("Unable to resolve module ./tarana-mobile/index.ts").
 */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const repoRoot = path.resolve(__dirname, '..');
const escapedRoot = repoRoot.replace(/\\/g, '\\\\');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  'tarana-web': path.join(repoRoot, 'src', 'lib'),
};

// Metro accepts an array of RegExps; keep Expo's default blockList and add ours.
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : [config.resolver.blockList].filter(Boolean)),
  new RegExp(`${escapedRoot}/\\.next/.*`),
  new RegExp(`${escapedRoot}/out/.*`),
  new RegExp(`${escapedRoot}/coverage/.*`),
];

config.watchFolders = [...(config.watchFolders ?? []), repoRoot];

module.exports = withNativeWind(config, { input: path.join(__dirname, 'global.css') });

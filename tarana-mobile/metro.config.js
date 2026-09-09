/**
 * Metro resolver wiring for tarana-mobile.
 *
 * `tarana-mobile/tsconfig.json` maps `tarana-web/*` → `../src/lib/*` for
 * type-checking, but Metro does not read tsconfig paths — without this file,
 * `import ... from 'tarana-web/...'` (e.g. tarana-mobile/src/supabase.ts)
 * fails at bundle time with "Unable to resolve module".
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
 * Still required before first run (not done here): `babel.config.js` with
 * `babel-preset-expo`, and `app.json` `extra` values per environment.
 */
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const escapedRoot = repoRoot.replace(/\\/g, '\\\\');

module.exports = {
  resolver: {
    extraNodeModules: {
      'tarana-web': path.join(repoRoot, 'src', 'lib'),
    },
    blockList: [
      new RegExp(`${escapedRoot}/\\.next/.*`),
      new RegExp(`${escapedRoot}/out/.*`),
      new RegExp(`${escapedRoot}/coverage/.*`),
    ],
  },
  watchFolders: [repoRoot],
};

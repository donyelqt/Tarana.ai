/**
 * Jest setup for the mobile local-LLM suite.
 *
 * Kept deliberately minimal: the suite covers the pure prompt contract and
 * the generator's failure paths, neither of which renders a React Native
 * view, so it needs no RN global stubs — only an explicit native-module
 * guard and the `__DEV__` flag RN code paths read.
 *
 * llama.rn is a native module and cannot be required under Jest. The
 * generator lazily requires it only AFTER its availability gate, and every
 * generator test mocks `./modelManager` first; this guard turns an
 * accidental unmocked load into a labelled failure instead of a raw
 * "Native module cannot be null" native error.
 */
import { jest } from '@jest/globals';

jest.mock('llama.rn', () => {
  throw new Error('llama.rn must not be loaded under Jest.');
}, { virtual: true });

/**
 * React Native's Babel runtime rewrites `__DEV__` into a literal at build
 * time; under Jest's transform the identifier survives and would read as
 * `undefined`. Defining it here keeps RN-shared code paths behaving the
 * same in test as on device.
 *
 * `__DEV__` is a compile-time RN global, so it cannot be produced by a
 * runtime check — hence the cast, assigned to a named const with the reason
 * above rather than inlined at the access site.
 */
type DevGlobal = typeof globalThis & { __DEV__?: boolean };

const jsGlobal = globalThis as DevGlobal;

if (typeof jsGlobal.__DEV__ === 'undefined') {
  jsGlobal.__DEV__ = true;
}

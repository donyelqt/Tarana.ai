import { jest } from '@jest/globals';

jest.mock('llama.rn', () => {
  throw new Error('llama.rn must not be loaded under Jest.');
}, { virtual: true });

type DevGlobal = typeof globalThis & { __DEV__?: boolean };

const jsGlobal = globalThis as DevGlobal;

if (typeof jsGlobal.__DEV__ === 'undefined') {
  jsGlobal.__DEV__ = true;
}

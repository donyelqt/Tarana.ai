/**
 * Local model manager — download, store, and load the on-device GGUF.
 *
 * Qwen3-1.7B Q4_K_M (~1.1 GB). Chosen over a 3B model for phone RAM headroom
 * (~2 GB vs ~3.2 GB peak) and roughly double generation speed; the generator
 * runs one day at a time, so coherence loss is bounded. Swap the URL to step
 * up to Llama-3.2-3B without touching any other file.
 *
 * Resumable download: llama.rn can init directly from a remote URL, but a
 * mid-generation network loss would then lose the whole file. We download to
 * disk first with FileSystem's resumable API, then init from the local path.
 * Progress reports to a callback so the Plan screen can gate generation on a
 * real, visible download instead of a silent stall.
 *
 * llama.rn is a native module: unavailable under Expo Go. The app requires a
 * dev build (documented in the plan); `isLlamaAvailable` lets callers show an
 * honest message instead of throwing an opaque module error.
 */
// SDK 57 split the filesystem: the resumable-download API the model manager
// depends on lives under the legacy entry point, which ships TypeScript
// source with no build output for that entry.
//
// Both native modules this file used to import at module scope -- Expo Go,
// Jest, or the web test suite -- are now required lazily. The repo-root
// Jest config leaves `node_modules` on the transform ignore path on Linux
// (a backslash path never matches the default pattern on Windows, so every
// node_modules file gets transformed locally and the same file throws in
// CI), so a top-level import of either ESM entry parses on a developer
// machine and then fails the suite in CI with "Cannot use import statement
// outside a module". `expo-file-system/legacy` is the sharper case: it
// resolves to `src/legacy/index.ts`, which has types at
// `build/legacy/index.d.ts` but no build output at all, so nothing but a
// transform of the TypeScript source can load it.
//
// One resolver, not a `require` per call site: the path constants are
// derived once from `documentDirectory`, and callers are spread across the
// file (status, download, delete), so a single cached accessor keeps the
// lazy-load rule in one place instead of a rule every call site must
// remember.
import type * as LegacyFileSystemModule from 'expo-file-system/legacy';

type FileSystemModule = typeof LegacyFileSystemModule;

let cachedFileSystem: FileSystemModule | null = null;

/**
 * Require the legacy filesystem module on first use, then reuse it.
 *
 * Cached in a plain variable rather than re-required per call because
 * `require` is not free to repeat, and because every call site wants the
 * same module instance -- the cached path must agree with the directory
 * `downloadModel` wrote to.
 *
 * `unknown` narrows to the real type the same way the guards below do: a
 * failed or absent native module throws out of `require`, and a wrong shape
 * (an ESM namespace, a Jest automock) fails the `typeof` checks at the access
 * sites rather than silently building a bad path.
 */
function getFileSystem(): FileSystemModule {
  if (cachedFileSystem === null) {
    const fs: unknown = require('expo-file-system/legacy');
    if (typeof fs !== 'object' || fs === null || !('documentDirectory' in fs)) {
      throw new Error(
        'expo-file-system/legacy did not resolve to the legacy filesystem module ' +
          '(expected an object with documentDirectory).'
      );
    }
    cachedFileSystem = fs as FileSystemModule;
  }
  return cachedFileSystem;
}

const DEFAULT_MODEL_URL =
  'https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/resolve/main/qwen3-1.7b-q4_k_m.gguf';

/**
 * app.json extra override keeps the URL configurable per build channel.
 *
 * `expo-constants` is required lazily for the same reason as
 * `expo-file-system` above. Requiring it inside the only function that
 * reads it keeps the cost off module load, and the model manager is
 * imported by paths -- including tests and the shared `generateWithLlama` --
 * that never touch the download source URL.
 */
function downloadUrl(): string {
  try {
    const Constants: unknown = require('expo-constants');
    const extra =
      Constants && typeof Constants === 'object' && 'expoConfig' in Constants
        ? (Constants.expoConfig as { extra?: unknown } | undefined)?.extra
        : undefined;
    if (extra && typeof extra === 'object' && 'localModelUrl' in extra) {
      const override = extra.localModelUrl;
      if (typeof override === 'string' && override.length > 0) return override;
    }
  } catch {
    // No native constants available (Expo Go, bare Jest, import failure):
    // fall through to the default URL.
  }
  return DEFAULT_MODEL_URL;
}

let cachedModelUrl: string | null = null;

/** Model source URL, read once. `MODEL_FILENAME` is derived from it. */
function modelUrl(): string {
  if (cachedModelUrl === null) cachedModelUrl = downloadUrl();
  return cachedModelUrl;
}

const MODEL_FILENAME = modelUrl().split('/').pop() ?? 'model.gguf';

let cachedModelDir: string | null = null;

/** Directory holding the on-device model, derived from `documentDirectory`. Read once. */
function modelDir(): string {
  if (cachedModelDir === null) {
    const fs = getFileSystem();
    if (typeof fs.documentDirectory !== 'string') {
      throw new Error('expo-file-system/legacy did not provide documentDirectory as a string.');
    }
    cachedModelDir = `${fs.documentDirectory}models/`;
  }
  return cachedModelDir;
}

let cachedModelPath: string | null = null;

/** Local model path: the model directory plus the model filename. Read once. */
function modelPath(): string {
  if (cachedModelPath === null) {
    cachedModelPath = `${modelDir()}${MODEL_FILENAME}`;
  }
  return cachedModelPath;
}

/**
 * The generator reads this to pick the file `initLlama` loads, so it takes
 * the snapshot lazily too rather than pinning a constant at import time.
 */
export function getModelPath(): string {
  return modelPath();
}

export type ModelStatus = {
  state: 'ready' | 'not-downloaded' | 'downloading' | 'downloading-incomplete' | 'unsupported';
  bytesDownloaded: number;
  bytesTotal: number;
  path: string | null;
};

let cachedStatus: ModelStatus | null = null;

/** Native module presence. False under Expo Go and on web. */
export function isLlamaAvailable(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Llama: unknown = require('llama.rn');
    return (
      typeof Llama === 'object' && Llama !== null && 'initLlama' in Llama && typeof Llama.initLlama === 'function'
    );
  } catch {
    return false;
  }
}

async function ensureDir(): Promise<void> {
  const fs = getFileSystem();
  const dir = modelDir();
  const info = await fs.getInfoAsync(dir);
  if (!info.exists) await fs.makeDirectoryAsync(dir, { intermediates: true });
}

export async function getModelStatus(): Promise<ModelStatus> {
  if (!isLlamaAvailable()) {
    return { state: 'unsupported', bytesDownloaded: 0, bytesTotal: 0, path: null };
  }
  if (cachedStatus) return cachedStatus;
  const fs = getFileSystem();
  const path = modelPath();
  const info = await fs.getInfoAsync(path);
  const partial = await fs.getInfoAsync(`${path}.part`).catch(() => null);
  if (info.exists && info.size && info.size > 0) {
    cachedStatus = { state: 'ready', bytesDownloaded: info.size, bytesTotal: info.size, path };
  } else if (partial && 'exists' in partial && partial.exists && 'size' in partial && typeof partial.size === 'number') {
    cachedStatus = {
      state: 'downloading-incomplete',
      bytesDownloaded: partial.size,
      bytesTotal: 0,
      path,
    };
  } else {
    cachedStatus = { state: 'not-downloaded', bytesDownloaded: 0, bytesTotal: 0, path };
  }
  return cachedStatus;
}

let activeDownload: { cancel: () => void } | null = null;

/**
 * Download the model to disk. Resolves with the local path; reports progress
 * through `onProgress` (0..1). Resumes an interrupted download when one exists.
 */
export async function downloadModel(
  onProgress?: (fraction: number, bytesDownloaded: number, bytesTotal: number) => void
): Promise<string> {
  if (!isLlamaAvailable()) throw new Error('The local model engine is unavailable in this build.');
  const status = await getModelStatus();
  if (status.state === 'ready' && status.path) return status.path;

  await ensureDir();
  const resumeHeaders =
    status.state === 'downloading-incomplete' ? { Range: 'bytes=-' } : undefined;

  return new Promise<string>((resolve, reject) => {
    const fs = getFileSystem();
    const path = modelPath();
    const job = fs.createDownloadResumable(
      modelUrl(),
      path,
      { headers: resumeHeaders },
      (progress) => {
        const { totalBytesWritten, totalBytesExpectedToWrite } = progress;
        if (onProgress && totalBytesExpectedToWrite > 0) {
          onProgress(totalBytesWritten / totalBytesExpectedToWrite, totalBytesWritten, totalBytesExpectedToWrite);
        }
      }
    );
    activeDownload = { cancel: () => job.pauseAsync().catch(() => undefined) };
    job
      .downloadAsync()
      .then((result) => {
        if (!result) {
          reject(new Error('Model download failed.'));
          return;
        }
        // Size is read after completion so the reported bytes are real.
        getFileSystem().getInfoAsync(result.uri).then((info) => {
          if (info.exists && 'size' in info && typeof info.size === 'number') {
            cachedStatus = { state: 'ready', bytesDownloaded: info.size, bytesTotal: info.size, path: result.uri };
          }
        });
        resolve(result.uri);
      })
      .catch((err: Error) => reject(err instanceof Error ? err : new Error('Model download failed.')))
      .finally(() => {
        activeDownload = null;
      });
  });
}

export function cancelDownload(): void {
  activeDownload?.cancel();
}

/** Delete the model file (Settings: free up ~1.1 GB). */
export async function deleteModel(): Promise<void> {
  const fs = getFileSystem();
  const path = modelPath();
  const info = await fs.getInfoAsync(path);
  if (info.exists) await fs.deleteAsync(path, { idempotent: true });
  cachedStatus = { state: 'not-downloaded', bytesDownloaded: 0, bytesTotal: 0, path };
}


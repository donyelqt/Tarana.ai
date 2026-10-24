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
import Constants from 'expo-constants';
// SDK 57 split the filesystem: the resumable-download API the model manager
// depends on lives under the legacy entry point and throws from the top-level
// import.
import * as FileSystem from 'expo-file-system/legacy';

// app.json extra override keeps the URL configurable per build channel.
const extra = Constants.expoConfig?.extra;
const localModelUrl =
  extra && typeof extra === 'object' && 'localModelUrl' in extra && typeof extra.localModelUrl === 'string'
    ? extra.localModelUrl
    : undefined;
const DEFAULT_MODEL_URL =
  'https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/resolve/main/qwen3-1.7b-q4_k_m.gguf';
const MODEL_URL: string = localModelUrl ?? DEFAULT_MODEL_URL;

const MODEL_FILENAME = MODEL_URL.split('/').pop() ?? 'model.gguf';
const MODEL_DIR = `${FileSystem.documentDirectory}models/`;
const MODEL_PATH = `${MODEL_DIR}${MODEL_FILENAME}`;

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
  const info = await FileSystem.getInfoAsync(MODEL_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(MODEL_DIR, { intermediates: true });
}

export async function getModelStatus(): Promise<ModelStatus> {
  if (!isLlamaAvailable()) {
    return { state: 'unsupported', bytesDownloaded: 0, bytesTotal: 0, path: null };
  }
  if (cachedStatus) return cachedStatus;
  const info = await FileSystem.getInfoAsync(MODEL_PATH);
  const partial = await FileSystem.getInfoAsync(`${MODEL_PATH}.part`).catch(() => null);
  if (info.exists && info.size && info.size > 0) {
    cachedStatus = { state: 'ready', bytesDownloaded: info.size, bytesTotal: info.size, path: MODEL_PATH };
  } else if (partial && 'exists' in partial && partial.exists && 'size' in partial && typeof partial.size === 'number') {
    cachedStatus = {
      state: 'downloading-incomplete',
      bytesDownloaded: partial.size,
      bytesTotal: 0,
      path: MODEL_PATH,
    };
  } else {
    cachedStatus = { state: 'not-downloaded', bytesDownloaded: 0, bytesTotal: 0, path: MODEL_PATH };
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
    const job = FileSystem.createDownloadResumable(
      MODEL_URL,
      MODEL_PATH,
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
        FileSystem.getInfoAsync(result.uri).then((info) => {
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
  const info = await FileSystem.getInfoAsync(MODEL_PATH);
  if (info.exists) await FileSystem.deleteAsync(MODEL_PATH, { idempotent: true });
  cachedStatus = { state: 'not-downloaded', bytesDownloaded: 0, bytesTotal: 0, path: MODEL_PATH };
}

export { MODEL_PATH };

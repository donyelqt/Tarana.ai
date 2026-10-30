import type * as LegacyFileSystemModule from 'expo-file-system/legacy';

type FileSystemModule = typeof LegacyFileSystemModule;

let cachedFileSystem: FileSystemModule | null = null;

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
  }
  return DEFAULT_MODEL_URL;
}

let cachedModelUrl: string | null = null;

function modelUrl(): string {
  if (cachedModelUrl === null) cachedModelUrl = downloadUrl();
  return cachedModelUrl;
}

const MODEL_FILENAME = modelUrl().split('/').pop() ?? 'model.gguf';

let cachedModelDir: string | null = null;

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

function modelPath(): string {
  if (cachedModelPath === null) {
    cachedModelPath = `${modelDir()}${MODEL_FILENAME}`;
  }
  return cachedModelPath;
}

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

export async function deleteModel(): Promise<void> {
  const fs = getFileSystem();
  const path = modelPath();
  const info = await fs.getInfoAsync(path);
  if (info.exists) await fs.deleteAsync(path, { idempotent: true });
  cachedStatus = { state: 'not-downloaded', bytesDownloaded: 0, bytesTotal: 0, path };
}


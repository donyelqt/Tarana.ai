
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  requestId?: string;
  entryPoint?: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const configuredLevel =
  (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info';
const threshold = LOG_LEVELS[configuredLevel] ?? LOG_LEVELS.info;

function emit(entry: LogEntry): void {
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() });
  process[(entry.level === 'error' || entry.level === 'warn') ? 'stderr' : 'stdout'].write(
    `${line}\n`
  );
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>, requestId?: string): void {
    if (LOG_LEVELS.debug < threshold) return;
    emit({ level: 'debug', message, requestId, ...meta });
  },

  info(message: string, meta?: Record<string, unknown>, requestId?: string): void {
    if (LOG_LEVELS.info < threshold) return;
    emit({ level: 'info', message, requestId, ...meta });
  },

  warn(message: string, meta?: Record<string, unknown>, requestId?: string): void {
    if (LOG_LEVELS.warn < threshold) return;
    emit({ level: 'warn', message, requestId, ...meta });
  },

  error(message: string, meta?: Record<string, unknown>, requestId?: string): void {
    if (LOG_LEVELS.error < threshold) return;
    emit({ level: 'error', message, requestId, ...meta });
  },
};
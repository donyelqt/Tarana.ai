export interface SafeErrorMetadata {
  errorName: string;
  errorCode?: string;
}

/**
 * Extract only bounded fields suitable for structured production logs.
 * Error messages, stacks, and objects are intentionally excluded.
 */
export function getSafeErrorMetadata(error: unknown): SafeErrorMetadata {
  const errorName = error instanceof Error ? error.name : typeof error;

  if (typeof error === 'object' && error !== null && 'code' in error) {
    const errorCode = error.code;
    if (typeof errorCode === 'string' && errorCode.length > 0 && errorCode.length <= 32) {
      return { errorName, errorCode };
    }
  }

  return { errorName };
}

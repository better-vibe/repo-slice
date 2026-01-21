export interface Logger {
  debug: (message: string) => void;
}

export function createLogger(enabled: boolean): Logger {
  return {
    debug: (message: string) => {
      if (!enabled) return;
      process.stderr.write(`[debug] ${message}\n`);
    },
  };
}

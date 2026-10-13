export interface Config {
  databaseUrl: string;
  storageRoot: string;
  port: number;
  maxUploadBytes: number;
  devUserId: string;
  nodeEnv: string;
  maxJobAttempts: number;
  jobStuckAfterMs: number;
  workerPollMs: number;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export function loadConfig(): Config {
  return {
    databaseUrl: required('DATABASE_URL'),
    storageRoot: process.env.STORAGE_ROOT ?? './storage/raw',
    port: Number(process.env.PORT ?? 4000),
    maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES ?? 5 * 1024 * 1024),
    devUserId: process.env.DEV_USER_ID ?? '',
    nodeEnv: process.env.NODE_ENV ?? 'development',
    maxJobAttempts: 3,
    jobStuckAfterMs: 5 * 60_000,
    workerPollMs: 2000,
  };
}

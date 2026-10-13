import type { FastifyRequest } from 'fastify';
import type { Config } from '../config.js';

/**
 * TEMPORARY auth seam. Every route gets its user through this ONE function, so
 * replacing it with real session/JWT auth later touches exactly one file.
 *
 * It deliberately does NOT read a user id from a request header: a client-controlled
 * user id is not "weak auth", it is no auth.
 */
export function assertAuthConfigured(config: Config): void {
  if (config.nodeEnv === 'production') {
    throw new Error('Refusing to start: real authentication is not implemented yet.');
  }
  if (!/^[0-9a-f-]{36}$/i.test(config.devUserId)) {
    throw new Error('DEV_USER_ID must be a UUID (temporary stand-in for authentication).');
  }
}

export function getCurrentUserId(_request: FastifyRequest, config: Config): string {
  return config.devUserId;
}

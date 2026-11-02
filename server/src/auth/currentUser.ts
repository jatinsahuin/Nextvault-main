import type { FastifyRequest } from 'fastify';
import type { Config } from '../config.js';

export interface UserSession {
  userId: string;
}

/**
 * Extracts the user identity from the request.
 * Now integrates with @fastify/jwt for secure identity verification.
 */
export function getCurrentUserId(request: FastifyRequest, config: Config): string {
  // 1. Try to get user from JWT session
  if (request.user) {
    return (request.user as UserSession).userId;
  }

  // 2. Fallback to DEV_USER_ID only in development mode
  if (config.nodeEnv === 'development' && config.devUserId) {
    return config.devUserId;
  }

  throw new Error('Unauthorized: No valid session found');
}

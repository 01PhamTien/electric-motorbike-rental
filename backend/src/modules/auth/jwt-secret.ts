import { ConfigService } from '@nestjs/config';

/**
 * Local development may use the documented fallback, but production must
 * provide a strong, non-example secret. Used by both signing and verification.
 */
export function resolveJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (process.env.NODE_ENV === 'production' &&
      (!secret || secret === 'change-me-in-production' || secret.length < 32)) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters in production');
  }
  return secret || 'change-me-in-production';
}

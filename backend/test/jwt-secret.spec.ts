import assert = require('node:assert/strict');
import test = require('node:test');
import { ConfigService } from '@nestjs/config';
import { resolveJwtSecret } from '../src/modules/auth/jwt-secret';

test('production rejects missing, sample, and short signing keys', () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    for (const secret of ['', 'change-me-in-production', 'short-secret']) {
      const config = new ConfigService({ JWT_SECRET: secret });
      assert.throws(() => resolveJwtSecret(config), /JWT_SECRET/);
    }
    assert.equal(
      resolveJwtSecret(new ConfigService({ JWT_SECRET: 'a-secure-random-secret-with-40-characters-min' })),
      'a-secure-random-secret-with-40-characters-min',
    );
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

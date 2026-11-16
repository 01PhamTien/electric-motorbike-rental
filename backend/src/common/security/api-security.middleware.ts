import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

type WindowEntry = { timestamps: number[]; expiresAt: number };
type Limit = { count: number; windowMs: number };

const DEFAULTS = {
  loginIp: { count: 20, windowMs: 15 * 60_000 },
  loginEmail: { count: 8, windowMs: 15 * 60_000 },
  registerIp: { count: 10, windowMs: 60 * 60_000 },
  registerEmail: { count: 3, windowMs: 60 * 60_000 },
} satisfies Record<string, Limit>;

/**
 * Lightweight per-process protection for public authentication endpoints.
 * Do not enable Express trust-proxy unless the deployment proxy is trusted and
 * configured explicitly; req.ip is used rather than user-controlled X-Forwarded-For.
 */
@Injectable()
export class ApiSecurityMiddleware implements NestMiddleware {
  private readonly windows = new Map<string, WindowEntry>();

  use(req: Request, res: Response, next: NextFunction): void {
    this.setSecurityHeaders(req, res);

    if (req.method !== 'POST') return next();
    const path = req.path.replace(/\/+$/, '');
    const isLogin = path === '/api/auth/login';
    const isRegister = path === '/api/auth/register';
    if (!isLogin && !isRegister) return next();

    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const email = typeof req.body?.email === 'string'
      ? req.body.email.trim().toLowerCase().slice(0, 254)
      : '';
    const limits = isLogin
      ? [this.limit('loginIp', ip, DEFAULTS.loginIp, now)]
      : [this.limit('registerIp', ip, DEFAULTS.registerIp, now)];
    if (email) {
      limits.push(isLogin
        ? this.limit('loginEmail', email, DEFAULTS.loginEmail, now)
        : this.limit('registerEmail', email, DEFAULTS.registerEmail, now));
    }

    const blocked = limits.find(result => result.blocked);
    if (blocked) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((blocked.resetAt - now) / 1000))));
      res.status(429).json({
        statusCode: 429,
        message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
      });
      return;
    }
    next();
  }

  private limit(scope: string, subject: string, limit: Limit, now: number) {
    const key = scope + ':' + subject;
    const cutoff = now - limit.windowMs;
    const entry = this.windows.get(key) || { timestamps: [], expiresAt: now + limit.windowMs };
    entry.timestamps = entry.timestamps.filter(timestamp => timestamp > cutoff);
    const blocked = entry.timestamps.length >= limit.count;
    if (!blocked) entry.timestamps.push(now);
    entry.expiresAt = (entry.timestamps[0] || now) + limit.windowMs;
    this.windows.set(key, entry);
    this.prune(now);
    return { blocked, resetAt: entry.expiresAt };
  }

  private prune(now: number) {
    for (const [key, entry] of this.windows) {
      if (entry.expiresAt <= now) this.windows.delete(key);
    }
    // Bound memory if a public endpoint receives many distinct identifiers.
    while (this.windows.size > 10_000) {
      const oldest = this.windows.keys().next().value;
      if (oldest === undefined) break;
      this.windows.delete(oldest);
    }
  }

  private setSecurityHeaders(req: Request, res: Response) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    if (process.env.NODE_ENV === 'production' || req.secure) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
  }
}

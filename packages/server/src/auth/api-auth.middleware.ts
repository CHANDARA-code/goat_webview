import { NextFunction, Request, Response } from 'express';
import * as crypto from 'node:crypto';

function safeTokenEqual(provided: string | undefined, expected: string | undefined): boolean {
  if (!provided || !expected || provided.length === 0 || expected.length === 0) {
    return false;
  }
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function bearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length).trim();
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  if (!safeTokenEqual(bearerToken(req), process.env.GOAT_ADMIN_TOKEN)) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

export function requirePaymentsAuth(req: Request, res: Response, next: NextFunction): void {
  if (!safeTokenEqual(bearerToken(req), process.env.GOAT_PAYMENTS_TOKEN)) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

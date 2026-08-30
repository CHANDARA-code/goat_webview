/**
 * @goat/compiler-uniapp Cryptographic SHA-256 Digest Generator
 */
import { createHash } from 'node:crypto';

export function computeSha256(content: string | Buffer): string {
  const hash = createHash('sha256');
  if (typeof content === 'string') {
    hash.update(content, 'utf8');
  } else {
    hash.update(content);
  }
  return hash.digest('hex');
}

export function computeByteLength(content: string | Buffer): number {
  if (typeof content === 'string') {
    return Buffer.byteLength(content, 'utf8');
  }
  return content.length;
}

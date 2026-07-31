import { describe, it, expect, afterEach } from 'vitest';
import { newId } from '../id';

describe('newId', () => {
  const original = crypto.randomUUID;

  afterEach(() => {
    Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true });
  });

  it('returns unique ids via crypto.randomUUID when available', () => {
    const a = newId();
    const b = newId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('falls back to getRandomValues when randomUUID is unavailable (insecure context)', () => {
    // crypto.randomUUID is inherited from Crypto.prototype, not an own property,
    // so it has to be shadowed with defineProperty to simulate its absence.
    Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });

    const a = newId();
    const b = newId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

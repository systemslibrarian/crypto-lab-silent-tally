import { describe, it, expect } from 'vitest';
import { P } from './types.js';
import {
  mod,
  add,
  sub,
  mul,
  pow,
  inv,
  lagrangeBasisAtZero,
  lagrangeInterpolate,
  evalPoly,
} from './field.js';

/**
 * These mirror the Rust unit tests in `src/lib.rs`. Both implementations must
 * agree, so the test vectors are intentionally shared between the two.
 */

describe('GF(p) arithmetic', () => {
  it('canonicalizes with mod, including negatives', () => {
    expect(mod(0n)).toBe(0n);
    expect(mod(P)).toBe(0n);
    expect(mod(P + 5n)).toBe(5n);
    expect(mod(-1n)).toBe(P - 1n);
    expect(mod(-P - 3n)).toBe(P - 3n);
  });

  it('adds with wraparound', () => {
    expect(add(1n, 2n)).toBe(3n);
    expect(add(P - 1n, 1n)).toBe(0n);
    expect(add(P - 1n, P - 1n)).toBe(P - 2n);
  });

  it('subtracts with wraparound', () => {
    expect(sub(5n, 3n)).toBe(2n);
    expect(sub(3n, 5n)).toBe(P - 2n);
    expect(sub(0n, 1n)).toBe(P - 1n);
  });

  it('multiplies, including -1 * -1 = 1', () => {
    expect(mul(2n, 3n)).toBe(6n);
    expect(mul(0n, 12345n)).toBe(0n);
    expect(mul(P - 1n, P - 1n)).toBe(1n);
  });

  it('computes modular inverse (a * a^-1 = 1)', () => {
    expect(inv(1n)).toBe(1n);
    for (const a of [2n, 3n, 12345n, P - 1n, 999999n]) {
      expect(mul(a, inv(a))).toBe(1n);
    }
  });

  it('throws inverting zero', () => {
    expect(() => inv(0n)).toThrow(/invert zero/);
  });

  it('pow matches repeated multiplication', () => {
    expect(pow(2n, 10n)).toBe(1024n);
    expect(pow(7n, 0n)).toBe(1n);
    // Fermat: a^(p-1) = 1
    expect(pow(123456n, P - 1n)).toBe(1n);
  });
});

describe('Lagrange interpolation', () => {
  it('matches the hand-computed polynomial f(x) = 7 + 3x + 5x^2', () => {
    // f(1)=15, f(2)=33, f(3)=61  →  f(0)=7
    expect(lagrangeInterpolate([1n, 2n, 3n], [15n, 33n, 61n])).toBe(7n);
  });

  it('produces the canonical basis coefficients 3, -3, 1 for nodes 1,2,3', () => {
    const [l1, l2, l3] = lagrangeBasisAtZero([1n, 2n, 3n]);
    expect(l1).toBe(3n);
    expect(l2).toBe(P - 3n); // -3 mod p
    expect(l3).toBe(1n);
  });

  it('rejects mismatched / empty input', () => {
    expect(() => lagrangeInterpolate([1n], [1n, 2n])).toThrow();
    expect(() => lagrangeInterpolate([], [])).toThrow();
  });
});

describe('Shamir round-trip (pure-TS reference)', () => {
  // Deterministic xorshift so the test is reproducible.
  function* prng(seed: bigint): Generator<bigint> {
    let x = seed;
    const MASK = (1n << 64n) - 1n;
    while (true) {
      x = (x ^ (x << 13n)) & MASK;
      x = x ^ (x >> 7n);
      x = (x ^ (x << 17n)) & MASK;
      yield x % P;
    }
  }

  function share(secret: bigint, t: number, n: number, rng: Generator<bigint>) {
    const coeffs: bigint[] = [];
    for (let i = 1; i < t; i++) coeffs.push(rng.next().value);
    const shares: bigint[] = [];
    for (let x = 1; x <= n; x++) shares.push(evalPoly(secret, coeffs, BigInt(x)));
    return { coeffs, shares };
  }

  it('reconstructs the secret from every 3-of-5 subset', () => {
    const rng = prng(0x9e3779b97f4a7c15n);
    for (let trial = 0; trial < 25; trial++) {
      const secret = rng.next().value;
      const { shares } = share(secret, 3, 5, rng);
      for (let i = 0; i < 5; i++) {
        for (let j = i + 1; j < 5; j++) {
          for (let k = j + 1; k < 5; k++) {
            const xs = [BigInt(i + 1), BigInt(j + 1), BigInt(k + 1)];
            const ys = [shares[i], shares[j], shares[k]];
            expect(lagrangeInterpolate(xs, ys)).toBe(secret);
          }
        }
      }
    }
  });

  it('is additively homomorphic: summed shares reconstruct the summed secret', () => {
    const rng = prng(0x1234567812345678n);
    const secrets = [1247n, 983n, 2104n, 761n, 1589n];
    const expectedTotal = secrets.reduce((a, b) => a + b, 0n);

    const allShares = secrets.map((s) => share(s, 3, 5, rng).shares);
    const localSums: bigint[] = [];
    for (let party = 0; party < 5; party++) {
      localSums.push(allShares.reduce((acc, sh) => add(acc, sh[party]), 0n));
    }
    expect(lagrangeInterpolate([1n, 2n, 3n], localSums.slice(0, 3))).toBe(expectedTotal);
  });

  it('two shares leave the secret information-theoretically hidden', () => {
    // For fixed observed points (1,y1),(2,y2), many distinct secrets each admit
    // a degree-2 polynomial passing through both — so 2 points reveal nothing.
    const x1 = 1n;
    const x2 = 2n;
    const y1 = 1234n;
    const y2 = 5678n;
    for (const candidate of [0n, 7n, 42n, 999999n, P - 1n]) {
      const b1 = sub(y1, candidate);
      const b2 = sub(y2, candidate);
      const x1sq = mul(x1, x1);
      const x2sq = mul(x2, x2);
      const det = sub(mul(x1, x2sq), mul(x2, x1sq));
      const detInv = inv(det);
      const a1 = mul(sub(mul(b1, x2sq), mul(b2, x1sq)), detInv);
      const a2 = mul(sub(mul(x1, b2), mul(x2, b1)), detInv);
      expect(evalPoly(candidate, [a1, a2], x1)).toBe(y1);
      expect(evalPoly(candidate, [a1, a2], x2)).toBe(y2);
    }
  });
});

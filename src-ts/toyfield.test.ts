import { describe, it, expect } from 'vitest';
import { TOY_P, toyMod, toyEval, toyShares } from './toyfield.js';

/**
 * The exhibit-3 parabola is a real Shamir sharing over the toy prime p = 97.
 * These tests guard the honesty of that illustration: the plotted points must
 * genuinely lie on f(x) = 8 + 2x + x², stay inside the field (so the drawn
 * curve and the field values coincide), and reconstruct the secret from any 3.
 */

describe('toy field (illustrative GF(97))', () => {
  it('wraps around the modulus', () => {
    expect(toyMod(8n + 7n, 13n)).toBe(2n); // the exhibit-3 wrap-around example
    expect(toyMod(-1n)).toBe(TOY_P - 1n);
    expect(toyMod(TOY_P)).toBe(0n);
  });

  it('evaluates the polynomial used in exhibit 3: f(x) = 8 + 2x + x²', () => {
    const t = toyShares(8n, 3, 5);
    expect(t.secret).toBe(8n);
    expect(t.coeffs).toEqual([2n, 1n]);
    // f(1)=11, f(2)=16, f(3)=23, f(4)=32, f(5)=43 — all below 97, no wrap,
    // so the drawn integer parabola matches the GF(97) share values exactly.
    expect(t.shares).toEqual([11n, 16n, 23n, 32n, 43n]);
    expect(t.shares.every(s => s < TOY_P)).toBe(true);
  });

  it('toyEval agrees with direct integer evaluation below the modulus', () => {
    for (let x = 0; x <= 5; x++) {
      const direct = 8n + 2n * BigInt(x) + BigInt(x) * BigInt(x);
      expect(toyEval(8n, [2n, 1n], BigInt(x))).toBe(direct % TOY_P);
    }
  });

  it('reconstructs the toy secret from any 3-of-5 subset (Lagrange at 0)', () => {
    const t = toyShares(8n, 3, 5);
    const modInv = (a: bigint, p: bigint) => {
      // Fermat inverse over the toy prime.
      let r = 1n, b = toyMod(a, p), e = p - 2n;
      while (e > 0n) { if (e & 1n) r = toyMod(r * b, p); e >>= 1n; b = toyMod(b * b, p); }
      return r;
    };
    const interp = (idx: number[]) => {
      let acc = 0n;
      for (const i of idx) {
        const xi = BigInt(i + 1);
        let num = 1n, den = 1n;
        for (const jj of idx) {
          if (jj === i) continue;
          const xj = BigInt(jj + 1);
          num = toyMod(num * toyMod(-xj, TOY_P), TOY_P);
          den = toyMod(den * toyMod(xi - xj, TOY_P), TOY_P);
        }
        acc = toyMod(acc + toyMod(t.shares[i] * toyMod(num * modInv(den, TOY_P), TOY_P), TOY_P), TOY_P);
      }
      return acc;
    };
    for (let a = 0; a < 5; a++)
      for (let b = a + 1; b < 5; b++)
        for (let c = b + 1; c < 5; c++)
          expect(interp([a, b, c])).toBe(8n);
  });
});

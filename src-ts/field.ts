/**
 * Pure-TypeScript reference implementation of GF(p) arithmetic and Shamir /
 * Lagrange mechanics over the Mersenne prime p = 2^61 - 1.
 *
 * This mirrors the Rust/WASM core in `src/lib.rs`. The WASM build is what the
 * running app uses for the heavy lifting; this module exists so that (a) the
 * exhibit UI can show derived values without duplicating field math inline, and
 * (b) the protocol logic is unit-testable in Node without loading WASM.
 *
 * The two implementations are cross-checked: identical inputs must yield
 * identical outputs (see `field.test.ts`).
 */

import { P } from './types.js';

/** Canonical field representative of `x` in `[0, P-1]`, handling negatives. */
export function mod(x: bigint): bigint {
  const r = x % P;
  return r < 0n ? r + P : r;
}

/** Addition in GF(p). */
export function add(a: bigint, b: bigint): bigint {
  return mod(a + b);
}

/** Subtraction in GF(p). */
export function sub(a: bigint, b: bigint): bigint {
  return mod(a - b);
}

/** Multiplication in GF(p). */
export function mul(a: bigint, b: bigint): bigint {
  return mod(a * b);
}

/** Modular exponentiation: base^exp mod p (square-and-multiply). */
export function pow(base: bigint, exp: bigint): bigint {
  let result = 1n;
  let b = mod(base);
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = mul(result, b);
    e >>= 1n;
    b = mul(b, b);
  }
  return result;
}

/** Modular inverse via Fermat's little theorem: a^{-1} = a^{p-2} mod p. */
export function inv(a: bigint): bigint {
  const c = mod(a);
  if (c === 0n) throw new Error('Cannot invert zero in GF(p)');
  return pow(c, P - 2n);
}

/**
 * Lagrange basis coefficients evaluated at x = 0, one per interpolation node.
 *
 * For nodes `xs`, returns `[L_0(0), L_1(0), ...]` where
 *   L_i(0) = ∏_{j≠i} (0 - x_j) / (x_i - x_j)   (mod p)
 *
 * The dot product of these with the corresponding y-values reconstructs f(0).
 */
export function lagrangeBasisAtZero(xs: bigint[]): bigint[] {
  return xs.map((xi, i) => {
    let num = 1n;
    let den = 1n;
    xs.forEach((xj, j) => {
      if (i === j) return;
      num = mul(num, sub(0n, xj));
      den = mul(den, sub(xi, xj));
    });
    return mul(num, inv(den));
  });
}

/** Lagrange-interpolate f(0) from points `(xs[i], ys[i])`. */
export function lagrangeInterpolate(xs: bigint[], ys: bigint[]): bigint {
  if (xs.length !== ys.length) {
    throw new Error('x and y arrays must have equal length');
  }
  if (xs.length === 0) throw new Error('need at least 1 point');
  const basis = lagrangeBasisAtZero(xs);
  return ys.reduce((acc, yi, i) => add(acc, mul(yi, basis[i])), 0n);
}

/**
 * Evaluate the polynomial `secret + c_1·x + c_2·x^2 + …` at `x` over GF(p),
 * where `coeffs = [c_1, c_2, …]` are the non-constant coefficients.
 *
 * Used by the UI to draw real polynomial curves (e.g. the coalition exhibit).
 */
export function evalPoly(secret: bigint, coeffs: bigint[], x: bigint): bigint {
  let acc = mod(secret);
  let xp = mod(x);
  for (const c of coeffs) {
    acc = add(acc, mul(c, xp));
    xp = mul(xp, x);
  }
  return acc;
}

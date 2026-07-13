/**
 * Teaching-only "toy field" helpers.
 *
 * The running protocol operates over the real field GF(2^61 - 1) — nothing in
 * here changes that. These helpers reproduce the *same* Shamir/Lagrange
 * mechanics over a tiny prime (p = 97) purely so the exhibits can draw an
 * honest, small-integer picture of what a degree-2 polynomial actually looks
 * like. Over the real 61-bit field the share values are ~2^61 and land in
 * effectively random positions, so a linear plot of them is meaningless (and
 * misleading). A toy prime lets a newcomer see a genuine parabola with f(0)
 * marked, then trust — via the cross-check tests — that the identical math runs
 * at full field size in the live demo.
 *
 * IMPORTANT: this is illustrative math over p=97, NOT a weakened security
 * parameter for the protocol. The protocol's shares, sums, and reconstruction
 * all still run over GF(2^61 - 1) via the WASM core.
 */

/** A small prime used only for the illustrative parabola in exhibit 3. */
export const TOY_P = 97n;

/** ((x % p) + p) % p — canonical representative in [0, p). */
export function toyMod(x: bigint, p: bigint = TOY_P): bigint {
  const r = x % p;
  return r < 0n ? r + p : r;
}

/**
 * Evaluate f(x) = secret + c1·x + c2·x² + … over GF(p), toy-sized.
 * Mirrors field.ts `evalPoly` but with a caller-supplied small modulus.
 */
export function toyEval(secret: bigint, coeffs: bigint[], x: bigint, p: bigint = TOY_P): bigint {
  let acc = toyMod(secret, p);
  let xp = toyMod(x, p);
  for (const c of coeffs) {
    acc = toyMod(acc + toyMod(c * xp, p), p);
    xp = toyMod(xp * x, p);
  }
  return acc;
}

export interface ToyShareData {
  p: bigint;
  secret: bigint;
  coeffs: bigint[];
  /** shares[i] = f(i+1) for i in 0..n-1 */
  shares: bigint[];
}

/**
 * Build a deterministic degree-(t-1) Shamir sharing over the toy prime.
 * Deterministic so the exhibit renders the same picture every load (and can be
 * asserted in tests). The coefficients are non-zero so the curve is a genuine
 * parabola, not a flat/line degenerate case.
 */
export function toyShares(secret: bigint, t = 3, n = 5, p: bigint = TOY_P): ToyShareData {
  // Fixed, non-zero coefficients chosen for a visually clear, non-degenerate
  // parabola whose f(1..n) values stay below the toy prime (no wrap for the
  // illustration, so the integer curve and the GF(p) share values coincide and
  // the points sit exactly on the drawn parabola). (a1, a2, …) — the constant
  // term is the secret.
  const preset = [2n, 1n, 1n, 1n];
  const coeffs = preset.slice(0, t - 1).map((c) => toyMod(c, p));
  const shares: bigint[] = [];
  for (let x = 1; x <= n; x++) shares.push(toyEval(secret, coeffs, BigInt(x), p));
  return { p, secret: toyMod(secret, p), coeffs, shares };
}

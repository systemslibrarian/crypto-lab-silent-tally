use wasm_bindgen::prelude::*;

/// Mersenne prime p = 2^61 - 1
const P: u64 = (1u64 << 61) - 1;

// ---------------------------------------------------------------------------
// GF(p) arithmetic — all operations mod p = 2^61 - 1
// ---------------------------------------------------------------------------

/// Reduce a u64 that may be up to 2*P - 2 into [0, P-1].
#[inline]
fn reduce(x: u64) -> u64 {
    if x >= P {
        x - P
    } else {
        x
    }
}

/// Canonicalize an arbitrary `u64` into the field representative `[0, P-1]`.
///
/// Public (`wasm_bindgen`) entry points run inputs through this so that callers
/// passing un-reduced values can never trigger overflow or non-canonical output.
#[inline]
fn canon(x: u64) -> u64 {
    x % P
}

/// Addition in GF(p).
///
/// Inputs are canonicalized to `[0, P-1]` first, so the intermediate `a + b`
/// can never overflow `u64` (max `2*(P-1) = 2^62 - 4`).
#[wasm_bindgen]
pub fn gf_add(a: u64, b: u64) -> u64 {
    reduce(canon(a) + canon(b))
}

/// Subtraction in GF(p).  Returns (a - b) mod p.
#[inline]
fn gf_sub(a: u64, b: u64) -> u64 {
    if a >= b {
        reduce(a - b)
    } else {
        P - (b - a)
    }
}

/// Multiplication in GF(p).
/// Uses u128 intermediate to avoid overflow:  max a*b = (2^61-2)^2 < 2^122.
#[wasm_bindgen]
pub fn gf_mul(a: u64, b: u64) -> u64 {
    let full = (canon(a) as u128) * (canon(b) as u128);
    mersenne_reduce(full)
}

/// Fast reduction mod Mersenne prime:
///   x mod (2^61-1) = (x >> 61) + (x & (2^61-1)), then normalize.
#[inline]
fn mersenne_reduce(x: u128) -> u64 {
    let lo = (x & (P as u128)) as u64;
    let hi = (x >> 61) as u64;
    reduce(lo + hi)
}

/// Modular exponentiation: base^exp mod p  (square-and-multiply).
fn gf_pow(mut base: u64, mut exp: u64) -> u64 {
    let mut result: u64 = 1;
    base = reduce(base);
    while exp > 0 {
        if exp & 1 == 1 {
            result = gf_mul(result, base);
        }
        exp >>= 1;
        base = gf_mul(base, base);
    }
    result
}

/// Modular inverse via Fermat's little theorem: a^{-1} = a^{p-2} mod p.
/// Panics if a == 0.
#[wasm_bindgen]
pub fn gf_inv(a: u64) -> u64 {
    let a = canon(a);
    assert!(a != 0, "Cannot invert zero in GF(p)");
    gf_pow(a, P - 2)
}

// ---------------------------------------------------------------------------
// Cryptographically-secure random field element
// ---------------------------------------------------------------------------

fn random_field_element() -> u64 {
    let mut buf = [0u8; 8];
    getrandom::fill(&mut buf).expect("getrandom failed");
    let val = u64::from_le_bytes(buf);
    val % P
}

// ---------------------------------------------------------------------------
// Shamir Secret Sharing
// ---------------------------------------------------------------------------

/// Generate shares for `secret` among `n_parties` with reconstruction `threshold`.
///
/// Returns a flat array:
///   [ a_1, a_2, ..., a_{t-1}, share_1, share_2, ..., share_n ]
///
/// The first (threshold-1) values are the random polynomial coefficients (for display).
/// The remaining n values are the evaluated shares f(1), f(2), ..., f(n).
#[wasm_bindgen]
pub fn generate_shares(secret: u64, threshold: u8, n_parties: u8) -> Vec<u64> {
    let t = threshold as usize;
    let n = n_parties as usize;
    assert!(t >= 2, "threshold must be >= 2");
    assert!(n >= t, "n_parties must be >= threshold");
    assert!(secret < P, "secret must be < P");

    // Build polynomial coefficients: f(x) = secret + a1*x + a2*x^2 + ...
    let mut coeffs: Vec<u64> = Vec::with_capacity(t);
    coeffs.push(secret);
    for _ in 1..t {
        coeffs.push(random_field_element());
    }

    // Output: first the random coefficients (for exhibit display), then the shares
    let mut result: Vec<u64> = Vec::with_capacity((t - 1) + n);
    result.extend_from_slice(&coeffs[1..t]);

    // Evaluate polynomial at x = 1, 2, ..., n via Horner-style accumulation.
    for j in 1..=n {
        let x = j as u64;
        let mut val = coeffs[0];
        let mut x_pow = x;
        for &c in &coeffs[1..t] {
            val = gf_add(val, gf_mul(c, x_pow));
            x_pow = gf_mul(x_pow, x);
        }
        result.push(val);
    }

    result
}

/// Lagrange interpolation to reconstruct f(0).
///
/// `x_values` and `y_values` must have the same length (= threshold).
/// x_values are 1-based party indices; y_values are the share values.
/// All arithmetic is mod p.
#[wasm_bindgen]
pub fn lagrange_interpolate(x_values: Vec<u64>, y_values: Vec<u64>) -> u64 {
    let n = x_values.len();
    assert_eq!(n, y_values.len(), "x and y arrays must have equal length");
    assert!(n >= 1, "need at least 1 point");

    let mut result: u64 = 0;

    for i in 0..n {
        // Compute Lagrange basis polynomial L_i(0)
        let mut num: u64 = 1; // numerator:   prod_{j≠i} (0 - x_j) = prod_{j≠i} (-x_j)
        let mut den: u64 = 1; // denominator: prod_{j≠i} (x_i - x_j)
        for j in 0..n {
            if i == j {
                continue;
            }
            // numerator *= (0 - x_j) mod p = (P - x_j) mod p
            num = gf_mul(num, gf_sub(0, x_values[j]));
            // denominator *= (x_i - x_j) mod p
            den = gf_mul(den, gf_sub(x_values[i], x_values[j]));
        }
        let basis = gf_mul(num, gf_inv(den));
        result = gf_add(result, gf_mul(y_values[i], basis));
    }

    result
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gf_add() {
        assert_eq!(gf_add(0, 0), 0);
        assert_eq!(gf_add(1, 2), 3);
        // Wraparound: (P-1) + 1 = 0
        assert_eq!(gf_add(P - 1, 1), 0);
        // (P-1) + (P-1) = P - 2
        assert_eq!(gf_add(P - 1, P - 1), P - 2);
    }

    #[test]
    fn test_gf_mul() {
        assert_eq!(gf_mul(0, 12345), 0);
        assert_eq!(gf_mul(1, 12345), 12345);
        assert_eq!(gf_mul(2, 3), 6);
        // (P-1) * (P-1) mod P = 1  (since -1 * -1 = 1)
        assert_eq!(gf_mul(P - 1, P - 1), 1);
    }

    #[test]
    fn test_gf_inv() {
        // inv(1) = 1
        assert_eq!(gf_inv(1), 1);
        // inv(2) * 2 = 1
        let inv2 = gf_inv(2);
        assert_eq!(gf_mul(inv2, 2), 1);
        // inv(12345) * 12345 = 1
        let inv = gf_inv(12345);
        assert_eq!(gf_mul(inv, 12345), 1);
    }

    #[test]
    fn test_roundtrip_single_secret() {
        // Share secret=42 with threshold=3, n=5
        let secret = 42u64;
        let result = generate_shares(secret, 3, 5);
        // result has (t-1)=2 coefficients + 5 shares = 7 elements
        assert_eq!(result.len(), 7);

        let shares = &result[2..]; // skip the 2 coefficients
                                   // Reconstruct from first 3 shares: x=[1,2,3], y=[shares[0..3]]
        let x = vec![1, 2, 3];
        let y = vec![shares[0], shares[1], shares[2]];
        let recovered = lagrange_interpolate(x, y);
        assert_eq!(recovered, secret);

        // Reconstruct from different subset: x=[2,4,5]
        let x2 = vec![2, 4, 5];
        let y2 = vec![shares[1], shares[3], shares[4]];
        let recovered2 = lagrange_interpolate(x2, y2);
        assert_eq!(recovered2, secret);
    }

    #[test]
    fn test_additive_homomorphism() {
        // Simulate 5 hospitals with known secrets
        let secrets = [1247u64, 983, 2104, 761, 1589];
        let expected_total: u64 = secrets.iter().sum();

        let n: u8 = 5;
        let t: u8 = 3;

        // Generate shares for each hospital
        let mut all_shares: Vec<Vec<u64>> = Vec::new();
        for &s in &secrets {
            let result = generate_shares(s, t, n);
            let shares = result[(t as usize - 1)..].to_vec();
            all_shares.push(shares);
        }

        // Each party j sums the shares it received from all hospitals
        let mut local_sums = vec![0u64; n as usize];
        for hospital_shares in &all_shares {
            for (j, sum) in local_sums.iter_mut().enumerate() {
                *sum = gf_add(*sum, hospital_shares[j]);
            }
        }

        // Reconstruct from first 3 local sums
        let x = vec![1, 2, 3];
        let y = vec![local_sums[0], local_sums[1], local_sums[2]];
        let total = lagrange_interpolate(x, y);
        assert_eq!(total, expected_total);
    }

    #[test]
    fn test_hand_computed_polynomial() {
        // f(x) = 7 + 3x + 5x^2  mod P
        // f(1) = 7 + 3 + 5 = 15
        // f(2) = 7 + 6 + 20 = 33
        // f(3) = 7 + 9 + 45 = 61
        // Reconstruct f(0) from (1,15), (2,33), (3,61)
        let x = vec![1, 2, 3];
        let y = vec![15, 33, 61];
        let result = lagrange_interpolate(x, y);
        assert_eq!(result, 7);
    }

    // --- Hardening: public entry points canonicalize their inputs ---

    #[test]
    fn test_public_ops_canonicalize_inputs() {
        // Values >= P must be reduced rather than overflowing or returning
        // a non-canonical representative.
        assert_eq!(gf_add(P, P), 0);
        assert_eq!(gf_add(P + 5, P + 7), 12);
        assert_eq!(gf_add(u64::MAX, 0), u64::MAX % P);
        assert_eq!(gf_mul(P, 12345), 0);
        assert_eq!(gf_mul(P + 2, P + 3), 6);
        // a^{-1} of a non-canonical representative equals a^{-1} of its residue.
        assert_eq!(gf_inv(P + 2), gf_inv(2));
    }

    #[test]
    fn test_every_output_is_canonical() {
        // No GF operation should ever return a value >= P.
        for a in [0u64, 1, 2, 12345, P - 1] {
            for b in [0u64, 1, 7, P - 1, P - 2] {
                assert!(gf_add(a, b) < P);
                assert!(gf_mul(a, b) < P);
            }
            if a != 0 {
                assert!(gf_inv(a) < P);
                // a * a^{-1} == 1
                assert_eq!(gf_mul(a, gf_inv(a)), 1);
            }
        }
    }

    #[test]
    fn test_gf_sub() {
        assert_eq!(gf_sub(5, 3), 2);
        assert_eq!(gf_sub(0, 0), 0);
        // 3 - 5 = -2 = P - 2
        assert_eq!(gf_sub(3, 5), P - 2);
        // 0 - 1 = P - 1
        assert_eq!(gf_sub(0, 1), P - 1);
        // a - a = 0 for several a
        for a in [0u64, 1, 999, P - 1] {
            assert_eq!(gf_sub(a, a), 0);
        }
    }

    /// Tiny deterministic xorshift PRNG so tests are reproducible without
    /// pulling in getrandom (which is unavailable under `cargo test`).
    fn lcg(state: &mut u64) -> u64 {
        let mut x = *state;
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        *state = x;
        x % P
    }

    #[test]
    fn test_all_three_subsets_reconstruct() {
        // For a range of secrets, EVERY 3-of-5 subset must reconstruct it.
        let mut rng: u64 = 0x9E3779B97F4A7C15;
        for _ in 0..50 {
            let secret = lcg(&mut rng);
            let result = generate_shares(secret, 3, 5);
            let shares = &result[2..]; // skip 2 coefficients
            for i in 0..5 {
                for j in (i + 1)..5 {
                    for k in (j + 1)..5 {
                        let x = vec![(i + 1) as u64, (j + 1) as u64, (k + 1) as u64];
                        let y = vec![shares[i], shares[j], shares[k]];
                        assert_eq!(
                            lagrange_interpolate(x, y),
                            secret,
                            "subset ({},{},{}) failed for secret {}",
                            i + 1,
                            j + 1,
                            k + 1,
                            secret
                        );
                    }
                }
            }
        }
    }

    #[test]
    fn test_subthreshold_is_information_theoretically_hidden() {
        // The core security claim: with only t-1 = 2 points, EVERY candidate
        // secret is consistent. We prove it constructively — for two distinct
        // candidate secrets we can build degree-2 polynomials agreeing on the
        // same 2 points yet differing at f(0). A 2-point adversary cannot tell
        // them apart.
        let x1 = 1u64;
        let x2 = 2u64;

        // Pick a fixed pair of observed shares (y1, y2) and show that several
        // distinct candidate secrets each admit a degree-2 polynomial passing
        // through exactly those two points — so the two points reveal nothing.
        let y1 = 1234u64;
        let y2 = 5678u64;
        for &candidate in &[0u64, 7, 42, 999_999, P - 1] {
            // Solve for (a1, a2) given f(0)=candidate, f(x1)=y1, f(x2)=y2.
            // f(x) = candidate + a1 x + a2 x^2.
            //   y1 - candidate = a1 x1 + a2 x1^2
            //   y2 - candidate = a1 x2 + a2 x2^2
            let b1 = gf_sub(y1, candidate);
            let b2 = gf_sub(y2, candidate);
            // Cramer's rule over GF(p):
            // | x1  x1^2 | | a1 |   | b1 |
            // | x2  x2^2 | | a2 | = | b2 |
            let x1sq = gf_mul(x1, x1);
            let x2sq = gf_mul(x2, x2);
            let det = gf_sub(gf_mul(x1, x2sq), gf_mul(x2, x1sq));
            let det_inv = gf_inv(det);
            let a1 = gf_mul(gf_sub(gf_mul(b1, x2sq), gf_mul(b2, x1sq)), det_inv);
            let a2 = gf_mul(gf_sub(gf_mul(x1, b2), gf_mul(x2, b1)), det_inv);

            // Verify the constructed polynomial really passes through both points.
            let eval = |x: u64| gf_add(candidate, gf_add(gf_mul(a1, x), gf_mul(a2, gf_mul(x, x))));
            assert_eq!(eval(x1), y1, "candidate {candidate} misses point 1");
            assert_eq!(eval(x2), y2, "candidate {candidate} misses point 2");
        }
    }

    #[test]
    fn test_edge_case_secrets() {
        for secret in [0u64, 1, P - 1, P - 2] {
            let result = generate_shares(secret, 3, 5);
            let shares = &result[2..];
            let x = vec![1, 2, 3];
            let y = vec![shares[0], shares[1], shares[2]];
            assert_eq!(lagrange_interpolate(x, y), secret);
        }
    }

    #[test]
    fn test_threshold_two() {
        // t=2: any 2 of n reconstruct a line through f(0).
        let secret = 314159u64;
        let result = generate_shares(secret, 2, 5);
        let shares = &result[1..]; // 1 coefficient skipped
        assert_eq!(
            lagrange_interpolate(vec![1, 2], vec![shares[0], shares[1]]),
            secret
        );
        assert_eq!(
            lagrange_interpolate(vec![4, 5], vec![shares[3], shares[4]]),
            secret
        );
    }

    #[test]
    #[should_panic(expected = "Cannot invert zero")]
    fn test_inv_zero_panics() {
        gf_inv(0);
    }

    #[test]
    #[should_panic(expected = "threshold must be >= 2")]
    fn test_threshold_too_small_panics() {
        generate_shares(42, 1, 5);
    }

    #[test]
    #[should_panic(expected = "n_parties must be >= threshold")]
    fn test_n_less_than_threshold_panics() {
        generate_shares(42, 3, 2);
    }
}

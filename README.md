# crypto-lab-silent-tally

## What It Is

silent-tally is a browser demo of **Multi-Party Computation (MPC)** for secure
summation, built on **Shamir Secret Sharing**, **GF(p) arithmetic** over the
Mersenne prime $p = 2^{61}-1$, **additive homomorphism**, and **Lagrange
interpolation**.

It solves a concrete problem: computing a combined clinical-trial enrollment
total across five hospitals **without disclosing any hospital's private input**.
The protocol is threshold MPC with $t = 3,\ n = 5$ — fewer than three shares
cannot reconstruct a secret. The privacy guarantee demonstrated here is
**information-theoretic** for the underlying sharing model: with fewer than $t$
shares, every possible secret is equally consistent with what an attacker holds.

## When to Use It

- When multiple organizations must publish an aggregate but cannot reveal
  individual inputs — additive homomorphism computes the sum directly from shares.
- When you need **threshold trust** rather than a single trusted server —
  reconstruction requires at least $t$ participants to cooperate.
- For **education or prototyping** that needs concrete Shamir and Lagrange
  mechanics in the browser, with real share generation and interpolation on view.
- **Not** for production-critical deployments without an external audit — this is
  a demo implementation, not an audited system.

## Live Demo

**[systemslibrarian.github.io/crypto-lab-silent-tally](https://systemslibrarian.github.io/crypto-lab-silent-tally/)**

The demo walks through six exhibits — from why a central aggregator fails,
through private input, secret sharing, the share-distribution matrix, and
homomorphic computation, to a coalition attack. You can edit each hospital's
enrollment value, step through the protocol with the on-screen buttons or the
**← / →** arrow keys, and watch the total get reconstructed without any
individual input ever being revealed.

## What Can Go Wrong

- Collusion of $t$ or more parties reconstructs any secret — the threshold is only
  as strong as the assumption that fewer than $t$ participants cooperate.
- The privacy guarantee is information-theoretic only for the sharing model; this
  demo simulates all five parties in one browser tab and implements no secure
  channels, authentication, or malicious-party defenses.
- It assumes semi-honest parties — a malicious participant can submit inconsistent
  or out-of-range shares to corrupt the tally undetected, since there is no
  verifiable secret sharing here.
- Weak randomness breaks privacy — polynomial coefficients must come from a CSPRNG
  (`getrandom`), never `Math.random`, or the shares can leak the secret.
- Field-range limits — all arithmetic is mod $p = 2^{61}-1$; inputs or totals that
  exceed the field wrap around, so values must stay within range.

## Real-World Usage

- Privacy-preserving aggregate statistics — combining counts or totals across
  organizations (clinical trials, salary surveys, ad measurement) without revealing
  any single party's input.
- Shamir Secret Sharing for key management — splitting master keys, HSM backups,
  and root-of-trust material into $t$-of-$n$ shares.
- Threshold custody — distributing control of high-value secrets (cryptocurrency
  keys, signing keys) so no single holder can act alone.
- MPC frameworks — additive secret sharing is a core building block in production
  secure-computation systems for joint analytics.

## How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-silent-tally
cd crypto-lab-silent-tally
npm install
npm run dev
npm test           # GF(p) / Shamir unit tests
npm run test:e2e   # Playwright: functional claims + WCAG 2.1 AA gate
```

`npm run test:e2e` (and `test:a11y`, the same run) builds first and serves the
production bundle, so what is driven is what ships.

**Functional browser gate:** `e2e/claims.spec.ts` walks all six exhibits and asserts the
numbers each one puts on screen — checked against each other, not against constants. The
reconstructed total must equal the enrollments actually entered, and the cross-check panel
must add them up the same way; every party's local sum expansion must be exactly the
share-matrix column it claims to be summing, and the homomorphism walk-through must show
that same column and land on that same $T_k$; every 3-subset of local sums must reconstruct
the identical total, while two must leave it undetermined and four must be called
redundant; and the coalition's verdict must follow the number its own Lagrange run
produced — below $t = 3$ the reconstruction must genuinely miss the victim's count and
above it must hit it to the digit, for the counts the learner entered rather than the
seeded ones. Every failure path is asserted to reach its state *and* name its cause:
out-of-range enrollments that cannot be locked, the gated Next button, the sub-threshold
reconstruction, and the coalition cap that keeps the victim outside. Uncaught page
exceptions fail the run.

## Related Demos

- [crypto-lab-shamir-gate](https://systemslibrarian.github.io/crypto-lab-shamir-gate/) — Shamir Secret Sharing and Lagrange interpolation over GF(p), the sharing scheme at the heart of this demo.
- [crypto-lab-vss-gate](https://systemslibrarian.github.io/crypto-lab-vss-gate/) — Feldman/Pedersen verifiable secret sharing, which catches the cheating shares silent-tally cannot.
- [crypto-lab-paillier-gate](https://systemslibrarian.github.io/crypto-lab-paillier-gate/) — Paillier additive homomorphic encryption for private aggregation and voting.
- [crypto-lab-threshold-decrypt](https://systemslibrarian.github.io/crypto-lab-threshold-decrypt/) — $t$-of-$n$ threshold ElGamal decryption with NIZK proofs.
- [crypto-lab-frost-threshold](https://systemslibrarian.github.io/crypto-lab-frost-threshold/) — FROST threshold Ed25519 signing built on verifiable secret sharing.

## How the Protocol Works

Each hospital $i$ holds a secret $s_i$ and builds a random polynomial

$$f_i(x) = s_i + a_{i,1}x + a_{i,2}x^2 \pmod p, \qquad f_i(0) = s_i$$

It distributes shares $f_i(1), \dots, f_i(5)$ — one to each party. Because Shamir
sharing is **additively homomorphic**, each party $j$ can locally sum the shares
it received:

$$T_j = \sum_i f_i(j)$$

The set $\{T_1, \dots, T_5\}$ is itself a valid Shamir sharing of
$\sum_i s_i$, because polynomial evaluation is linear:
$(f_1 + \dots + f_5)(j) = T_j$ and $(f_1 + \dots + f_5)(0) = \sum_i s_i$.
Exhibit 5 makes this concrete — it lines up the five summed shares at any
$x = k$ against the summed secrets, so you can *see* that $T_k$ is a share of the
total rather than take it on faith. Any $t = 3$ of those local sums reconstruct
the grand total via Lagrange interpolation at $x = 0$ — and **nothing else** is
ever revealed. A live 3-of-5 chooser lets you confirm every valid subset yields
the same total, while any 2 leave it undetermined.

With only $t - 1 = 2$ shares, the secret is information-theoretically hidden: for
*every* candidate $f(0)$ in $\mathrm{GF}(p)$ there is exactly one degree-2
polynomial through those two points, so all $p = 2^{61}-1$ secrets stay equally
likely. Exhibit 6 draws a sample of these curves for real.

Because the live shares are ~19-digit elements of $\mathrm{GF}(2^{61}-1)$ that
plot as meaningless noise on a linear axis, Exhibit 3 illustrates the *shape* of
a degree-2 sharing over a toy prime $p = 97$ (secret $s = 8$,
$f(x) = 8 + 2x + x^2$), where the five share points sit exactly on a visible
parabola with $f(0)$ marked. This is the identical Shamir math shrunk for
drawing — the running protocol still operates over $2^{61}-1$, and the toy
illustration is unit-tested for correctness (`src-ts/toyfield.test.ts`).

## Architecture

```
┌─────────────────────────┐      ┌──────────────────────────────┐
│  Rust core (src/lib.rs)  │      │  TypeScript UI (src-ts/)       │
│  • GF(2^61-1) arithmetic │ wasm │  • main.ts  — shell / nav      │
│  • Shamir share gen      ├─────▶│  • exhibits/ — six exhibits    │
│  • Lagrange interpolate  │      │  • field.ts — pure-TS mirror   │
│  → compiled with         │      │  • Tailwind CSS, Vite bundler  │
│    wasm-pack             │      └──────────────────────────────┘
└─────────────────────────┘
```

The field math lives in two deliberately mirrored places:

- **`src/lib.rs`** — the Rust/WASM core the app runs in production.
- **`src-ts/field.ts`** — a pure-TypeScript reference, used by the UI for derived
  display values and **unit-tested in Node** with shared test vectors so the two
  implementations can't silently drift.

**Tech stack:** Rust + `wasm-bindgen` · `getrandom` (CSPRNG) · TypeScript · Vite
· Tailwind CSS v4 · Vitest · GitHub Actions → GitHub Pages.

## Exhibits

| # | Exhibit | What it shows |
|---|---------|---------------|
| 1 | The Problem | Why a central aggregator fails, and what MPC offers instead |
| 2 | Private Input | Each hospital locks in its enrollment count locally |
| 3 | Secret Sharing | Each secret split via a random degree-2 polynomial over GF(p); a field wrap-around primer and an honest toy-field (p=97) parabola show what a real degree-2 sharing looks like |
| 4 | Distribution | The 5×5 share matrix — who sends what to whom |
| 5 | Computation & Reconstruction | Additive homomorphism made visible (adding shares at x=k *is* evaluating the summed polynomial), plus a 3-of-5 chooser proving every valid subset reconstructs the same total — and 2 cannot |
| 6 | Coalition Attack | Build a coalition of 1–4 hospitals and Lagrange-interpolate their *actual* shares of a victim's polynomial. Below t = 3 the reconstruction misses (and the alternatives are drawn as real polynomials); at t = 3 it lands on the victim's count to the digit. Every verdict is read off that reconstruction, never off the coalition size |

## Testing

All checks below run in CI and gate every deploy:

```bash
cargo fmt --check                          # Rust formatting
cargo clippy --all-targets -- -D warnings  # Rust lints
cargo test                                 # Rust core (field, Shamir, Lagrange)
npx tsc --noEmit                           # TypeScript typecheck
npm test                                   # Vitest (pure-TS field reference)
```

The Rust and TypeScript suites share test vectors — including all $\binom{5}{3}$
reconstruction subsets, additive homomorphism, edge-case secrets, and a
constructive proof that two shares reveal nothing.

Building the WASM core needs the Rust toolchain and `wasm-pack`
(`cargo install wasm-pack`); run `npm run wasm` to build the Rust core into
`pkg/` after Rust changes. No environment variables are required.

## Security Notes

- Polynomial coefficients come from a **cryptographically secure RNG**
  (`getrandom`), not `Math.random`.
- The privacy guarantee is **information-theoretic for the sharing model** — but
  this demo simulates all five parties in one browser tab and does **not**
  implement secure channels, authentication, or malicious-party defenses.
- It is an educational artifact. **Do not** use it to protect real data without a
  proper, audited implementation.

## License

[MIT](./LICENSE) © 2026 Paul Clark

---

*Part of the [Crypto Lab](https://crypto-lab.systemslibrarian.dev/) suite.*

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*

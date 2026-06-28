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
```

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
$\sum_i s_i$. Any $t = 3$ of those local sums reconstruct the grand total via
Lagrange interpolation at $x = 0$ — and **nothing else** is ever revealed.

With only $t - 1 = 2$ shares, the secret is information-theoretically hidden:
infinitely many degree-2 polynomials pass through any two points, each implying a
different $f(0)$. Exhibit 6 draws these curves for real.

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
| 3 | Secret Sharing | Each secret split via a random degree-2 polynomial over GF(p) |
| 4 | Distribution | The 5×5 share matrix — who sends what to whom |
| 5 | Computation & Reconstruction | Additive homomorphism + Lagrange recover **only** the total |
| 6 | Coalition Attack | Two colluders provably learn nothing — drawn as real polynomials |

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

*One of 60+ browser demos in the [Crypto Lab](https://crypto-lab.systemslibrarian.dev/) suite.*

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*

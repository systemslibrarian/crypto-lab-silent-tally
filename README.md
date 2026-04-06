# silent-tally

**Secure MPC in the browser** — five hospitals compute combined clinical trial enrollment without revealing individual counts. Shamir SSS · additive homomorphism · GF(2⁶¹−1) · no trusted third party.

**[▸ Live Demo](https://systemslibrarian.github.io/crypto-lab-silent-tally/)**

Part of the [systemslibrarian crypto-lab collection](https://github.com/systemslibrarian).

---

## Why This Exists

Five hospitals are collaborating on a global clinical trial. A regulatory body needs the combined total enrollment across all institutions. Each hospital holds its private enrollment count — numbers they will not share with peer institutions, not with regulators, not with any central server.

The core problem: you have five parties who each hold a private number. They want to compute a function of all five numbers together — in this case, a sum. The naive solutions all fail:

- **Send everything to a central server** → the server learns all five private inputs. HIPAA violation, single point of failure, requires trust.
- **Send numbers to each other** → same problem. Hospital A now knows Hospital B's enrollment.
- **Just trust someone** → there is no one everyone trusts.

### What MPC does

Multi-Party Computation lets the parties compute the output of a function without any party learning anyone else's input. The hospitals learn the total. Nobody learns the individual counts. There is no central server. There is no trusted third party. The protocol itself enforces privacy — mathematically.

### Why Shamir SSS enables this specifically

When you secret-share your number as a polynomial, the shares are individually meaningless — they look like random field elements. But shares have the **additive homomorphism** property: if you add together one share from each party's polynomial, the result is itself a share of the *sum* of all secrets. So each hospital can compute a local sum over the shares it holds, broadcast that result, and Lagrange interpolation over those broadcasted values reconstructs the total — and only the total.

The insight is that the computation happens *inside* the secret sharing scheme. The math collapses in a way that produces the answer without ever assembling the inputs in one place.

### The security guarantee

It's **information-theoretic** — not computational. With fewer than *t* shares you don't just lack the computing power to break it. You literally have **zero information**. Every possible secret is equally consistent with the shares you hold. No quantum computer, no algorithmic breakthrough, no amount of time changes this. That's a fundamentally stronger guarantee than "it would take a billion years to brute force."

That's why MPC matters, and why this demo is worth building.

---

## The Five Hospitals

| ID | Institution | Pre-seeded Enrollment |
|----|-------------|----------------------|
| 1 | Geneva Medical Institute | 1,247 |
| 2 | Seoul Research Center | 983 |
| 3 | Johns Hopkins Clinical Division | 2,104 |
| 4 | Lagos University Hospital | 761 |
| 5 | São Paulo Clinical Center | 1,589 |

All counts are user-editable (1–9,999). The total is never revealed until the protocol completes.

---

## Cryptographic Primitives

| Primitive | Implementation |
|-----------|---------------|
| **Finite field** | GF(2⁶¹ − 1) — Mersenne prime, large enough for 5 × 9,999 = 49,995 |
| **Secret sharing** | Shamir SSS with threshold t = 3, parties n = 5 |
| **Reconstruction** | Lagrange interpolation over GF(p) |
| **Homomorphism** | Additive — share-level addition produces shares of the sum |
| **RNG** | `getrandom` crate with `wasm_js` feature (browser CSPRNG) |
| **Modular inverse** | Fermat's little theorem: a⁻¹ = a^(p−2) mod p |
| **Overflow prevention** | u128 intermediate values for multiplication before Mersenne reduction |

All arithmetic is real. No simulated math. No hand-waving. Every primitive is implemented and tested.

---

## Six Exhibits

The demo is structured as a step-through navigator. Users advance manually — nothing auto-plays.

1. **The Problem** — five hospital cards with locked enrollments, naive-vs-MPC diagram
2. **Private Input** — editable enrollment counts with per-hospital lock-in mechanic
3. **Secret Sharing** — polynomial construction, random coefficients, computed shares, curve visualization
4. **Share Distribution** — 5×5 share matrix, peer-to-peer flow diagram
5. **Computation & Reconstruction** — local sums, Lagrange interpolation with formula and real values, total reveal with cross-check verification
6. **Coalition Attack** — select up to 2 colluders, watch the attack fail, multi-curve visualization of the underdetermined system, threshold analysis

---

## Architecture

```
crypto-lab-silent-tally/
├── Cargo.toml              # Rust crate: wasm-bindgen + getrandom
├── src/
│   └── lib.rs              # GF(p) arithmetic, Shamir SSS, Lagrange interpolation
├── pkg/                    # wasm-pack output (gitignored)
├── src-ts/
│   ├── main.ts             # App entry, exhibit navigation, state management
│   ├── wasm.ts             # WASM init and typed bindings
│   ├── types.ts            # Hospital, ShareData, AppState interfaces
│   ├── style.css           # Tailwind entry
│   └── exhibits/
│       ├── exhibit1.ts     # The Problem
│       ├── exhibit2.ts     # Private Input
│       ├── exhibit3.ts     # Secret Sharing
│       ├── exhibit4.ts     # Share Distribution
│       ├── exhibit5.ts     # Computation & Reconstruction
│       └── exhibit6.ts     # Coalition Attack
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

**Stack:** Rust → WASM (via `wasm-pack`) + Vite + TypeScript (strict) + Tailwind CSS v4 → GitHub Pages

---

## Build

```bash
# Prerequisites: Rust, wasm-pack, Node.js ≥ 18

# Build WASM
wasm-pack build --target web --out-dir pkg

# Install frontend dependencies
npm install

# Development server
npm run dev

# Production build
npm run build
```

---

## The Shamir Trilogy

Three projects in the crypto-lab collection use Shamir's construction over three different fields for three fundamentally different cryptographic applications:

| Project | Field | Application |
|---------|-------|-------------|
| [quantum-vault-kpqc](https://github.com/systemslibrarian/quantum-vault-kpqc) | GF(2⁸) | Key splitting — XOR-based secret sharing for byte-level data |
| [frost-threshold](https://github.com/systemslibrarian/frost-threshold) | Ed25519 scalar field | Threshold signatures — distributed signing without key assembly |
| **silent-tally** | GF(2⁶¹ − 1) | Arithmetic MPC — secure sum computation via additive homomorphism |

Same mathematical idea. Three fundamentally different cryptographic applications.

---

## Status

This is a demonstration and educational tool. The cryptographic primitives are standard, publicly vetted algorithms (Shamir SSS, Lagrange interpolation, Mersenne prime field arithmetic). The implementation has not been externally audited. Do not use this code in production security-critical systems without a professional audit.

---

*So whether you eat or drink or whatever you do, do it all for the glory of God.* — 1 Corinthians 10:31

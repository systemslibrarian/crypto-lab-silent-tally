# Contributing to silent-tally

Thanks for your interest! This is an educational demo of Multi-Party Computation,
so contributions that improve **clarity**, **correctness**, or **accessibility**
are especially welcome.

## Project layout

```
src/lib.rs            Rust GF(p) field + Shamir/Lagrange core (compiled to WASM)
src-ts/field.ts       Pure-TS reference of the same math (mirrors src/lib.rs)
src-ts/exhibits/      The six interactive exhibits (one file each)
src-ts/main.ts        App shell: navigation, theming, WASM init
```

The cryptographic logic lives in **two** places that must stay in agreement:
`src/lib.rs` (the WASM core the app actually runs) and `src-ts/field.ts` (a pure
TypeScript reference used by the UI and unit-tested in Node). If you change the
math in one, change it in the other and keep the shared test vectors passing.

## Prerequisites

- [Rust](https://rustup.rs/) with `wasm-pack`, `clippy`, and `rustfmt`
- [Node.js](https://nodejs.org/) 22+

```bash
rustup component add clippy rustfmt
cargo install wasm-pack   # or: cargo binstall wasm-pack
npm install
```

## Local workflow

```bash
npm run wasm     # build the WASM core into pkg/ (required before dev/build)
npm run dev      # start the Vite dev server
```

## Before opening a pull request

Run the same checks CI runs — all must pass:

```bash
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
npx tsc --noEmit
npm test
```

## Conventions

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Keep exhibits self-contained and accessible (semantic HTML, ARIA labels,
  keyboard navigation, and `prefers-reduced-motion` support).
- This is a **demo, not an audited library** — don't add claims of production
  readiness.

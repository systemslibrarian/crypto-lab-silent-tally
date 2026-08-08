import type { AppState } from '../types.js';
import { wasm } from '../wasm.js';
import { THRESHOLD, N_PARTIES } from '../types.js';
import { formatBigint } from '../format.js';
import { toyShares, TOY_P } from '../toyfield.js';

export function computeShares(state: AppState): void {
  if (state.shareData.size > 0) return; // already computed
  for (const h of state.hospitals) {
    const result = wasm.generate_shares(BigInt(h.count), THRESHOLD, N_PARTIES);
    const coefficients: bigint[] = [];
    for (let i = 0; i < THRESHOLD - 1; i++) {
      coefficients.push(result[i]);
    }
    const shares: bigint[] = [];
    for (let i = THRESHOLD - 1; i < THRESHOLD - 1 + N_PARTIES; i++) {
      shares.push(result[i]);
    }
    state.shareData.set(h.id, { coefficients, shares });
  }
}

export function renderExhibit3(container: HTMLElement, state: AppState): void {
  computeShares(state);

  const hospitalSections = state.hospitals.map(h => {
    const data = state.shareData.get(h.id)!;
    const secret = BigInt(h.count);

    return `
      <div class="bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
        <div class="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <div>
            <span class="text-xs font-mono text-gray-500">Hospital ${h.id}</span>
            <div class="text-sm font-medium text-white">${h.name}</div>
          </div>
          <span class="text-xs font-mono text-amber-400" title="Lab control — not visible to any party in the protocol">
            secret = ${h.count}
            <span class="text-[10px] text-gray-500">(omniscient view)</span>
          </span>
        </div>
        <div class="p-4 space-y-3">
          <div class="font-mono text-xs text-gray-400">
            <span class="text-indigo-400">f(x)</span> = ${secret.toString()}
            + ${formatBigint(data.coefficients[0])}·x
            + ${formatBigint(data.coefficients[1])}·x²
            <span class="text-gray-400">(mod p)</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2" role="list" aria-label="Shares for Hospital ${h.id}">
            ${data.shares.map((s, i) => `
              <div class="bg-gray-950 rounded p-2 text-center" role="listitem">
                <div class="text-[10px] text-gray-400 font-mono">f(${i + 1})</div>
                <!-- No aria-label here. It was PROHIBITED (a plain div is
                     role=generic, so browsers discard the name and axe files it
                     under "incomplete", never as a violation) and it was
                     redundant besides: the visible "f(N)" above already says
                     which share this is. Had it been honoured it would have been
                     actively harmful, replacing the share value with the words
                     "Share f(N) value". The listitem reads f(N) then the
                     abbreviated value. -->
                <div class="text-xs text-emerald-400 font-mono break-all">${formatBigint(s)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // -------------------------------------------------------------------------
  // Honest curve visualization.
  //
  // The live protocol runs over GF(2^61 - 1): each real share (shown in the
  // tables below) is a ~19-digit field element sitting in an effectively random
  // spot. Plotting those raw values on a linear axis produces a meaningless
  // zigzag that looks nothing like a parabola — so instead we render the SAME
  // Shamir math over a tiny prime (p = 97, small secret) where the degree-2
  // curve is actually visible, with f(0) = secret marked. This teaches the true
  // shape without weakening the real demo.
  // -------------------------------------------------------------------------
  const toySecret = 8n; // small, human-readable secret for the illustration
  const toy = toyShares(toySecret, THRESHOLD, N_PARTIES); // f(x) = 8 + 2x + x² (mod 97)

  // Continuous parabola f(x) = 8 + 2x + x² over the *reals* (identical
  // coefficients to the toy sharing). For x in 1..5 the values stay below the
  // toy prime 97, so the GF(97) share points sit EXACTLY on this smooth curve —
  // an honest picture of a degree-2 polynomial and its shares.
  const realAt = (x: number) => 8 + 2 * x + x * x; // f over the reals
  const maxReal = realAt(5); // = 43
  const PXL = { x0: 55, x1: 380, y0: 175, y1: 25 };
  const sx = (x: number) => PXL.x0 + (x / 5) * (PXL.x1 - PXL.x0);
  const sy = (v: number) => PXL.y0 - (v / maxReal) * (PXL.y0 - PXL.y1);

  container.innerHTML = `
    <div class="space-y-8">
      <div>
        <h2 class="text-2xl font-bold text-white mb-2">Each hospital splits its secret into shares.</h2>
        <p class="text-gray-400 text-sm font-mono">Exhibit 3 of 6 — Secret Sharing</p>
      </div>

      <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <p class="text-gray-300 text-sm leading-relaxed">
          Each hospital constructs a random degree-2 polynomial <code class="text-indigo-400">f(x) = s + a₁x + a₂x²</code>
          over GF(p) where p = 2⁶¹ − 1. The secret is <code class="text-indigo-400">f(0) = s</code>.
          Five shares are evaluated: f(1) through f(5). Any 3 shares reconstruct the polynomial;
          any 2 reveal <strong class="text-white">nothing</strong> about the secret — information-theoretic security.
        </p>
      </div>

      <!-- Field wrap-around motivator: why the real share numbers look huge and random -->
      <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <h3 class="text-sm font-semibold text-gray-300 mb-2">First: what does "over GF(p)" mean?</h3>
        <p class="text-gray-300 text-sm leading-relaxed">
          All arithmetic happens <strong class="text-white">modulo a prime p</strong> — numbers live on a clock
          face of size p and <em>wrap around</em> when they pass the top. On a tiny clock of size
          <code class="text-indigo-400">p = 13</code>:
        </p>
        <p class="font-mono text-sm text-emerald-400 mt-2 text-center">8 + 7 = 15 → 15 − 13 = <strong>2</strong> &nbsp;&nbsp;(mod 13)</p>
        <p class="text-gray-400 text-sm leading-relaxed mt-2">
          The real demo uses <code class="text-indigo-400">p = 2⁶¹ − 1</code> (≈ 2.3 × 10¹⁸), so every share is a
          near-random 19-digit number on an astronomically large clock. That wrap-around is exactly what makes an
          individual share <strong class="text-white">leak nothing</strong>: knowing one point tells you where a
          curve passes through one spot on the clock, but the curve could have wrapped any number of times to get
          there. Hence the giant, scrambled-looking values in the tables below.
        </p>
      </div>

      <!-- Honest curve visualization over a TOY field so the parabola is visible -->
      <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <h3 class="text-sm font-semibold text-gray-300 mb-1">What a degree-2 sharing actually looks like</h3>
        <p class="text-xs text-gray-400 mb-3">
          Same Shamir math, shrunk to a toy field <code class="text-indigo-400">p = ${TOY_P}</code> with secret
          <code class="text-amber-400">s = ${toySecret}</code> so the curve is drawable:
          <code class="text-indigo-400">f(x) = ${toySecret} + 2x + x²</code>. Over the real 2⁶¹ − 1 field the same
          five points exist — they just land in random-looking spots you can't plot on a line.
        </p>
        <svg viewBox="0 0 400 200" class="w-full max-w-lg mx-auto" role="img" aria-label="The parabola f(x) = 8 + 2x + x squared drawn over the real numbers, with the five GF(97) share points f(1) through f(5) plotted on top of it. They sit exactly on the curve only because f(1) through f(5) are all below 97, so nothing wraps; the secret f(0) equals 8 is marked on the vertical axis. Three points are enough to pin down the whole parabola.">
          <!-- Axes -->
          <line class="svg-axis" x1="55" y1="175" x2="380" y2="175" stroke-width="1"/>
          <line class="svg-axis" x1="55" y1="175" x2="55" y2="20" stroke-width="1"/>
          <text class="svg-text-muted" x="215" y="195" text-anchor="middle" font-size="10">x (party index)</text>
          <text class="svg-text-muted" x="18" y="100" text-anchor="middle" font-size="10" transform="rotate(-90 18 100)">f(x) mod ${TOY_P}</text>
          <!-- Smooth parabola through the reals 0..5 -->
          ${(() => {
            const pts: string[] = [];
            for (let s = 0; s <= 100; s++) {
              const x = (s / 100) * 5;
              pts.push(`${sx(x).toFixed(1)},${sy(realAt(x)).toFixed(1)}`);
            }
            return `<polyline class="svg-curve" points="${pts.join(' ')}" fill="none" stroke-width="2"/>`;
          })()}
          <!-- Share points f(1..5) sitting exactly on the curve -->
          ${toy.shares.map((s, i) => {
            const x = i + 1;
            const px = sx(x);
            const py = sy(realAt(x));
            return `
              <circle class="svg-point" cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4.5" stroke-width="1.5"/>
              <text class="svg-point-label" x="${px.toFixed(1)}" y="${(py - 9).toFixed(1)}" text-anchor="middle" font-size="9">f(${x})=${s}</text>
            `;
          }).join('')}
          <!-- f(0) = secret, revealed on the toy axis (the real one stays hidden) -->
          <circle class="svg-secret" cx="55" cy="${sy(Number(toySecret)).toFixed(1)}" r="6" stroke-width="1.5"/>
          <text class="svg-secret-label" x="63" y="${(sy(Number(toySecret)) - 8).toFixed(1)}" font-size="10">f(0) = ${toySecret} (secret)</text>
        </svg>
        <p class="text-xs text-gray-400 mt-2 text-center">
          A genuine parabola: the 5 green share points lie exactly on it, and the secret is
          <strong class="text-amber-400">f(0)</strong>. Any 3 of these points pin down the whole degree-2 curve —
          so any 3 reconstruct the secret, while 2 leave one possible curve for every secret in the field
          (you'll play that out for real in Exhibit 6).
        </p>
        <p class="text-xs text-amber-400/90 leading-relaxed mt-3 bg-amber-950/20 border border-amber-900/40 rounded-lg p-3">
          <strong class="text-amber-300">The smoothness is a coincidence of the numbers, not a property of the field.</strong>
          The curve above is f(x) = ${toySecret} + 2x + x² plotted over the <em>reals</em>. The GF(${TOY_P}) share values
          land on it exactly only because f(1) … f(5) = ${toy.shares.join(', ')} all happen to stay below
          ${TOY_P} — nothing wraps, so mod ${TOY_P} does nothing here. Push the secret or the coefficients up and the
          points start wrapping past ${TOY_P} and scatter off the curve, which is precisely what the real 2⁶¹ − 1
          shares do. A finite field has no notion of "smooth"; the picture is a teaching aid for the algebra of degree,
          not a portrait of GF(${TOY_P}).
        </p>
      </div>

      <!-- All hospital share tables -->
      <div class="space-y-4">
        <h3 class="text-sm font-semibold text-gray-300">Share tables — all 5 hospitals (25 shares total)</h3>
        <p class="text-xs text-amber-400/90 leading-relaxed bg-amber-950/20 border border-amber-900/40 rounded-lg p-3">
          <strong class="text-amber-300">Omniscient view.</strong> Each card prints its hospital's plaintext count and
          the polynomial's constant term beside the shares. <em>No party in the protocol can see that column</em> —
          you can only see it because you are outside the protocol, holding the dealer's notes. Each hospital knows
          its own count and the 5 shares it was handed; nobody else learns either. Exhibit 6 lets you play the
          attacker with only the share values, which is the view that actually matters.
        </p>
        ${hospitalSections}
      </div>
    </div>
  `;
}

export function canAdvanceExhibit3(): boolean {
  return true;
}

import type { AppState } from '../types.js';
import { formatBigint } from '../format.js';
import { wasm } from '../wasm.js';
import { THRESHOLD, N_PARTIES } from '../types.js';

/**
 * The coalition can grow to n − 1 members: one hospital must stay outside it to
 * be the victim. That range straddles the threshold (t = 3), so the learner can
 * drive the guarantee to BOTH outcomes — 2 colluders watch reconstruction miss,
 * 3 watch it land on the victim's real count.
 */
const MAX_COALITION = N_PARTIES - 1;

export function renderExhibit6(container: HTMLElement, state: AppState, onStateChange: () => void): void {
  const coalition = state.coalitionSelection;
  const coalitionArr = Array.from(coalition).sort((a, b) => a - b);

  // Get the shares available to the coalition for a target hospital
  // The coalition tries to learn the secret of a non-coalition hospital
  const target = state.hospitals.find(h => !coalition.has(h.id)) ?? state.hospitals[0];
  const targetId = target.id;
  const targetData = state.shareData.get(targetId)!;

  // Shares of the target's polynomial held by the coalition members
  const coalitionShares = coalitionArr.map(id => ({
    partyId: id,
    share: targetData.shares[id - 1],
  }));

  // ---------------------------------------------------------------------
  // THE ACTUAL ATTACK. Not a lookup table on coalition size: we hand the
  // coalition's real shares to the same Lagrange routine Exhibit 5 uses and
  // interpolate at x = 0. With k < t points that yields the degree-(k−1)
  // curve through them, which is a *different* polynomial from the dealer's
  // degree-2 one — so f(0) comes out wrong. With k ≥ t points it is the
  // dealer's polynomial, and f(0) is the secret. Every verdict below reads
  // off `attackSucceeded`, never off coalitionArr.length.
  // ---------------------------------------------------------------------
  const trueSecret = BigInt(target.count);
  const recovered: bigint | null =
    coalitionArr.length > 0
      ? wasm.lagrange_interpolate(
          new BigUint64Array(coalitionArr.map(id => BigInt(id))),
          new BigUint64Array(coalitionShares.map(cs => cs.share)),
        )
      : null;
  const attackSucceeded = recovered !== null && recovered === trueSecret;

  container.innerHTML = `
    <div class="space-y-8">
      <div>
        <h2 class="text-2xl font-bold text-white mb-2">What if hospitals collude?</h2>
        <p class="text-gray-400 text-sm font-mono">Exhibit 6 of 6 — Coalition Attack</p>
      </div>

      <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <p class="text-gray-300 text-sm leading-relaxed">
          Select up to <strong class="text-white">${MAX_COALITION} hospitals</strong> to form a coalition. They pool the
          shares they hold of another hospital's polynomial and run Lagrange interpolation at x = 0 — the same
          routine Exhibit 5 used, on their real share values. Threshold is t = ${THRESHOLD}, so the run is live in
          both directions: below t the interpolation returns the wrong number, at or above t it returns the victim's
          count exactly. Add and remove colluders and watch the guarantee hold, then collapse.
        </p>
      </div>

      <!-- Hospital selection -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" id="coalition-cards" role="group" aria-label="Select hospitals for coalition">
        ${state.hospitals.map(h => {
          const selected = coalition.has(h.id);
          // At the cap, the last hospital must stay outside — it is the victim.
          const full = !selected && coalition.size >= MAX_COALITION;
          return `
            <button
              class="rounded-xl p-4 border-2 text-center transition-all min-h-[44px]
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950
                ${selected
                  ? 'bg-red-950/30 border-red-600 ring-1 ring-red-500/30 cursor-pointer'
                  : full
                    ? 'bg-gray-900 border-gray-800 opacity-50 cursor-not-allowed'
                    : 'bg-gray-900 border-gray-700 hover:border-gray-500 cursor-pointer'}"
              data-coalition-id="${h.id}"
              aria-pressed="${selected}"
              ${full ? 'aria-disabled="true"' : ''}
              aria-label="${h.name}${selected ? ' — in coalition' : full ? ' — cannot join, this hospital is the victim' : ''}"
            >
              <div class="text-2xl mb-1" aria-hidden="true">${selected ? '🕵️' : '🏥'}</div>
              <div class="text-xs font-medium ${selected ? 'text-red-300' : 'text-white'}">${h.name.split(' ')[0]}</div>
              <div class="text-[10px] mt-1 ${selected ? 'text-red-400' : 'text-gray-400'}">
                ${selected ? 'In coalition' : full ? 'The victim' : 'Click to add'}
              </div>
            </button>
          `;
        }).join('')}
      </div>

      ${coalitionArr.length === 0 ? `
        <div class="bg-gray-900 rounded-xl p-8 border border-gray-700 text-center">
          <p class="text-gray-500 text-sm">Select up to ${MAX_COALITION} hospitals above to simulate a coalition attack.</p>
        </div>
      ` : ''}

      ${coalitionArr.length > 0 ? `
        <!-- Coalition's knowledge -->
        <div class="bg-red-950/20 rounded-xl p-5 border border-red-900/40 space-y-4">
          <h3 class="text-sm font-semibold text-red-400">
            Coalition: Hospital${coalitionArr.length > 1 ? 's' : ''} ${coalitionArr.join(' & ')}
            — attacking Hospital ${targetId} (${state.hospitals.find(h => h.id === targetId)!.name.split(' ')[0]})
          </h3>

          <div class="space-y-2">
            <p class="text-xs text-gray-400">Shares of Hospital ${targetId}'s polynomial known to the coalition:</p>
            ${coalitionShares.map(cs => `
              <div class="bg-gray-950 rounded p-2 font-mono text-xs">
                <span class="text-gray-500">f(${cs.partyId}) =</span>
                <span class="text-red-400">${formatBigint(cs.share)}</span>
              </div>
            `).join('')}
          </div>

          <!-- =============================================================== -->
          <!-- LIVE RECONSTRUCTION — the verdict is this computation's output.  -->
          <!-- =============================================================== -->
          <div class="bg-gray-950 rounded-lg p-4 border ${attackSucceeded ? 'border-red-600' : 'border-red-900/30'} space-y-3"
               role="status" aria-live="polite">
            <div class="font-mono text-xs text-gray-400 space-y-1">
              <p class="text-gray-500">
                Lagrange-interpolating the coalition's ${coalitionArr.length}
                share${coalitionArr.length === 1 ? '' : 's'} at x = 0:
              </p>
              <p>
                (${coalitionShares.map(cs => `${cs.partyId}, ${formatBigint(cs.share)}`).join('), (')})
              </p>
              <p class="pt-2 border-t border-gray-800">
                <span class="text-gray-500">coalition's reconstruction f(0) =</span>
                <span class="${attackSucceeded ? 'text-red-400' : 'text-gray-300'} font-bold">${recovered!.toString()}</span>
              </p>
              <p>
                <span class="text-gray-500">Hospital ${targetId}'s real count =</span>
                <span class="text-amber-400 font-bold">${target.count.toLocaleString()}</span>
                <span class="text-gray-600">(omniscient view — the coalition never sees this line)</span>
              </p>
            </div>

            ${attackSucceeded ? `
              <p class="text-red-400 text-sm font-medium">
                ✗ Guarantee broken. ${coalitionArr.length} colluders ≥ threshold t = ${THRESHOLD}: the interpolation
                landed on Hospital ${targetId}'s real count, to the digit. ${coalitionArr.length} points pin down a
                degree-${THRESHOLD - 1} polynomial uniquely, and f(0) is the secret. Nothing here is asserted — that
                number came out of the same <code>lagrange_interpolate</code> Exhibit 5 used.
              </p>
            ` : `
              <p class="text-emerald-400 text-sm font-medium">
                ✓ Coalition fails. ${coalitionArr.length} point${coalitionArr.length === 1 ? '' : 's'} is below the
                threshold t = ${THRESHOLD}, so the interpolation fits a degree-${coalitionArr.length - 1} curve
                through the${coalitionArr.length === 1 ? ' one point' : 'm'} instead of the dealer's degree-${THRESHOLD - 1}
                one — and its value at x = 0 misses the secret by a field-sized margin.
              </p>
              <p class="text-xs text-gray-400 leading-relaxed">
                The miss is not the point; a lucky hit would be. With ${coalitionArr.length} of ${THRESHOLD} points, the
                remaining ${THRESHOLD - coalitionArr.length} coefficient${THRESHOLD - coalitionArr.length === 1 ? ' is' : 's are'}
                free, so <em>some</em> polynomial over GF(2⁶¹ − 1) passes through these shares for every candidate secret.
                The shares are consistent with all of them, which is why they move the attacker's belief about the count
                <strong class="text-white">not at all</strong>: whatever the coalition thought Hospital ${targetId}'s
                enrollment was before seeing the shares, they think exactly the same thing after. That — not a claim
                about which values are likely — is what information-theoretic security buys.
              </p>
            `}
          </div>

          ${coalitionArr.length === 2 ? `
            <!-- Multi-curve visualization -->
            <div class="bg-gray-950 rounded-lg p-4 border border-gray-800">
              <h4 class="text-xs font-semibold text-gray-400 mb-3">
                Multiple valid polynomials through the 2 known points
              </h4>
              ${(() => {
                // Honest visualization: draw real parabolas that each pass
                // EXACTLY through the coalition's two known points but cross the
                // f(0) axis at a different height — so every secret is possible.
                //
                // Coordinates: x in [0,6] → pixels; an abstract display height
                // VMAX → pixels. The two known points sit at fixed display
                // heights (their true field values are ~2^61 and meaningless on
                // a small linear axis; what matters is that they are *fixed*).
                const VMAX = 10;
                const px = (x: number) => 50 + (x / 6) * 330;
                const py = (v: number) => 170 - (Math.max(0, Math.min(VMAX, v)) / VMAX) * 150;

                const [x1, x2] = [coalitionShares[0].partyId, coalitionShares[1].partyId];
                // Fixed (but data-seeded) display heights for the two points.
                const y1 = 2.4 + Number(coalitionShares[0].share % 520n) / 100;
                const y2 = 2.4 + Number(coalitionShares[1].share % 520n) / 100;

                // Real Lagrange quadratic through (0,c), (x1,y1), (x2,y2).
                const curveAt = (c: number, x: number) => {
                  const L0 = ((x - x1) * (x - x2)) / ((0 - x1) * (0 - x2));
                  const L1 = (x * (x - x2)) / ((x1 - 0) * (x1 - x2));
                  const L2 = (x * (x - x1)) / ((x2 - 0) * (x2 - x1));
                  return c * L0 + y1 * L1 + y2 * L2;
                };

                const colors = ['#818cf8', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#22d3ee'];
                const intercepts = [9.2, 7.6, 6.0, 4.4, 2.8, 1.2];
                const curves = intercepts.map((c, idx) => {
                  const pts: string[] = [];
                  for (let s = 0; s <= 60; s++) {
                    const x = (s / 60) * 6;
                    pts.push(`${px(x).toFixed(1)},${py(curveAt(c, x)).toFixed(1)}`);
                  }
                  return `<polyline points="${pts.join(' ')}" fill="none" stroke="${colors[idx % colors.length]}" stroke-width="1.3" opacity="0.75"/>
                    <circle cx="${px(0).toFixed(1)}" cy="${py(c).toFixed(1)}" r="2.5" fill="${colors[idx % colors.length]}"/>`;
                }).join('');

                const knownPoints = coalitionShares.map((cs, i) => {
                  const yv = i === 0 ? y1 : y2;
                  return `<circle class="svg-danger" cx="${px(cs.partyId).toFixed(1)}" cy="${py(yv).toFixed(1)}" r="5" stroke-width="1.5"/>
                    <text class="svg-danger-label" x="${px(cs.partyId).toFixed(1)}" y="${(py(yv) - 9).toFixed(1)}" text-anchor="middle" font-size="8">f(${cs.partyId}) known</text>`;
                }).join('');

                return `
                <svg viewBox="0 0 400 200" class="w-full max-w-lg mx-auto" role="img" aria-label="Six polynomial curves each passing through the coalition's two known share points but crossing the f(0) axis at six different heights, showing that every secret is equally consistent with two shares">
                  <!-- Axes -->
                  <line class="svg-axis" x1="50" y1="170" x2="380" y2="170" stroke-width="1"/>
                  <line class="svg-axis" x1="50" y1="170" x2="50" y2="20" stroke-width="1"/>
                  <text class="svg-text-muted" x="215" y="193" text-anchor="middle" font-size="10">x (party index)</text>
                  <!-- f(0) axis highlight: every curve crosses here at a different point -->
                  <rect class="svg-danger-mark" x="46" y="22" width="8" height="148" opacity="0.12" rx="3"/>
                  <text class="svg-danger-label" x="50" y="16" text-anchor="middle" font-size="8">f(0) = ?</text>
                  ${curves}
                  ${knownPoints}
                  <text class="svg-text-muted" x="380" y="16" text-anchor="end" font-size="7">6 curves · 1 pair of points · 6 different secrets</text>
                </svg>`;
              })()}
              <p class="text-xs text-gray-500 mt-2 text-center">
                Every curve passes through <strong class="text-gray-400">both</strong> red points the colluders hold,
                yet each crosses the f(0) axis at a different height. With only 2 points, the secret is
                genuinely undetermined — these are real polynomials, not an artist's impression.
              </p>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- Threshold analysis -->
      <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <h3 class="text-sm font-semibold text-amber-400 mb-2">Where the guarantee ends</h3>
        <p class="text-gray-300 text-sm leading-relaxed">
          Threshold t = ${THRESHOLD} is the whole boundary, and the selector above walks you across it: add a third
          colluder and the reconstruction stops missing. ${THRESHOLD} points uniquely determine a
          degree-${THRESHOLD - 1} polynomial, so f(0) falls out. This is why threshold selection matters. In practice,
          t &gt; n/2 is common (a strict majority must collude to break privacy). Our t = ${THRESHOLD} out of
          n = ${N_PARTIES} means a majority coalition is required — 60% of participants.
        </p>
        <p class="text-gray-400 text-sm mt-2 leading-relaxed">
          Below the threshold the guarantee is <strong class="text-white">information-theoretic</strong> — not
          computational. Fewer than t shares does not mean you lack the computing power to break it. For every
          candidate secret there is a polynomial through the shares you hold, so the shares rule nothing out and
          your posterior belief about the count equals your prior. No quantum computer, no algorithmic breakthrough,
          no amount of time changes that — a fundamentally stronger guarantee than "it would take a billion years
          to brute force." What it is <em>not</em> is a guarantee about the count itself: the learner was asked in
          Exhibit 2 for an integer in [1, 9,999], and that public constraint is knowledge the coalition already had.
          Secret sharing promises to add nothing to it, not to erase it.
        </p>
      </div>
    </div>
  `;

  // Attach coalition selection handlers
  const buttons = container.querySelectorAll('[data-coalition-id]');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.getAttribute('data-coalition-id')!, 10);
      if (coalition.has(id)) {
        coalition.delete(id);
      } else if (coalition.size < MAX_COALITION) {
        coalition.add(id);
      }
      onStateChange();
      // The whole exhibit re-renders, so restore focus to the same card the
      // user just activated (keyboard/screen-reader users keep their place).
      const refreshed = container.querySelector<HTMLElement>(`[data-coalition-id="${id}"]`);
      refreshed?.focus();
    });
  });
}

export function canAdvanceExhibit6(): boolean {
  return true;
}

import type { AppState } from '../types.js';
import { formatBigint } from '../format.js';

export function renderExhibit6(container: HTMLElement, state: AppState, onStateChange: () => void): void {
  const coalition = state.coalitionSelection;
  const coalitionArr = Array.from(coalition);

  // Get the shares available to the coalition for a target hospital
  // The coalition tries to learn the secret of a non-coalition hospital
  const targetId = state.hospitals.find(h => !coalition.has(h.id))?.id ?? 1;
  const targetData = state.shareData.get(targetId)!;

  // Shares of the target's polynomial held by the coalition members
  const coalitionShares = coalitionArr.map(id => ({
    partyId: id,
    share: targetData.shares[id - 1],
  }));

  container.innerHTML = `
    <div class="space-y-8">
      <div>
        <h2 class="text-2xl font-bold text-white mb-2">What if hospitals collude?</h2>
        <p class="text-gray-400 text-sm font-mono">Exhibit 6 of 6 — Coalition Attack</p>
      </div>

      <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <p class="text-gray-300 text-sm leading-relaxed">
          Select up to <strong class="text-white">2 hospitals</strong> to form a coalition. They will pool their shares
          and attempt to learn another hospital's private enrollment count. With threshold t = 3,
          two colluders hold only 2 points on a degree-2 polynomial — an underdetermined system.
        </p>
      </div>

      <!-- Hospital selection -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" id="coalition-cards" role="group" aria-label="Select hospitals for coalition">
        ${state.hospitals.map(h => {
          const selected = coalition.has(h.id);
          return `
            <button
              class="rounded-xl p-4 border-2 text-center transition-all cursor-pointer min-h-[44px]
                focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950
                ${selected
                  ? 'bg-red-950/30 border-red-600 ring-1 ring-red-500/30'
                  : 'bg-gray-900 border-gray-700 hover:border-gray-500'}"
              data-coalition-id="${h.id}"
              aria-pressed="${selected}"
              aria-label="${h.name}${selected ? ' — in coalition' : ''}"
            >
              <div class="text-2xl mb-1" aria-hidden="true">${selected ? '🕵️' : '🏥'}</div>
              <div class="text-xs font-medium ${selected ? 'text-red-300' : 'text-white'}">${h.name.split(' ')[0]}</div>
              <div class="text-[10px] mt-1 ${selected ? 'text-red-400' : 'text-gray-400'}">
                ${selected ? 'In coalition' : 'Click to add'}
              </div>
            </button>
          `;
        }).join('')}
      </div>

      ${coalitionArr.length === 0 ? `
        <div class="bg-gray-900 rounded-xl p-8 border border-gray-700 text-center">
          <p class="text-gray-500 text-sm">Select up to 2 hospitals above to simulate a coalition attack.</p>
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

          ${coalitionArr.length === 1 ? `
            <div class="bg-gray-950 rounded-lg p-4 border border-red-900/30">
              <p class="text-red-400 text-sm font-medium">
                ✗ Coalition fails. 1 point on a degree-2 polynomial is completely useless.
                The secret could be any value in GF(p) — that's 2⁶¹ − 1 possibilities, all equally likely.
              </p>
            </div>
          ` : ''}

          ${coalitionArr.length === 2 ? `
            <div class="bg-gray-950 rounded-lg p-4 border border-red-900/30 space-y-3">
              <p class="text-red-400 text-sm font-medium">
                ✗ Coalition fails. 2 points cannot define a degree-2 polynomial.
                The missing share could be any value in GF(p). Information-theoretic security.
              </p>
              <p class="text-xs text-gray-400">
                The colluders know f(${coalitionArr[0]}) and f(${coalitionArr[1]}). But a degree-2 polynomial
                has 3 unknowns (a₀, a₁, a₂). With only 2 equations, exactly one polynomial passes through
                these points for <em>every</em> candidate secret f(0) — all 2⁶¹ − 1 of them, equally likely.
                The colluders cannot distinguish them.
              </p>
            </div>

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
                  return `<circle cx="${px(cs.partyId).toFixed(1)}" cy="${py(yv).toFixed(1)}" r="5" fill="#ef4444" stroke="#7f1d1d" stroke-width="1.5"/>
                    <text x="${px(cs.partyId).toFixed(1)}" y="${(py(yv) - 9).toFixed(1)}" text-anchor="middle" fill="#fca5a5" font-size="8">f(${cs.partyId}) known</text>`;
                }).join('');

                return `
                <svg viewBox="0 0 400 200" class="w-full max-w-lg mx-auto" role="img" aria-label="Six polynomial curves each passing through the coalition's two known share points but crossing the f(0) axis at six different heights, showing that every secret is equally consistent with two shares">
                  <!-- Axes -->
                  <line x1="50" y1="170" x2="380" y2="170" stroke="#374151" stroke-width="1"/>
                  <line x1="50" y1="170" x2="50" y2="20" stroke="#374151" stroke-width="1"/>
                  <text x="215" y="193" text-anchor="middle" fill="#6b7280" font-size="10">x (party index)</text>
                  <!-- f(0) axis highlight: every curve crosses here at a different point -->
                  <rect x="46" y="22" width="8" height="148" fill="#ef4444" opacity="0.12" rx="3"/>
                  <text x="50" y="16" text-anchor="middle" fill="#ef4444" font-size="8">f(0) = ?</text>
                  ${curves}
                  ${knownPoints}
                  <text x="380" y="16" text-anchor="end" fill="#6b7280" font-size="7">6 curves · 1 pair of points · 6 different secrets</text>
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
        <h3 class="text-sm font-semibold text-amber-400 mb-2">What about 3 colluders?</h3>
        <p class="text-gray-300 text-sm leading-relaxed">
          With threshold t = 3, three colluding hospitals <strong class="text-white">would succeed</strong>.
          Three points uniquely define a degree-2 polynomial, allowing them to reconstruct f(0) — the secret.
          This is why threshold selection matters. In practice, t &gt; n/2 is common (a strict majority must
          collude to break privacy). Our t = 3 out of n = 5 means a majority coalition is required — 60% of participants.
        </p>
        <p class="text-gray-400 text-sm mt-2 leading-relaxed">
          The security guarantee is <strong class="text-white">information-theoretic</strong> — not computational.
          With fewer than t shares, you don't just lack the computing power to break it. You literally have
          <em>zero information</em>. Every possible secret is equally consistent with the shares you hold.
          No quantum computer, no algorithmic breakthrough, no amount of time can help. That's a
          fundamentally stronger guarantee than "it would take a billion years to brute force."
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
      } else if (coalition.size < 2) {
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

import type { AppState } from '../types.js';
import { wasm } from '../wasm.js';
import { formatBigint } from '../format.js';
import { lagrangeBasisAtZero } from '../field.js';

export function computeLocalSums(state: AppState): void {
  if (state.localSums.length > 0) return;

  // Each party j sums the shares it received from all 5 hospitals
  for (let j = 0; j < 5; j++) {
    let sum = 0n;
    for (const h of state.hospitals) {
      const data = state.shareData.get(h.id)!;
      sum = wasm.gf_add(sum, data.shares[j]);
    }
    state.localSums.push(sum);
  }
}

/**
 * View-only interaction state for exhibit 5. Not part of the protocol — just
 * which party column the homomorphism walk-through is focused on, and which
 * subset of local sums the learner has selected for reconstruction.
 */
interface Ex5UI {
  homParty: number;          // 1..5 — which x= column the additive walk-through highlights
  reconSel: Set<number>;     // chosen party indices (1..5) for the Lagrange chooser
}

let ui: Ex5UI | null = null;

export function renderExhibit5(container: HTMLElement, state: AppState): void {
  computeLocalSums(state);
  if (!ui) ui = { homParty: 3, reconSel: new Set([1, 2, 3]) };

  const expectedTotal = state.hospitals.reduce((acc, h) => acc + h.count, 0);

  // Canonical reconstruction using the first 3 parties (threshold = 3).
  const xVals = new BigUint64Array([1n, 2n, 3n]);
  const yVals = new BigUint64Array([state.localSums[0], state.localSums[1], state.localSums[2]]);
  const reconstructed = wasm.lagrange_interpolate(xVals, yVals);
  state.reconstructedTotal = Number(reconstructed);

  const lagrangeCoeffs = lagrangeBasisAtZero([1n, 2n, 3n]);

  const j = ui.homParty - 1; // 0-based party index for the highlighted column
  // The five shares party `homParty` holds — one from each hospital's polynomial.
  const colShares = state.hospitals.map(sender => state.shareData.get(sender.id)!.shares[j]);

  container.innerHTML = `
    <div class="space-y-8">
      <div>
        <h2 class="text-2xl font-bold text-white mb-2">Local sums computed. Total reconstructed. No secret revealed.</h2>
        <p class="text-gray-400 text-sm font-mono">Exhibit 5 of 6 — Computation & Reconstruction</p>
      </div>

      <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <p class="text-gray-300 text-sm leading-relaxed">
          Each hospital sums the five shares it holds — one from each party's polynomial.
          Because Shamir sharing is <strong class="text-white">additively homomorphic</strong>, these local sums
          {T₁, …, T₅} form a valid Shamir sharing of the <strong class="text-white">sum of all secrets</strong>.
          Any 3 local sums suffice to reconstruct the total via Lagrange interpolation.
        </p>
      </div>

      <!-- ============================================================= -->
      <!-- ADDITIVE HOMOMORPHISM — shown, not just asserted               -->
      <!-- ============================================================= -->
      <div class="bg-indigo-950/30 rounded-xl p-5 border border-indigo-900/40 space-y-4">
        <div>
          <h3 class="text-sm font-semibold text-indigo-300">Why this works: adding shares = sharing the sum</h3>
          <p class="text-xs text-gray-400 mt-1 leading-relaxed">
            Pick a party. Watch its local sum <strong class="text-white">T</strong> line up with the sum of secrets.
            Adding the five share-values at x&nbsp;=&nbsp;k <em>is</em> evaluating the combined polynomial
            (f₁+f₂+⋯+f₅) at x&nbsp;=&nbsp;k — because evaluation is linear.
          </p>
        </div>

        <!-- Party selector -->
        <div class="flex flex-wrap gap-2" role="group" aria-label="Choose which party's local sum to walk through">
          ${state.hospitals.map((_h, k) => {
            const sel = ui!.homParty === k + 1;
            return `
              <button type="button" data-hom-party="${k + 1}" aria-pressed="${sel}"
                aria-label="Show local sum for party ${k + 1}${sel ? ' (selected)' : ''}"
                class="px-3 py-2 rounded-lg border text-xs font-mono min-h-[44px] transition-colors
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950
                  ${sel
                    ? 'bg-indigo-600 border-indigo-400 text-white'
                    : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'}">
                x = ${k + 1}
              </button>`;
          }).join('')}
        </div>

        <!-- The two additions, side by side -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- Left: shares add to the local sum T_k -->
          <div class="bg-gray-950 rounded-lg p-4 border border-gray-800">
            <div class="text-xs text-gray-400 mb-2 font-medium">Five shares at x = ${ui.homParty}, summed in the field:</div>
            <div class="font-mono text-xs space-y-1">
              ${state.hospitals.map((h, i) => `
                <div class="flex items-center justify-between gap-2">
                  <span class="text-gray-500">f<sub>${h.id}</sub>(${ui!.homParty})</span>
                  <span class="text-indigo-300 break-all text-right">${formatBigint(colShares[i])}</span>
                </div>
              `).join('')}
              <div class="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-gray-800">
                <span class="text-emerald-400 font-semibold">T<sub>${ui.homParty}</sub> (mod p)</span>
                <span class="text-emerald-400 font-semibold break-all text-right">${formatBigint(state.localSums[j])}</span>
              </div>
            </div>
          </div>

          <!-- Right: the secrets add to the total (same structure) -->
          <div class="bg-gray-950 rounded-lg p-4 border border-gray-800">
            <div class="text-xs text-gray-400 mb-2 font-medium">The hidden secrets, summed:</div>
            <div class="font-mono text-xs space-y-1">
              ${state.hospitals.map(h => `
                <div class="flex items-center justify-between gap-2">
                  <span class="text-gray-500">s<sub>${h.id}</sub> = f<sub>${h.id}</sub>(0)</span>
                  <span class="text-amber-300 text-right">${h.count.toLocaleString()}</span>
                </div>
              `).join('')}
              <div class="flex items-center justify-between gap-2 pt-2 mt-1 border-t border-gray-800">
                <span class="text-amber-400 font-semibold">Σ secrets = f(0)</span>
                <span class="text-amber-400 font-semibold text-right">${expectedTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        <p class="text-xs text-gray-400 leading-relaxed">
          The left column is <strong class="text-emerald-400">(f₁+⋯+f₅)(${ui.homParty})</strong>; the right column is
          <strong class="text-amber-400">(f₁+⋯+f₅)(0)</strong>. Both are values of the <em>same</em> summed polynomial.
          So T<sub>${ui.homParty}</sub> is genuinely a Shamir share of the total — evaluate the summed curve at
          x&nbsp;=&nbsp;0 and out pops the sum of secrets. That is the whole trick: no hospital's secret is ever
          added on its own; only the shares are combined.
        </p>
      </div>

      <!-- Local sums for each hospital -->
      <div class="space-y-3">
        <h3 class="text-sm font-semibold text-gray-300">All five local sums {T₁ … T₅}</h3>
        ${state.hospitals.map((h, jj) => {
          const sharesReceived = state.hospitals.map(sender => {
            return state.shareData.get(sender.id)!.shares[jj];
          });
          return `
            <div class="bg-gray-900 rounded-lg border ${ui!.homParty === jj + 1 ? 'border-indigo-700' : 'border-gray-800'} p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-white">Party ${h.id} (x = ${jj + 1}) — ${h.name.split(' ')[0]}</span>
                <span class="text-xs font-mono text-emerald-400">T<sub>${h.id}</sub> = ${formatBigint(state.localSums[jj])}</span>
              </div>
              <div class="font-mono text-xs text-gray-400">
                T<sub>${h.id}</sub> = ${sharesReceived.map((s, k) => `<span class="text-gray-400">${formatBigint(s)}</span>${k < 4 ? ' + ' : ''}`).join('')}
                <span class="text-gray-400"> (mod p)</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- ============================================================= -->
      <!-- RECONSTRUCTION CHOOSER — any valid 3-subset gives the total    -->
      <!-- ============================================================= -->
      <div class="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-4">
        <div>
          <h3 class="text-sm font-semibold text-gray-300">Try it: pick which local sums reconstruct the total</h3>
          <p class="text-xs text-gray-400 mt-1 leading-relaxed">
            Select any 3 of the 5 local sums and Lagrange-interpolate them at x = 0. Every valid 3-subset yields the
            <strong class="text-white">same</strong> total — reconstruction doesn't depend on <em>which</em> parties show up.
            Select only 2 and it's undetermined; the total cannot be pinned down.
          </p>
        </div>

        <div class="flex flex-wrap gap-2" role="group" aria-label="Choose local sums to reconstruct from">
          ${state.hospitals.map((_h, k) => {
            const sel = ui!.reconSel.has(k + 1);
            return `
              <button type="button" data-recon-id="${k + 1}" aria-pressed="${sel}"
                aria-label="Local sum T${k + 1}${sel ? ' (chosen)' : ''}"
                class="px-3 py-2 rounded-lg border text-xs font-mono min-h-[44px] transition-colors
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950
                  ${sel
                    ? 'bg-emerald-700 border-emerald-400 text-white'
                    : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'}">
                T<sub>${k + 1}</sub>
              </button>`;
          }).join('')}
        </div>

        <div id="recon-result" role="status" aria-live="polite">
          ${renderReconResult(state, expectedTotal)}
        </div>
      </div>

      <!-- Canonical Lagrange reconstruction (fixed 1,2,3) -->
      <div class="bg-indigo-950/30 rounded-xl p-6 border border-indigo-900/40 space-y-4">
        <h3 class="text-sm font-semibold text-indigo-300">Lagrange interpolation — reconstructing f(0) from points 1, 2, 3</h3>

        <div class="font-mono text-xs text-gray-400 space-y-2">
          <p class="text-gray-500">Using points (1, T₁), (2, T₂), (3, T₃):</p>
          <p>f(0) = Σᵢ yᵢ · ∏<sub>j≠i</sub> (0 − xⱼ) / (xᵢ − xⱼ)</p>
          <div class="mt-3 space-y-1">
            <p>L₁(0) · T₁ = ${formatBigint(lagrangeCoeffs[0])} · ${formatBigint(state.localSums[0])}</p>
            <p>L₂(0) · T₂ = ${formatBigint(lagrangeCoeffs[1])} · ${formatBigint(state.localSums[1])}</p>
            <p>L₃(0) · T₃ = ${formatBigint(lagrangeCoeffs[2])} · ${formatBigint(state.localSums[2])}</p>
          </div>
          <p class="pt-2 border-t border-gray-800">
            <span class="text-gray-500">Sum mod p =</span>
            <span class="text-emerald-400 text-sm font-bold">${reconstructed.toString()}</span>
          </p>
        </div>
      </div>

      <!-- Total reveal -->
      <div class="bg-gray-900 rounded-xl p-6 border-2 border-emerald-600 text-center space-y-3" id="total-reveal" role="status" aria-live="polite" aria-label="Reconstructed total enrollment">
        <div class="text-xs text-emerald-500 font-mono uppercase tracking-wider">Total Enrollment Across All Sites</div>
        <div class="text-4xl sm:text-5xl font-bold text-emerald-400 font-mono">${Number(reconstructed).toLocaleString()}</div>
        <div class="text-sm text-gray-400">
          Reconstructed via Lagrange interpolation over GF(2⁶¹ − 1)
        </div>
      </div>

      <!-- Cross-check -->
      <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <h3 class="text-sm font-semibold text-gray-300 mb-3">Cross-check verification</h3>
        <div class="font-mono text-xs space-y-1 overflow-x-auto">
          <p class="text-gray-400">
            Direct sum: ${state.hospitals.map(h => h.count.toLocaleString()).join(' + ')} =
            <span class="text-amber-400">${expectedTotal.toLocaleString()}</span>
          </p>
          <p class="text-gray-400">
            Reconstructed: <span class="text-emerald-400">${Number(reconstructed).toLocaleString()}</span>
          </p>
          <p class="mt-2 ${expectedTotal === Number(reconstructed) ? 'text-emerald-400' : 'text-red-400'} font-medium">
            ${expectedTotal === Number(reconstructed) ? '✓ Match — protocol is correct.' : '✗ Mismatch — something went wrong.'}
          </p>
        </div>
      </div>

      <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <p class="text-gray-300 text-sm leading-relaxed">
          <strong class="text-white">No individual hospital's enrollment count was ever transmitted or reconstructed.</strong>
          Only the aggregate sum was computed — using the additive homomorphism of Shamir secret sharing
          and Lagrange interpolation. The computation happened <em>inside</em> the secret sharing scheme.
        </p>
      </div>
    </div>
  `;

  // --- Party selector (homomorphism walk-through) ---
  container.querySelectorAll('[data-hom-party]').forEach(btn => {
    btn.addEventListener('click', () => {
      ui!.homParty = parseInt(btn.getAttribute('data-hom-party')!, 10);
      renderExhibit5(container, state);
      container.querySelector<HTMLElement>(`[data-hom-party="${ui!.homParty}"]`)?.focus();
    });
  });

  // --- Reconstruction chooser ---
  container.querySelectorAll('[data-recon-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.getAttribute('data-recon-id')!, 10);
      if (ui!.reconSel.has(id)) ui!.reconSel.delete(id);
      else ui!.reconSel.add(id);
      renderExhibit5(container, state);
      container.querySelector<HTMLElement>(`[data-recon-id="${id}"]`)?.focus();
    });
  });
}

/** Render the live result panel for the reconstruction chooser. */
function renderReconResult(state: AppState, expectedTotal: number): string {
  const chosen = Array.from(ui!.reconSel).sort((a, b) => a - b);

  if (chosen.length < 3) {
    const need = 3 - chosen.length;
    return `
      <div class="bg-gray-950 rounded-lg p-4 border border-amber-900/40">
        <p class="text-amber-400 text-sm font-medium">
          ⚠ Undetermined — ${chosen.length} of 3 needed.
        </p>
        <p class="text-xs text-gray-400 mt-1 leading-relaxed">
          ${chosen.length === 0
            ? 'Pick 3 local sums to reconstruct the total.'
            : `With ${chosen.length} point${chosen.length === 1 ? '' : 's'} on a degree-2 sharing, the polynomial is
               not pinned down: one curve fits for every value in the field, so f(0) could be anything. Add ${need} more.`}
        </p>
      </div>`;
  }

  if (chosen.length > 3) {
    return `
      <div class="bg-gray-950 rounded-lg p-4 border border-gray-700">
        <p class="text-gray-300 text-sm">
          ${chosen.length} points selected. Any 3 already determine the answer; extra points are consistent but
          redundant. Deselect down to exactly 3 to see a clean reconstruction.
        </p>
      </div>`;
  }

  // Exactly 3 — reconstruct from this specific subset.
  const xs = new BigUint64Array(chosen.map(c => BigInt(c)));
  const ys = new BigUint64Array(chosen.map(c => state.localSums[c - 1]));
  const total = Number(wasm.lagrange_interpolate(xs, ys));
  const match = total === expectedTotal;

  return `
    <div class="bg-gray-950 rounded-lg p-4 border ${match ? 'border-emerald-800' : 'border-red-800'} space-y-2">
      <p class="font-mono text-xs text-gray-400">
        Interpolating (${chosen.map(c => `${c}, T${c === 1 ? '₁' : c === 2 ? '₂' : c === 3 ? '₃' : c === 4 ? '₄' : '₅'}`).join('), (')})
        at x = 0
      </p>
      <p class="text-sm ${match ? 'text-emerald-400' : 'text-red-400'} font-semibold">
        ${match ? '✓' : '✗'} f(0) = ${total.toLocaleString()}
        ${match ? '— same total, from a different 3-subset.' : '— mismatch (should not happen for a valid subset).'}
      </p>
    </div>`;
}

export function canAdvanceExhibit5(): boolean {
  return true;
}

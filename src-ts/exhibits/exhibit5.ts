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

export function renderExhibit5(container: HTMLElement, state: AppState): void {
  computeLocalSums(state);

  const expectedTotal = state.hospitals.reduce((acc, h) => acc + h.count, 0);

  // Lagrange interpolation using first 3 parties (threshold = 3)
  const xVals = new BigUint64Array([1n, 2n, 3n]);
  const yVals = new BigUint64Array([state.localSums[0], state.localSums[1], state.localSums[2]]);
  const reconstructed = wasm.lagrange_interpolate(xVals, yVals);
  state.reconstructedTotal = Number(reconstructed);

  // Lagrange basis coefficients L_i(0) for the reconstruction points x = 1,2,3.
  // For these fixed nodes they evaluate to the integers 3, -3, 1 (mod p):
  //   L_1(0) = (0-2)(0-3) / (1-2)(1-3) = 6/2  =  3
  //   L_2(0) = (0-1)(0-3) / (2-1)(2-3) = 3/-1 = -3  (= P-3 mod p)
  //   L_3(0) = (0-1)(0-2) / (3-1)(3-2) = 2/2  =  1
  const lagrangeCoeffs = lagrangeBasisAtZero([1n, 2n, 3n]);

  container.innerHTML = `
    <div class="space-y-8">
      <div>
        <h2 class="text-2xl font-bold text-white mb-2">Local sums computed. Total reconstructed. No secret revealed.</h2>
        <p class="text-gray-400 text-sm font-mono">Exhibit 5 of 6 — Computation & Reconstruction</p>
      </div>

      <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <p class="text-gray-300 text-sm leading-relaxed">
          Each hospital sums the five shares it holds — one from each party's polynomial.
          Because Shamir sharing is additively homomorphic, these local sums {T₁, …, T₅} form
          a valid Shamir sharing of the <strong class="text-white">sum of all secrets</strong>.
          Any 3 local sums suffice to reconstruct the total via Lagrange interpolation.
        </p>
      </div>

      <!-- Local sums for each hospital -->
      <div class="space-y-3">
        <h3 class="text-sm font-semibold text-gray-300">Local sums — each hospital's computation</h3>
        ${state.hospitals.map((h, j) => {
          const sharesReceived = state.hospitals.map(sender => {
            return state.shareData.get(sender.id)!.shares[j];
          });
          return `
            <div class="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-white">Hospital ${h.id} — ${h.name.split(' ')[0]}</span>
                <span class="text-xs font-mono text-emerald-400">T<sub>${h.id}</sub> = ${formatBigint(state.localSums[j])}</span>
              </div>
              <div class="font-mono text-xs text-gray-500">
                T<sub>${h.id}</sub> = ${sharesReceived.map((s, k) => `<span class="text-gray-400">${formatBigint(s)}</span>${k < 4 ? ' + ' : ''}`).join('')}
                <span class="text-gray-400"> (mod p)</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Lagrange reconstruction -->
      <div class="bg-indigo-950/30 rounded-xl p-6 border border-indigo-900/40 space-y-4">
        <h3 class="text-sm font-semibold text-indigo-300">Lagrange interpolation — reconstructing f(0) from 3 points</h3>

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
}

export function canAdvanceExhibit5(): boolean {
  return true;
}

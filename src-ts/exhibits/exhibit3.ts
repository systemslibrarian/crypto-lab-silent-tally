import type { AppState } from '../types.js';
import { wasm } from '../wasm.js';
import { THRESHOLD, N_PARTIES, P } from '../types.js';
import { formatBigint } from '../format.js';

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
          <span class="text-xs font-mono text-amber-400">secret = ${h.count}</span>
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
                <div class="text-xs text-emerald-400 font-mono break-all" aria-label="Share f(${i + 1}) value">${formatBigint(s)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // SVG curve visualization for hospital 1
  const h1data = state.shareData.get(1)!;
  const h1secret = BigInt(state.hospitals[0].count);

  // Normalize share values to [0, 1] for display
  const displayShares = h1data.shares.map(s => Number((s * 1000n) / P) / 1000);
  const maxY = Math.max(...displayShares, Number((h1secret * 1000n) / P) / 1000);
  const scale = maxY > 0 ? 1 / maxY : 1;

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

      <!-- Curve visualization for Hospital 1 -->
      <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <h3 class="text-sm font-semibold text-gray-300 mb-3">Polynomial curve — ${state.hospitals[0].name}</h3>
        <svg viewBox="0 0 400 200" class="w-full max-w-lg mx-auto" role="img" aria-label="Polynomial curve showing 5 share points plotted on a degree-2 polynomial, with the secret f(0) occluded">
          <!-- Grid -->
          <line x1="50" y1="170" x2="380" y2="170" stroke="#374151" stroke-width="1"/>
          <line x1="50" y1="170" x2="50" y2="20" stroke="#374151" stroke-width="1"/>
          <!-- Axis labels -->
          <text x="215" y="195" text-anchor="middle" fill="#6b7280" font-size="10">x (party index)</text>
          <text x="20" y="95" text-anchor="middle" fill="#6b7280" font-size="10" transform="rotate(-90 20 95)">f(x)</text>
          <!-- Curve (approx) — draw line segments through the 5 points -->
          ${(() => {
            const points = displayShares.map((y, i) => {
              const px = 50 + ((i + 1) / 6) * 330;
              const py = 170 - y * scale * 140;
              return `${px},${py}`;
            });
            return `<polyline points="${points.join(' ')}" fill="none" stroke="#818cf8" stroke-width="2" stroke-linejoin="round"/>`;
          })()}
          <!-- Share points -->
          ${displayShares.map((y, i) => {
            const px = 50 + ((i + 1) / 6) * 330;
            const py = 170 - y * scale * 140;
            return `
              <circle cx="${px}" cy="${py}" r="5" fill="#818cf8" stroke="#312e81" stroke-width="1.5"/>
              <text x="${px}" y="${py - 10}" text-anchor="middle" fill="#a5b4fc" font-size="9">f(${i + 1})</text>
            `;
          }).join('')}
          <!-- f(0) = secret (occluded) -->
          <circle cx="50" cy="${170 - Number((h1secret * 1000n) / P) / 1000 * scale * 140}" r="6" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="3"/>
          <text x="58" y="${170 - Number((h1secret * 1000n) / P) / 1000 * scale * 140 - 8}" fill="#f59e0b" font-size="9">f(0) = ?</text>
        </svg>
        <p class="text-xs text-gray-500 mt-2 text-center">
          The secret f(0) is marked but occluded. You need 3 points to define this degree-2 curve.
        </p>
      </div>

      <!-- All hospital share tables -->
      <div class="space-y-4">
        <h3 class="text-sm font-semibold text-gray-300">Share tables — all 5 hospitals (25 shares total)</h3>
        ${hospitalSections}
      </div>
    </div>
  `;
}

export function canAdvanceExhibit3(): boolean {
  return true;
}

import type { AppState } from '../types.js';
import { formatBigint } from '../format.js';

export function renderExhibit4(container: HTMLElement, state: AppState): void {
  const hospitals = state.hospitals;

  // Build 5x5 matrix display: rows = sending hospital, columns = receiving hospital
  // Hospital i sends share f_i(j) to hospital j
  const matrixRows = hospitals.map(sender => {
    const senderData = state.shareData.get(sender.id)!;
    return hospitals.map(receiver => {
      const shareValue = senderData.shares[receiver.id - 1];
      const isSelf = sender.id === receiver.id;
      return { value: shareValue, isSelf };
    });
  });

  container.innerHTML = `
    <div class="space-y-8">
      <div>
        <h2 class="text-2xl font-bold text-white mb-2">Each hospital receives one share from every other.</h2>
        <p class="text-gray-400 text-sm font-mono">Exhibit 4 of 6 — Share Distribution</p>
      </div>

      <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <p class="text-gray-300 text-sm leading-relaxed">
          Hospital <em>i</em> evaluates its polynomial at each party index and sends share f<sub>i</sub>(j) to hospital <em>j</em>.
          After distribution, each hospital holds exactly <strong class="text-white">5 shares</strong> — one from each party's polynomial.
          The diagonal entries (highlighted) are shares the hospital keeps locally.
        </p>
      </div>

      <!-- Distribution diagram -->
      <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <h3 class="text-sm font-semibold text-gray-300 mb-4">Share flow diagram</h3>
        <svg viewBox="0 0 500 280" class="w-full max-w-xl mx-auto" role="img" aria-label="Diagram showing five hospitals exchanging shares in a peer-to-peer ring topology">
          ${hospitals.map((h, i) => {
            const angle = (i / 5) * 2 * Math.PI - Math.PI / 2;
            const cx = 250 + 110 * Math.cos(angle);
            const cy = 140 + 100 * Math.sin(angle);
            return `
              <circle cx="${cx}" cy="${cy}" r="28" fill="#1f2937" stroke="#6ee7b7" stroke-width="1.5"/>
              <text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="#d1d5db" font-size="8" font-weight="bold">H${h.id}</text>
              <text x="${cx}" y="${cy + 6}" text-anchor="middle" fill="#9ca3af" font-size="6">${h.name.split(' ')[0]}</text>
            `;
          }).join('')}
          ${(() => {
            const lines: string[] = [];
            for (let i = 0; i < 5; i++) {
              for (let j = i + 1; j < 5; j++) {
                const ai = (i / 5) * 2 * Math.PI - Math.PI / 2;
                const aj = (j / 5) * 2 * Math.PI - Math.PI / 2;
                const x1 = 250 + 110 * Math.cos(ai);
                const y1 = 140 + 100 * Math.sin(ai);
                const x2 = 250 + 110 * Math.cos(aj);
                const y2 = 140 + 100 * Math.sin(aj);
                lines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#4b5563" stroke-width="0.75" opacity="0.5"/>`);
              }
            }
            return lines.join('');
          })()}
          <text x="250" y="265" text-anchor="middle" fill="#6b7280" font-size="9">Each line represents bidirectional share exchange</text>
        </svg>
      </div>

      <!-- 5×5 Share Matrix -->
      <div class="bg-gray-900 rounded-xl p-3 sm:p-5 border border-gray-800 overflow-x-auto -mx-4 sm:mx-0 rounded-none sm:rounded-xl">
        <h3 class="text-sm font-semibold text-gray-300 mb-4 px-1" id="matrix-heading">5 × 5 Share Matrix</h3>
        <table class="w-full text-xs font-mono min-w-[500px]" aria-labelledby="matrix-heading">
          <thead>
            <tr>
              <th scope="col" class="text-left text-gray-500 p-2 border-b border-gray-800">Sender ↓ · Receiver →</th>
              ${hospitals.map(h => `<th scope="col" class="text-center text-gray-400 p-2 border-b border-gray-800">H${h.id}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${matrixRows.map((row, i) => `
              <tr>
              <td class="text-gray-400 p-2 border-b border-gray-800/50 whitespace-nowrap" scope="row">H${i + 1} — ${hospitals[i].name.split(' ')[0]}</td>
                ${row.map(cell => `
                  <td class="text-center p-2 border-b border-gray-800/50 ${cell.isSelf ? 'bg-indigo-950/30 text-indigo-400' : 'text-emerald-400'}">
                    ${formatBigint(cell.value)}
                    ${cell.isSelf ? '<span class="block text-[9px] text-indigo-500">self</span>' : ''}
                  </td>
                `).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <p class="text-gray-400 text-sm leading-relaxed">
          <strong class="text-gray-300">Note:</strong> In a real protocol, these transmissions happen over
          authenticated, encrypted channels. Here, the browser simulates all five parties — but the
          mathematics is identical. Each share individually reveals nothing about the sender's secret.
        </p>
      </div>
    </div>
  `;
}

export function canAdvanceExhibit4(): boolean {
  return true;
}

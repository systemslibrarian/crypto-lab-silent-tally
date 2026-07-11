import type { AppState } from '../types.js';

export function renderExhibit1(container: HTMLElement, _state: AppState): void {
  container.innerHTML = `
    <div class="space-y-8">
      <div>
        <h2 class="text-2xl font-bold text-white mb-2">Five hospitals. One question. Zero data sharing.</h2>
        <p class="text-gray-400 text-sm font-mono">Exhibit 1 of 6 — The Problem</p>
      </div>

      <div class="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-4">
        <p class="text-gray-300 leading-relaxed">
          A global regulatory body needs the <strong class="text-white">combined total enrollment</strong> across five
          clinical trial sites. Each hospital holds its private enrollment count — a number they
          will not share with peer institutions, not with regulators, not with any central server.
        </p>
        <p class="text-gray-300 leading-relaxed">
          A naive central aggregator would be a single point of trust failure and a GDPR/HIPAA liability.
          Sending numbers directly between hospitals exposes each site's data to the others.
          There is no one everyone trusts.
        </p>
        <p class="text-gray-300 leading-relaxed">
          <strong class="text-indigo-400">Multi-Party Computation</strong> solves this. The five hospitals collectively
          compute the total enrollment. At the end, every party learns the aggregate. Nobody learns
          any individual hospital's count. No trusted third party required.
        </p>
      </div>

      <!-- Hospital cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" role="list" aria-label="Participating hospitals">
        ${_state.hospitals.map(h => `
          <div class="bg-gray-900 rounded-lg p-4 border border-gray-700 text-center" role="listitem">
            <div class="text-2xl mb-2" aria-hidden="true">🏥</div>
            <div class="text-sm font-medium text-white leading-tight">${h.name}</div>
            <div class="mt-2 flex items-center justify-center gap-1 text-gray-400 text-xs">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Enrollment hidden</span>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Diagram: naive vs MPC -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Naive approach (crossed out) -->
        <div class="bg-gray-900 rounded-xl p-6 border border-red-900/40 relative">
          <div class="absolute top-3 right-3 text-red-500 text-xs font-bold uppercase tracking-wider">✗ Fails</div>
          <h3 class="text-sm font-semibold text-red-400 mb-4">Naive: Central Server</h3>
          <svg viewBox="0 0 300 200" class="w-full max-w-xs mx-auto opacity-50" role="img" aria-label="Diagram showing five hospitals sending data to a central server, crossed out as insecure">
            <!-- Hospital nodes -->
            <circle cx="60" cy="40" r="16" fill="#374151" stroke="#6b7280" stroke-width="1.5"/>
            <circle cx="240" cy="40" r="16" fill="#374151" stroke="#6b7280" stroke-width="1.5"/>
            <circle cx="60" cy="160" r="16" fill="#374151" stroke="#6b7280" stroke-width="1.5"/>
            <circle cx="240" cy="160" r="16" fill="#374151" stroke="#6b7280" stroke-width="1.5"/>
            <circle cx="150" cy="160" r="16" fill="#374151" stroke="#6b7280" stroke-width="1.5"/>
            <!-- Central server -->
            <rect x="125" y="75" width="50" height="40" rx="6" fill="#374151" stroke="#6b7280" stroke-width="1.5"/>
            <!-- Lines to server -->
            <line x1="60" y1="56" x2="135" y2="80" stroke="#6b7280" stroke-width="1" stroke-dasharray="4"/>
            <line x1="240" y1="56" x2="165" y2="80" stroke="#6b7280" stroke-width="1" stroke-dasharray="4"/>
            <line x1="60" y1="144" x2="135" y2="110" stroke="#6b7280" stroke-width="1" stroke-dasharray="4"/>
            <line x1="240" y1="144" x2="165" y2="110" stroke="#6b7280" stroke-width="1" stroke-dasharray="4"/>
            <line x1="150" y1="144" x2="150" y2="115" stroke="#6b7280" stroke-width="1" stroke-dasharray="4"/>
            <!-- Big red X -->
            <line x1="80" y1="30" x2="220" y2="170" stroke="#ef4444" stroke-width="4" stroke-linecap="round"/>
            <line x1="220" y1="30" x2="80" y2="170" stroke="#ef4444" stroke-width="4" stroke-linecap="round"/>
          </svg>
          <p class="text-xs text-gray-400 mt-3 text-center">Server learns all private inputs. Single point of failure.</p>
        </div>

        <!-- MPC approach -->
        <div class="bg-gray-900 rounded-xl p-6 border border-emerald-900/40 relative">
          <div class="absolute top-3 right-3 text-emerald-500 text-xs font-bold uppercase tracking-wider">✓ Secure</div>
          <h3 class="text-sm font-semibold text-emerald-400 mb-4">MPC: Shamir Secret Sharing</h3>
          <svg viewBox="0 0 300 200" class="w-full max-w-xs mx-auto" role="img" aria-label="Diagram showing five hospitals connected peer-to-peer via MPC, computing only the total sum">
            <!-- Hospital nodes in a ring -->
            <circle cx="150" cy="30" r="16" fill="#374151" stroke="#6ee7b7" stroke-width="1.5"/>
            <circle cx="264" cy="80" r="16" fill="#374151" stroke="#6ee7b7" stroke-width="1.5"/>
            <circle cx="220" cy="175" r="16" fill="#374151" stroke="#6ee7b7" stroke-width="1.5"/>
            <circle cx="80" cy="175" r="16" fill="#374151" stroke="#6ee7b7" stroke-width="1.5"/>
            <circle cx="36" cy="80" r="16" fill="#374151" stroke="#6ee7b7" stroke-width="1.5"/>
            <!-- Peer-to-peer connections -->
            <line x1="150" y1="46" x2="248" y2="72" stroke="#6ee7b7" stroke-width="1" opacity="0.4"/>
            <line x1="264" y1="96" x2="228" y2="162" stroke="#6ee7b7" stroke-width="1" opacity="0.4"/>
            <line x1="204" y1="175" x2="96" y2="175" stroke="#6ee7b7" stroke-width="1" opacity="0.4"/>
            <line x1="72" y1="162" x2="36" y2="96" stroke="#6ee7b7" stroke-width="1" opacity="0.4"/>
            <line x1="44" y1="68" x2="138" y2="34" stroke="#6ee7b7" stroke-width="1" opacity="0.4"/>
            <!-- Result in center -->
            <text x="150" y="115" text-anchor="middle" fill="#6ee7b7" font-size="14" font-weight="bold">Σ = total</text>
            <text x="150" y="132" text-anchor="middle" fill="#6b7280" font-size="9">only the sum revealed</text>
          </svg>
          <p class="text-xs text-gray-400 mt-3 text-center">No central server. Only the aggregate is revealed.</p>
        </div>
      </div>

      <div class="bg-indigo-950/30 rounded-xl p-5 border border-indigo-900/40">
        <p class="text-indigo-300 text-sm leading-relaxed">
          <strong class="text-indigo-200">Shamir Secret Sharing makes this possible.</strong>
          Each hospital splits its secret into shares using a random polynomial. The shares are individually
          meaningless — they look like random field elements. But they have the additive homomorphism property:
          adding shares from each hospital produces shares of the <em>sum</em> of all secrets.
          Lagrange interpolation then recovers the total — and only the total.
          Here's how.
        </p>
      </div>
    </div>
  `;
}

export function canAdvanceExhibit1(): boolean {
  return true;
}

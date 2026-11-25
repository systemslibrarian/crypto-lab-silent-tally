import type { AppState } from '../types.js';

function enrollmentValue(input: HTMLInputElement): number | null {
  const value = input.valueAsNumber;
  if (!Number.isInteger(value) || value < 1 || value > 9999) return null;

  // valueAsNumber can round a fraction to an integer. Check that any decimal
  // places left after applying the exponent contain only zeroes.
  const [mantissa, exponent = '0'] = input.value.toLowerCase().split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  const decimalPlaces = fraction.length - Number(exponent);
  const digits = whole + fraction;
  if (decimalPlaces > 0 && /[1-9]/.test(digits.slice(-decimalPlaces))) return null;
  return value;
}

export function renderExhibit2(container: HTMLElement, state: AppState, onStateChange: () => void): void {
  container.innerHTML = `
    <div class="space-y-8">
      <div>
        <h2 class="text-2xl font-bold text-white mb-2">Each hospital enters its enrollment count.</h2>
        <p class="text-gray-400 text-sm font-mono">Exhibit 2 of 6 — Private Input</p>
      </div>

      <p class="text-gray-300 text-sm leading-relaxed">
        You can see all five counts in this classroom view. Locking a count confirms it for the tally;
        it stays visible here. In the protocol, each hospital enters its count on its own device
        and sends shares to the other hospitals. Lock all five counts to continue.
      </p>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="hospital-inputs" role="list" aria-label="Hospital enrollment inputs">
        ${state.hospitals.map(h => `
          <div class="bg-gray-900 rounded-xl border ${h.locked ? 'border-emerald-800' : 'border-gray-700'} overflow-hidden" id="card-${h.id}" role="listitem">
            <div class="px-4 py-3 border-b ${h.locked ? 'border-emerald-900 bg-emerald-950/20' : 'border-gray-800 bg-gray-900'}">
              <div class="flex items-center gap-2">
                <span class="text-xs font-mono ${h.locked ? 'text-emerald-500' : 'text-gray-500'}">
                  ${h.locked ? '🔒' : '🔓'} Hospital ${h.id}
                </span>
              </div>
              <div class="text-sm font-medium text-white mt-1">${h.name}</div>
            </div>
            <div class="p-4 bg-gray-950">
              <label for="input-${h.id}" class="block text-xs text-gray-500 mb-1.5 font-mono">
                enrollment_count &gt;<span class="sr-only"> for ${h.name}</span>
              </label>
              <div class="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="9999"
                  step="1"
                  ${h.locked ? 'disabled' : ''}
                  aria-describedby="error-${h.id}"
                  class="w-full bg-gray-900 border ${h.locked ? 'border-emerald-800 text-emerald-400' : 'border-gray-700 text-amber-300'} rounded px-3 py-2 font-mono text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-gray-950 disabled:opacity-60 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  data-hospital-id="${h.id}"
                  id="input-${h.id}"
                />
              </div>
              <div class="mt-2 text-xs text-red-400 hidden" id="error-${h.id}" role="alert" aria-live="assertive"></div>
              <button
                class="mt-3 w-full py-2.5 rounded text-sm font-medium transition-colors min-h-[44px]
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-gray-950
                  ${h.locked
                    ? 'bg-emerald-900/30 text-emerald-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'}"
                data-lock-id="${h.id}"
                ${h.locked ? 'disabled' : ''}
                id="lock-${h.id}"
                aria-label="${h.locked ? 'Locked In enrollment for ' + h.name : 'Lock In enrollment for ' + h.name}"
              >
                ${h.locked ? '✓ Locked In' : 'Lock In'}
              </button>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Running total placeholder -->
      <div class="bg-gray-900 rounded-xl p-5 border border-gray-700 flex items-center justify-between">
        <div>
          <div class="text-sm text-gray-400 font-mono">Combined Enrollment Total</div>
          <div class="text-xs text-gray-500 mt-1">Revealed only after secure computation in Exhibit 5</div>
        </div>
        <div class="text-3xl font-bold font-mono text-gray-600">???</div>
      </div>

      <div class="text-xs text-gray-500 text-center">
        ${state.hospitals.filter(h => h.locked).length} of 5 hospitals locked in.
        ${state.hospitals.every(h => h.locked) ? '<span class="text-emerald-400 font-medium">All locked — ready to proceed.</span>' : '<span class="text-gray-400">Lock all five to continue.</span>'}
      </div>
    </div>
  `;

  // Attach event listeners
  for (const h of state.hospitals) {
    const input = container.querySelector(`#input-${h.id}`) as HTMLInputElement;
    const lockBtn = container.querySelector(`#lock-${h.id}`) as HTMLButtonElement;
    const errorEl = container.querySelector(`#error-${h.id}`) as HTMLElement;

    input.value = h.draft ?? String(h.count);
    const showError = (message: string | null) => {
      errorEl.textContent = message ?? '';
      errorEl.classList.toggle('hidden', message === null);
      input.setAttribute('aria-invalid', String(message !== null));
    };
    const validateDraft = () => {
      showError(enrollmentValue(input) === null ? 'Enter an integer between 1 and 9,999' : null);
    };
    if (!h.locked) {
      validateDraft();
      input.addEventListener('input', () => {
        h.draft = input.value;
        validateDraft();
      });
    }

    if (lockBtn && !h.locked) {
      lockBtn.addEventListener('click', () => {
        const value = enrollmentValue(input);
        if (value === null) {
          showError('Enter a valid integer (1–9,999) before locking.');
          return;
        }
        h.count = value;
        delete h.draft;
        h.locked = true;
        onStateChange();
        // The grid re-renders and the locked button becomes disabled, so move
        // focus onward: the next unlocked "Lock In" button, or once every
        // hospital is locked, the "Next" navigation button.
        const nextLock = container.querySelector<HTMLElement>('[data-lock-id]:not([disabled])');
        (nextLock ?? document.getElementById('btn-next'))?.focus();
      });
    }
  }
}

export function canAdvanceExhibit2(state: AppState): boolean {
  return state.hospitals.every(h => h.locked);
}

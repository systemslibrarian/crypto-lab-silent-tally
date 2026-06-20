import './style.css';
import { initWasm } from './wasm.js';
import type { AppState } from './types.js';
import { HOSPITALS } from './types.js';
import { renderExhibit1, canAdvanceExhibit1 } from './exhibits/exhibit1.js';
import { renderExhibit2, canAdvanceExhibit2 } from './exhibits/exhibit2.js';
import { renderExhibit3, computeShares, canAdvanceExhibit3 } from './exhibits/exhibit3.js';
import { renderExhibit4, canAdvanceExhibit4 } from './exhibits/exhibit4.js';
import { renderExhibit5, computeLocalSums, canAdvanceExhibit5 } from './exhibits/exhibit5.js';
import { renderExhibit6, canAdvanceExhibit6 } from './exhibits/exhibit6.js';

const state: AppState = {
  currentExhibit: 1,
  hospitals: HOSPITALS.map(h => ({ ...h })),
  shareData: new Map(),
  localSums: [],
  reconstructedTotal: null,
  coalitionSelection: new Set(),
};

const exhibitContainer = document.getElementById('exhibit-container')!;
const progressEl = document.getElementById('progress')!;
const btnPrev = document.getElementById('btn-prev') as HTMLButtonElement;
const btnNext = document.getElementById('btn-next') as HTMLButtonElement;
const loadingOverlay = document.getElementById('loading-overlay')!;
const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement;

function applyTheme(theme: 'dark' | 'light'): void {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
  themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}

function canAdvance(): boolean {
  switch (state.currentExhibit) {
    case 1: return canAdvanceExhibit1();
    case 2: return canAdvanceExhibit2(state);
    case 3: return canAdvanceExhibit3();
    case 4: return canAdvanceExhibit4();
    case 5: return canAdvanceExhibit5();
    case 6: return canAdvanceExhibit6();
    default: return false;
  }
}

function render(focusExhibit = false): void {
  progressEl.textContent = `Exhibit ${state.currentExhibit} of 6`;
  btnPrev.disabled = state.currentExhibit === 1;
  btnNext.disabled = state.currentExhibit === 6 || !canAdvance();

  switch (state.currentExhibit) {
    case 1:
      renderExhibit1(exhibitContainer, state);
      break;
    case 2:
      renderExhibit2(exhibitContainer, state, () => render(false));
      break;
    case 3:
      computeShares(state);
      renderExhibit3(exhibitContainer, state);
      break;
    case 4:
      renderExhibit4(exhibitContainer, state);
      break;
    case 5:
      computeLocalSums(state);
      renderExhibit5(exhibitContainer, state);
      break;
    case 6:
      renderExhibit6(exhibitContainer, state, () => render(false));
      break;
  }

  if (focusExhibit) {
    exhibitContainer.focus();
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    exhibitContainer.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  }
}

btnPrev.addEventListener('click', () => {
  if (state.currentExhibit > 1) {
    state.currentExhibit--;
    render(true);
  }
});

btnNext.addEventListener('click', () => {
  if (state.currentExhibit < 6 && canAdvance()) {
    state.currentExhibit++;
    render(true);
  }
});

// Keyboard navigation: left/right arrows
document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.key === 'ArrowLeft' && state.currentExhibit > 1) {
    state.currentExhibit--;
    render(true);
  } else if (e.key === 'ArrowRight' && state.currentExhibit < 6 && canAdvance()) {
    state.currentExhibit++;
    render(true);
  }
});

themeToggle.addEventListener('click', () => {
  const currentTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

async function main(): Promise<void> {
  try {
    const initialTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    applyTheme(initialTheme);
    await initWasm();
    loadingOverlay.style.display = 'none';
    loadingOverlay.setAttribute('aria-hidden', 'true');
    render(false);
  } catch (err) {
    loadingOverlay.innerHTML = `
      <div class="text-center">
        <p class="text-red-400 text-sm">Failed to initialize WASM core.</p>
        <p class="text-gray-500 text-xs mt-2">${err instanceof Error ? err.message : String(err)}</p>
      </div>
    `;
  }
}

main();

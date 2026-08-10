/**
 * Known WCAG 1.4.11 / generated-content findings in this lab, captured through
 * the gate's own path so the baseline and the check cannot disagree.
 *
 * THIS FILE IS A TO-DO LIST, NOT A SET OF EXEMPTIONS. The gate ratchets on it:
 *   - a finding NOT listed here fails the run, so a regression cannot land;
 *   - a listed finding whose ratio gets WORSE fails, so the list cannot rot;
 *   - a listed finding that no longer appears ALSO fails, so a fixed entry must
 *     be deleted and the file can only shrink toward empty.
 * The last rule is what stops an allowlist becoming a permanent exemption.
 *
 * `unverified: true` marks an absolutely-positioned pseudo-element. It can paint
 * outside its host and the oracle measures it against the host's backdrop, so
 * that ratio is NOT trustworthy — hand-measure before acting on it.
 */
export const NONTEXT_BASELINE: Record<
  string,
  { ratio: number; required: number; unverified: boolean }
> = {
  "control-boundary|a.cl-btn": { ratio: 2.45, required: 3.0, unverified: false },
  "control-boundary|button#btn-prev.px-5.py-3.sm:py-2.rounded-lg.bg-gray-800.text-gray-300.hover:bg-gray-700.focus:outline-none.focus:ring-2.focus:ring-indigo-500.focus:ring-offset-2.focus:ring-offset-gray-950.disabled:opacity-30.disabled:cursor-not-allowed.transition-colors.font-medium.min-h-[44px]": { ratio: 1.18, required: 3.0, unverified: false },
  "control-boundary|button#cl-theme-toggle.cl-btn.cl-icon": { ratio: 2.45, required: 3.0, unverified: false },
  "control-boundary|button.px-3.py-2.rounded-lg.border.text-xs.font-mono.min-h-[44px].transition-colors.focus:outline-none.focus:ring-2.focus:ring-indigo-500.focus:ring-offset-2.focus:ring-offset-gray-950.bg-gray-900.border-gray-700.text-gray-300.hover:border-gray-500": { ratio: 1.32, required: 3.0, unverified: false },
  "control-boundary|button.rounded-xl.p-4.border-2.text-center.transition-all.min-h-[44px].focus:outline-none.focus:ring-2.focus:ring-indigo-500.focus:ring-offset-2.focus:ring-offset-gray-950.bg-gray-900.border-gray-700.hover:border-gray-500.cursor-pointer": { ratio: 1.41, required: 3.0, unverified: false },
  "control-boundary|button.rounded-xl.p-4.border-2.text-center.transition-all.min-h-[44px].focus:outline-none.focus:ring-2.focus:ring-indigo-500.focus:ring-offset-2.focus:ring-offset-gray-950.bg-gray-900.border-gray-800.opacity-50.cursor-not-allowed": { ratio: 1.18, required: 3.0, unverified: false },
  "control-boundary|button.rounded-xl.p-4.border-2.text-center.transition-all.min-h-[44px].focus:outline-none.focus:ring-2.focus:ring-indigo-500.focus:ring-offset-2.focus:ring-offset-gray-950.bg-red-950/30.border-red-600.ring-1.ring-red-500/30.cursor-pointer": { ratio: 2.76, required: 3.0, unverified: false },
  "control-boundary|input#input-1.w-full.bg-gray-900.border.border-gray-700.text-amber-300.rounded.px-3.py-2.font-mono.text-lg.focus:outline-none.focus:ring-2.focus:ring-indigo-500.focus:ring-offset-1.focus:ring-offset-gray-950.disabled:opacity-60.disabled:cursor-not-allowed.[appearance:textfield].[&::-webkit-outer-spin-button]:appearance-none.[&::-webkit-inner-spin-button]:appearance-none": { ratio: 1.41, required: 3.0, unverified: false },
  "control-boundary|input#input-2.w-full.bg-gray-900.border.border-gray-700.text-amber-300.rounded.px-3.py-2.font-mono.text-lg.focus:outline-none.focus:ring-2.focus:ring-indigo-500.focus:ring-offset-1.focus:ring-offset-gray-950.disabled:opacity-60.disabled:cursor-not-allowed.[appearance:textfield].[&::-webkit-outer-spin-button]:appearance-none.[&::-webkit-inner-spin-button]:appearance-none": { ratio: 1.41, required: 3.0, unverified: false },
  "control-boundary|input#input-3.w-full.bg-gray-900.border.border-gray-700.text-amber-300.rounded.px-3.py-2.font-mono.text-lg.focus:outline-none.focus:ring-2.focus:ring-indigo-500.focus:ring-offset-1.focus:ring-offset-gray-950.disabled:opacity-60.disabled:cursor-not-allowed.[appearance:textfield].[&::-webkit-outer-spin-button]:appearance-none.[&::-webkit-inner-spin-button]:appearance-none": { ratio: 1.41, required: 3.0, unverified: false },
  "control-boundary|input#input-4.w-full.bg-gray-900.border.border-gray-700.text-amber-300.rounded.px-3.py-2.font-mono.text-lg.focus:outline-none.focus:ring-2.focus:ring-indigo-500.focus:ring-offset-1.focus:ring-offset-gray-950.disabled:opacity-60.disabled:cursor-not-allowed.[appearance:textfield].[&::-webkit-outer-spin-button]:appearance-none.[&::-webkit-inner-spin-button]:appearance-none": { ratio: 1.41, required: 3.0, unverified: false },
  "control-boundary|input#input-5.w-full.bg-gray-900.border.border-gray-700.text-amber-300.rounded.px-3.py-2.font-mono.text-lg.focus:outline-none.focus:ring-2.focus:ring-indigo-500.focus:ring-offset-1.focus:ring-offset-gray-950.disabled:opacity-60.disabled:cursor-not-allowed.[appearance:textfield].[&::-webkit-outer-spin-button]:appearance-none.[&::-webkit-inner-spin-button]:appearance-none": { ratio: 1.41, required: 3.0, unverified: false }
};

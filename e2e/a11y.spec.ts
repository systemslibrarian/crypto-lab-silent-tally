import { test } from '@playwright/test';
import { boot, driveAllStates, expectBaselineNotStale, NARROW } from './gate';

/**
 * WCAG A/AA regression gate for the Silent Tally MPC walkthrough.
 *
 * All six exhibits are driven in order, plus the states between them: the two
 * real validation-error messages on Exhibit 2, a partial lock, every
 * homomorphism party column and all four reconstruction-chooser panels on
 * Exhibit 5, and Exhibit 6's coalition grown from none through past the
 * threshold so both verdicts are scanned. Each in both themes at desktop and
 * phone width.
 *
 * See `gate.ts` for why nothing is injected into the page, why each scan
 * asserts its content first, and why `violations` is not the whole oracle.
 */

for (const theme of ['dark', 'light'] as const) {
  test(`no WCAG A/AA violations in ${theme} theme`, async ({ page }) => {
    test.setTimeout(900_000);
    await boot(page, theme);
    await driveAllStates(page, theme);
  });

  test(`no WCAG A/AA violations in ${theme} theme at 380px`, async ({ page }) => {
    test.setTimeout(900_000);
    await page.setViewportSize(NARROW);
    await boot(page, theme);
    await driveAllStates(page, `${theme} @380px`);
  });
}

/**
 * The baseline's third rule: a listed finding that no longer appears fails
 * until its entry is deleted, so a fixed defect cannot linger as a permanent
 * exemption. `expectBaselineNotStale` was exported and never called, so that
 * rule had never run and the file could only grow.
 *
 * It runs LAST and exactly once, not at the end of each configuration.
 * `nonTextSeen` is module state and this config pins `workers: 1` with
 * `fullyParallel: false`, so all four configurations share one module instance
 * and accumulate into one set — declared last, this test therefore sees the
 * union of all four drives. Calling it per configuration would instead assert
 * the whole baseline against a partial drive, which was measured rather than
 * assumed: with the call added to the first test as well, the dark desktop pass
 * alone reports the red-ring reconstruction chooser
 * (`bg-red-950/30.border-red-600.ring-1.ring-red-500/30`, 2.76:1) stale,
 * because only a later configuration's drive reaches that state.
 */
test('the non-text baseline carries no stale entries', () => {
  expectBaselineNotStale();
});

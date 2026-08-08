import { test } from '@playwright/test';
import { boot, driveAllStates, NARROW } from './gate';

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

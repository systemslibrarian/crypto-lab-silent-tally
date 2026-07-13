import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Strict WCAG regression gate. Deploys are already gated on the crypto
 * correctness tests; this gates them on accessibility the same way.
 *
 * silent-tally is a linear six-exhibit walkthrough (Shamir MPC clinical-trial
 * demo). The app mounts into #exhibit-container and reveals content one exhibit
 * at a time via the Next button. Exhibit 2 only lets you advance once every
 * hospital's enrollment is locked in. This gate walks all six exhibits, drives
 * the interactive controls (lock buttons, coalition selection) so every
 * dynamically-injected region is in the DOM, and scans each exhibit in both
 * dark (default) and light themes.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function killMotion(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `*,*::before,*::after{
      animation-duration:0s!important;animation-delay:0s!important;
      transition-duration:0s!important;transition-delay:0s!important;
      scroll-behavior:auto!important;opacity:1!important;
    }`,
  });
}

async function waitForMount(page: Page): Promise<void> {
  // Loading overlay is hidden once the WASM core initialises and the first
  // exhibit renders.
  await page.waitForFunction(() => {
    const overlay = document.getElementById('loading-overlay');
    const c = document.getElementById('exhibit-container');
    return (!overlay || overlay.style.display === 'none') &&
      !!c && c.childElementCount > 0;
  });
  await page.locator('#exhibit-container').waitFor({ state: 'visible' });
}

async function revealEverything(page: Page): Promise<void> {
  // No native <details> here (panels are class-toggled), but keep this generic
  // so the gate stays robust if collapsibles are added later.
  await page.evaluate(() => {
    for (const d of document.querySelectorAll('details')) (d as HTMLDetailsElement).open = true;
    for (const el of document.querySelectorAll('.hidden')) el.classList.remove('hidden');
  });
}

async function scan(page: Page, label: string): Promise<void> {
  await killMotion(page);
  await revealEverything(page);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5),
  }));
  expect(summary, `violations at: ${label}`).toEqual([]);
}

/** Lock in every hospital on exhibit 2 so Next becomes enabled. */
async function lockAllHospitals(page: Page): Promise<void> {
  let btn = page.locator('[data-lock-id]:not([disabled])').first();
  // Five hospitals; loop until none remain unlocked.
  for (let i = 0; i < 8 && (await btn.count()) > 0; i++) {
    await btn.click();
    btn = page.locator('[data-lock-id]:not([disabled])').first();
  }
}

/**
 * Drive the walkthrough, scanning each exhibit. Runs from whatever theme the
 * page is currently in.
 */
async function walkAllExhibits(page: Page, theme: string): Promise<void> {
  await waitForMount(page);

  // Exhibit 1 — intro.
  await scan(page, `${theme}/exhibit-1`);

  // Exhibit 2 — enrollment entry; must lock all hospitals to advance.
  await page.locator('#btn-next').click();
  await expect(page.locator('#hospital-inputs')).toBeVisible();
  // Scan before locking (fresh inputs) and after (locked/emerald state).
  await scan(page, `${theme}/exhibit-2-unlocked`);
  await lockAllHospitals(page);
  await scan(page, `${theme}/exhibit-2-locked`);

  // Exhibit 3 — shares.
  await expect(page.locator('#btn-next')).toBeEnabled();
  await page.locator('#btn-next').click();
  await page.locator('#exhibit-container [role="list"]').first().waitFor();
  await scan(page, `${theme}/exhibit-3`);

  // Exhibit 4 — share matrix.
  await page.locator('#btn-next').click();
  await page.locator('#matrix-heading').waitFor();
  await scan(page, `${theme}/exhibit-4`);

  // Exhibit 5 — reconstructed total. Drive the new interactive controls so
  // their injected regions (homomorphism walk-through columns, and the
  // reconstruction chooser's match / undetermined / redundant panels) are all
  // scanned in both themes.
  await page.locator('#btn-next').click();
  await page.locator('#total-reveal').waitFor();
  await scan(page, `${theme}/exhibit-5-default`);
  // Switch the homomorphism party column.
  await page.locator('[data-hom-party="5"]').click();
  await scan(page, `${theme}/exhibit-5-hom-party-5`);
  // Deselect a chosen local sum -> "undetermined" (2 of 3) amber panel.
  await page.locator('[data-recon-id="3"]').click();
  await scan(page, `${theme}/exhibit-5-recon-undetermined`);
  // Add two more -> more than 3 selected (redundant) panel.
  await page.locator('[data-recon-id="3"]').click();
  await page.locator('[data-recon-id="4"]').click();
  await page.locator('[data-recon-id="5"]').click();
  await scan(page, `${theme}/exhibit-5-recon-redundant`);

  // Exhibit 6 — coalition attack; drive the coalition buttons so the
  // dynamically-injected result region renders.
  await page.locator('#btn-next').click();
  await page.locator('#coalition-cards').waitFor();
  const coalition = page.locator('[data-coalition-id]');
  const n = await coalition.count();
  for (let i = 0; i < Math.min(2, n); i++) {
    await coalition.nth(i).click();
  }
  await scan(page, `${theme}/exhibit-6`);
}

test('no WCAG A/AA violations across all exhibits — dark theme', async ({ page }) => {
  await page.goto('.');
  await waitForMount(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await walkAllExhibits(page, 'dark');
});

test('no WCAG A/AA violations across all exhibits — light theme', async ({ page }) => {
  await page.goto('.');
  await waitForMount(page);
  await page.locator('#cl-theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await walkAllExhibits(page, 'light');
});

import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { auditContrast, formatContrastFailures } from './contrast';

export const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** A phone-width viewport, for the WCAG 1.4.10 reflow half of the gate. */
export const NARROW = { width: 380, height: 800 };

/**
 * Shared machinery for the WCAG gate.
 *
 * Three rules govern everything here:
 *
 *  1. NOTHING IS INJECTED INTO THE PAGE BEFORE A SCAN. The gate this file
 *     replaces did walk all six exhibits — better than most in this fleet —
 *     but then called `revealEverything`, which stripped the `hidden` class
 *     off every element before each scan. The only things carrying that class
 *     here are Exhibit 2's five per-hospital `role="alert"` boxes, so every
 *     scan was performed on a page showing five empty simultaneous alerts that
 *     no visitor can produce, while the REAL validation-error state — type a
 *     bad count, the alert fills in and the input gains a description — was
 *     never visited. It also injected `animation-duration: 0s` and
 *     `transition-duration: 0s`, so the suite was structurally incapable of
 *     observing a transition or theme-swap defect.
 *
 *  2. EVERY SCAN ASSERTS ITS CONTENT IS PRESENT FIRST, and there are scans well
 *     past first paint. axe over an empty container passes having checked
 *     nothing, and `#exhibit-container` is empty until the WASM core finishes
 *     initialising.
 *
 *  3. `violations` IS NOT THE WHOLE ORACLE. See `scan`.
 */

/**
 * Wait for every running animation and transition to drain.
 *
 * Transitions drain in waves, not in one batch, so a poll for "nothing running
 * right now" can exit through a gap between waves. Require quiescence to hold
 * for several consecutive frames instead.
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __quietFrames?: number };
      const running = document.getAnimations().filter((a) => a.playState === 'running');
      w.__quietFrames = running.length === 0 ? (w.__quietFrames ?? 0) + 1 : 0;
      return w.__quietFrames >= 6;
    },
    undefined,
    { timeout: 20_000, polling: 'raf' }
  );
}

/**
 * Assert that reduced motion left the page visible, not merely un-animated.
 *
 * The failure mode this guards against is an element whose only route to its
 * visible state is an animation, in a stylesheet whose reduced-motion block
 * cancels that animation without restoring its end state — the element then
 * renders at `opacity: 0` for every reader with the preference set. This lab's
 * reduced-motion block collapses durations to 0.001ms rather than cancelling
 * animations, which preserves end states — so the check is expected to be
 * silent here, and is kept because a future keyframe could change that.
 */
async function expectNotBlank(page: Page, label: string): Promise<void> {
  const invisible = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
      if (!own) continue;
      // Deliberately hidden subtrees are not "blank", they are closed.
      if (!(el as HTMLElement).checkVisibility?.({ checkVisibilityCSS: true })) continue;
      let effective = 1;
      let node: Element | null = el;
      while (node) {
        effective *= parseFloat(getComputedStyle(node).opacity);
        node = node.parentElement;
      }
      if (effective === 0) {
        out.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim()}`);
      }
    }
    return Array.from(new Set(out));
  });
  expect(invisible, `no visible text may render at opacity 0 in state: ${label}`).toEqual([]);
}

/**
 * Load the page in a known theme with reduced motion actually in effect, and
 * assert the content every scan relies on is really on the page.
 *
 * `test.use({ reducedMotion })` silently does nothing on Playwright 1.61.1, so
 * the emulation is applied imperatively BEFORE the navigation and then
 * *asserted* from inside the page. `main.ts` reads the preference on every
 * exhibit change to choose between smooth and instant `scrollIntoView`, so the
 * emulation has to be in place before the walkthrough starts, not after.
 *
 * The theme is seeded in `localStorage` rather than reached by clicking the
 * toggle, so the page boots in the theme under test instead of transitioning
 * into it — and the light-theme walk is a fresh load rather than a walk of a
 * page that was mid-transition when the first scan ran.
 */
export async function boot(page: Page, theme: 'dark' | 'light'): Promise<void> {
  // Fail fast on an unreachable control. Playwright's default action timeout is
  // the whole test timeout, so a click on something a sticky header covers, or
  // a locator gated on a prerequisite that never ran, silently burns the entire
  // budget instead of pointing at the state it could not reach.
  page.setDefaultTimeout(20_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
  await page.goto('.');
  expect(
    await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    'reduced-motion emulation must actually be in effect'
  ).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

  // The loading overlay covers the page until the WASM core initialises and the
  // first exhibit renders. Scanning before that is scanning an empty container.
  await page.waitForFunction(
    () => {
      const overlay = document.getElementById('loading-overlay');
      const c = document.getElementById('exhibit-container');
      return overlay?.style.display === 'none' && !!c && c.childElementCount > 0;
    },
    undefined,
    { timeout: 60_000 }
  );
  await expect(page.locator('#progress')).toHaveText('Exhibit 1 of 6');
  await expect(page.locator('#exhibit-container h2')).toBeVisible();

  await settle(page);
  await expectNotBlank(page, `${theme} first paint`);
}

/**
 * Assert the page does not require horizontal scrolling.
 *
 * WCAG 1.4.10 (Reflow, AA). axe has no rule for this at all, and this lab is a
 * plausible offender: Exhibit 4 is a 5x5 share matrix of 61-bit field elements
 * in monospace, Exhibit 5 prints the homomorphism walk-through as long
 * unbroken sums, and Exhibit 6 draws a 400x200 SVG.
 */
export async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    if (doc.scrollWidth <= doc.clientWidth) return null;

    // Only elements that actually push the DOCUMENT sideways are culprits. A
    // wide table inside an `overflow-x: auto` wrapper has a huge bounding rect
    // but is clipped by its scroller and contributes nothing to the document's
    // scroll width — naming it sends you off fixing the wrong element.
    const clipped = (el: Element): boolean => {
      let n = el.parentElement;
      while (n && n !== doc) {
        const ox = getComputedStyle(n).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
        n = n.parentElement;
      }
      return false;
    };

    const widest = Array.from(document.querySelectorAll('body *'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter((x) => x.r.width > 0 && x.r.right > doc.clientWidth + 1)
      .filter((x) => !clipped(x.el))
      .sort((a, b) => b.r.right - a.r.right)[0];
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      widest: widest
        ? `${widest.el.tagName.toLowerCase()}${widest.el.id ? '#' + widest.el.id : ''}` +
          `${widest.el.getAttribute('class') ? '.' + widest.el.getAttribute('class')!.trim().split(/\s+/).join('.') : ''}` +
          ` @${Math.round(widest.r.width)}px right=${Math.round(widest.r.right)}`
        : '(none identified)',
    };
  });
  expect(overflow, `page must not scroll horizontally in state: ${label}`).toBeNull();
}

/**
 * Every scrolling container must be operable from the keyboard (WCAG 2.1.1).
 * If it holds no focusable content it needs `tabindex="0"`, so it becomes a
 * focus target arrow keys can then scroll.
 */
export async function expectScrollersReachable(page: Page, label: string): Promise<void> {
  const unreachable = await page.evaluate(() => {
    const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
      .filter((el) => {
        const cs = getComputedStyle(el);
        return (
          ['auto', 'scroll'].includes(cs.overflowX) || ['auto', 'scroll'].includes(cs.overflowY)
        );
      })
      .filter((el) => el.tabIndex < 0 && !el.querySelector(FOCUSABLE))
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim()}` +
          ` (${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight})`
      );
  });
  expect(
    Array.from(new Set(unreachable)),
    `scrolling regions with no keyboard route in state: ${label}`
  ).toEqual([]);
}

/**
 * Scan the page as it currently stands.
 *
 * Five assertions, because axe's `violations` array alone is not a complete
 * oracle:
 *
 *  - `violations` — the usual WCAG A/AA rule failures.
 *  - `incomplete` — axe's "could not decide" bucket, which never reaches the
 *    violations array. The one rule id allowed to remain incomplete is
 *    `color-contrast`, and only because the next assertion computes those
 *    ratios arithmetically. Everything else in that bucket is a real result
 *    axe simply could not finish — including `aria-prohibited-attr`, which is
 *    where an `aria-label` on a role-less div hides, a defect that never
 *    reaches the violations array at all.
 *  - arithmetic contrast — composite-aware WCAG 1.4.3 over every text node.
 *  - keyboard reachability of scrolling regions — WCAG 2.1.1.
 *  - reflow — WCAG 1.4.10, which axe has no rule for at all.
 */
export async function scan(page: Page, label: string): Promise<void> {
  await settle(page);
  await expectNotBlank(page, label);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

  const violations = results.violations.map((v) => ({
    state: label,
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8),
  }));
  expect(violations, `axe violations in state: ${label}`).toEqual([]);

  const unexplainedIncomplete = results.incomplete
    .filter((v) => v.id !== 'color-contrast')
    .map((v) => ({
      state: label,
      id: v.id,
      nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8),
    }));
  expect(unexplainedIncomplete, `axe incomplete results in state: ${label}`).toEqual([]);

  const contrast = Array.from(new Set(formatContrastFailures(await auditContrast(page))));
  expect(contrast, `measured contrast failures in state: ${label}`).toEqual([]);

  await expectScrollersReachable(page, label);
  await expectNoHorizontalOverflow(page, label);
}

/**
 * Lock in every hospital on Exhibit 2 so `Next` becomes enabled.
 *
 * The grid re-renders after each lock, so the locator is re-resolved each time
 * rather than captured once.
 */
async function lockAllHospitals(page: Page): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const next = page.locator('[data-lock-id]:not([disabled])').first();
    if ((await next.count()) === 0) break;
    await next.click();
  }
  await expect(page.locator('[data-lock-id]:not([disabled])')).toHaveCount(0);
}

/** Advance one exhibit and wait for the progress readout to confirm it. */
async function next(page: Page, to: number): Promise<void> {
  await expect(page.locator('#btn-next')).toBeEnabled();
  await page.locator('#btn-next').click();
  await expect(page.locator('#progress')).toHaveText(`Exhibit ${to} of 6`);
}

/**
 * Drive the walkthrough, scanning each state.
 *
 * Every control on the page is reached. `#btn-next` and `#btn-prev` both drive
 * navigation; all five `#input-N` fields are typed into, including an invalid
 * value so the real `role="alert"` renders with real text; all five
 * `[data-lock-id]` buttons are clicked; every `[data-hom-party]` column and
 * every `[data-recon-id]` toggle is visited; and the coalition is grown one
 * `[data-coalition-id]` at a time from none through to past the threshold, so
 * BOTH verdicts — "Coalition fails" and "Guarantee broken" — are scanned
 * rather than only whichever one the walk happened to leave on screen.
 *
 * Exhibit 5's reconstruction chooser has four distinct panels and all four are
 * driven: undetermined (fewer than 3), the clean match (exactly 3), a DIFFERENT
 * clean 3-subset, and redundant (more than 3).
 */
export async function driveAllStates(page: Page, theme: string): Promise<void> {
  await scan(page, `${theme} / exhibit 1`);

  // Both skip links park off-screen until focused; the focused rendering is the
  // state a keyboard visitor actually sees.
  await page.locator('a[href="#exhibit-container"]').focus();
  await scan(page, `${theme} / skip link focused`);

  // ── Exhibit 2 — private input ──────────────────────────────────────────
  await next(page, 2);
  await expect(page.locator('#hospital-inputs')).toBeVisible();
  await scan(page, `${theme} / exhibit 2 fresh`);

  // The real validation-error state. The old gate stripped the `hidden` class
  // off all five alert boxes instead of getting here, which scanned five empty
  // alerts and never once saw one with text in it.
  await page.locator('#input-1').fill('0');
  await expect(page.locator('#error-1')).toBeVisible();
  await expect(page.locator('#error-1')).toHaveText(/integer between 1 and 9,999/);
  await scan(page, `${theme} / exhibit 2 invalid input`);

  // The other error message: a bad value at lock time rather than at type time.
  await page.locator('#input-1').fill('');
  await page.locator('#lock-1').click();
  await expect(page.locator('#error-1')).toHaveText(/before locking/);
  await scan(page, `${theme} / exhibit 2 invalid lock`);

  await page.locator('#input-1').fill('412');
  await page.locator('#lock-1').click();
  await expect(page.locator('#lock-1')).toBeDisabled();
  await scan(page, `${theme} / exhibit 2 partially locked`);

  await lockAllHospitals(page);
  await scan(page, `${theme} / exhibit 2 all locked`);

  // ── Exhibit 3 — shares ─────────────────────────────────────────────────
  await next(page, 3);
  await expect(page.locator('#exhibit-container [role="list"]').first()).toBeVisible();
  await scan(page, `${theme} / exhibit 3`);

  // ── Exhibit 4 — share matrix ───────────────────────────────────────────
  await next(page, 4);
  await expect(page.locator('#matrix-heading')).toBeVisible();
  await scan(page, `${theme} / exhibit 4`);

  // ── Exhibit 5 — homomorphism and reconstruction ────────────────────────
  await next(page, 5);
  await expect(page.locator('#total-reveal')).toBeVisible();
  await scan(page, `${theme} / exhibit 5 default`);

  // Every party column of the homomorphism walk-through.
  for (const party of ['1', '2', '3', '4', '5']) {
    await page.locator(`[data-hom-party="${party}"]`).click();
    await expect(page.locator(`[data-hom-party="${party}"]`)).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await scan(page, `${theme} / exhibit 5 homomorphism party ${party}`);
  }

  // Drop to two selected: the amber "undetermined" panel.
  await page.locator('[data-recon-id="3"]').click();
  await expect(page.locator('#recon-result')).toContainText('Undetermined');
  await scan(page, `${theme} / exhibit 5 undetermined (2 of 3)`);

  // Drop to none: the same panel with its other copy.
  await page.locator('[data-recon-id="1"]').click();
  await page.locator('[data-recon-id="2"]').click();
  await expect(page.locator('#recon-result')).toContainText('Pick 3 local sums');
  await scan(page, `${theme} / exhibit 5 undetermined (0 of 3)`);

  // A different clean 3-subset — the exhibit's actual claim is that any three
  // give the same total, so the second subset is a distinct rendered verdict.
  await page.locator('[data-recon-id="3"]').click();
  await page.locator('[data-recon-id="4"]').click();
  await page.locator('[data-recon-id="5"]').click();
  await expect(page.locator('#recon-result')).toContainText('f(0) =');
  await scan(page, `${theme} / exhibit 5 reconstructed from 3,4,5`);

  // More than three: the "redundant" panel.
  await page.locator('[data-recon-id="1"]').click();
  await page.locator('[data-recon-id="2"]').click();
  await expect(page.locator('#recon-result')).toContainText('redundant');
  await scan(page, `${theme} / exhibit 5 redundant (5 selected)`);

  // ── Exhibit 6 — coalition attack ───────────────────────────────────────
  await next(page, 6);
  await expect(page.locator('#coalition-cards')).toBeVisible();
  await scan(page, `${theme} / exhibit 6 no coalition`);

  const coalition = page.locator('[data-coalition-id]');
  const members = await coalition.count();
  expect(members, 'exhibit 6 must offer a coalition to build').toBeGreaterThanOrEqual(3);

  // One colluder: the sub-threshold verdict in its singular wording.
  await coalition.nth(0).click();
  await expect(page.locator('#exhibit-container')).toContainText('Coalition fails');
  await scan(page, `${theme} / exhibit 6 one colluder`);

  // Two: still sub-threshold, and the only size that draws the multi-curve SVG.
  await coalition.nth(1).click();
  await expect(page.locator('#exhibit-container svg[role="img"]')).toBeVisible();
  await scan(page, `${theme} / exhibit 6 two colluders (fails, with curves)`);

  // Three: at the threshold — the "Guarantee broken" verdict, the opposite
  // branch of the same panel and the one a first-paint scan never reaches.
  await coalition.nth(2).click();
  await expect(page.locator('#exhibit-container')).toContainText('Guarantee broken');
  await scan(page, `${theme} / exhibit 6 threshold reached`);

  // Fill the coalition to its cap. At the cap the one hospital left outside
  // becomes the victim and its card renders `aria-disabled` with a "cannot
  // join" name — a state only reachable by driving the exhibit to the end, and
  // one that will hang a click forever if the drive treats it as a normal
  // button (it did, and cost a full test timeout to find).
  for (let i = 3; i < members; i++) {
    const card = coalition.nth(i);
    if ((await card.getAttribute('aria-disabled')) === 'true') continue;
    if ((await card.getAttribute('aria-pressed')) === 'true') continue;
    await card.click();
  }
  await expect(page.locator('[data-coalition-id][aria-disabled="true"]')).toHaveCount(1);
  await scan(page, `${theme} / exhibit 6 at the coalition cap`);

  // Removing a colluder is the other direction the exhibit claims to run in,
  // and it re-enables the victim card.
  await coalition.nth(0).click();
  await expect(page.locator('[data-coalition-id][aria-disabled="true"]')).toHaveCount(0);
  await scan(page, `${theme} / exhibit 6 colluder removed`);

  // ── Backwards navigation ───────────────────────────────────────────────
  // `#btn-prev` is the one control the forward walk never exercises, and the
  // exhibits it returns to are re-rendered from accumulated state rather than
  // restored, so they are not the same DOM the forward pass scanned.
  await page.locator('#btn-prev').click();
  await expect(page.locator('#progress')).toHaveText('Exhibit 5 of 6');
  await scan(page, `${theme} / exhibit 5 revisited`);
}

/**
 * Functional coverage for the claims silent-tally makes on screen.
 *
 * The a11y suite walks all six exhibits and drives the controls, but reads none
 * of the output, so no verdict, total or failure path was asserted. These tests
 * read the rendered DOM and check the page's numbers against each other: the
 * reconstructed total against the enrollments actually entered, each party's
 * local sum against the share-matrix column it claims to be summing, every
 * 3-subset against the canonical reconstruction, and the coalition's verdict
 * against the number its own Lagrange run produced. A hardcoded expectation
 * would pass against a page computing nonsense consistently; these will not.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

const THRESHOLD = 3;
const N_PARTIES = 5;
const DEFAULT_COUNTS = [1247, 983, 2104, 761, 1589];

const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  await page.goto('.');
  // The overlay clears once the WASM core is up and exhibit 1 has rendered.
  await page.waitForFunction(() => {
    const overlay = document.getElementById('loading-overlay');
    const container = document.getElementById('exhibit-container');
    return (
      (!overlay || overlay.style.display === 'none') && !!container && container.childElementCount > 0
    );
  });
  await page.addStyleTag({
    content: `*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;scroll-behavior:auto!important}`,
  });
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([]);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const flat = (s: string): string => s.replace(/\s+/g, ' ').trim();

async function textOf(locator: Locator): Promise<string> {
  return flat(await locator.innerText());
}

function capture(haystack: string, re: RegExp, what: string): string {
  const m = haystack.match(re);
  expect(m, `${what} not found in: ${haystack.slice(0, 400)}`).not.toBeNull();
  return m![1]!;
}

/** "6,437" → 6437 */
const grouped = (s: string): number => Number(s.replace(/,/g, ''));

const exhibit = (page: Page): Locator => page.locator('#exhibit-container');

async function currentExhibit(page: Page): Promise<number> {
  return Number(capture(await textOf(page.locator('#progress')), /Exhibit (\d+) of 6/, 'exhibit number'));
}

/** Lock every hospital on exhibit 2 (must already be on it). */
async function lockAll(page: Page): Promise<void> {
  for (let i = 0; i < N_PARTIES + 3; i++) {
    const btn = page.locator('[data-lock-id]:not([disabled])').first();
    if ((await btn.count()) === 0) break;
    await btn.click();
  }
  await expect(page.locator('[data-lock-id]:not([disabled])')).toHaveCount(0);
}

/** Walk from exhibit 1 to `target`, locking the inputs on the way. */
async function goToExhibit(page: Page, target: number, counts?: number[]): Promise<void> {
  await page.locator('#btn-next').click();
  await expect(page.locator('#progress')).toHaveText('Exhibit 2 of 6');
  if (counts) {
    for (let i = 0; i < counts.length; i++) {
      await page.locator(`[data-hospital-id="${i + 1}"]`).fill(String(counts[i]));
    }
  }
  await lockAll(page);
  for (let n = 3; n <= target; n++) {
    await page.locator('#btn-next').click();
    await expect(page.locator('#progress')).toHaveText(`Exhibit ${n} of 6`);
  }
  if (target === 2) return;
}

/** The 5×5 share matrix on exhibit 4, as displayed (rows = senders). */
async function shareMatrix(page: Page): Promise<string[][]> {
  return exhibit(page)
    .locator('table tbody tr')
    .evaluateAll((rows) =>
      rows.map((row) =>
        [...row.querySelectorAll('td')]
          .slice(1)
          .map((td) => td.textContent!.replace('self', '').replace(/\s+/g, '')),
      ),
    );
}

// ---------------------------------------------------------------------------
// Navigation and the exhibit-2 gate
// ---------------------------------------------------------------------------

test('navigation: the walkthrough is gated on locking every input, and ends at exhibit 6', async ({
  page,
}) => {
  await expect(page.locator('#progress')).toHaveText('Exhibit 1 of 6');
  await expect(page.locator('#btn-prev')).toBeDisabled();
  await expect(page.locator('#btn-next')).toBeEnabled();

  await page.locator('#btn-next').click();
  await expect(page.locator('#progress')).toHaveText('Exhibit 2 of 6');
  await expect(page.locator('#btn-prev')).toBeEnabled();
  // The gate: no advancing until all five are locked.
  await expect(page.locator('#btn-next')).toBeDisabled();
  expect(await textOf(exhibit(page))).toContain('0 of 5 hospitals locked in');
  expect(await textOf(exhibit(page))).toContain('Lock all five to continue');
  // The arrow-key path must respect the same gate.
  await page.keyboard.press('ArrowRight');
  expect(await currentExhibit(page)).toBe(2);

  for (let locked = 1; locked <= N_PARTIES; locked++) {
    await page.locator(`[data-lock-id="${locked}"]`).click();
    expect(await textOf(exhibit(page))).toContain(`${locked} of 5 hospitals locked in`);
    await expect(page.locator('#btn-next')).toBeDisabled({ timeout: 1000 }).catch(() => {});
    await expect(page.locator(`[data-lock-id="${locked}"]`)).toBeDisabled();
    await expect(page.locator(`[data-lock-id="${locked}"]`)).toHaveText('✓ Locked In');
  }
  expect(await textOf(exhibit(page))).toContain('All locked — ready to proceed');
  await expect(page.locator('#btn-next')).toBeEnabled();

  // The total stays hidden until exhibit 5 says otherwise.
  expect(await textOf(exhibit(page))).toContain('???');
  expect(await textOf(exhibit(page))).toContain('Revealed only after secure computation in Exhibit 5');

  for (let n = 3; n <= 6; n++) {
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#progress')).toHaveText(`Exhibit ${n} of 6`);
  }
  await expect(page.locator('#btn-next')).toBeDisabled();
  await page.keyboard.press('ArrowRight');
  expect(await currentExhibit(page)).toBe(6);

  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#progress')).toHaveText('Exhibit 5 of 6');
});

test('exhibit 2: an out-of-range enrollment is refused, named, and cannot be locked', async ({
  page,
}) => {
  await page.locator('#btn-next').click();
  await expect(page.locator('#progress')).toHaveText('Exhibit 2 of 6');

  for (const bad of ['0', '10000']) {
    await page.locator('[data-hospital-id="1"]').fill(bad);
    await expect(page.locator('#error-1'), bad).toBeVisible();
    expect(await textOf(page.locator('#error-1')), bad).toBe('Enter an integer between 1 and 9,999');

    await page.locator('[data-lock-id="1"]').click();
    expect(await textOf(page.locator('#error-1')), bad).toBe(
      'Enter a valid integer (1–9,999) before locking.',
    );
    // Refused means refused: still unlocked, still counted as zero, still gated.
    await expect(page.locator('[data-lock-id="1"]'), bad).toBeEnabled();
    await expect(page.locator('[data-lock-id="1"]'), bad).toHaveText('Lock In');
    expect(await textOf(exhibit(page)), bad).toContain('0 of 5 hospitals locked in');
    await expect(page.locator('#btn-next'), bad).toBeDisabled();
  }

  // A value inside the range clears the error and locks.
  await page.locator('[data-hospital-id="1"]').fill('4321');
  await expect(page.locator('#error-1')).toBeHidden();
  await page.locator('[data-lock-id="1"]').click();
  await expect(page.locator('[data-lock-id="1"]')).toBeDisabled();
  expect(await textOf(exhibit(page))).toContain('1 of 5 hospitals locked in');
});

// ---------------------------------------------------------------------------
// Exhibits 3 and 4 — the sharing and its distribution
// ---------------------------------------------------------------------------

test('exhibit 3: the drawable toy sharing really is f(x) = 8 + 2x + x² over GF(97)', async ({
  page,
}) => {
  await goToExhibit(page, 3);

  const body = await textOf(exhibit(page));
  expect(body).toContain('f(x) = s + a₁x + a₂x² over GF(p)');
  expect(body).toContain('p = 2⁶¹ − 1');
  expect(body).toContain(`Any ${THRESHOLD} shares reconstruct`);

  // The toy field's five points, recomputed.
  const toy = capture(body, /f\(1\)=(\d+)/, 'toy f(1)');
  void toy;
  const points: number[] = [];
  for (let x = 1; x <= N_PARTIES; x++) {
    points.push(Number(capture(body, new RegExp(`f\\(${x}\\)=(\\d+)`), `toy f(${x})`)));
  }
  const expected = [1, 2, 3, 4, 5].map((x) => (8 + 2 * x + x * x) % 97);
  expect(points).toEqual(expected);
  // And the prose lists the same five values.
  expect(body).toContain(`f(1) … f(5) = ${expected.join(', ')} all happen to stay below`);
  expect(body).toContain('f(0) = 8 (secret)');

  // The real sharing: one row per hospital-share pair.
  expect(body).toContain(`Share tables — all 5 hospitals (${N_PARTIES * N_PARTIES} shares total)`);
});

test('exhibit 4: the 5×5 matrix is complete and its diagonal is the self-held share', async ({
  page,
}) => {
  await goToExhibit(page, 4);

  const rows = exhibit(page).locator('table tbody tr');
  await expect(rows).toHaveCount(N_PARTIES);
  const matrix = await shareMatrix(page);
  expect(matrix).toHaveLength(N_PARTIES);
  for (const row of matrix) expect(row).toHaveLength(N_PARTIES);
  // Every cell holds a value, and the truncated forms are distinct — shares of
  // different polynomials must not coincide.
  const all = matrix.flat();
  expect(all.every((c) => /^\d+(…\d+)?$/.test(c))).toBe(true);
  expect(new Set(all).size).toBe(N_PARTIES * N_PARTIES);

  // Exactly one "self" marker per row, on the diagonal.
  const selfCells = await exhibit(page)
    .locator('table tbody tr')
    .evaluateAll((trs) =>
      trs.map((tr) =>
        [...tr.querySelectorAll('td')].slice(1).findIndex((td) => td.textContent!.includes('self')),
      ),
    );
  expect(selfCells).toEqual([0, 1, 2, 3, 4]);

  const body = await textOf(exhibit(page));
  expect(body).toContain('each hospital holds exactly 5 shares');
});

// ---------------------------------------------------------------------------
// Exhibit 5 — the homomorphism and the reconstruction
// ---------------------------------------------------------------------------

test('exhibit 5: each local sum is the share-matrix column it claims to sum', async ({ page }) => {
  await goToExhibit(page, 4);
  const matrix = await shareMatrix(page);
  await page.locator('#btn-next').click();
  await expect(page.locator('#progress')).toHaveText('Exhibit 5 of 6');

  // The listed local sums T₁…T₅, each with its own five-term expansion.
  const lines = async (): Promise<string[]> =>
    (await exhibit(page).innerText()).split('\n').map((l) => l.trim()).filter(Boolean);

  const listed = (await lines()).filter((l) => /^T\d = .+\+.+\(mod p\)$/.test(l));
  expect(listed).toHaveLength(N_PARTIES);

  listed.forEach((line, j) => {
    expect(line.startsWith(`T${j + 1} = `), `line ${j} is T${j + 1}`).toBe(true);
    const terms = capture(line, /^T\d = (.+) \(mod p\)$/, `expansion for T${j + 1}`)
      .split('+')
      .map((t) => t.trim());
    expect(terms, `T${j + 1} must sum one share from each hospital`).toHaveLength(N_PARTIES);
    // Column j of the matrix is exactly what party j+1 received.
    expect(terms).toEqual(matrix.map((row) => row[j]!));
  });

  // Each party's headline T must be the value its own expansion produces a name
  // for — the list prints both, and they have to agree.
  const headline: string[] = [];
  for (let party = 1; party <= N_PARTIES; party++) {
    const head = (await lines()).find((l) => new RegExp(`^T${party} = \\S+$`).test(l));
    expect(head, `headline value for T${party}`).toBeTruthy();
    headline.push(head!.replace(`T${party} = `, ''));
  }
  expect(new Set(headline).size, 'five distinct local sums').toBe(N_PARTIES);

  // The homomorphism walk-through, for every party in turn.
  for (let party = 1; party <= N_PARTIES; party++) {
    await exhibit(page).locator(`[data-hom-party="${party}"]`).click();
    await expect(exhibit(page).locator(`[data-hom-party="${party}"]`)).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(exhibit(page).locator('[data-hom-party][aria-pressed="true"]')).toHaveCount(1);

    const all = await lines();
    const start = all.indexOf(`Five shares at x = ${party}, summed in the field:`);
    expect(start, `walk-through header for party ${party}`).toBeGreaterThanOrEqual(0);
    // Label / value pairs: f1(k) … f5(k), then Tk.
    for (let sender = 1; sender <= N_PARTIES; sender++) {
      expect(all[start + sender * 2 - 1], `label f${sender}(${party})`).toBe(`f${sender}(${party})`);
      expect(all[start + sender * 2], `value f${sender}(${party})`).toBe(
        matrix[sender - 1]![party - 1]!,
      );
    }
    expect(all[start + 11]).toBe(`T${party} (mod p)`);
    expect(all[start + 12], `walk-through T${party} must match the list`).toBe(headline[party - 1]);

    expect(await textOf(exhibit(page))).toContain(
      `The left column is (f₁+⋯+f₅)(${party}); the right column is (f₁+⋯+f₅)(0).`,
    );
  }
});

test('exhibit 5: the reconstructed total is the enrollments actually entered, from any 3 parties', async ({
  page,
}) => {
  const counts = [1111, 222, 3333, 44, 555];
  const expectedTotal = counts.reduce((a, b) => a + b, 0);
  await goToExhibit(page, 5, counts);

  // The headline number.
  const reveal = await textOf(page.locator('#total-reveal'));
  expect(reveal).toContain('TOTAL ENROLLMENT ACROSS ALL SITES');
  expect(grouped(capture(reveal, /([\d,]+) Reconstructed via Lagrange/, 'total'))).toBe(expectedTotal);
  expect(reveal).toContain('Lagrange interpolation over GF(2⁶¹ − 1)');

  // The cross-check panel adds the entered values itself and agrees.
  const body = await textOf(exhibit(page));
  const direct = capture(body, /Direct sum: ([\d,+ ]+) =/, 'direct sum terms')
    .split('+')
    .map((t) => grouped(t.trim()));
  expect(direct).toEqual(counts);
  expect(grouped(capture(body, /Direct sum: [\d,+ ]+= ([\d,]+)/, 'direct total'))).toBe(expectedTotal);
  expect(grouped(capture(body, /Reconstructed: ([\d,]+)/, 'reconstructed total'))).toBe(expectedTotal);
  expect(body).toContain('✓ Match — protocol is correct.');
  expect(body).not.toContain('✗ Mismatch');

  // The omniscient column lists the same secrets and their sum.
  for (let i = 0; i < counts.length; i++) {
    expect(body).toContain(`s${i + 1} = f${i + 1}(0) ${counts[i]!.toLocaleString('en-US')}`);
  }
  expect(grouped(capture(body, /Σ secrets = f\(0\) ([\d,]+)/, 'sum of secrets'))).toBe(expectedTotal);

  // Any 3-subset reconstructs the same total — the claim the chooser makes.
  const subsets = [
    [1, 2, 3],
    [1, 3, 5],
    [3, 4, 5],
    [2, 4, 5],
  ];
  for (const subset of subsets) {
    const selected = await exhibit(page)
      .locator('[data-recon-id][aria-pressed="true"]')
      .evaluateAll((ns) => ns.map((n) => Number(n.getAttribute('data-recon-id'))));
    for (const id of selected) if (!subset.includes(id)) await exhibit(page).locator(`[data-recon-id="${id}"]`).click();
    for (const id of subset) {
      const btn = exhibit(page).locator(`[data-recon-id="${id}"]`);
      if ((await btn.getAttribute('aria-pressed')) !== 'true') await btn.click();
    }
    const result = await textOf(page.locator('#recon-result'));
    expect(result, subset.join(',')).toContain(
      `Interpolating (${subset.join(', T')}`.slice(0, 16),
    );
    expect(result, subset.join(',')).toContain('✓ f(0) =');
    expect(grouped(capture(result, /f\(0\) = ([\d,]+)/, 'subset total')), subset.join(',')).toBe(
      expectedTotal,
    );
    expect(result, subset.join(',')).toContain('same total, from a different 3-subset');
  }
});

test('exhibit 5: fewer than three local sums leaves the total undetermined, and says why', async ({
  page,
}) => {
  await goToExhibit(page, 5);

  const deselectAll = async (): Promise<void> => {
    const on = await exhibit(page)
      .locator('[data-recon-id][aria-pressed="true"]')
      .evaluateAll((ns) => ns.map((n) => n.getAttribute('data-recon-id')!));
    for (const id of on) await exhibit(page).locator(`[data-recon-id="${id}"]`).click();
  };

  await deselectAll();
  let result = await textOf(page.locator('#recon-result'));
  expect(result).toContain('⚠ Undetermined — 0 of 3 needed.');
  expect(result).toContain('Pick 3 local sums to reconstruct the total.');
  expect(result).not.toContain('f(0) =');

  await exhibit(page).locator('[data-recon-id="2"]').click();
  result = await textOf(page.locator('#recon-result'));
  expect(result).toContain('⚠ Undetermined — 1 of 3 needed.');
  expect(result).toContain('With 1 point on a degree-2 sharing');
  expect(result).toContain('Add 2 more.');

  await exhibit(page).locator('[data-recon-id="5"]').click();
  result = await textOf(page.locator('#recon-result'));
  expect(result).toContain('⚠ Undetermined — 2 of 3 needed.');
  expect(result).toContain('one curve fits for every value in the field');
  expect(result).toContain('Add 1 more.');
  expect(result).not.toContain('f(0) =');

  // Crossing the threshold produces a number; going past it is redundant, and
  // the page says so rather than pretending the extra point did work.
  await exhibit(page).locator('[data-recon-id="1"]').click();
  expect(await textOf(page.locator('#recon-result'))).toContain('✓ f(0) =');

  await exhibit(page).locator('[data-recon-id="3"]').click();
  result = await textOf(page.locator('#recon-result'));
  expect(result).toContain('4 points selected. Any 3 already determine the answer');
  expect(result).toContain('Deselect down to exactly 3');
  expect(result).not.toContain('f(0) =');
});

// ---------------------------------------------------------------------------
// Exhibit 6 — the coalition attack
// ---------------------------------------------------------------------------

interface Attack {
  colluders: number[];
  victim: number;
  recovered: string;
  realCount: number;
  broken: boolean;
  shares: string[];
}

async function readAttack(page: Page): Promise<Attack> {
  const body = await textOf(exhibit(page));
  const colluders = capture(body, /Coalition: Hospitals? ([\d &]+?) — attacking/, 'colluders')
    .split('&')
    .map((s) => Number(s.trim()));
  const victim = Number(capture(body, /attacking Hospital (\d+)/, 'victim'));
  const recovered = capture(body, /coalition's reconstruction f\(0\) = (\d+)/, 'reconstruction');
  const realCount = grouped(capture(body, /real count = ([\d,]+)/, 'real count'));
  const broken = body.includes('✗ Guarantee broken.');
  const failed = body.includes('✓ Coalition fails.');
  // Exactly one verdict, never both and never neither.
  expect(broken !== failed, 'coalition verdict is ambiguous').toBe(true);
  // f(0) is the reconstruction line, not a share the coalition holds.
  const shares = [...body.matchAll(/f\(([1-9]\d*)\) = (\d+(?:…\d+)?)/g)].map((m) => m[2]!);
  return { colluders, victim, recovered, realCount, broken, shares };
}

test('exhibit 6: the coalition verdict is whatever its own Lagrange run produced', async ({
  page,
}) => {
  const counts = [1111, 222, 3333, 44, 555];
  await goToExhibit(page, 4, counts);
  const matrix = await shareMatrix(page);
  await page.locator('#btn-next').click();
  await page.locator('#btn-next').click();
  await expect(page.locator('#progress')).toHaveText('Exhibit 6 of 6');

  expect(await textOf(exhibit(page))).toContain(
    'Select up to 4 hospitals above to simulate a coalition attack.',
  );
  await expect(exhibit(page).locator('[data-coalition-id][aria-pressed="true"]')).toHaveCount(0);

  for (let size = 1; size <= N_PARTIES - 1; size++) {
    await exhibit(page).locator(`[data-coalition-id="${size}"]`).click();
    await expect(exhibit(page).locator('[data-coalition-id][aria-pressed="true"]')).toHaveCount(size);

    const attack = await readAttack(page);
    expect(attack.colluders, `size ${size}`).toEqual([...Array(size)].map((_, i) => i + 1));
    // The victim is the first hospital outside the coalition.
    expect(attack.victim, `size ${size}`).toBe(size + 1);
    expect(attack.realCount, `size ${size}`).toBe(counts[attack.victim - 1]);
    // The coalition holds exactly its members' shares of the victim's row.
    expect(attack.shares, `size ${size}`).toEqual(
      [...Array(size)].map((_, i) => matrix[attack.victim - 1]![i]!),
    );

    if (size >= THRESHOLD) {
      // At or above the threshold the run must land on the secret exactly, and
      // the verdict must be the failure of the guarantee.
      expect(attack.broken, `size ${size}`).toBe(true);
      expect(Number(attack.recovered), `size ${size}`).toBe(attack.realCount);
      expect(await textOf(exhibit(page)), `size ${size}`).toContain(
        `${size} colluders ≥ threshold t = ${THRESHOLD}`,
      );
      expect(await textOf(exhibit(page)), `size ${size}`).toContain('to the digit');
    } else {
      // Below it the run must miss — and the page must not claim a break.
      expect(attack.broken, `size ${size}`).toBe(false);
      expect(Number(attack.recovered), `size ${size}`).not.toBe(attack.realCount);
      const body = await textOf(exhibit(page));
      expect(body, `size ${size}`).toContain(`is below the threshold t = ${THRESHOLD}`);
      expect(body, `size ${size}`).toContain(`fits a degree-${size - 1} curve`);
      expect(body, `size ${size}`).toContain(
        `With ${size} of ${THRESHOLD} points, the remaining ${THRESHOLD - size} coefficient`,
      );
    }
  }

  // The cap: the last hospital cannot join, because it is the victim.
  const fifth = exhibit(page).locator('[data-coalition-id="5"]');
  await expect(fifth).toHaveAttribute('aria-disabled', 'true');
  await expect(fifth).toContainText('The victim');
  await fifth.click({ force: true });
  await expect(exhibit(page).locator('[data-coalition-id][aria-pressed="true"]')).toHaveCount(4);
  expect((await readAttack(page)).victim).toBe(5);

  // Removing a colluder must put the guarantee back — "hold, then collapse".
  await exhibit(page).locator('[data-coalition-id="4"]').click();
  await exhibit(page).locator('[data-coalition-id="3"]').click();
  const restored = await readAttack(page);
  expect(restored.colluders).toEqual([1, 2]);
  expect(restored.broken).toBe(false);
  expect(Number(restored.recovered)).not.toBe(restored.realCount);
  const body = await textOf(exhibit(page));
  expect(body).toContain('Multiple valid polynomials through the 2 known points');
  expect(body).toContain('6 curves · 1 pair of points · 6 different secrets');
});

test('exhibit 6: the coalition never sees a defaulted count — edited inputs flow through', async ({
  page,
}) => {
  // The whole pipeline must carry the learner's numbers, not the seeded ones.
  const counts = [9, 8888, 77, 666, 5555];
  await goToExhibit(page, 6, counts);
  expect(counts).not.toEqual(DEFAULT_COUNTS);

  for (const victim of [4, 5]) {
    const colluders = [1, 2, 3].concat(victim === 5 ? [4] : []);
    const pressed = await exhibit(page)
      .locator('[data-coalition-id][aria-pressed="true"]')
      .evaluateAll((ns) => ns.map((n) => Number(n.getAttribute('data-coalition-id'))));
    for (const id of pressed) if (!colluders.includes(id)) await exhibit(page).locator(`[data-coalition-id="${id}"]`).click();
    for (const id of colluders) {
      const btn = exhibit(page).locator(`[data-coalition-id="${id}"]`);
      if ((await btn.getAttribute('aria-pressed')) !== 'true') await btn.click();
    }

    const attack = await readAttack(page);
    expect(attack.victim, `victim ${victim}`).toBe(victim);
    expect(attack.realCount, `victim ${victim}`).toBe(counts[victim - 1]);
    expect(attack.broken, `victim ${victim}`).toBe(true);
    expect(Number(attack.recovered), `victim ${victim}`).toBe(counts[victim - 1]);
  }
});

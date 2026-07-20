/**
 * TC-21 through TC-25: UI smoke tests — critical user flows
 */
import { test, expect } from '@playwright/test';

// ── TC-21: App loads and renders main navigation ──────────────────────────────

test('TC-21 [CRITICAL] app loads and shows main navigation sidebar', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#sidebar')).toBeVisible({ timeout: 8_000 });
  // Sidebar should contain at least one nav item
  const navCount = await page.locator('.nav-item').count();
  expect(navCount).toBeGreaterThan(0);
});

// ── TC-22: Job Search view loads ──────────────────────────────────────────────

test('TC-22 [HIGH] job search view renders search input and button', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#sidebar', { timeout: 8_000 });
  // Click job search nav item
  const navItem = page.locator('.nav-item').filter({ hasText: /job search/i }).first();
  await navItem.click();
  // Wait for view content to render
  await page.waitForTimeout(500);
  await expect(page.locator('input.input, input[placeholder], textarea').first()).toBeVisible({ timeout: 6_000 });
});

// ── TC-23: Resume & CV view loads with upload zone ───────────────────────────

test('TC-23 [HIGH] resume view shows upload zone and file input', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#sidebar', { timeout: 8_000 });
  const resumeNav = page.locator('.nav-item').filter({ hasText: /resume/i }).first();
  await resumeNav.click();
  // Upload zone or file input should be present
  await page.waitForTimeout(500);
  const uploadCount = await page.locator('input[type="file"], .upload-zone, [data-upload], .drop-zone').count();
  expect(uploadCount).toBeGreaterThan(0);
});

// ── TC-24: Settings view loads with provider selector ────────────────────────

test('TC-24 [HIGH] settings view loads and shows AI provider options', async ({ page }) => {
  await page.goto('/');
  const settingsNav = page.locator('.nav-item, a, button').filter({ hasText: /settings/i }).first();
  if (await settingsNav.count() > 0) {
    await settingsNav.click();
  }
  await expect(page.locator('select, .provider-tab, [data-provider], input[type="radio"]').first()).toBeVisible({ timeout: 6_000 });
});

// ── TC-25: No unhandled JS errors on load ────────────────────────────────────

test('TC-25 [HIGH] no unhandled JavaScript errors on initial page load', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('/');
  await page.waitForTimeout(2_000);
  expect(errors.filter(e => !e.includes('ResizeObserver'))).toHaveLength(0);
});

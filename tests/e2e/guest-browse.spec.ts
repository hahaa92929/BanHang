import { expect, test } from '@playwright/test';

test('guest can browse seeded catalog but cannot add to cart', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('home-page')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Catalog' })).toBeVisible();
  await expect(page.getByText('iPhone 15 128GB')).toBeVisible();
  await expect(page.getByTestId('session-line')).toContainText('Not logged in');
  await expect(page.getByRole('button', { name: 'Add to cart' }).first()).toBeDisabled();
});

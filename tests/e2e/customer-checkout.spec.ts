import { expect, test } from '@playwright/test';

test('customer can checkout an order from the seeded storefront', async ({ page }) => {
  await page.goto('/');

  await page.getByPlaceholder('Email').fill('customer@banhang.local');
  await page.getByPlaceholder('Password').fill('customer12345');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByTestId('session-line')).toContainText('Customer Demo');
  await expect(page.getByRole('button', { name: 'Add to cart' }).first()).toBeEnabled();

  await page.getByRole('button', { name: 'Add to cart' }).first().click();
  await expect(page.getByTestId('notice')).toContainText('Added to cart');

  await page.getByRole('button', { name: 'Submit checkout' }).click();

  await expect(page.getByTestId('notice')).toContainText('Checkout success');
  await expect(page.getByTestId('orders-panel')).toContainText('Status: created');
  await expect(page.getByTestId('cart-total')).toContainText('0');
});

import { expect, test } from '@playwright/test';
import { createSeededOrder } from './support/api';

test('admin can advance order status from created to completed', async ({ page, request }) => {
  const order = await createSeededOrder(request);

  await page.goto('/');

  await page.getByPlaceholder('Email').fill('admin@banhang.local');
  await page.getByPlaceholder('Password').fill('admin12345');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByTestId('session-line')).toContainText('Admin Demo');

  const orderCard = page.getByTestId(`order-card-${order.id}`);
  await expect(orderCard).toBeVisible();

  await orderCard.getByRole('button', { name: 'Move to confirmed' }).click();
  await expect(orderCard).toContainText('Status: confirmed');

  await orderCard.getByRole('button', { name: 'Move to shipping' }).click();
  await expect(orderCard).toContainText('Status: shipping');

  await orderCard.getByRole('button', { name: 'Move to completed' }).click();
  await expect(orderCard).toContainText('Status: completed');
  await expect(orderCard).toContainText('Payment: cod / paid');
});

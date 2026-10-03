import { expect, test } from '@playwright/test';
import { mockCalendar } from './support';

test('home opens the implemented workspaces and returns to the dashboard', async ({ page }) => {
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'EcoCut Dashboard' })).toBeVisible();

  const destinations = [
    { action: 'Clients', path: '/clients', heading: 'Client book' },
    { action: 'Manage Employees', path: '/employees/manage', heading: 'Manage employees' },
    { action: 'Start Next Job', path: '/jobs/start', heading: 'Start Next Job' },
    { action: 'Client Broadcast', path: '/communications/broadcast', heading: 'Client broadcast' },
    { action: 'Chats', path: '/communications/chats', heading: 'Chats' },
  ];

  for (const destination of destinations) {
    await page.getByRole('button', { name: new RegExp(`^${destination.action}`) }).click();
    await expect(page).toHaveURL(new RegExp(`${destination.path.replaceAll('/', '\\/')}\/?$`));
    await expect(
      page.getByRole('heading', { name: destination.heading, exact: true }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Back to dashboard' }).click();
    await expect(page.getByRole('heading', { name: 'EcoCut Dashboard' })).toBeVisible();
  }
});

test('add entry menu opens both entry variants and closes without saving', async ({ page }) => {
  await mockCalendar(page);
  await page.goto('/home');
  await page.getByRole('button', { name: 'Add Entry' }).click();
  await page.getByRole('button', { name: 'Warm Lead' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).last().click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.getByRole('button', { name: 'Add Entry' }).click();
  await page.getByRole('button', { name: 'Customer / Closed' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).last().click();
  await expect(page.getByRole('dialog')).toBeHidden();
});

import { expect, test } from '@playwright/test';
import { backendUrl } from './support';

test('employee profile, role controls, filters, and clock board work together', async ({
  page,
}) => {
  const suffix = Math.floor(1000 + Math.random() * 9000).toString();
  const fullName = `Playwright Worker${suffix}`;
  await page.goto('/employees/manage');
  await expect(page.getByRole('heading', { name: 'Employee roster' })).toBeVisible();

  await page.getByRole('button', { name: 'Add employee' }).click();
  const editor = page.getByRole('article', { name: 'Employee profile editor' });
  await expect(editor.getByRole('heading', { name: 'Add employee profile' })).toBeVisible();
  await editor.getByRole('button', { name: 'Save profile' }).click();
  await expect(editor.getByRole('alert')).toContainText('First name');

  await editor.getByLabel('First name *').fill('Playwright');
  await editor.getByLabel('Last name *').fill(`Worker${suffix}`);
  await editor.getByLabel('Phone (###) ###-#### *').fill(`(514) 555-${suffix}`);
  await editor.getByLabel('Email').fill(`worker.${suffix}@example.test`);
  await editor.getByLabel('Role *').fill('Crew');
  await editor.getByLabel('Hourly rate *').fill('25');
  await editor.getByRole('button', { name: 'Save profile' }).click();

  await page.getByRole('searchbox', { name: 'Search roster' }).fill(fullName);
  const card = page.locator('.employee-card').filter({ hasText: fullName });
  await expect(card).toBeVisible();
  await card.click();
  await expect(card.getByRole('button', { name: 'Edit' })).toBeEnabled();

  await page
    .getByRole('group', { name: 'Operator role' })
    .getByRole('button', { name: 'Manager' })
    .click();
  await expect(card.getByRole('button', { name: 'Edit' })).toBeDisabled();
  await expect(card.getByRole('button', { name: 'Archive' })).toBeDisabled();
  await page
    .getByRole('group', { name: 'Operator role' })
    .getByRole('button', { name: 'Owner' })
    .click();

  await page.getByRole('button', { name: 'Clock board' }).click();
  const clockCard = page.locator('.clock-card').filter({ hasText: fullName });
  await expect(clockCard).toBeVisible();
  await clockCard.getByRole('button', { name: 'Clock in' }).click();
  await expect(clockCard.getByRole('button', { name: 'Clock out' })).toBeEnabled();
  await clockCard.getByRole('button', { name: 'Clock out' }).click();
  await expect(clockCard.getByRole('button', { name: 'Clock in' })).toBeEnabled();

  await card.getByRole('button', { name: 'Archive' }).click();
  await expect(card.getByRole('button', { name: 'Restore' })).toBeVisible();
  await page
    .getByRole('group', { name: 'Status filters' })
    .getByRole('button', { name: 'Active', exact: true })
    .click();
  await expect(card).toBeHidden();
  await page
    .getByRole('group', { name: 'Status filters' })
    .getByRole('button', { name: 'Inactive', exact: true })
    .click();
  await expect(card).toBeVisible();
});

test('manual hours can be created, edited, and removed for an employee', async ({
  page,
  request,
}) => {
  const suffix = Math.floor(1000 + Math.random() * 9000).toString();
  const fullName = `Playwright Hours${suffix}`;
  const created = await request.post(`${backendUrl}/employees/roster`, {
    data: {
      firstName: 'Playwright',
      lastName: `Hours${suffix}`,
      phone: `(514) 555-${suffix}`,
      role: 'Crew',
      hourlyRate: 26,
    },
  });
  expect(created.ok()).toBe(true);

  await page.goto('/employees/manage');
  await page.getByRole('searchbox', { name: 'Search roster' }).fill(fullName);
  const card = page.locator('.employee-card').filter({ hasText: fullName });
  await card.click();
  await card.getByRole('button', { name: 'Hours' }).click();
  const editor = card.getByRole('region', { name: 'Employee hours editor' });
  await expect(editor.getByRole('heading', { name: 'Hours editor' })).toBeVisible();
  await editor.getByRole('button', { name: 'Save hours' }).click();
  await expect(editor.getByRole('alert')).toContainText('Hours');
  await editor.getByLabel('Hours *').fill('2.5');
  await editor.getByLabel('Manual correction note (optional)').fill('Training shift');
  await editor.getByRole('button', { name: 'Save hours' }).click();
  const row = editor.locator('.hours-card').filter({ hasText: 'Training shift' });
  await expect(row).toContainText('2.5h');

  await row.getByRole('button', { name: 'Edit' }).click();
  await editor.getByLabel('Hours *').fill('3');
  await editor.getByRole('button', { name: 'Update hours' }).click();
  await expect(row).toContainText('3h');
  await row.getByRole('button', { name: 'Remove' }).click();
  await expect(row).toBeHidden();
});

import { expect, test } from '@playwright/test';
import { backendUrl, seedEntry } from './support';

test('a saved client job autofills and links a new crew assignment', async ({ page, request }) => {
  const { client, entry } = await seedEntry(request);
  const suffix = Math.floor(1000 + Math.random() * 9000).toString();
  const employeeName = `Playwright Linked${suffix}`;
  const employee = await request.post(`${backendUrl}/employees/roster`, {
    data: {
      firstName: 'Playwright',
      lastName: `Linked${suffix}`,
      phone: `(514) 555-${suffix}`,
      role: 'Crew',
      hourlyRate: 25,
    },
  });
  expect(employee.ok()).toBe(true);
  const employeeId = ((await employee.json()) as { id: string }).id;

  await page.goto('/jobs/start');
  await page.getByRole('button', { name: 'Schedule later' }).click();
  await page.getByLabel('Linked client job mode *').selectOption(entry.id);
  await expect(
    page.getByText(`Linked job selected: ${client.fullName}`, { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel('Job label *')).toHaveAttribute('readonly', '');
  await expect(page.locator('#start-next-draft app-address-autocomplete-field input')).toHaveValue(
    client.address,
  );
  await page.getByRole('button', { name: 'Continue to Step 2' }).click();
  await page.getByRole('searchbox', { name: 'Search crew' }).fill(employeeName);
  await page
    .locator('.crew-card')
    .filter({ hasText: employeeName })
    .getByRole('button', { name: 'Select', exact: true })
    .click();
  await page.getByRole('button', { name: 'Continue to Step 3' }).click();
  await expect(page.getByText('No conflicts detected. Assignment is ready to save.')).toBeVisible();
  await page.getByRole('button', { name: 'Save assignment' }).click();
  await expect(page.getByRole('status')).toContainText('Assignment saved');

  const history = await request.get(`${backendUrl}/employees/history`);
  expect(history.ok()).toBe(true);
  const records = (await history.json()) as {
    employeeId: string;
    jobEntryId: string | null;
    status: string;
  }[];
  expect(records).toContainEqual(
    expect.objectContaining({
      employeeId,
      jobEntryId: entry.id,
      status: 'scheduled',
    }),
  );
});

import { expect, test } from '@playwright/test';
import { backendUrl } from './support';

function localDateTime(daysAhead: number, hour: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(hour, 0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:00`;
}

test('manual job assignment moves through job, crew, review, and history', async ({
  page,
  request,
}) => {
  const suffix = Math.floor(1000 + Math.random() * 9000).toString();
  const employeeName = `Playwright Jobber${suffix}`;
  const label = `Playwright route ${suffix}`;
  const create = await request.post(`${backendUrl}/employees/roster`, {
    data: {
      firstName: 'Playwright',
      lastName: `Jobber${suffix}`,
      phone: `(514) 555-${suffix}`,
      email: `jobber.${suffix}@example.test`,
      role: 'Crew',
      hourlyRate: 25,
    },
  });
  expect(create.ok()).toBe(true);

  await page.goto('/jobs/start');
  await expect(page.getByRole('heading', { name: 'Step 1 - Job details' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Step 2 - Crew' })).toBeDisabled();
  await page.getByRole('button', { name: 'Schedule later' }).click();
  await page
    .getByLabel('Linked client job mode *')
    .selectOption({ label: 'No specific client job (manual)' });
  await page.getByLabel('Job label *').fill(label);
  await page
    .locator('#start-next-draft app-address-autocomplete-field input')
    .fill(`${suffix} Route St`);
  await page.getByLabel('Scheduled start *').fill(localDateTime(3, 10));
  await page.getByLabel('Scheduled end *').fill(localDateTime(3, 12));
  await page.getByRole('button', { name: 'Continue to Step 2' }).click();

  await expect(page.getByRole('heading', { name: 'Step 2 - Crew pool' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search crew' }).fill(employeeName);
  const crew = page.locator('.crew-card').filter({ hasText: employeeName });
  await expect(crew).toBeVisible();
  await crew.getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to Step 3' }).click();
  await expect(page.getByText('No conflicts detected. Assignment is ready to save.')).toBeVisible();
  await page.getByRole('button', { name: 'Save assignment' }).click();
  await expect(page.getByRole('status')).toContainText('Assignment saved');

  const history = await request.get(`${backendUrl}/employees/history`);
  expect(history.ok()).toBe(true);
  const records = (await history.json()) as { id: string; siteLabel: string; status: string }[];
  const saved = records.find((record) => record.siteLabel === label);
  expect(saved?.status).toBe('scheduled');

  await page.getByRole('button', { name: 'Step 1 - Job' }).click();
  await page
    .getByLabel('Linked client job mode *')
    .selectOption({ label: 'No specific client job (manual)' });
  await page.getByRole('button', { name: 'Continue to Step 2' }).click();
  await page.getByRole('searchbox', { name: 'Search crew' }).fill(employeeName);
  await page
    .locator('.crew-card')
    .filter({ hasText: employeeName })
    .getByRole('button', { name: 'Select', exact: true })
    .click();
  await page.getByRole('button', { name: 'Scheduled history' }).click();
  await expect(page.locator('.history-card').filter({ hasText: label })).toBeVisible();
  await page
    .locator('.history-card')
    .filter({ hasText: label })
    .getByRole('button', { name: 'Cancel assignment' })
    .click();
  await expect
    .poll(async () => {
      const response = await request.get(`${backendUrl}/employees/history`);
      const items = (await response.json()) as { id: string; status: string }[];
      return items.find((item) => item.id === saved?.id)?.status;
    })
    .toBe('cancelled');
});

test('an active run supports an early crew exit before the remaining crew ends it', async ({
  page,
  request,
}) => {
  const suffix = Math.floor(1000 + Math.random() * 9000).toString();
  const employeeName = `Playwright Runner${suffix}`;
  const secondEmployeeName = `Playwright Helper${suffix}`;
  const label = `Playwright lifecycle ${suffix}`;
  const create = await request.post(`${backendUrl}/employees/roster`, {
    data: {
      firstName: 'Playwright',
      lastName: `Runner${suffix}`,
      phone: `(514) 555-${suffix}`,
      role: 'Crew',
      hourlyRate: 25,
    },
  });
  expect(create.ok()).toBe(true);
  const employeeId = ((await create.json()) as { id: string }).id;
  const createSecond = await request.post(`${backendUrl}/employees/roster`, {
    data: {
      firstName: 'Playwright',
      lastName: `Helper${suffix}`,
      phone: `(438) 555-${suffix}`,
      role: 'Crew',
      hourlyRate: 24,
    },
  });
  expect(createSecond.ok()).toBe(true);
  const secondEmployeeId = ((await createSecond.json()) as { id: string }).id;

  await page.goto('/jobs/start');
  await page.getByRole('button', { name: 'Schedule later' }).click();
  await page
    .getByLabel('Linked client job mode *')
    .selectOption({ label: 'No specific client job (manual)' });
  await page.getByLabel('Job label *').fill(label);
  await page.locator('#start-next-draft app-address-autocomplete-field input').fill('100 Run St');
  await page.getByLabel('Scheduled start *').fill(localDateTime(5, 10));
  await page.getByLabel('Scheduled end *').fill(localDateTime(5, 12));
  await page.getByRole('button', { name: 'Continue to Step 2' }).click();
  await page.getByRole('searchbox', { name: 'Search crew' }).fill(employeeName);
  await page
    .locator('.crew-card')
    .filter({ hasText: employeeName })
    .getByRole('button', { name: 'Select', exact: true })
    .click();
  await page.getByRole('searchbox', { name: 'Search crew' }).fill(secondEmployeeName);
  await page
    .locator('.crew-card')
    .filter({ hasText: secondEmployeeName })
    .getByRole('button', { name: 'Select', exact: true })
    .click();
  await page.getByRole('button', { name: 'Continue to Step 3' }).click();
  await page.getByRole('button', { name: 'Save assignment' }).click();
  await expect(page.getByRole('status')).toContainText('Assignment saved');

  await page.getByRole('button', { name: 'Step 1 - Job' }).click();
  await page
    .getByLabel('Linked client job mode *')
    .selectOption({ label: 'No specific client job (manual)' });
  await page.getByRole('button', { name: 'Continue to Step 2' }).click();
  await page.getByRole('searchbox', { name: 'Search crew' }).fill(employeeName);
  await page
    .locator('.crew-card')
    .filter({ hasText: employeeName })
    .getByRole('button', { name: 'Select', exact: true })
    .click();
  await page.getByRole('searchbox', { name: 'Search crew' }).fill(secondEmployeeName);
  await page
    .locator('.crew-card')
    .filter({ hasText: secondEmployeeName })
    .getByRole('button', { name: 'Select', exact: true })
    .click();
  await page.getByRole('button', { name: 'Scheduled history' }).click();
  const historyCard = page.locator('.history-card').filter({ hasText: employeeName });
  const secondHistoryCard = page.locator('.history-card').filter({ hasText: secondEmployeeName });
  await expect(historyCard.getByRole('button', { name: 'Start job' })).toBeVisible();
  await historyCard.getByRole('button', { name: 'Start job' }).click();
  await expect(historyCard).toContainText('Run active since');
  await expect(secondHistoryCard).toContainText('Run active since');
  await expect(historyCard.getByRole('button', { name: 'End job' })).toBeVisible();

  page.on('dialog', async (dialog) => {
    const note = dialog.message().includes('clock-out')
      ? 'Left early through Playwright'
      : 'Finished through Playwright';
    await dialog.accept(dialog.type() === 'prompt' ? note : undefined);
  });
  await secondHistoryCard.getByRole('button', { name: 'Clock out member' }).click();
  await expect(secondHistoryCard).toContainText('completed');
  await expect(secondHistoryCard).toContainText('Left early through Playwright');
  await expect(historyCard).toContainText('Run active since');

  await historyCard.getByRole('button', { name: 'End job' }).click();
  await expect(historyCard).toContainText('completed');
  await expect(historyCard).toContainText('Clock-out note: Finished through Playwright');
  const history = await request.get(`${backendUrl}/employees/history`);
  expect(history.ok()).toBe(true);
  const records = (await history.json()) as {
    employeeId: string;
    siteLabel: string;
    status: string;
    runStartedAt: string | null;
    runEndedAt: string | null;
  }[];
  const saved = records.find(
    (record) => record.siteLabel === label && record.employeeId === employeeId,
  );
  const earlyExit = records.find(
    (record) => record.siteLabel === label && record.employeeId === secondEmployeeId,
  );
  expect(saved).toMatchObject({ status: 'completed' });
  expect(saved?.runStartedAt).toBeTruthy();
  expect(saved?.runEndedAt).toBeTruthy();
  expect(earlyExit).toMatchObject({ status: 'completed' });
  expect(earlyExit?.runEndedAt).toBeTruthy();
});

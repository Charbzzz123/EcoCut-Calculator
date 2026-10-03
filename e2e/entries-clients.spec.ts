import { expect, test } from '@playwright/test';
import { backendUrl, mockCalendar, seedEntry, uniqueClient } from './support';

test('a warm lead is validated, saved, found, edited, and removed through the UI', async ({
  page,
  request,
}) => {
  const client = uniqueClient();
  await mockCalendar(page);
  await page.goto('/home');
  await page.getByRole('button', { name: 'Add Entry' }).click();
  await page.getByRole('button', { name: 'Warm Lead' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Save Warm Lead' }).click();
  await expect(dialog.getByRole('alert')).toContainText('First name');
  await expect(dialog.getByRole('alert')).toContainText('Home address');

  await dialog.getByLabel('First name').fill(client.firstName);
  await dialog.getByLabel('Last name').fill(client.lastName);
  await dialog.locator('app-address-autocomplete-field input').fill(client.address);
  await dialog.getByLabel('Phone number').fill(client.phone);
  await dialog.getByLabel('Email (optional)').fill(client.email);
  await dialog.getByRole('radio', { name: 'Hedge Trimming' }).check();
  await dialog.getByLabel('Job value').fill('450');
  await dialog.getByLabel('Additional details (optional)').fill('One tall hedge at front');
  await dialog.getByRole('button', { name: 'Save Warm Lead' }).click();
  await expect(dialog).toBeHidden();

  await expect
    .poll(async () => {
      const response = await request.get(`${backendUrl}/entries/clients`);
      const clients = (await response.json()) as { fullName: string }[];
      return clients.some((item) => item.fullName === client.fullName);
    })
    .toBe(true);

  await page.getByRole('button', { name: /^Clients/ }).click();
  await page.getByRole('searchbox', { name: 'Search clients' }).fill(client.lastName);
  await page.getByRole('button', { name: new RegExp(client.fullName) }).click();
  const drawer = page.getByRole('dialog', { name: client.fullName });
  await expect(drawer.getByRole('heading', { name: client.fullName })).toBeVisible();
  await expect(drawer.getByText('Hedge Trimming')).toBeVisible();

  await drawer.getByRole('button', { name: 'Edit client' }).click();
  await drawer.getByLabel('Last name').fill(`${client.lastName}Updated`);
  await drawer.getByRole('button', { name: 'Save client' }).click();
  await expect(drawer.getByRole('heading', { name: `${client.fullName}Updated` })).toBeVisible();

  page.once('dialog', (confirmation) => confirmation.accept());
  await drawer.getByRole('button', { name: 'Delete client' }).click();
  await expect(page.getByRole('button', { name: new RegExp(client.lastName) })).toHaveCount(0);
});

test('client search ignores phone punctuation and job deletion updates the history', async ({
  page,
  request,
}) => {
  const { client, entry } = await seedEntry(request);
  await page.goto('/clients');
  await page
    .getByRole('searchbox', { name: 'Search clients' })
    .fill(client.phone.replace(/\D/g, ''));
  await page.getByRole('button', { name: new RegExp(client.fullName) }).click();
  const drawer = page.getByRole('dialog', { name: client.fullName });
  await expect(drawer.getByRole('button', { name: 'Delete job' })).toBeVisible();
  page.once('dialog', (confirmation) => confirmation.accept());
  await drawer.getByRole('button', { name: 'Delete job' }).click();
  await expect(drawer).toBeHidden();
  await expect(page.getByText('No clients match that search yet.')).toBeVisible();
  await expect
    .poll(async () => {
      const response = await request.get(`${backendUrl}/entries`);
      return ((await response.json()) as { id: string }[]).some((item) => item.id === entry.id);
    })
    .toBe(false);
});

test('customer entry schedules a calendar event and persists its event link', async ({
  page,
  request,
}) => {
  const client = uniqueClient();
  let calendarCreated = false;
  await page.route('**/api/calendar/events**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON() as {
        summary: string;
        start: string;
        end: string;
      };
      expect(payload.summary).toContain(client.fullName);
      expect(new Date(payload.end).getTime()).toBeGreaterThan(new Date(payload.start).getTime());
      calendarCreated = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'playwright-calendar-event', ...payload }),
      });
      return;
    }
    await route.abort('blockedbyclient');
  });

  await page.goto('/home');
  await page.getByRole('button', { name: 'Add Entry' }).click();
  await page.getByRole('button', { name: 'Customer / Closed' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('First name').fill(client.firstName);
  await dialog.getByLabel('Last name').fill(client.lastName);
  await dialog.locator('app-address-autocomplete-field input').fill(client.address);
  await dialog.getByLabel('Phone number').fill(client.phone);
  await dialog.getByLabel('Email (optional)').fill(client.email);
  await dialog.getByRole('radio', { name: 'Hedge Trimming' }).check();
  await dialog.getByLabel('Job value').fill('500');
  await dialog.getByLabel('Additional details (optional)').fill('Trim front hedge');

  await dialog.getByRole('button', { name: 'Week', exact: true }).click();
  await expect(dialog.locator('.calendar-view-panel--week')).toBeVisible();
  await dialog.getByRole('button', { name: 'Month', exact: true }).click();
  await expect(dialog.locator('.calendar-view-panel--month')).toBeVisible();
  await dialog.getByRole('button', { name: 'Day', exact: true }).click();

  const date = new Date();
  date.setDate(date.getDate() + 4);
  const dateInput = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  await dialog.getByLabel('Date', { exact: true }).fill(dateInput);
  await dialog.getByLabel('Start time').fill('10:00');
  await dialog.getByLabel('End time').fill('12:00');
  await dialog.getByRole('button', { name: 'Save Customer' }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => calendarCreated).toBe(true);

  let storedId = '';
  await expect
    .poll(async () => {
      const response = await request.get(`${backendUrl}/entries`);
      const entries = (await response.json()) as {
        id: string;
        form: { email?: string };
        calendar?: { eventId?: string };
      }[];
      const saved = entries.find((item) => item.form.email === client.email);
      storedId = saved?.id ?? '';
      return saved?.calendar?.eventId;
    })
    .toBe('playwright-calendar-event');
  await request.delete(`${backendUrl}/entries/${storedId}`);
});

test('an existing client job can be edited from the detail drawer', async ({ page, request }) => {
  const { client, entry } = await seedEntry(request);
  await mockCalendar(page);
  await page.goto('/clients');
  await page.getByRole('searchbox', { name: 'Search clients' }).fill(client.lastName);
  await page.getByRole('button', { name: new RegExp(client.fullName) }).click();
  const drawer = page.getByRole('dialog', { name: client.fullName });
  await drawer.getByRole('button', { name: 'Edit job' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit Hedge Trimming' });
  await editor.getByLabel('Job value').fill('675');
  await editor.getByLabel('Additional details (optional)').fill('Updated through Playwright');
  await editor.getByRole('button', { name: 'Update job' }).click();
  await expect(editor).toBeHidden();
  await expect
    .poll(async () => {
      const response = await request.get(`${backendUrl}/entries`);
      const items = (await response.json()) as {
        id: string;
        form: { jobValue: string | number };
      }[];
      return Number(items.find((item) => item.id === entry.id)?.form.jobValue);
    })
    .toBe(675);
  await request.delete(`${backendUrl}/entries/${entry.id}`);
});

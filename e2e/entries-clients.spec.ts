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

test('opportunity outcomes update client identity, open counts, and future filters', async ({
  page,
  request,
}) => {
  const { client, entry } = await seedEntry(request);
  const secondResponse = await request.post(`${backendUrl}/entries`, {
    data: {
      variant: 'warm-lead',
      form: {
        firstName: client.firstName,
        lastName: client.lastName,
        address: client.address,
        phone: client.phone,
        email: client.email,
        jobType: 'Rabattage',
        jobValue: '625',
        additionalDetails: 'Second opportunity for the same sample client',
      },
      hedges: {},
    },
  });
  expect(secondResponse.ok()).toBe(true);
  const secondEntry = (await secondResponse.json()) as { id: string };
  await mockCalendar(page);
  await page.goto('/clients');
  await page.getByRole('searchbox', { name: 'Search clients' }).fill(client.lastName);
  await page.getByRole('button', { name: new RegExp(client.fullName) }).click();
  const drawer = page.getByRole('dialog', { name: client.fullName });
  await expect(drawer.getByText('Lead', { exact: true })).toBeVisible();
  await expect(drawer.getByText('2 open', { exact: true })).toBeVisible();
  await expect(drawer.locator('.history__badge[data-sales-status="open"]')).toHaveCount(2);
  await expect(page.getByText('Open opportunities').locator('..')).toContainText('2');

  const firstRow = drawer.locator('.client-drawer__history li').filter({
    hasText: 'Playwright test entry',
  });
  const secondRow = drawer.locator('.client-drawer__history li').filter({
    hasText: 'Second opportunity for the same sample client',
  });
  await firstRow.getByRole('button', { name: 'Mark Hedge Trimming accepted' }).click();
  const acceptanceDialog = page.getByRole('dialog', { name: 'Accept opportunity' });
  await expect(acceptanceDialog).toBeVisible();
  await acceptanceDialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(acceptanceDialog).toBeHidden();
  let response = await request.get(`${backendUrl}/entries?salesStatus=open`);
  let entries = (await response.json()) as {
    id: string;
    variant?: string;
    calendar?: unknown;
    salesStatus?: string;
    form?: { additionalDetails?: string };
  }[];
  expect(entries.map((item) => item.id)).toEqual(
    expect.arrayContaining([entry.id, secondEntry.id]),
  );

  page.once('dialog', (confirmation) => confirmation.accept());
  await firstRow.getByRole('button', { name: 'Mark Hedge Trimming not proceeding' }).click();
  await expect(firstRow.locator('.history__badge')).toHaveText('Not proceeding');
  await expect(drawer.getByText('1 open', { exact: true })).toBeVisible();
  await expect(page.getByText('Open opportunities').locator('..')).toContainText('1');
  await expect(drawer.getByText('Lead', { exact: true })).toBeVisible();

  page.once('dialog', (confirmation) => confirmation.accept());
  await firstRow.getByRole('button', { name: 'Reopen Hedge Trimming' }).click();
  await expect(drawer.getByText('2 open', { exact: true })).toBeVisible();

  await firstRow.getByRole('button', { name: 'Mark Hedge Trimming accepted' }).click();
  const acceptToSchedule = page.getByRole('dialog', { name: 'Accept opportunity' });
  await acceptToSchedule.getByLabel('To schedule').check();
  await acceptToSchedule
    .getByPlaceholder('For example: prefers next month; call back.')
    .fill('Call back next month.');
  await acceptToSchedule.getByRole('button', { name: 'Accept · To schedule' }).click();
  await expect(acceptToSchedule).toBeHidden();
  await expect(firstRow.locator('.history__badge[data-sales-status="accepted"]')).toHaveText(
    'Accepted · To schedule',
  );
  await expect(drawer.getByText('Customer', { exact: true })).toBeVisible();
  await expect(drawer.getByText('1 open', { exact: true })).toBeVisible();
  await expect(page.locator('.summary-card--schedule')).toContainText('1');
  await expect(secondRow.locator('.history__badge')).toHaveText('Open');
  await expect(drawer.getByText('Playwright test entry')).toBeVisible();

  response = await request.get(`${backendUrl}/entries?salesStatus=accepted`);
  entries = (await response.json()) as typeof entries;
  const saved = entries.find((item) => item.id === entry.id);
  expect(saved).toMatchObject({
    id: entry.id,
    variant: 'warm-lead',
    salesStatus: 'accepted',
    form: { additionalDetails: 'Playwright test entry' },
    followUpNote: 'Call back next month.',
  });
  expect(saved?.calendar).toBeUndefined();
  response = await request.get(`${backendUrl}/entries?salesStatus=not-proceeding`);
  expect(await response.json()).toEqual([]);

  page.once('dialog', (confirmation) => confirmation.accept());
  await secondRow.getByRole('button', { name: 'Mark Rabattage not proceeding' }).click();
  await expect(drawer.getByText('History', { exact: true })).toBeVisible();
  await expect(drawer.getByText('1 open', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Open opportunities').locator('..')).toContainText('0');
  await expect(drawer.getByText('Customer', { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole('searchbox', { name: 'Search clients' }).fill(client.lastName);
  await page.getByRole('button', { name: new RegExp(client.fullName) }).click();
  const refreshedDrawer = page.getByRole('dialog', { name: client.fullName });
  await expect(refreshedDrawer.getByText('Customer', { exact: true })).toBeVisible();
  await expect(
    refreshedDrawer.locator('.history__badge[data-sales-status="accepted"]'),
  ).toHaveCount(1);
  await expect(
    refreshedDrawer.locator('.history__badge[data-sales-status="not-proceeding"]'),
  ).toHaveCount(1);
  await expect(refreshedDrawer.getByText('History', { exact: true })).toBeVisible();
  await request.delete(`${backendUrl}/entries/${entry.id}`);
  await request.delete(`${backendUrl}/entries/${secondEntry.id}`);
});

test('a single opportunity recalculates Lead, Inactive, and Customer states', async ({
  page,
  request,
}) => {
  const { client, entry } = await seedEntry(request);
  await page.goto('/clients');
  await page.getByRole('searchbox', { name: 'Search clients' }).fill(client.lastName);
  await page.getByRole('button', { name: new RegExp(client.fullName) }).click();
  const drawer = page.getByRole('dialog', { name: client.fullName });

  await expect(drawer.getByText('Lead', { exact: true })).toBeVisible();
  page.once('dialog', (confirmation) => confirmation.accept());
  await drawer.getByRole('button', { name: 'Mark Hedge Trimming not proceeding' }).click();
  await expect(drawer.getByText('Inactive', { exact: true })).toBeVisible();

  page.once('dialog', (confirmation) => confirmation.accept());
  await drawer.getByRole('button', { name: 'Reopen Hedge Trimming' }).click();
  await expect(drawer.getByText('Lead', { exact: true })).toBeVisible();

  await drawer.getByRole('button', { name: 'Mark Hedge Trimming accepted' }).click();
  const acceptance = page.getByRole('dialog', { name: 'Accept opportunity' });
  await acceptance.getByLabel('To schedule').check();
  await acceptance.getByRole('button', { name: 'Accept · To schedule' }).click();
  await expect(acceptance).toBeHidden();
  await expect(drawer.locator('.history__badge[data-sales-status="accepted"]')).toHaveText(
    'Accepted · To schedule',
  );
  await expect(drawer.getByText('Customer', { exact: true })).toBeVisible();

  page.once('dialog', (confirmation) => confirmation.accept());
  await drawer.getByRole('button', { name: 'Reopen Hedge Trimming' }).click();
  await expect(drawer.getByText('Lead', { exact: true })).toBeVisible();
  await expect(drawer.locator('.history__badge[data-sales-status="open"]')).toHaveText('Open');
  await expect(drawer.getByText('History', { exact: true })).toBeVisible();

  await request.delete(`${backendUrl}/entries/${entry.id}`);
});

test('scheduled acceptance writes the calendar link and reopening removes the event', async ({
  page,
  request,
}) => {
  const { client, entry } = await seedEntry(request);
  let eventDeleted = false;
  await page.route('**/calendar/events**', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    if (method === 'POST') {
      const payload = route.request().postDataJSON() as {
        summary: string;
        start: string;
        end: string;
      };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'acceptance-calendar-event', ...payload }),
      });
      return;
    }
    if (method === 'DELETE') {
      eventDeleted = true;
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    await route.abort('blockedbyclient');
  });

  await page.goto('/clients');
  await page.getByRole('searchbox', { name: 'Search clients' }).fill(client.lastName);
  await page.getByRole('button', { name: new RegExp(client.fullName) }).click();
  const drawer = page.getByRole('dialog', { name: client.fullName });
  await drawer.getByRole('button', { name: 'Mark Hedge Trimming accepted' }).click();
  const acceptance = page.getByRole('dialog', { name: 'Accept opportunity' });
  const date = new Date();
  date.setDate(date.getDate() + 4);
  const dateValue = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  await acceptance.getByLabel('Date', { exact: true }).fill(dateValue);
  await acceptance.getByLabel('Start time').fill('10:00');
  await acceptance.getByLabel('End time').fill('12:00');
  await acceptance.getByRole('button', { name: 'Accept and schedule' }).click();
  await expect(acceptance).toBeHidden();
  await expect
    .poll(async () => {
      const response = await request.get(`${backendUrl}/entries`);
      const entries = (await response.json()) as {
        id: string;
        salesStatus?: string;
        calendar?: { eventId?: string };
      }[];
      return entries.find((item) => item.id === entry.id)?.calendar?.eventId;
    })
    .toBe('acceptance-calendar-event');
  await expect(drawer.getByText('Customer', { exact: true })).toBeVisible();
  await expect(drawer.getByText('0 to schedule', { exact: true })).toHaveCount(0);

  page.once('dialog', (confirmation) => confirmation.accept());
  await drawer.getByRole('button', { name: 'Reopen Hedge Trimming' }).click();
  await expect.poll(() => eventDeleted).toBe(true);
  await expect(drawer.getByText('Lead', { exact: true })).toBeVisible();
  const list = await request.get(`${backendUrl}/entries`);
  const savedEntries = (await list.json()) as {
    id: string;
    salesStatus?: string;
    calendar?: unknown;
    acceptedAt?: string | null;
  }[];
  const saved = savedEntries.find((item) => item.id === entry.id);
  expect(saved).toMatchObject({ salesStatus: 'open', acceptedAt: null });
  expect(saved?.calendar).toBeUndefined();
  await request.delete(`${backendUrl}/entries/${entry.id}`);
});

test('finished jobs create an editable next-year copy', async ({ page, request }) => {
  const client = uniqueClient();
  const entryResponse = await request.post(`${backendUrl}/entries`, {
    data: {
      variant: 'customer',
      form: {
        firstName: client.firstName,
        lastName: client.lastName,
        address: client.address,
        phone: client.phone,
        email: client.email,
        jobType: 'Hedge Trimming',
        jobValue: '450',
        additionalDetails: 'Annual cleanup',
      },
      hedges: {},
      calendar: {
        start: '2026-04-01T14:00:00.000Z',
        end: '2026-04-01T16:00:00.000Z',
        timeZone: 'America/Toronto',
        eventId: 'completed-original-event',
      },
      execution: {
        status: 'completed',
        startedAt: '2026-04-01T14:00:00.000Z',
        endedAt: '2026-04-01T16:00:00.000Z',
        completionNote: 'Finished work',
        completedByRole: 'owner',
        totalHours: 2,
        crew: [],
        updatedAt: '2026-04-01T16:00:00.000Z',
      },
    },
  });
  expect(entryResponse.ok()).toBe(true);
  const original = (await entryResponse.json()) as { id: string };
  await page.route('**/calendar/events**', async (route) => {
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
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'next-year-calendar-event', ...payload }),
      });
      return;
    }
    await route.abort('blockedbyclient');
  });

  await page.goto('/clients');
  await page.getByRole('searchbox', { name: 'Search clients' }).fill(client.lastName);
  await page.getByRole('button', { name: new RegExp(client.fullName) }).click();
  const drawer = page.getByRole('dialog', { name: client.fullName });
  await expect(drawer.getByText('Finished', { exact: true })).toBeVisible();
  await drawer.getByRole('button', { name: 'Create next year copy of Hedge Trimming' }).click();
  const copyDialog = page.getByRole('dialog', { name: 'Copy Hedge Trimming for next year' });
  await expect(copyDialog.getByLabel('Job value')).toHaveValue('450');
  await expect(copyDialog.getByLabel('Date', { exact: true })).toHaveValue('2027-04-01');
  await copyDialog.getByLabel('Job value').fill('650');
  await copyDialog.getByRole('button', { name: 'Save Customer' }).click();
  await expect(copyDialog.getByText('Existing client detected')).toBeVisible();
  await copyDialog.getByRole('button', { name: 'Use existing client' }).click();
  await expect(copyDialog).toBeHidden();
  const response = await request.get(`${backendUrl}/entries`);
  const entries = (await response.json()) as {
    id: string;
    form: { email?: string; jobValue?: number | string; address?: string };
    calendar?: { eventId?: string; start?: string };
    execution?: { status?: string };
  }[];
  const copy = entries.find((item) => item.form.email === client.email && item.id !== original.id);
  expect(copy).toMatchObject({
    form: { jobValue: 650, address: client.address },
    calendar: { eventId: 'next-year-calendar-event', start: expect.stringContaining('2027-04-01') },
  });
  expect(copy?.execution).toBeUndefined();
  await request.delete(`${backendUrl}/entries/${original.id}`);
  if (copy) await request.delete(`${backendUrl}/entries/${copy.id}`);
});

test('customer entry schedules a calendar event and persists its event link', async ({
  page,
  request,
}) => {
  const client = uniqueClient();
  let calendarCreated = false;
  await page.route('**/calendar/events**', async (route) => {
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

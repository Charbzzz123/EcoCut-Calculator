import { expect, test } from '@playwright/test';
import { backendUrl, seedEntry } from './support';

test('broadcast filters recipients, previews merge fields, and confirms a test SMS', async ({
  page,
  request,
}) => {
  const { client, entry } = await seedEntry(request);
  const sent: { channel: string; sms?: { to: string; body: string } }[] = [];
  await page.route('**/api/communications/test', async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        campaignId: 'test-playwright',
        status: 'completed',
        stats: { recipients: 1, attempted: 1, sent: 1, failed: 0 },
      }),
    });
  });

  await page.goto('/communications/broadcast');
  await expect(page.getByRole('heading', { name: 'Client broadcast' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search' }).fill(client.lastName);
  await expect(page.getByRole('region', { name: 'Audience preview list' })).toContainText(
    client.fullName,
  );

  await page.getByRole('radio', { name: 'SMS', exact: true }).check();
  await page.getByRole('button', { name: 'Confirm channel selection' }).click();
  const preview = page.getByRole('article', { name: 'Rendered preview' });
  await expect(preview).toContainText(client.firstName);
  await expect(preview).toContainText(client.address);

  await page.getByLabel('Test SMS destination').fill('(514) 555-0199');
  await expect(page.getByRole('button', { name: 'Send test' })).toBeEnabled();
  await page.getByRole('button', { name: 'Send test' }).click();
  const confirmation = page.locator('.confirmation-modal');
  await expect(confirmation.getByRole('heading', { name: 'Confirm test send' })).toBeVisible();
  await confirmation.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]?.channel).toBe('sms');
  expect(sent[0]?.sms?.body).toContain(client.firstName);
  expect(sent[0]?.sms?.to.replace(/\D/g, '')).toBe('5145550199');

  await request.delete(`${backendUrl}/entries/${entry.id}`);
});

test('daily cap changes require an explicit review and confirmation', async ({ page }) => {
  await page.goto('/communications/broadcast');
  await page.getByRole('button', { name: 'Modify daily caps' }).click();
  const editor = page.locator('.cap-editor');
  await editor.getByLabel('Email cap').fill('75');
  await editor.getByLabel('SMS cap').fill('150');
  await editor.getByRole('button', { name: 'Review changes' }).click();
  await expect(editor.getByRole('button', { name: 'Confirm apply' })).toBeVisible();
  await editor.getByRole('button', { name: 'Confirm apply' }).click();
  await expect(page.getByRole('region', { name: 'Broadcast metrics' })).toContainText('75');
  await expect(page.getByRole('region', { name: 'Broadcast metrics' })).toContainText('150');
});

test('broadcast dispatch requires confirmation and sends only selected recipients', async ({
  page,
  request,
}) => {
  const { client, entry } = await seedEntry(request);
  const dispatched: { channel: string; recipients: { clientLabel: string; smsBody: string }[] }[] =
    [];
  await page.route('**/api/communications/dispatch', async (route) => {
    dispatched.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        campaignId: 'playwright-dispatch',
        status: 'completed',
        stats: { recipients: 1, attempted: 1, sent: 1, failed: 0 },
      }),
    });
  });

  await page.goto('/communications/broadcast');
  await page.getByRole('searchbox', { name: 'Search' }).fill(client.lastName);
  await page.getByRole('radio', { name: 'SMS', exact: true }).check();
  await page.getByRole('button', { name: 'Confirm channel selection' }).click();
  await expect(page.getByRole('button', { name: 'Confirm broadcast' })).toBeEnabled();
  await page.getByRole('button', { name: 'Confirm broadcast' }).click();
  const confirmation = page.locator('.confirmation-modal');
  await expect(
    confirmation.getByRole('heading', { name: 'Confirm broadcast dispatch' }),
  ).toBeVisible();
  await expect.poll(() => dispatched.length).toBe(0);
  await confirmation.getByRole('button', { name: 'Cancel' }).click();
  await expect(confirmation).toBeHidden();
  await expect.poll(() => dispatched.length).toBe(0);

  await page.getByRole('button', { name: 'Confirm broadcast' }).click();
  await confirmation.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect.poll(() => dispatched.length).toBe(1);
  expect(dispatched[0]?.channel).toBe('sms');
  expect(dispatched[0]?.recipients).toHaveLength(1);
  expect(dispatched[0]?.recipients[0]?.clientLabel).toBe(client.fullName);
  expect(dispatched[0]?.recipients[0]?.smsBody).toContain(client.firstName);
  await expect(page.getByText(/Broadcast queued for 1 recipients/)).toBeVisible();

  await request.delete(`${backendUrl}/entries/${entry.id}`);
});

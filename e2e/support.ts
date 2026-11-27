import type { APIRequestContext, Page } from '@playwright/test';

export const backendUrl = 'http://127.0.0.1:3200';

export function uniqueClient() {
  const suffix = Math.floor(1000 + Math.random() * 9000).toString();
  return {
    firstName: 'Playwright',
    lastName: `Client${suffix}`,
    fullName: `Playwright Client${suffix}`,
    address: `${suffix} Test Lane`,
    phone: `(514) 555-${suffix}`,
    email: `playwright.${suffix}@example.test`,
  };
}

export async function mockCalendar(page: Page): Promise<void> {
  await page.route('**/api/calendar/events**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    await route.abort('blockedbyclient');
  });
}

export async function seedEntry(
  request: APIRequestContext,
  client = uniqueClient(),
  variant: 'warm-lead' | 'customer' = 'warm-lead',
) {
  const response = await request.post(`${backendUrl}/entries`, {
    data: {
      variant,
      form: {
        firstName: client.firstName,
        lastName: client.lastName,
        address: client.address,
        phone: client.phone,
        email: client.email,
        jobType: 'Hedge Trimming',
        jobValue: '450',
        additionalDetails: 'Playwright test entry',
      },
      hedges: {},
    },
  });
  if (!response.ok()) {
    throw new Error(`Could not seed entry: ${response.status()} ${await response.text()}`);
  }
  return { client, entry: (await response.json()) as { id: string } };
}

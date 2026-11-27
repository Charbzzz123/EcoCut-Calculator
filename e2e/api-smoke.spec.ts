import { expect, test } from '@playwright/test';
import { backendUrl } from './support';

test('core read APIs return valid shapes against the isolated Nest server', async ({ request }) => {
  const paths = [
    '/entries',
    '/entries/clients',
    '/employees/roster',
    '/employees/hours',
    '/employees/history',
    '/employees/job-options',
    '/communications/campaigns',
  ];
  for (const path of paths) {
    const response = await request.get(`${backendUrl}${path}`);
    expect(response.ok(), `${path} should respond successfully`).toBe(true);
    expect(Array.isArray(await response.json()), `${path} should return a list`).toBe(true);
  }

  const report = await request.get(`${backendUrl}/employees/reporting/lifecycle`);
  expect(report.ok()).toBe(true);
  expect((await report.json()) as object).toHaveProperty('totals');

  const usage = await request.get(`${backendUrl}/addresses/usage`);
  expect(usage.ok()).toBe(true);
  expect((await usage.json()) as object).toHaveProperty('counts');

  const missingAddress = await request.post(`${backendUrl}/addresses/validate`, { data: {} });
  expect(missingAddress.ok()).toBe(true);
  expect((await missingAddress.json()) as { status: string }).toHaveProperty(
    'status',
    'missing_selection',
  );
});

import { expect, test } from '@playwright/test';
import { mockCalendar } from './support';

test('mobile dashboard and entry dialog remain usable', async ({ page }) => {
  await mockCalendar(page);
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'EcoCut Dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Add Entry' }).click();
  await page.getByRole('button', { name: 'Warm Lead' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('First name')).toBeVisible();
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: /^Clients/ }).click();
  await expect(page.getByRole('heading', { name: 'Client book' })).toBeVisible();
});

test('mobile chats switch from inbox to thread and back', async ({ page }) => {
  await page.route('**/api/communications/chats/**', async (route) => {
    const url = route.request().url();
    let body: unknown;
    if (url.includes('/health')) {
      body = {
        provider: 'quo',
        configured: true,
        connected: true,
        checkedAt: new Date().toISOString(),
        lastSyncAt: null,
        rateLimitPerSecond: 10,
        phoneNumber: '+14388007177',
        details: 'Connected',
        mirror: { conversations: 1, messages: 1, clientLinks: 0, cursors: 0 },
      };
    } else if (url.includes('/messages')) {
      body = {
        conversationId: 'mobile-conv',
        total: 1,
        limit: 80,
        offset: 0,
        items: [
          {
            messageId: 'mobile-msg',
            conversationId: 'mobile-conv',
            direction: 'inbound',
            content: 'Mobile message',
            from: '+15145550123',
            to: '+14388007177',
            createdAt: new Date().toISOString(),
          },
        ],
      };
    } else if (url.includes('/read')) {
      body = { conversationId: 'mobile-conv', unreadCount: 0 };
    } else {
      body = {
        items: [
          {
            conversationId: 'mobile-conv',
            linkedClientId: null,
            displayName: 'Mobile Contact',
            participantPhone: '+15145550123',
            lastMessageAt: new Date().toISOString(),
            lastMessagePreview: 'Mobile message',
            lastMessageDirection: 'inbound',
            unreadCount: 1,
          },
        ],
        total: 1,
        limit: 40,
        offset: 0,
      };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  await page.goto('/communications/chats');
  await expect(page.getByRole('button', { name: /Mobile Contact/ })).toBeVisible();
  await page.getByRole('button', { name: /Mobile Contact/ }).click();
  await expect(page.getByText('Mobile message').last()).toBeVisible();
  await page.getByRole('button', { name: 'Back to inbox' }).click();
  await expect(page.getByRole('button', { name: /Mobile Contact/ })).toBeVisible();
});

import { expect, test, type Page } from '@playwright/test';
import { backendUrl, seedEntry } from './support';

async function mockChats(page: Page, linkedClientId: string | null = null) {
  const sent: string[] = [];
  const conversations = [
    {
      conversationId: 'conv-alex',
      linkedClientId,
      displayName: 'Playwright Client',
      participantPhone: '+15145550123',
      lastMessageAt: '2026-09-30T12:00:00.000Z',
      lastMessagePreview: 'Can you visit tomorrow?',
      lastMessageDirection: 'inbound',
      unreadCount: 1,
    },
    {
      conversationId: 'conv-other',
      linkedClientId: null,
      displayName: 'Other Contact',
      participantPhone: '+15145550999',
      lastMessageAt: '2026-09-29T12:00:00.000Z',
      lastMessagePreview: 'Thanks',
      lastMessageDirection: 'outbound',
      unreadCount: 0,
    },
  ];
  await page.route('**/api/communications/chats/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const json = (body: unknown) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (path.endsWith('/health')) {
      await json({
        provider: 'quo',
        configured: true,
        connected: true,
        checkedAt: '2026-09-30T12:00:00Z',
        lastSyncAt: '2026-09-30T11:00:00Z',
        rateLimitPerSecond: 10,
        phoneNumber: '+14388007177',
        details: 'Connection successful.',
        mirror: { conversations: 2, messages: 2, clientLinks: linkedClientId ? 1 : 0, cursors: 1 },
      });
    } else if (path.endsWith('/conversations') || path.endsWith('/search')) {
      const query = (url.searchParams.get('query') ?? '').toLowerCase();
      const filtered = conversations.filter((item) =>
        `${item.displayName} ${item.participantPhone} ${item.lastMessagePreview}`
          .toLowerCase()
          .includes(query),
      );
      await json({ items: filtered, total: filtered.length, limit: 40, offset: 0 });
    } else if (path.endsWith('/messages') && method === 'GET') {
      await json({
        conversationId: 'conv-alex',
        total: 1 + sent.length,
        limit: 80,
        offset: 0,
        items: [
          ...sent.map((content, index) => ({
            messageId: `sent-${index}`,
            conversationId: 'conv-alex',
            direction: 'outbound',
            content,
            from: '+14388007177',
            to: '+15145550123',
            createdAt: '2026-09-30T12:01:00Z',
          })),
          {
            messageId: 'incoming-1',
            conversationId: 'conv-alex',
            direction: 'inbound',
            content: 'Can you visit tomorrow?',
            from: '+15145550123',
            to: '+14388007177',
            createdAt: '2026-09-30T12:00:00Z',
          },
        ],
      });
    } else if (path.endsWith('/messages') && method === 'POST') {
      const body = route.request().postDataJSON() as { content: string };
      sent.push(body.content);
      await json({
        conversationId: 'conv-alex',
        messageId: `sent-${sent.length}`,
        sentAt: '2026-09-30T12:01:00Z',
      });
    } else if (path.endsWith('/read')) {
      await json({ conversationId: 'conv-alex', unreadCount: 0 });
    } else if (path.endsWith('/sync')) {
      await json({
        mode: 'backfill',
        startedAt: '2026-09-30T12:00:00Z',
        completedAt: '2026-09-30T12:00:01Z',
        durationMs: 1000,
        truncated: false,
        scanned: { conversations: 2, messages: 2 },
        mirrored: { conversations: 2, messages: 2 },
        pages: { conversations: 1, messages: 1 },
        contacts: { scanned: 0, pages: 0, matchedPhoneNumbers: 0 },
        contactCache: {
          reused: true,
          refreshed: false,
          contacts: 2,
          phoneNumbers: 2,
          lastSyncedAt: '2026-09-30T11:00:00Z',
          fresh: true,
        },
        hydrated: { conversationNames: 0 },
        hasMorePages: { contacts: false, conversations: false, messages: false },
        mirror: { conversations: 2, messages: 2, clientLinks: linkedClientId ? 1 : 0, cursors: 1 },
      });
    } else {
      await route.continue();
    }
  });
  return sent;
}

test('chats search, thread, reply, unread clearing, and sync feedback', async ({ page }) => {
  const sent = await mockChats(page);
  await page.goto('/communications/chats');
  await expect(page.getByRole('heading', { name: 'Chats' })).toBeVisible();
  await expect(page.getByText('Connection successful.')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search chats' }).fill('Playwright');
  await expect(page.locator('.conversation-card')).toHaveCount(1);
  await page.locator('.conversation-card').click();
  await expect(page.getByText('Can you visit tomorrow?').last()).toBeVisible();
  await page.getByRole('textbox', { name: 'Reply by SMS' }).fill('Yes, we can visit.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText('Message sent.')).toBeVisible();
  expect(sent).toEqual(['Yes, we can visit.']);
  await page.getByRole('button', { name: 'Sync Quo chats' }).first().click();
  await expect(page.getByRole('status')).toContainText('Synced 2 conversation(s)');
});

test('client book opens the matching chat with client context', async ({ page, request }) => {
  const { client, entry } = await seedEntry(request);
  const clientsResponse = await request.get(`${backendUrl}/entries/clients`);
  const clients = (await clientsResponse.json()) as { clientId: string; email?: string }[];
  const clientId = clients.find((item) => item.email === client.email)?.clientId;
  expect(clientId).toBeTruthy();
  await mockChats(page, clientId);

  await page.goto('/clients');
  await page.getByRole('searchbox', { name: 'Search clients' }).fill(client.lastName);
  await page.getByRole('button', { name: new RegExp(client.fullName) }).click();
  await page
    .getByRole('dialog', { name: client.fullName })
    .getByRole('link', { name: 'Open chat' })
    .click();
  await expect.poll(() => new URL(page.url()).searchParams.get('clientId')).toBe(clientId);
  await expect(page.getByRole('region', { name: 'Linked client context' })).toContainText(
    client.fullName,
  );
  await expect(page.getByRole('heading', { name: 'Playwright Client', exact: true })).toBeVisible();
  await request.delete(`${backendUrl}/entries/${entry.id}`);
});

test('unconfigured Quo state gives an actionable sync failure', async ({ page }) => {
  await page.goto('/communications/chats');
  await expect(page.getByText('Not configured')).toBeVisible();
  await expect(page.getByText('No mirrored Quo conversations yet.')).toBeVisible();
  await page.getByRole('button', { name: 'Sync Quo chats' }).first().click();
  await expect(page.locator('.sync-status--error')).toContainText('Sync failed');
});

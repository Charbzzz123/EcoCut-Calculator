import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { vi } from 'vitest';
import type {
  ChatConversationListResult,
  ChatMessageListResult,
  ChatProviderHealth,
} from '@shared/domain/communications/chats-api.service.js';
import { ChatsApiService } from '@shared/domain/communications/chats-api.service.js';
import { ChatsFacade } from './chats.facade.js';
import { ChatsShellComponent } from './chats-shell.component.js';

const health: ChatProviderHealth = {
  provider: 'quo',
  configured: true,
  connected: true,
  checkedAt: '2026-04-24T12:00:00.000Z',
  lastSyncAt: '2026-04-24T11:00:00.000Z',
  rateLimitPerSecond: 10,
  phoneNumber: '+14388007177',
  details: 'Quo is connected.',
  mirror: { conversations: 2, messages: 5, clientLinks: 1, cursors: 1 },
};

const conversations: ChatConversationListResult = {
  total: 2,
  limit: 40,
  offset: 0,
  items: [
    {
      conversationId: 'conv-1',
      displayName: 'Alex North',
      participantPhone: '+15145550101',
      lastMessageAt: '2026-04-24T12:00:00.000Z',
      lastMessagePreview: 'Can you come tomorrow?',
      lastMessageDirection: 'inbound',
      unreadCount: 2,
    },
    {
      conversationId: 'conv-2',
      displayName: null,
      participantPhone: '+15145550202',
      lastMessageAt: null,
      lastMessagePreview: null,
      lastMessageDirection: 'unknown',
      unreadCount: 0,
    },
  ],
};

const messages: ChatMessageListResult = {
  conversationId: 'conv-1',
  total: 2,
  limit: 80,
  offset: 0,
  items: [
    {
      messageId: 'msg-1',
      conversationId: 'conv-1',
      direction: 'inbound',
      content: 'Can you come tomorrow?',
      from: '+15145550101',
      to: '+14388007177',
      createdAt: '2026-04-24T12:00:00.000Z',
    },
    {
      messageId: 'msg-2',
      conversationId: 'conv-1',
      direction: 'outbound',
      content: 'Yes, we can.',
      from: '+14388007177',
      to: '+15145550101',
      createdAt: '2026-04-24T12:05:00.000Z',
    },
  ],
};

const syncResult = {
  mode: 'incremental' as const,
  startedAt: '2026-04-24T12:00:00.000Z',
  completedAt: '2026-04-24T12:00:01.000Z',
  durationMs: 1000,
  truncated: false,
  scanned: { conversations: 2, messages: 5 },
  mirrored: { conversations: 1, messages: 3 },
  mirror: { conversations: 2, messages: 5, clientLinks: 1, cursors: 2 },
};

const createApiMock = () => ({
  getHealth: vi.fn().mockResolvedValue(health),
  syncChats: vi.fn().mockResolvedValue(syncResult),
  listConversations: vi.fn().mockResolvedValue(conversations),
  searchConversations: vi.fn().mockResolvedValue(conversations),
  listMessages: vi.fn().mockResolvedValue(messages),
  markConversationRead: vi.fn().mockResolvedValue(undefined),
  sendMessage: vi.fn().mockResolvedValue({
    conversationId: 'conv-1',
    messageId: 'msg-sent',
    sentAt: '2026-04-24T12:10:00.000Z',
  }),
});

describe('ChatsShellComponent', () => {
  let fixture: ComponentFixture<ChatsShellComponent>;
  let api: ReturnType<typeof createApiMock>;

  beforeEach(async () => {
    api = createApiMock();
    await TestBed.configureTestingModule({
      imports: [ChatsShellComponent, RouterTestingModule],
      providers: [{ provide: ChatsApiService, useValue: api }],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatsShellComponent);
    fixture.detectChanges();
    await settle();
  });

  it('renders the Chats route shell with provider and conversation status', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('h1')?.textContent?.trim()).toBe('Chats');
    expect(compiled.textContent).toContain('Provider');
    expect(compiled.textContent).toContain('Connected');
    expect(compiled.textContent).toContain('Conversations');
    expect(compiled.textContent).toContain('2 unread message(s).');
    expect(compiled.textContent).toContain('Mirror');
  });

  it('renders conversations and opens the selected thread', async () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll<HTMLButtonElement>('.conversation-card');

    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('Alex North');

    cards[0].click();
    fixture.detectChanges();
    await settle();

    expect(api.listMessages).toHaveBeenCalledWith('conv-1', { limit: 80 });
    expect(api.markConversationRead).toHaveBeenCalledWith('conv-1');
    expect(compiled.textContent).toContain('Can you come tomorrow?');
    expect(compiled.textContent).toContain('Yes, we can.');
  });

  it('falls back gracefully when contact or message fields are missing', async () => {
    api.listConversations.mockResolvedValueOnce({
      items: [
        {
          conversationId: 'conv-empty',
          displayName: null,
          participantPhone: null,
          lastMessageAt: null,
          lastMessagePreview: null,
          lastMessageDirection: 'unknown',
          unreadCount: 0,
        },
      ],
      total: 1,
      limit: 40,
      offset: 0,
    });
    api.listMessages.mockResolvedValueOnce({
      conversationId: 'conv-empty',
      items: [
        {
          messageId: 'msg-empty',
          conversationId: 'conv-empty',
          direction: 'inbound',
          content: null,
          from: null,
          to: null,
          createdAt: null,
        },
      ],
      total: 1,
      limit: 80,
      offset: 0,
    });

    clickRefresh();
    await settle();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Unknown contact');
    expect(compiled.textContent).toContain('No phone number');

    compiled.querySelector<HTMLButtonElement>('.conversation-card')!.click();
    fixture.detectChanges();
    await settle();

    expect(compiled.textContent).toContain('(No message content)');
    expect(compiled.textContent).toContain('No phone number on this thread.');
  });

  it('sends replies from the active thread', async () => {
    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelectorAll<HTMLButtonElement>('.conversation-card')[0].click();
    fixture.detectChanges();
    await settle();

    fixture.debugElement.injector.get(ChatsFacade).composerControl.setValue('Booked for tomorrow.');
    fixture.detectChanges();

    (fixture.componentInstance as unknown as { sendMessage(): void }).sendMessage();
    fixture.detectChanges();
    await settle();

    expect(api.sendMessage).toHaveBeenCalledWith('conv-1', 'Booked for tomorrow.', '+15145550101');
    expect(compiled.textContent).toContain('Booked for tomorrow.');
    expect(compiled.textContent).toContain('Message sent.');
  });

  it('closes the mobile thread view back to the inbox', async () => {
    const compiled = fixture.nativeElement as HTMLElement;
    compiled.querySelectorAll<HTMLButtonElement>('.conversation-card')[0].click();
    fixture.detectChanges();
    await settle();

    compiled.querySelector<HTMLButtonElement>('.back-to-list')!.click();
    fixture.detectChanges();
    await settle();

    expect(compiled.textContent).toContain('Select a conversation');
  });

  it('renders empty and error states', async () => {
    api.listConversations.mockResolvedValueOnce({ items: [], total: 0, limit: 40, offset: 0 });
    clickRefresh();
    await settle();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No mirrored Quo conversations yet.');

    api.listConversations.mockRejectedValueOnce(new Error('boom'));
    clickRefresh();
    await settle();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load chat conversations right now.');

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.text-action')!.click();
    await settle();
    fixture.detectChanges();

    expect(api.getHealth).toHaveBeenCalled();
  });

  it('runs manual sync from the inbox empty state', async () => {
    api.listConversations.mockResolvedValueOnce({ items: [], total: 0, limit: 40, offset: 0 });
    clickRefresh();
    await settle();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Run a sync to import existing Quo conversation history');

    const syncButton = Array.from(compiled.querySelectorAll<HTMLButtonElement>('.refresh-btn')).find((button) =>
      button.textContent?.includes('Sync Quo chats'),
    );
    syncButton?.click();
    fixture.detectChanges();
    await settle();

    expect(api.syncChats).toHaveBeenCalled();
    expect(compiled.textContent).toContain('Synced 1 conversation(s) and 3 message(s).');
  });

  it('shows sync failure feedback', async () => {
    api.syncChats.mockRejectedValueOnce(new Error('sync failed'));
    const compiled = fixture.nativeElement as HTMLElement;

    compiled.querySelector<HTMLButtonElement>('.refresh-btn--primary')!.click();
    fixture.detectChanges();
    await settle();

    expect(compiled.textContent).toContain('Unable to sync Quo conversations right now.');
    expect(compiled.textContent).toContain('Sync failed. Check Quo credentials');
  });

  it('provides a dashboard back link', () => {
    const link = fixture.nativeElement.querySelector('app-back-chip a') as HTMLAnchorElement;

    expect(link.getAttribute('href')).toBe('/home');
    expect(link.textContent).toContain('Back to dashboard');
  });

  async function settle(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  function clickRefresh(): void {
    const refreshButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.refresh-btn'),
    ).find((button) => button.textContent?.includes('Refresh'));
    refreshButton?.click();
  }
});

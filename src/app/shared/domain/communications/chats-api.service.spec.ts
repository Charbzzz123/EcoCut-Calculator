import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ChatsApiService } from './chats-api.service';

describe('ChatsApiService', () => {
  let service: ChatsApiService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/communications/chats`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ChatsApiService],
    });
    service = TestBed.inject(ChatsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads provider health', async () => {
    const promise = service.getHealth();
    const req = httpMock.expectOne(`${baseUrl}/health`);
    expect(req.request.method).toBe('GET');
    req.flush({
      provider: 'quo',
      configured: true,
      connected: true,
      checkedAt: '2026-04-24T12:00:00.000Z',
      lastSyncAt: null,
      rateLimitPerSecond: 10,
      phoneNumber: '+14388007177',
      details: 'ok',
      mirror: { conversations: 1, messages: 2, clientLinks: 0, cursors: 1 },
    });

    await expect(promise).resolves.toMatchObject({ connected: true });
  });

  it('lists and searches conversations with query params', async () => {
    const listPromise = service.listConversations({ limit: 10, offset: 5 });
    const listReq = httpMock.expectOne(`${baseUrl}/conversations?limit=10&offset=5`);
    expect(listReq.request.method).toBe('GET');
    listReq.flush({ items: [], total: 0, limit: 10, offset: 5 });
    await expect(listPromise).resolves.toMatchObject({ total: 0 });

    const searchPromise = service.searchConversations({ query: 'alex', limit: 10 });
    const searchReq = httpMock.expectOne(`${baseUrl}/search?query=alex&limit=10`);
    expect(searchReq.request.method).toBe('GET');
    searchReq.flush({ items: [], total: 0, limit: 10, offset: 0 });
    await expect(searchPromise).resolves.toMatchObject({ limit: 10 });
  });

  it('loads messages, sends replies, and marks conversations read', async () => {
    const messagesPromise = service.listMessages('conv/1', { limit: 20 });
    const messagesReq = httpMock.expectOne(`${baseUrl}/conversations/conv%2F1/messages?limit=20`);
    expect(messagesReq.request.method).toBe('GET');
    messagesReq.flush({ conversationId: 'conv/1', items: [], total: 0, limit: 20, offset: 0 });
    await expect(messagesPromise).resolves.toMatchObject({ conversationId: 'conv/1' });

    const sendPromise = service.sendMessage('conv/1', 'Hello', '+15145550101');
    const sendReq = httpMock.expectOne(`${baseUrl}/conversations/conv%2F1/messages`);
    expect(sendReq.request.method).toBe('POST');
    expect(sendReq.request.body).toEqual({ content: 'Hello', to: '+15145550101' });
    sendReq.flush({ conversationId: 'conv/1', messageId: 'msg-1', sentAt: 'now' });
    await expect(sendPromise).resolves.toMatchObject({ messageId: 'msg-1' });

    const readPromise = service.markConversationRead('conv/1');
    const readReq = httpMock.expectOne(`${baseUrl}/conversations/conv%2F1/read`);
    expect(readReq.request.method).toBe('POST');
    readReq.flush({ conversationId: 'conv/1', readAt: 'now' });
    await expect(readPromise).resolves.toBeUndefined();
  });

  it('omits optional request fields when they are empty', async () => {
    const listPromise = service.listConversations({ query: '', limit: undefined, offset: 0 });
    const listReq = httpMock.expectOne(`${baseUrl}/conversations?offset=0`);
    expect(listReq.request.method).toBe('GET');
    listReq.flush({ items: [], total: 0, limit: 40, offset: 0 });
    await expect(listPromise).resolves.toMatchObject({ offset: 0 });

    const sendPromise = service.sendMessage('conv/2', 'No explicit recipient');
    const sendReq = httpMock.expectOne(`${baseUrl}/conversations/conv%2F2/messages`);
    expect(sendReq.request.method).toBe('POST');
    expect(sendReq.request.body).toEqual({ content: 'No explicit recipient' });
    sendReq.flush({ conversationId: 'conv/2', messageId: 'msg-2', sentAt: 'now' });
    await expect(sendPromise).resolves.toMatchObject({ messageId: 'msg-2' });
  });
});

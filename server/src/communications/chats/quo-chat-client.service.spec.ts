import {
  QuoApiRequestError,
  QuoChatClientService,
} from './quo-chat-client.service';

const ORIGINAL_ENV = { ...process.env };

describe('QuoChatClientService', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.QUO_API_BASE_URL;
    delete process.env.QUO_API_KEY;
    delete process.env.QUO_FROM_NUMBER;
    delete process.env.QUO_FROM_NUMBER_ID;
    delete process.env.QUO_USER_ID;
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('reports not configured when mandatory env vars are missing', () => {
    const service = new QuoChatClientService();
    expect(service.isConfigured()).toBe(false);
    expect(service.getFromNumber()).toBeNull();
  });

  it('lists phone numbers with quo auth headers when configured', async () => {
    process.env.QUO_API_BASE_URL = 'https://api.quo.com/v1';
    process.env.QUO_API_KEY = 'quo-key';
    process.env.QUO_FROM_NUMBER = '+14388007177';
    process.env.QUO_FROM_NUMBER_ID = 'PN123';
    process.env.QUO_USER_ID = 'USR123';

    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ data: [{ id: 'PN123', number: '+14388007177' }] }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const service = new QuoChatClientService();
    await expect(service.listPhoneNumbers(1)).resolves.toEqual({
      data: [{ id: 'PN123', number: '+14388007177' }],
    });
    const requestCall = fetchMock.mock.calls[0];
    expect(requestCall?.[0]).toBe(
      'https://api.quo.com/v1/phone-numbers?limit=1',
    );
    const requestInit = requestCall?.[1];
    expect(requestInit?.method).toBe('GET');
    const requestHeaders = requestInit?.headers as Record<string, string>;
    expect(requestHeaders.Authorization).toBe('quo-key');
    expect(requestHeaders['Content-Type']).toBe('application/json');
  });

  it('throws a typed quo request error on non-retryable responses', async () => {
    process.env.QUO_API_BASE_URL = 'https://api.quo.com/v1';
    process.env.QUO_API_KEY = 'quo-key';
    process.env.QUO_FROM_NUMBER = '+14388007177';
    process.env.QUO_FROM_NUMBER_ID = 'PN123';
    process.env.QUO_USER_ID = 'USR123';

    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('forbidden', { status: 403 }));

    const service = new QuoChatClientService();
    await expect(service.listPhoneNumbers(1)).rejects.toBeInstanceOf(
      QuoApiRequestError,
    );
  });
});

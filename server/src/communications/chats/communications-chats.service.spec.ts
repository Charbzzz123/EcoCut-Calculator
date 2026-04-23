import { CommunicationsChatsService } from './communications-chats.service';
import { QuoApiRequestError } from './quo-chat-client.service';

describe('CommunicationsChatsService', () => {
  const mirror = {
    conversations: 1,
    messages: 2,
    clientLinks: 3,
    cursors: 4,
  } as const;

  it('returns not configured when QUO credentials are missing', async () => {
    const client = {
      isConfigured: jest.fn(() => false),
      listPhoneNumbers: jest.fn(),
      getFromNumber: jest.fn(() => null),
    };
    const repository = {
      getMirrorStats: jest.fn(() => mirror),
    };
    const service = new CommunicationsChatsService(
      client as never,
      repository as never,
    );

    await expect(service.getProviderHealth()).resolves.toMatchObject({
      provider: 'quo',
      configured: false,
      connected: false,
      phoneNumber: null,
      mirror,
    });
    expect(client.listPhoneNumbers).not.toHaveBeenCalled();
  });

  it('returns connected status when provider responds', async () => {
    const client = {
      isConfigured: jest.fn(() => true),
      listPhoneNumbers: jest.fn(() =>
        Promise.resolve({
          data: [{ formattedNumber: '(438) 800-7177' }],
        }),
      ),
      getFromNumber: jest.fn(() => '+14388007177'),
    };
    const repository = {
      getMirrorStats: jest.fn(() => mirror),
    };
    const service = new CommunicationsChatsService(
      client as never,
      repository as never,
    );

    await expect(service.getProviderHealth()).resolves.toMatchObject({
      provider: 'quo',
      configured: true,
      connected: true,
      phoneNumber: '(438) 800-7177',
      mirror,
    });
  });

  it('maps auth errors into actionable health details', async () => {
    const client = {
      isConfigured: jest.fn(() => true),
      listPhoneNumbers: jest.fn(() =>
        Promise.reject(new QuoApiRequestError(401, 'Unauthorized')),
      ),
      getFromNumber: jest.fn(() => '+14388007177'),
    };
    const repository = {
      getMirrorStats: jest.fn(() => mirror),
    };
    const service = new CommunicationsChatsService(
      client as never,
      repository as never,
    );

    await expect(service.getProviderHealth()).resolves.toMatchObject({
      provider: 'quo',
      configured: true,
      connected: false,
      phoneNumber: '+14388007177',
      details: 'Authentication failed. Verify QUO_API_KEY and number/user IDs.',
      mirror,
    });
  });
});

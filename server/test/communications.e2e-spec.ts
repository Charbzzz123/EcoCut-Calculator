import { INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { EMAIL_PROVIDER } from '../src/communications/providers/email-provider';
import { SMS_PROVIDER } from '../src/communications/providers/sms-provider';

interface CampaignResponseBody {
  campaignId: string;
  status: string;
}

interface CampaignAnalyticsBody {
  totals: {
    delivered: number;
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const readStringField = (
  source: Record<string, unknown>,
  key: string,
): string => {
  const value = source[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Expected string field "${key}" in response body.`);
  }
  return value;
};

const readNumberField = (
  source: Record<string, unknown>,
  key: string,
): number => {
  const value = source[key];
  if (typeof value !== 'number') {
    throw new Error(`Expected number field "${key}" in response body.`);
  }
  return value;
};

const parseCampaignBody = (body: unknown): CampaignResponseBody => {
  if (!isRecord(body)) {
    throw new Error('Expected object response body.');
  }
  return {
    campaignId: readStringField(body, 'campaignId'),
    status: readStringField(body, 'status'),
  };
};

const parseAnalyticsBody = (body: unknown): CampaignAnalyticsBody => {
  if (!isRecord(body)) {
    throw new Error('Expected object response body.');
  }
  const totals = body.totals;
  if (!isRecord(totals)) {
    throw new Error('Expected object field "totals" in response body.');
  }
  return {
    totals: {
      delivered: readNumberField(totals, 'delivered'),
    },
  };
};

describe('Communications (e2e)', () => {
  const emailSend = jest.fn<Promise<string>, [unknown]>();
  const smsSend = jest.fn<Promise<string>, [unknown]>();
  let workspace: string;
  let dbPath: string;
  let app: INestApplication<App>;

  const createApp = async (): Promise<INestApplication<App>> => {
    const builder: TestingModuleBuilder = Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EMAIL_PROVIDER)
      .useValue({ send: emailSend })
      .overrideProvider(SMS_PROVIDER)
      .useValue({ send: smsSend });

    const moduleRef = await builder.compile();
    const instance = moduleRef.createNestApplication();
    await instance.init();
    return instance;
  };

  beforeEach(async () => {
    workspace = mkdtempSync(join(tmpdir(), 'communications-e2e-'));
    dbPath = join(workspace, 'communications.db');
    process.env.COMMUNICATIONS_DB_PATH = dbPath;
    jest.clearAllMocks();
    emailSend.mockResolvedValue('email-msg-id');
    smsSend.mockResolvedValue('sms-msg-id');
    app = await createApp();
  });

  afterEach(async () => {
    await app.close();
    delete process.env.COMMUNICATIONS_DB_PATH;
    rmSync(workspace, { recursive: true, force: true });
  });

  it('runs approval workflow, webhook ingestion, and analytics from HTTP routes', async () => {
    const dispatchResponse = await request(app.getHttpServer())
      .post('/communications/dispatch')
      .send({
        channel: 'both',
        scheduleMode: 'now',
        operatorRole: 'manager',
        requiresApproval: true,
        recipients: [
          {
            clientId: 'client-1',
            clientLabel: 'Client One',
            email: 'client.one@ecocutqc.com',
            phone: '+15145550001',
            emailSubject: 'Spring cleanup',
            emailBody: 'Hello',
            smsBody: 'Hi',
          },
        ],
      })
      .expect(201);

    const dispatchBody = parseCampaignBody(dispatchResponse.body as unknown);
    expect(dispatchBody.status).toBe('pending_approval');
    const campaignId = dispatchBody.campaignId;

    await request(app.getHttpServer())
      .post(`/communications/campaigns/${campaignId}/approve`)
      .send({ approvedBy: 'owner' })
      .expect(201);

    expect(emailSend).toHaveBeenCalledTimes(1);
    expect(smsSend).toHaveBeenCalledTimes(1);

    await request(app.getHttpServer())
      .post('/communications/webhooks/delivery')
      .send({
        campaignId,
        channel: 'email',
        provider: 'hostinger',
        eventType: 'delivered',
        recipient: 'client.one@ecocutqc.com',
      })
      .expect(201);

    const analytics = await request(app.getHttpServer())
      .get(`/communications/campaigns/${campaignId}/analytics`)
      .expect(200);
    const analyticsBody = parseAnalyticsBody(analytics.body as unknown);
    expect(analyticsBody.totals.delivered).toBe(1);
  });

  it('persists communications state across server restarts', async () => {
    const created = await request(app.getHttpServer())
      .post('/communications/test')
      .send({
        channel: 'email',
        scheduleMode: 'later',
        scheduleAt: '2026-07-10T09:00:00.000Z',
        email: {
          to: 'owner@ecocutqc.com',
          subject: 'Staging check',
          body: 'Body',
        },
      })
      .expect(201);

    const createdBody = parseCampaignBody(created.body as unknown);
    const campaignId = createdBody.campaignId;
    await app.close();
    app = await createApp();

    const persisted = await request(app.getHttpServer())
      .get(`/communications/campaigns/${campaignId}`)
      .expect(200);

    const persistedBody = parseCampaignBody(persisted.body as unknown);
    expect(persistedBody.status).toBe('scheduled');
  });
});

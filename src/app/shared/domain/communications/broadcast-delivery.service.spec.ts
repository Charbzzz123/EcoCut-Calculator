import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { BroadcastDeliveryService } from './broadcast-delivery.service';

describe('BroadcastDeliveryService', () => {
  let service: BroadcastDeliveryService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/communications`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [BroadcastDeliveryService],
    });
    service = TestBed.inject(BroadcastDeliveryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('posts test payloads to the test endpoint', async () => {
    const promise = service.sendTest({
      channel: 'email',
      scheduleMode: 'now',
      email: {
        to: 'owner@ecocutqc.com',
        subject: 'subj',
        body: 'body',
      },
    });

    const req = httpMock.expectOne(`${baseUrl}/test`);
    expect(req.request.method).toBe('POST');
    req.flush({
      campaignId: 'c-1',
      status: 'completed',
      stats: { recipients: 1, attempted: 1, sent: 1, failed: 0 },
    });

    await expect(promise).resolves.toEqual({
      campaignId: 'c-1',
      status: 'completed',
      stats: { recipients: 1, attempted: 1, sent: 1, failed: 0 },
    });
  });

  it('posts dispatch payloads to the dispatch endpoint', async () => {
    const promise = service.dispatch({
      channel: 'both',
      scheduleMode: 'later',
      scheduleAt: '2026-07-01T09:00',
      recipients: [
        {
          clientId: 'alex',
          clientLabel: 'Alex North',
          email: 'alex@ecocutqc.com',
          phone: '+15145550000',
          emailSubject: 'Subj',
          emailBody: 'Email body',
          smsBody: 'Sms body',
        },
      ],
    });

    const req = httpMock.expectOne(`${baseUrl}/dispatch`);
    expect(req.request.method).toBe('POST');
    req.flush({
      campaignId: 'c-2',
      status: 'scheduled',
      stats: { recipients: 1, attempted: 0, sent: 0, failed: 0 },
    });

    await expect(promise).resolves.toEqual({
      campaignId: 'c-2',
      status: 'scheduled',
      stats: { recipients: 1, attempted: 0, sent: 0, failed: 0 },
    });
  });
});

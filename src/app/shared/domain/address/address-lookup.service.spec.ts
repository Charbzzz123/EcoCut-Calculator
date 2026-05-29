import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { AddressLookupService } from './address-lookup.service';

describe('AddressLookupService', () => {
  let service: AddressLookupService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AddressLookupService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AddressLookupService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('requests suggestions with query + session token params', async () => {
    const requestPromise = service.suggest('123 main', 'session-1');

    const request = httpMock.expectOne(
      `${environment.apiBaseUrl}/addresses/suggest?q=123%20main&sessionToken=session-1`,
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      status: 'ok',
      suggestions: [],
      usage: mockUsage(),
    });

    await expect(requestPromise).resolves.toEqual({
      status: 'ok',
      suggestions: [],
      usage: mockUsage(),
    });
  });

  it('posts suggestion id + session token for validation', async () => {
    const requestPromise = service.validate('place-1', 'session-2');

    const request = httpMock.expectOne(`${environment.apiBaseUrl}/addresses/validate`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      suggestionId: 'place-1',
      sessionToken: 'session-2',
    });
    request.flush({
      verified: true,
      status: 'verified',
      usage: mockUsage(),
      normalizedAddress: {
        formattedAddress: '123 Main St, Montreal, QC H1H 1H1, Canada',
        streetAddress: '123 Main St',
        city: 'Montreal',
        province: 'QC',
        postalCode: 'H1H 1H1',
        countryCode: 'CA',
        latitude: 45.5,
        longitude: -73.5,
      },
    });

    await expect(requestPromise).resolves.toBeTruthy();
  });

  it('requests address usage snapshot', async () => {
    const requestPromise = service.getUsage();

    const request = httpMock.expectOne(`${environment.apiBaseUrl}/addresses/usage`);
    expect(request.request.method).toBe('GET');
    request.flush(mockUsage());

    await expect(requestPromise).resolves.toEqual(mockUsage());
  });
});

function mockUsage() {
  return {
    monthKey: '2026-04',
    caps: {
      autocompleteRequests: 10000,
      placeDetailsRequests: 10000,
      addressValidationRequests: 5000,
    },
    counts: {
      autocompleteRequests: 12,
      placeDetailsRequests: 3,
      addressValidationRequests: 0,
    },
    thresholds: {
      warn75Reached: false,
      warn90Reached: false,
      hardStopReached: false,
    },
  };
}

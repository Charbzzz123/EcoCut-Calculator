import type { AddressesUsageRepository } from './addresses.repository';
import { AddressesService } from './addresses.service';
import type { AddressUsageMetric } from './addresses.types';

interface MonthlyUsage {
  readonly autocomplete_requests: number;
  readonly place_details_requests: number;
  readonly address_validation_requests: number;
}

class FakeAddressesUsageRepository {
  private readonly store = new Map<string, MonthlyUsage>();

  getMonthlyCounts(monthKey: string): MonthlyUsage {
    return this.store.get(monthKey) ?? this.emptyUsage();
  }

  increment(monthKey: string, metric: AddressUsageMetric, amount = 1): number {
    const current = this.getMonthlyCounts(monthKey);
    const next: MonthlyUsage = {
      ...current,
      [metric]: current[metric] + amount,
    };
    this.store.set(monthKey, next);
    return next[metric];
  }

  private emptyUsage(): MonthlyUsage {
    return {
      autocomplete_requests: 0,
      place_details_requests: 0,
      address_validation_requests: 0,
    };
  }
}

describe('AddressesService', () => {
  let service: AddressesService;
  let repository: FakeAddressesUsageRepository;
  const currentMonth = new Date().toISOString().slice(0, 7);

  beforeEach(() => {
    jest.restoreAllMocks();
    process.env.ADDRESS_PROVIDER = 'google';
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    process.env.ADDRESS_AUTOCOMPLETE_CAP_MONTHLY = '10';
    process.env.ADDRESS_DETAILS_CAP_MONTHLY = '10';
    process.env.ADDRESS_VALIDATION_CAP_MONTHLY = '10';
    repository = new FakeAddressesUsageRepository();
    service = new AddressesService(
      repository as unknown as AddressesUsageRepository,
    );
  });

  it('returns too_short without calling provider', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const response = await service.suggest('ab');

    expect(response.status).toBe('too_short');
    expect(response.suggestions).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns quota_reached for autocomplete when cap is hit', async () => {
    process.env.ADDRESS_AUTOCOMPLETE_CAP_MONTHLY = '1';
    repository.increment(currentMonth, 'autocomplete_requests', 1);
    service = new AddressesService(
      repository as unknown as AddressesUsageRepository,
    );

    const fetchSpy = jest.spyOn(global, 'fetch');
    const response = await service.suggest('123 Main');

    expect(response.status).toBe('quota_reached');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps autocomplete suggestions and increments usage on success', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          suggestions: [
            {
              placePrediction: {
                placeId: 'place-1',
                text: { text: '123 Main St, Montreal, QC, Canada' },
                structuredFormat: {
                  mainText: { text: '123 Main St' },
                  secondaryText: { text: 'Montreal, QC, Canada' },
                },
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const response = await service.suggest('123 Main', 'session-1');

    expect(response.status).toBe('ok');
    expect(response.suggestions).toEqual([
      {
        id: 'place-1',
        label: '123 Main St, Montreal, QC, Canada',
        primaryText: '123 Main St',
        secondaryText: 'Montreal, QC, Canada',
      },
    ]);
    expect(response.usage.counts.autocompleteRequests).toBe(1);
  });

  it('requires suggestion id for validation', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const response = await service.validate({});

    expect(response.verified).toBe(false);
    expect(response.status).toBe('missing_selection');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('validates a selected address and returns normalized payload', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'place-1',
          formattedAddress: '123 Main St, Montreal, QC H1H 1H1, Canada',
          addressComponents: [
            { longText: '123', shortText: '123', types: ['street_number'] },
            { longText: 'Main St', shortText: 'Main St', types: ['route'] },
            {
              longText: 'Montreal',
              shortText: 'Montreal',
              types: ['locality'],
            },
            {
              longText: 'Quebec',
              shortText: 'QC',
              types: ['administrative_area_level_1'],
            },
            {
              longText: 'H1H 1H1',
              shortText: 'H1H 1H1',
              types: ['postal_code'],
            },
            { longText: 'Canada', shortText: 'CA', types: ['country'] },
          ],
          location: { latitude: 45.5, longitude: -73.5 },
        }),
        { status: 200 },
      ),
    );

    const response = await service.validate({
      suggestionId: 'place-1',
      sessionToken: 'session-1',
    });

    expect(response.verified).toBe(true);
    expect(response.status).toBe('verified');
    expect(response.normalizedAddress).toEqual({
      formattedAddress: '123 Main St, Montreal, QC H1H 1H1, Canada',
      streetAddress: '123 Main St',
      city: 'Montreal',
      province: 'QC',
      postalCode: 'H1H 1H1',
      countryCode: 'CA',
      latitude: 45.5,
      longitude: -73.5,
    });
    expect(response.usage.counts.placeDetailsRequests).toBe(1);
  });
});

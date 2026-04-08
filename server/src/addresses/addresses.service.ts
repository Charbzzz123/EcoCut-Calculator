import { Injectable, Logger } from '@nestjs/common';
import { AddressesUsageRepository } from './addresses.repository';
import type {
  AddressSuggestResponse,
  AddressSuggestion,
  AddressUsageCaps,
  AddressUsageCounts,
  AddressUsageSnapshot,
  AddressValidateRequest,
  AddressValidateResponse,
  NormalizedAddress,
} from './addresses.types';

interface GoogleAutocompleteResponse {
  readonly suggestions?: {
    readonly placePrediction?: {
      readonly placeId?: string;
      readonly text?: { readonly text?: string };
      readonly structuredFormat?: {
        readonly mainText?: { readonly text?: string };
        readonly secondaryText?: { readonly text?: string };
      };
    };
  }[];
}

interface GooglePlaceDetailsResponse {
  readonly id?: string;
  readonly formattedAddress?: string;
  readonly addressComponents?: {
    readonly longText?: string;
    readonly shortText?: string;
    readonly types?: string[];
  }[];
  readonly location?: {
    readonly latitude?: number;
    readonly longitude?: number;
  };
}

const GOOGLE_AUTOCOMPLETE_ENDPOINT =
  'https://places.googleapis.com/v1/places:autocomplete';
const GOOGLE_PLACE_DETAILS_ENDPOINT = 'https://places.googleapis.com/v1/places';

@Injectable()
export class AddressesService {
  private readonly logger = new Logger(AddressesService.name);
  private readonly provider = (process.env.ADDRESS_PROVIDER ?? 'google')
    .trim()
    .toLowerCase();
  private readonly apiKey = (process.env.GOOGLE_MAPS_API_KEY ?? '').trim();

  constructor(private readonly usageRepository: AddressesUsageRepository) {}

  async suggest(
    rawQuery: string,
    sessionToken?: string,
  ): Promise<AddressSuggestResponse> {
    const query = rawQuery.trim();
    const usage = this.getUsageSnapshot();

    if (query.length < 3) {
      return {
        status: 'too_short',
        suggestions: [],
        usage,
        message: 'Type at least 3 characters to search addresses.',
      };
    }

    if (usage.counts.autocompleteRequests >= usage.caps.autocompleteRequests) {
      return {
        status: 'quota_reached',
        suggestions: [],
        usage,
        message:
          'Monthly autocomplete cap reached. Address search is paused until reset.',
      };
    }

    if (!this.isGoogleConfigured()) {
      return {
        status: 'provider_unconfigured',
        suggestions: [],
        usage,
        message: 'Address provider is not configured yet.',
      };
    }

    try {
      const response = await fetch(GOOGLE_AUTOCOMPLETE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask':
            'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text',
        },
        body: JSON.stringify({
          input: query,
          includedRegionCodes: ['ca'],
          languageCode: 'en',
          ...(sessionToken ? { sessionToken } : {}),
        }),
      });

      if (!response.ok) {
        const payload = await response.text();
        this.logger.warn(
          `Google autocomplete failed (${response.status}): ${payload.slice(0, 250)}`,
        );
        return {
          status: 'provider_error',
          suggestions: [],
          usage: this.getUsageSnapshot(),
          message: 'Address provider returned an error while searching.',
        };
      }

      this.incrementUsage('autocomplete_requests');
      const payload = (await response.json()) as GoogleAutocompleteResponse;
      const suggestions = this.mapAutocompleteSuggestions(payload);

      return {
        status: 'ok',
        suggestions,
        usage: this.getUsageSnapshot(),
      };
    } catch (error) {
      this.logger.warn(
        `Autocomplete request failed: ${this.stringifyError(error)}`,
      );
      return {
        status: 'provider_error',
        suggestions: [],
        usage: this.getUsageSnapshot(),
        message: 'Unable to reach address provider.',
      };
    }
  }

  async validate(
    request: AddressValidateRequest,
  ): Promise<AddressValidateResponse> {
    const usage = this.getUsageSnapshot();
    const suggestionId = request.suggestionId?.trim();

    if (!suggestionId) {
      return {
        verified: false,
        status: 'missing_selection',
        usage,
        message: 'Select an address from suggestions before continuing.',
      };
    }

    if (usage.counts.placeDetailsRequests >= usage.caps.placeDetailsRequests) {
      return {
        verified: false,
        status: 'quota_reached',
        usage,
        message:
          'Monthly address validation cap reached. Try again after reset.',
      };
    }

    if (!this.isGoogleConfigured()) {
      return {
        verified: false,
        status: 'provider_unconfigured',
        usage,
        message: 'Address provider is not configured yet.',
      };
    }

    try {
      const queryParams = new URLSearchParams({
        languageCode: 'en',
        regionCode: 'CA',
      });
      if (request.sessionToken?.trim()) {
        queryParams.set('sessionToken', request.sessionToken.trim());
      }

      const detailsUrl = `${GOOGLE_PLACE_DETAILS_ENDPOINT}/${encodeURIComponent(suggestionId)}?${queryParams.toString()}`;
      const response = await fetch(detailsUrl, {
        headers: {
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask':
            'id,formattedAddress,addressComponents.longText,addressComponents.shortText,addressComponents.types,location.latitude,location.longitude',
        },
      });

      if (!response.ok) {
        const payload = await response.text();
        this.logger.warn(
          `Google place details failed (${response.status}): ${payload.slice(0, 250)}`,
        );
        return {
          verified: false,
          status: 'provider_error',
          usage: this.getUsageSnapshot(),
          message: 'Address provider returned an error during validation.',
        };
      }

      this.incrementUsage('place_details_requests');
      const payload = (await response.json()) as GooglePlaceDetailsResponse;
      const normalized = this.normalizeAddress(payload);

      if (!normalized) {
        return {
          verified: false,
          status: 'invalid',
          usage: this.getUsageSnapshot(),
          message: 'Selected address is incomplete. Pick a full civic address.',
        };
      }

      return {
        verified: true,
        status: 'verified',
        usage: this.getUsageSnapshot(),
        normalizedAddress: normalized,
      };
    } catch (error) {
      this.logger.warn(
        `Address validation failed: ${this.stringifyError(error)}`,
      );
      return {
        verified: false,
        status: 'provider_error',
        usage: this.getUsageSnapshot(),
        message: 'Unable to reach address provider for validation.',
      };
    }
  }

  getUsage(): AddressUsageSnapshot {
    return this.getUsageSnapshot();
  }

  private mapAutocompleteSuggestions(
    payload: GoogleAutocompleteResponse,
  ): AddressSuggestion[] {
    return (payload.suggestions ?? [])
      .map((item) => {
        const prediction = item.placePrediction;
        const id = prediction?.placeId?.trim() ?? '';
        if (!id) {
          return null;
        }

        const primaryText =
          prediction?.structuredFormat?.mainText?.text?.trim() ??
          prediction?.text?.text?.trim() ??
          '';
        const secondaryText =
          prediction?.structuredFormat?.secondaryText?.text?.trim() ?? '';

        const label =
          prediction?.text?.text?.trim() ??
          [primaryText, secondaryText].filter(Boolean).join(', ');

        return {
          id,
          label,
          primaryText,
          secondaryText,
        } satisfies AddressSuggestion;
      })
      .filter(
        (suggestion): suggestion is AddressSuggestion => suggestion !== null,
      )
      .slice(0, 8);
  }

  private normalizeAddress(
    payload: GooglePlaceDetailsResponse,
  ): NormalizedAddress | null {
    const formattedAddress = payload.formattedAddress?.trim() ?? '';
    if (!formattedAddress) {
      return null;
    }

    const components = payload.addressComponents ?? [];
    const streetNumber = this.findComponentLongText(
      components,
      'street_number',
    );
    const route = this.findComponentLongText(components, 'route');
    const city =
      this.findComponentLongText(components, 'locality') ||
      this.findComponentLongText(components, 'postal_town') ||
      this.findComponentLongText(components, 'administrative_area_level_3');
    const province = this.findComponentShortText(
      components,
      'administrative_area_level_1',
    );
    const postalCode = this.findComponentLongText(components, 'postal_code');
    const countryCode = this.findComponentShortText(
      components,
      'country',
    ).toUpperCase();

    if (
      !streetNumber ||
      !route ||
      !city ||
      !province ||
      !postalCode ||
      !countryCode
    ) {
      return null;
    }

    return {
      formattedAddress,
      streetAddress: `${streetNumber} ${route}`.trim(),
      city,
      province,
      postalCode,
      countryCode,
      latitude: payload.location?.latitude ?? null,
      longitude: payload.location?.longitude ?? null,
    };
  }

  private findComponentLongText(
    components: GooglePlaceDetailsResponse['addressComponents'],
    targetType: string,
  ): string {
    const component = components?.find((item) =>
      item.types?.includes(targetType),
    );
    return component?.longText?.trim() ?? '';
  }

  private findComponentShortText(
    components: GooglePlaceDetailsResponse['addressComponents'],
    targetType: string,
  ): string {
    const component = components?.find((item) =>
      item.types?.includes(targetType),
    );
    return component?.shortText?.trim() ?? component?.longText?.trim() ?? '';
  }

  private incrementUsage(
    metric:
      | 'autocomplete_requests'
      | 'place_details_requests'
      | 'address_validation_requests',
  ): void {
    const monthKey = this.currentMonthKey();
    this.usageRepository.increment(monthKey, metric, 1);
  }

  private getUsageSnapshot(): AddressUsageSnapshot {
    const monthKey = this.currentMonthKey();
    const countsByMetric = this.usageRepository.getMonthlyCounts(monthKey);
    const capsByMetricName = this.readMetricCapsByMetricName();

    const counts: AddressUsageCounts = {
      autocompleteRequests: countsByMetric.autocomplete_requests,
      placeDetailsRequests: countsByMetric.place_details_requests,
      addressValidationRequests: countsByMetric.address_validation_requests,
    };

    const caps: AddressUsageCaps = {
      autocompleteRequests: capsByMetricName.autocompleteRequests.cap,
      placeDetailsRequests: capsByMetricName.placeDetailsRequests.cap,
      addressValidationRequests: capsByMetricName.addressValidationRequests.cap,
    };

    const percentages = [
      this.computePercentage(
        counts.autocompleteRequests,
        caps.autocompleteRequests,
      ),
      this.computePercentage(
        counts.placeDetailsRequests,
        caps.placeDetailsRequests,
      ),
      this.computePercentage(
        counts.addressValidationRequests,
        caps.addressValidationRequests,
      ),
    ];

    const highest = Math.max(...percentages);

    return {
      monthKey,
      caps,
      counts,
      thresholds: {
        warn75Reached: highest >= 75,
        warn90Reached: highest >= 90,
        hardStopReached: highest >= 100,
      },
    };
  }

  private computePercentage(used: number, cap: number): number {
    if (cap <= 0) {
      return 100;
    }
    return Math.min(100, (used / cap) * 100);
  }

  private readMetricCapsByMetricName(): {
    readonly autocompleteRequests: {
      readonly metric: 'autocomplete_requests';
      readonly cap: number;
    };
    readonly placeDetailsRequests: {
      readonly metric: 'place_details_requests';
      readonly cap: number;
    };
    readonly addressValidationRequests: {
      readonly metric: 'address_validation_requests';
      readonly cap: number;
    };
  } {
    return {
      autocompleteRequests: {
        metric: 'autocomplete_requests',
        cap: this.readPositiveIntEnv('ADDRESS_AUTOCOMPLETE_CAP_MONTHLY', 10000),
      },
      placeDetailsRequests: {
        metric: 'place_details_requests',
        cap: this.readPositiveIntEnv('ADDRESS_DETAILS_CAP_MONTHLY', 10000),
      },
      addressValidationRequests: {
        metric: 'address_validation_requests',
        cap: this.readPositiveIntEnv('ADDRESS_VALIDATION_CAP_MONTHLY', 5000),
      },
    };
  }

  private readPositiveIntEnv(name: string, fallback: number): number {
    const raw = process.env[name]?.trim();
    if (!raw) {
      return fallback;
    }
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }

  private currentMonthKey(): string {
    return new Date().toISOString().slice(0, 7);
  }

  private isGoogleConfigured(): boolean {
    return this.provider === 'google' && this.apiKey.length > 0;
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown error';
  }
}

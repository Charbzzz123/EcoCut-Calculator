export type AddressUsageMetric =
  | 'autocomplete_requests'
  | 'place_details_requests'
  | 'address_validation_requests';

export interface AddressSuggestion {
  readonly id: string;
  readonly label: string;
  readonly primaryText: string;
  readonly secondaryText: string;
}

export interface NormalizedAddress {
  readonly formattedAddress: string;
  readonly streetAddress: string;
  readonly city: string;
  readonly province: string;
  readonly postalCode: string;
  readonly countryCode: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface AddressUsageCaps {
  readonly autocompleteRequests: number;
  readonly placeDetailsRequests: number;
  readonly addressValidationRequests: number;
}

export interface AddressUsageCounts {
  readonly autocompleteRequests: number;
  readonly placeDetailsRequests: number;
  readonly addressValidationRequests: number;
}

export interface AddressUsageSnapshot {
  readonly monthKey: string;
  readonly caps: AddressUsageCaps;
  readonly counts: AddressUsageCounts;
  readonly thresholds: {
    readonly warn75Reached: boolean;
    readonly warn90Reached: boolean;
    readonly hardStopReached: boolean;
  };
}

export interface AddressSuggestResponse {
  readonly status:
    | 'ok'
    | 'too_short'
    | 'quota_reached'
    | 'provider_unconfigured'
    | 'provider_error';
  readonly suggestions: readonly AddressSuggestion[];
  readonly usage: AddressUsageSnapshot;
  readonly message?: string;
}

export interface AddressValidateRequest {
  readonly suggestionId?: string;
  readonly sessionToken?: string;
}

export interface AddressValidateResponse {
  readonly verified: boolean;
  readonly status:
    | 'verified'
    | 'missing_selection'
    | 'quota_reached'
    | 'provider_unconfigured'
    | 'provider_error'
    | 'invalid';
  readonly usage: AddressUsageSnapshot;
  readonly normalizedAddress?: NormalizedAddress;
  readonly message?: string;
}

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface AddressSuggestion {
  readonly id: string;
  readonly label: string;
  readonly primaryText: string;
  readonly secondaryText: string;
}

export interface AddressUsageSnapshot {
  readonly monthKey: string;
  readonly caps: {
    readonly autocompleteRequests: number;
    readonly placeDetailsRequests: number;
    readonly addressValidationRequests: number;
  };
  readonly counts: {
    readonly autocompleteRequests: number;
    readonly placeDetailsRequests: number;
    readonly addressValidationRequests: number;
  };
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

export interface AddressValidationResult {
  readonly verified: boolean;
  readonly status:
    | 'verified'
    | 'missing_selection'
    | 'quota_reached'
    | 'provider_unconfigured'
    | 'provider_error'
    | 'invalid';
  readonly usage: AddressUsageSnapshot;
  readonly normalizedAddress?: {
    readonly formattedAddress: string;
    readonly streetAddress: string;
    readonly city: string;
    readonly province: string;
    readonly postalCode: string;
    readonly countryCode: string;
    readonly latitude: number | null;
    readonly longitude: number | null;
  };
  readonly message?: string;
}

@Injectable({ providedIn: 'root' })
export class AddressLookupService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/addresses`;

  async suggest(query: string, sessionToken: string): Promise<AddressSuggestResponse> {
    return firstValueFrom(
      this.http.get<AddressSuggestResponse>(`${this.baseUrl}/suggest`, {
        params: {
          q: query,
          sessionToken,
        },
      }),
    );
  }

  async validate(
    suggestionId: string,
    sessionToken: string,
  ): Promise<AddressValidationResult> {
    return firstValueFrom(
      this.http.post<AddressValidationResult>(`${this.baseUrl}/validate`, {
        suggestionId,
        sessionToken,
      }),
    );
  }

  async getUsage(): Promise<AddressUsageSnapshot> {
    return firstValueFrom(this.http.get<AddressUsageSnapshot>(`${this.baseUrl}/usage`));
  }
}

export const HEDGE_IDS = [
  'hedge-1',
  'hedge-2',
  'hedge-3',
  'hedge-4',
  'hedge-5',
  'hedge-6',
  'hedge-7',
  'hedge-8',
] as const;

export type HedgeId = (typeof HEDGE_IDS)[number];
export type HedgeState = 'none' | 'trim' | 'rabattage';
export type TrimPreset = 'normal' | 'total';
export type RabattageOption = 'partial' | 'total' | 'total_no_roots';
export type EntryVariant = 'warm-lead' | 'customer';

export interface EntryCalendarPayload {
  start: string;
  end: string;
  notes?: string;
}

export interface TrimConfig {
  mode: 'custom' | 'preset';
  inside?: boolean;
  top?: boolean;
  outside?: boolean;
  preset?: TrimPreset;
}

export interface RabattageConfig {
  option: RabattageOption;
  partialAmountText?: string;
}

export interface HedgeConfig {
  state: HedgeState;
  trim?: TrimConfig;
  rabattage?: RabattageConfig;
}

export interface EntryModalPayload {
  variant: EntryVariant;
  form: {
    firstName: string;
    lastName: string;
    address: string;
    phone: string;
    email?: string;
    jobType: string;
    jobValue: string;
    desiredBudget?: string;
    additionalDetails?: string;
  };
  hedges: Record<HedgeId, HedgeConfig>;
  calendar?: EntryCalendarPayload;
}

export const createEmptyHedgeState = (): Record<HedgeId, HedgeState> =>
  HEDGE_IDS.reduce(
    (acc, id) => ({
      ...acc,
      [id]: 'none',
    }),
    {} as Record<HedgeId, HedgeState>,
  );

export const createEmptyHedgeConfigs = (): Record<HedgeId, HedgeConfig> =>
  HEDGE_IDS.reduce(
    (acc, id) => ({
      ...acc,
      [id]: { state: 'none' },
    }),
    {} as Record<HedgeId, HedgeConfig>,
  );

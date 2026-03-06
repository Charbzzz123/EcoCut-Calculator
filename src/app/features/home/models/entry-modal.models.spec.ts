import { describe, expect, it } from 'vitest';
import {
  HEDGE_IDS,
  createEmptyHedgeConfigs,
  createEmptyHedgeState,
  type HedgeState,
} from './entry-modal.models.js';

describe('entry-modal models', () => {
  it('defines eight deterministic hedge ids', () => {
    expect(HEDGE_IDS).toHaveLength(8);
    expect(HEDGE_IDS[0]).toBe('hedge-1');
  });

  it('creates empty hedge states defaulting to none', () => {
    const stateMap = createEmptyHedgeState();
    HEDGE_IDS.forEach((id) => {
      expect(stateMap[id]).toBe<'none'>('none');
    });
  });

  it('creates default hedge configs for every id', () => {
    const configs = createEmptyHedgeConfigs();
    const first: HedgeState = configs['hedge-1'].state;
    expect(first).toBe('none');
    expect(Object.keys(configs)).toHaveLength(HEDGE_IDS.length);
  });
});

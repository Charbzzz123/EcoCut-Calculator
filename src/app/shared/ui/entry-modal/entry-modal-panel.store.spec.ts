import { EntryModalPanelStore, createPanelSignals } from './entry-modal-panel.store.js';

describe('EntryModalPanelStore', () => {
  it('initializes panel state and exposes defaults', () => {
    const store = new EntryModalPanelStore();
    expect(store.hedgeStates()['hedge-1']).toBe('none');
    expect(store.panelState()).toBeNull();
    expect(store.panelPosition()).toEqual({ left: 0, top: 0 });
    expect(store.panelFloats()).toBe(true);
  });

  it('binds drag callbacks during construction', () => {
    const store = new EntryModalPanelStore();
    (store as unknown as { onPanelDragMove: (event: PointerEvent) => void }).onPanelDragMove({
      clientX: 0,
      clientY: 0,
    } as PointerEvent);
    (store as unknown as { onPanelDragEnd: () => void }).onPanelDragEnd();
  });

  it('creates fresh panel signals via the factory', () => {
    const signals = createPanelSignals();
    expect(signals.hedgeStates()).toMatchObject({
      'hedge-1': 'none',
      'hedge-2': 'none',
    });
    expect(signals.panelState()).toBeNull();
    expect(signals.floatingPanelEnabled()).toBe(true);
  });

  it('builds hedge payloads using the latest hedge states even without saved configs', () => {
    const store = new EntryModalPanelStore();
    store.hedgeStates.set({
      ...store.hedgeStates(),
      'hedge-1': 'trim',
      'hedge-3': 'rabattage',
    });

    const payload = store.buildHedgePayload();

    expect(payload['hedge-1'].state).toBe('trim');
    expect(payload['hedge-1'].trim).toBeUndefined();
    expect(payload['hedge-3'].state).toBe('rabattage');
    expect(payload['hedge-3'].rabattage).toBeUndefined();
    expect(payload['hedge-2'].state).toBe('none');
  });

  it('prefers saved configs when states and configs agree', () => {
    const store = new EntryModalPanelStore();
    store.savedConfigs.set({
      ...store.savedConfigs(),
      'hedge-2': { state: 'trim', trim: { mode: 'preset', preset: 'normal' } },
    });
    store.hedgeStates.set({
      ...store.hedgeStates(),
      'hedge-2': 'trim',
    });

    const payload = store.buildHedgePayload();

    expect(payload['hedge-2'].trim?.preset).toBe('normal');
  });

  it('normalizes missing states when loading configs', () => {
    const store = new EntryModalPanelStore();
    store.loadFromConfigs(
      {
        'hedge-1': { state: 'trim', trim: { mode: 'custom', inside: true } },
        'hedge-2': {} as unknown,
      } as unknown as Record<string, { state: 'none' | 'trim' | 'rabattage' }>,
    );
    expect(store.hedgeStates()['hedge-1']).toBe('trim');
    expect(store.hedgeStates()['hedge-2']).toBe('none');
    expect(store.savedConfigs()['hedge-2'].state).toBeUndefined();
  });

  it('keeps trim presets and custom checkboxes mutually exclusive', () => {
    const store = new EntryModalPanelStore();
    const event = {
      stopPropagation: () => undefined,
      currentTarget: null,
    } as unknown as MouseEvent;

    store.cycleHedge(event, 'hedge-1');
    store.selectTrimPreset('normal');
    const presetState = store.panelState();
    expect(presetState?.state).toBe('trim');
    if (presetState?.state !== 'trim') {
      throw new Error('Expected trim panel state');
    }
    expect(presetState.trim.preset).toBe('normal');

    store.updateTrimSection('inside', true);
    const customState = store.panelState();
    expect(customState?.state).toBe('trim');
    if (customState?.state !== 'trim') {
      throw new Error('Expected trim panel state');
    }
    expect(customState.trim.inside).toBe(true);
    expect(customState.trim.preset).toBeUndefined();

    store.selectTrimPreset('total');
    const totalState = store.panelState();
    expect(totalState?.state).toBe('trim');
    if (totalState?.state !== 'trim') {
      throw new Error('Expected trim panel state');
    }
    expect(totalState.trim.preset).toBe('total');
    expect(totalState.trim.inside).toBe(false);
    expect(totalState.trim.top).toBe(false);
    expect(totalState.trim.outside).toBe(false);
  });
});

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
});

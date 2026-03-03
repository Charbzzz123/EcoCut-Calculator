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
});

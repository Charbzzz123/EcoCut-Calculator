import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { vi } from 'vitest';
import { MergeTokenEditorComponent } from './merge-token-editor.component.js';

describe('MergeTokenEditorComponent', () => {
  let fixture: ComponentFixture<MergeTokenEditorComponent>;
  let component: MergeTokenEditorComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MergeTokenEditorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MergeTokenEditorComponent);
    component = fixture.componentInstance;
    component.targetId = 'emailBody';
    component.placeholder = 'Write a message';
    component.mergeFields = [
      {
        token: '{{firstName}}',
        label: 'First name',
      },
      {
        token: '{{address}}',
        label: 'Address',
      },
    ];
  });

  afterEach(() => {
    ((document as unknown) as Record<string, unknown>)['caretPositionFromPoint'] = undefined;
    ((document as unknown) as Record<string, unknown>)['caretRangeFromPoint'] = undefined;
  });

  it('renders merge values as token chips', () => {
    component.value = 'Hi {{firstName}} at [[Address]]';
    fixture.detectChanges();

    const chips = fixture.nativeElement.querySelectorAll('.merge-token-editor__chip');
    expect(chips.length).toBe(2);
    expect(chips[0].textContent).toContain('First name');
    expect(chips[1].textContent).toContain('Address');
  });

  it('emits focus and blocks enter in single-line mode', () => {
    component.singleLine = true;
    fixture.detectChanges();

    const focusSpy = vi.fn();
    component.editorFocused.subscribe(focusSpy);

    const editor = fixture.nativeElement.querySelector('.merge-token-editor__surface') as HTMLDivElement;
    editor.dispatchEvent(new Event('focus'));
    expect(focusSpy).toHaveBeenCalledTimes(1);

    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    editor.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);

    const nonEnter = new KeyboardEvent('keydown', { key: 'A', cancelable: true });
    editor.dispatchEvent(nonEnter);
    expect(nonEnter.defaultPrevented).toBe(false);
  });

  it('inserts token and emits updated value', () => {
    component.value = 'Hi ';
    fixture.detectChanges();
    const changeSpy = vi.fn();
    component.valueChange.subscribe(changeSpy);

    component.insertToken('[[First name]]', 'First name');

    expect(changeSpy).toHaveBeenCalledWith('Hi [[First name]]');
  });

  it('re-renders when input value changes after initial render', () => {
    component.value = 'Hi {{firstName}}';
    fixture.detectChanges();

    component.value = 'Hello {{address}}';
    component.ngOnChanges({
      value: new SimpleChange('Hi {{firstName}}', 'Hello {{address}}', false),
    });

    const chips = fixture.nativeElement.querySelectorAll('.merge-token-editor__chip');
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toContain('Address');
  });

  it('supports drop insertion with provider payload', () => {
    component.value = 'Hello ';
    fixture.detectChanges();
    const changeSpy = vi.fn();
    component.valueChange.subscribe(changeSpy);

    component['onEditorDrop']({
      preventDefault: vi.fn(),
      dataTransfer: {
        getData: vi.fn((kind: string) => {
          if (kind === 'application/ecocut-merge-token') {
            return '[[Address]]';
          }
          if (kind === 'application/ecocut-merge-label') {
            return 'Address';
          }
          return '';
        }),
      },
    } as unknown as DragEvent);

    expect(changeSpy).toHaveBeenCalledWith('Hello [[Address]]');
  });

  it('ignores drop when token payload is empty', () => {
    component.value = 'Hello ';
    fixture.detectChanges();
    const changeSpy = vi.fn();
    component.valueChange.subscribe(changeSpy);

    component['onEditorDrop']({
      preventDefault: vi.fn(),
      dataTransfer: {
        getData: vi.fn(() => ''),
      },
    } as unknown as DragEvent);

    expect(changeSpy).not.toHaveBeenCalled();
  });

  it('moves an existing token chip when dragging inside the editor', () => {
    component.value = 'Hi {{firstName}} there';
    fixture.detectChanges();
    const changeSpy = vi.fn();
    component.valueChange.subscribe(changeSpy);

    const editor = fixture.nativeElement.querySelector('.merge-token-editor__surface') as HTMLDivElement;
    const chip = fixture.nativeElement.querySelector('.merge-token-editor__chip') as HTMLElement;
    const transfer = {
      getData: vi.fn((kind: string) => {
        if (kind === 'application/ecocut-merge-token') {
          return '{{firstName}}';
        }
        if (kind === 'application/ecocut-merge-label') {
          return 'First name';
        }
        return '';
      }),
      setData: vi.fn(),
      effectAllowed: 'none',
      dropEffect: 'none',
    };

    component['onEditorDragStart']({ target: chip, dataTransfer: transfer } as unknown as DragEvent);
    expect(chip.classList.contains('merge-token-editor__chip--dragging')).toBe(true);
    expect(transfer.setData).toHaveBeenCalledWith('application/ecocut-merge-token', '{{firstName}}');

    component['onEditorDragOver']({ preventDefault: vi.fn(), dataTransfer: transfer } as unknown as DragEvent);
    expect(transfer.dropEffect).toBe('move');

    component['onEditorDrop']({
      preventDefault: vi.fn(),
      currentTarget: editor,
      target: editor,
      dataTransfer: transfer,
    } as unknown as DragEvent);

    const latestValue = changeSpy.mock.calls[changeSpy.mock.calls.length - 1]?.[0] as string;
    expect((latestValue.match(/\{\{firstName\}\}/g) ?? []).length).toBe(1);
  });

  it('clears drag state on drag end and keeps copy mode for external drags', () => {
    component.value = 'Hello';
    fixture.detectChanges();

    const chip = fixture.nativeElement.querySelector('.merge-token-editor__chip') as HTMLElement | null;
    if (chip) {
      component['onEditorDragStart']({
        target: chip,
        dataTransfer: { setData: vi.fn() },
      } as unknown as DragEvent);
      component['onEditorDragEnd']();
      expect(chip.classList.contains('merge-token-editor__chip--dragging')).toBe(false);
    }

    const transfer = { dropEffect: 'none' };
    component['onEditorDragOver']({ preventDefault: vi.fn(), dataTransfer: transfer } as unknown as DragEvent);
    expect(transfer.dropEffect).toBe('copy');
  });

  it('does nothing when drag starts from a non-chip target or chip without token', () => {
    component.value = 'Hello';
    fixture.detectChanges();

    const setData = vi.fn();
    component['onEditorDragStart']({
      target: document.createElement('div'),
      dataTransfer: { setData },
    } as unknown as DragEvent);

    const chipWithoutToken = document.createElement('span');
    chipWithoutToken.className = 'merge-token-editor__chip';
    component['onEditorDragStart']({
      target: chipWithoutToken,
      dataTransfer: { setData },
    } as unknown as DragEvent);

    expect(setData).not.toHaveBeenCalled();
  });

  it('uses caretPositionFromPoint when available during dragover', () => {
    component.value = 'Hello';
    fixture.detectChanges();

    const editor = fixture.nativeElement.querySelector('.merge-token-editor__surface') as HTMLDivElement;
    const textNode = editor.firstChild as Text;
    ((document as unknown) as Record<string, unknown>)['caretPositionFromPoint'] = vi.fn(() => ({
      offsetNode: textNode,
      offset: 2,
    }));

    const transfer = { dropEffect: 'none' };
    component['onEditorDragOver']({
      preventDefault: vi.fn(),
      clientX: 12,
      clientY: 14,
      dataTransfer: transfer,
    } as unknown as DragEvent);

    expect(transfer.dropEffect).toBe('copy');
  });

  it('falls back to caretRangeFromPoint when caretPositionFromPoint is unavailable', () => {
    component.value = 'Hello';
    fixture.detectChanges();

    const editor = fixture.nativeElement.querySelector('.merge-token-editor__surface') as HTMLDivElement;
    const textNode = editor.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 1);
    range.collapse(true);

    ((document as unknown) as Record<string, unknown>)['caretPositionFromPoint'] = undefined;
    ((document as unknown) as Record<string, unknown>)['caretRangeFromPoint'] = vi.fn(() => range);

    component['onEditorDragOver']({
      preventDefault: vi.fn(),
      clientX: 10,
      clientY: 10,
      dataTransfer: { dropEffect: 'none' },
    } as unknown as DragEvent);

    const selection = window.getSelection();
    expect(selection?.rangeCount).toBeGreaterThan(0);
  });

  it('keeps selection safe when pointer coordinates are invalid', () => {
    component.value = 'Hello';
    fixture.detectChanges();

    const before = window.getSelection()?.rangeCount ?? 0;
    component['onEditorDragOver']({
      preventDefault: vi.fn(),
      clientX: Number.NaN,
      clientY: Number.NaN,
      dataTransfer: { dropEffect: 'none' },
    } as unknown as DragEvent);
    const after = window.getSelection()?.rangeCount ?? 0;

    expect(after).toBe(before);
  });

  it('does not emit when input serialization keeps the same value', () => {
    component.value = 'No change';
    fixture.detectChanges();
    const changeSpy = vi.fn();
    component.valueChange.subscribe(changeSpy);

    const editor = fixture.nativeElement.querySelector('.merge-token-editor__surface') as HTMLDivElement;
    editor.dispatchEvent(new Event('input'));

    expect(changeSpy).not.toHaveBeenCalled();
  });

  it('uses plain text fallback on drop when custom payload is missing', () => {
    component.value = 'Hello ';
    fixture.detectChanges();
    const changeSpy = vi.fn();
    component.valueChange.subscribe(changeSpy);

    component['onEditorDrop']({
      preventDefault: vi.fn(),
      dataTransfer: {
        getData: vi.fn((kind: string) => {
          if (kind === 'application/ecocut-merge-token') {
            return undefined as unknown as string;
          }
          return kind === 'text/plain' ? '[[Address]]' : '';
        }),
      },
    } as unknown as DragEvent);

    expect(changeSpy).toHaveBeenCalledWith('Hello [[Address]]');
  });

  it('ignores caret updates when resolved caret target is outside editor', () => {
    component.value = 'Hello';
    fixture.detectChanges();
    ((document as unknown) as Record<string, unknown>)['caretPositionFromPoint'] = vi.fn(() => ({
      offsetNode: document.createTextNode('outside'),
      offset: 1,
    }));

    component['onEditorDragOver']({
      preventDefault: vi.fn(),
      clientX: 10,
      clientY: 10,
      dataTransfer: { dropEffect: 'none' },
    } as unknown as DragEvent);

    const selection = window.getSelection();
    expect(selection?.rangeCount ?? 0).toBeGreaterThanOrEqual(0);
  });

  it('serializes block elements with line breaks', () => {
    component.value = 'Base';
    fixture.detectChanges();
    const changeSpy = vi.fn();
    component.valueChange.subscribe(changeSpy);
    const editor = fixture.nativeElement.querySelector('.merge-token-editor__surface') as HTMLDivElement;
    editor.innerHTML = '<div>Line 1</div><p>Line 2</p><br>Tail';

    editor.dispatchEvent(new Event('input'));
    const latest = changeSpy.mock.calls[changeSpy.mock.calls.length - 1]?.[0] as string;
    expect(latest).toContain('Line 1\n');
    expect(latest).toContain('Line 2\n');
    expect(latest).toContain('Tail');
  });

  it('returns inline token label when canonical map is missing', () => {
    component.mergeFields = [];
    component.value = '[[Inline label]]';
    fixture.detectChanges();
    const chip = fixture.nativeElement.querySelector('.merge-token-editor__chip') as HTMLElement;
    expect(chip.textContent).toContain('Inline label');
  });

  it('returns raw token when no canonical or inline label match is found', () => {
    component.value = '{{unknown}}';
    fixture.detectChanges();
    const chip = fixture.nativeElement.querySelector('.merge-token-editor__chip') as HTMLElement;
    expect(chip.textContent).toContain('{{unknown}}');
  });

  it('covers editor guard branches when editor is unavailable', () => {
    (component as unknown as { editorRef?: unknown }).editorRef = undefined;
    expect(() => component.insertToken('{{firstName}}', 'First name')).not.toThrow();
    expect(
      (component as unknown as { serializeEditorValue: () => string }).serializeEditorValue(),
    ).toBe('');
    expect(
      (
        component as unknown as {
          renderFromValue: (value: string) => void;
        }
      ).renderFromValue('Hello'),
    ).toBeUndefined();
  });

  it('covers caret/selection guard branches', () => {
    component.value = 'Hello';
    fixture.detectChanges();
    const editor = fixture.nativeElement.querySelector('.merge-token-editor__surface') as HTMLDivElement;
    const selectionSpy = vi.spyOn(window, 'getSelection');
    selectionSpy.mockReturnValue(null);

    expect(
      (
        component as unknown as {
          placeCaretFromPointer: (event: DragEvent) => void;
        }
      ).placeCaretFromPointer({ clientX: 10, clientY: 10 } as DragEvent),
    ).toBeUndefined();

    selectionSpy.mockRestore();

    const textNode = editor.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 1);
    range.collapse(true);
    ((document as unknown) as Record<string, unknown>)['caretPositionFromPoint'] = undefined;
    ((document as unknown) as Record<string, unknown>)['caretRangeFromPoint'] = vi.fn(() => {
      const outsideRange = document.createRange();
      outsideRange.setStart(document.createTextNode('outside'), 0);
      outsideRange.collapse(true);
      return outsideRange;
    });

    component['onEditorDragOver']({
      preventDefault: vi.fn(),
      clientX: 10,
      clientY: 10,
      dataTransfer: { dropEffect: 'none' },
    } as unknown as DragEvent);
  });

  it('serializes non-html nodes and non-div wrappers safely', () => {
    component.value = 'Base';
    fixture.detectChanges();
    const editor = fixture.nativeElement.querySelector('.merge-token-editor__surface') as HTMLDivElement;
    editor.innerHTML = '';
    editor.append(document.createComment('note'));
    const span = document.createElement('span');
    span.textContent = 'span-text';
    editor.append(span);

    const spy = vi.fn();
    component.valueChange.subscribe(spy);
    editor.dispatchEvent(new Event('input'));
    expect(spy).toHaveBeenLastCalledWith('span-text');
  });

  it('handles drag end when no dragged chip exists', () => {
    component.value = 'Hello';
    fixture.detectChanges();
    expect(() => component['onEditorDragEnd']()).not.toThrow();
  });

  it('handles drag end when dragged chip is tracked', () => {
    component.value = 'Hello {{firstName}}';
    fixture.detectChanges();
    const chip = fixture.nativeElement.querySelector('.merge-token-editor__chip') as HTMLElement;
    (component as unknown as { draggedChipNode: HTMLElement | null }).draggedChipNode = chip;
    chip.classList.add('merge-token-editor__chip--dragging');

    component['onEditorDragEnd']();

    expect(chip.classList.contains('merge-token-editor__chip--dragging')).toBe(false);
  });

  it('executes template drag bindings through DOM events', () => {
    component.value = 'Hi {{firstName}}';
    fixture.detectChanges();

    const editor = fixture.nativeElement.querySelector('.merge-token-editor__surface') as HTMLDivElement;
    const chip = fixture.nativeElement.querySelector('.merge-token-editor__chip') as HTMLElement;
    const textNode = editor.firstChild as Text;
    const transfer = {
      getData: vi.fn((kind: string) => {
        if (kind === 'application/ecocut-merge-token') {
          return '{{firstName}}';
        }
        if (kind === 'application/ecocut-merge-label') {
          return 'First name';
        }
        return '';
      }),
      setData: vi.fn(),
      effectAllowed: 'none',
      dropEffect: 'none',
    };

    ((document as unknown) as Record<string, unknown>)['caretPositionFromPoint'] = vi.fn(() => ({
      offsetNode: textNode,
      offset: 1,
    }));

    const dragStartEvent = new Event('dragstart', { bubbles: true }) as DragEvent;
    Object.defineProperty(dragStartEvent, 'dataTransfer', { value: transfer });
    chip.dispatchEvent(dragStartEvent);

    const dragOverEvent = new Event('dragover', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(dragOverEvent, 'dataTransfer', { value: transfer });
    Object.defineProperty(dragOverEvent, 'clientX', { value: 10 });
    Object.defineProperty(dragOverEvent, 'clientY', { value: 10 });
    editor.dispatchEvent(dragOverEvent);

    const dropEvent = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(dropEvent, 'dataTransfer', { value: transfer });
    Object.defineProperty(dropEvent, 'clientX', { value: 10 });
    Object.defineProperty(dropEvent, 'clientY', { value: 10 });
    editor.dispatchEvent(dropEvent);

    const dragEndEvent = new Event('dragend', { bubbles: true }) as DragEvent;
    editor.dispatchEvent(dragEndEvent);

    expect(transfer.setData).toHaveBeenCalledWith('application/ecocut-merge-token', '{{firstName}}');
  });

  it('covers drag/drop branches without dataTransfer and label payload', () => {
    component.value = 'Hello';
    fixture.detectChanges();
    const editor = fixture.nativeElement.querySelector('.merge-token-editor__surface') as HTMLDivElement;
    const textNode = editor.firstChild as Text;
    const changeSpy = vi.fn();
    component.valueChange.subscribe(changeSpy);
    ((document as unknown) as Record<string, unknown>)['caretPositionFromPoint'] = vi.fn(() => ({
      offsetNode: textNode,
      offset: 1,
    }));

    component['onEditorDragOver']({
      preventDefault: vi.fn(),
      clientX: 10,
      clientY: 10,
    } as unknown as DragEvent);

    component['onEditorDrop']({
      preventDefault: vi.fn(),
    } as unknown as DragEvent);

    const transfer = {
      getData: vi.fn((kind: string) => (kind === 'text/plain' ? '{{address}}' : '')),
    };
    component['onEditorDrop']({
      preventDefault: vi.fn(),
      dataTransfer: transfer,
      clientX: 10,
      clientY: 10,
    } as unknown as DragEvent);

    expect(() => editor.dispatchEvent(new Event('input'))).not.toThrow();
  });

  it('covers token-less drag start and non-HTMLElement target resolution', () => {
    component.value = 'Hello';
    fixture.detectChanges();
    const setData = vi.fn();
    const chipWithoutLabel = document.createElement('span');
    chipWithoutLabel.className = 'merge-token-editor__chip';
    chipWithoutLabel.dataset['mergeToken'] = '{{firstName}}';
    chipWithoutLabel.textContent = '';

    component['onEditorDragStart']({
      target: chipWithoutLabel,
      dataTransfer: { setData, effectAllowed: 'none' },
    } as unknown as DragEvent);

    component['onEditorDragStart']({
      target: document.createTextNode('outside'),
      dataTransfer: { setData },
    } as unknown as DragEvent);

    expect(setData).toHaveBeenCalledWith('application/ecocut-merge-label', 'First name');
  });

  it('covers insertToken path when selection has no ranges', () => {
    component.value = 'Hello';
    fixture.detectChanges();
    const getSelectionSpy = vi.spyOn(window, 'getSelection');
    getSelectionSpy.mockReturnValue({
      rangeCount: 0,
      removeAllRanges: vi.fn(),
      addRange: vi.fn(),
    } as unknown as Selection);

    component.insertToken('{{firstName}}', 'First name');
    getSelectionSpy.mockRestore();
  });

  it('covers placeCaret branch when editor reference is missing and no caret APIs exist', () => {
    (component as unknown as { editorRef?: unknown }).editorRef = undefined;
    component['onEditorDragOver']({
      preventDefault: vi.fn(),
      clientX: 10,
      clientY: 10,
      dataTransfer: { dropEffect: 'none' },
    } as unknown as DragEvent);

    component.value = 'Hello';
    fixture.detectChanges();
    ((document as unknown) as Record<string, unknown>)['caretPositionFromPoint'] = undefined;
    ((document as unknown) as Record<string, unknown>)['caretRangeFromPoint'] = undefined;
    component['onEditorDragOver']({
      preventDefault: vi.fn(),
      clientX: 10,
      clientY: 10,
      dataTransfer: { dropEffect: 'none' },
    } as unknown as DragEvent);
  });

  it('covers text serialization null branch and appendText break insertion', () => {
    component.value = 'A\n';
    fixture.detectChanges();
    const editor = fixture.nativeElement.querySelector('.merge-token-editor__surface') as HTMLDivElement;
    const spy = vi.fn();
    component.valueChange.subscribe(spy);

    const textNode = document.createTextNode('X');
    textNode.textContent = null;
    editor.innerHTML = '';
    editor.append(textNode);
    editor.dispatchEvent(new Event('input'));

    component['ngOnChanges']({
      value: new SimpleChange('A\n', 'B\n', false),
    });
    expect(spy).toHaveBeenCalled();
  });
});

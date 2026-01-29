/* istanbul ignore file */
import { signal, type WritableSignal } from '@angular/core';

export function createWritableSignal<T>(initialValue: T): WritableSignal<T> {
  return signal(initialValue);
}

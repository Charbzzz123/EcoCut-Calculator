import { ValidatorFn } from '@angular/forms';

const extractDigits = (value: string): string => value.replace(/\D/g, '');

export const normalizeNorthAmericanDigits = (value: string): string => {
  let digits = extractDigits(value);
  if (digits.startsWith('1') && digits.length > 10) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
};

export const formatNorthAmericanPhone = (digits: string): string => {
  if (!digits) {
    return '';
  }
  if (digits.length <= 3) {
    return `(${digits}`;
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export const northAmericanPhoneValidator: ValidatorFn = (control) => {
  const raw = (control.value as string | null) ?? '';
  if (!raw) {
    return null;
  }
  return normalizeNorthAmericanDigits(raw).length === 10 ? null : { phoneInvalid: true };
};

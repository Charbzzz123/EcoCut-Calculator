import type { CreateCalendarEventRequest } from '../services/calendar-events.service.js';
import {
  HEDGE_IDS,
  type EntryModalPayload,
  type HedgeConfig,
  type HedgeId,
  type RabattageConfig,
  type TrimConfig,
} from './entry-modal.models.js';

const HEDGE_LABELS: Record<HedgeId, string> = {
  'hedge-1': 'Front Left',
  'hedge-2': 'Left',
  'hedge-3': 'Back',
  'hedge-4': 'Right',
  'hedge-5': 'Right House',
  'hedge-6': 'Left House',
  'hedge-7': 'Front Right',
  'hedge-8': 'Parking',
};

const currencyFormatter = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

export const buildCalendarEventRequest = (
  payload: EntryModalPayload,
): CreateCalendarEventRequest | null => {
  if (!payload.calendar) {
    return null;
  }

  const { form, calendar, hedges } = payload;
  const summary = `${form.firstName} ${form.lastName} \u2013 ${deriveJobTypeLabel(hedges, form.jobType)}`;

  const descriptionLines: string[] = [];
  descriptionLines.push(`Address : ${form.address}`);
  descriptionLines.push(`Phone : ${form.phone}`);
  if (form.email) {
    descriptionLines.push(`Email : ${form.email}`);
  }
  descriptionLines.push(`Job value: ${formatCurrency(form.jobValue)}`);
  if (form.desiredBudget) {
    descriptionLines.push(`Desired budget: ${formatCurrency(form.desiredBudget)}`);
  }

  const hedgeLines = describeHedgePlan(hedges);
  if (hedgeLines.length) {
    descriptionLines.push('Hedge plan:');
    hedgeLines.forEach((line) => descriptionLines.push(`- ${line}`));
  }

  if (form.additionalDetails?.trim()) {
    descriptionLines.push(`Additional details: ${form.additionalDetails.trim()}`);
  }

  return {
    summary,
    description: descriptionLines.join('\n'),
    start: calendar.start,
    end: calendar.end,
    timeZone: calendar.timeZone,
    location: form.address,
  };
};

const deriveJobTypeLabel = (hedges: Record<HedgeId, HedgeConfig>, fallback: string): string => {
  let hasTrim = false;
  let hasRabattage = false;

  for (const config of Object.values(hedges)) {
    if (config?.state === 'trim') {
      hasTrim = true;
    } else if (config?.state === 'rabattage') {
      hasRabattage = true;
    }
    if (hasTrim && hasRabattage) {
      break;
    }
  }

  if (hasTrim && hasRabattage) {
    return 'Both';
  }
  if (hasRabattage) {
    return 'Rabattage';
  }
  if (hasTrim) {
    return 'Trim';
  }
  return fallback;
};

const describeHedgePlan = (hedges: Record<HedgeId, HedgeConfig>): string[] => {
  const handled = new Set<HedgeId>();
  const lines: string[] = [];

  const frontLeft = hedges['hedge-1'];
  const frontRight = hedges['hedge-7'];
  if (
    frontLeft &&
    frontRight &&
    frontLeft.state !== 'none' &&
    frontLeft.state === frontRight.state
  ) {
    handled.add('hedge-1');
    handled.add('hedge-7');
    if (frontLeft.state === 'trim') {
      lines.push(`Front Trim ${describeMergedTrimConfig(frontLeft.trim, frontRight.trim)}`);
    }
    if (frontLeft.state === 'rabattage') {
      lines.push(
        `Front Rabattage ${describeMergedRabattageConfig(frontLeft.rabattage, frontRight.rabattage)}`,
      );
    }
  }

  const orderedKeys = [
    ...HEDGE_IDS,
    ...Object.keys(hedges).filter((key) => !HEDGE_IDS.includes(key as HedgeId)),
  ];

  for (const hedgeKey of orderedKeys) {
    const hedgeId = hedgeKey as HedgeId;
    if (handled.has(hedgeId)) {
      continue;
    }
    const config = (hedges as Record<string, HedgeConfig | undefined>)[hedgeKey];
    if (!config || config.state === 'none') {
      continue;
    }
    const label = HEDGE_LABELS[hedgeId] ?? hedgeKey;
    if (config.state === 'trim') {
      lines.push(`${label} Trim ${describeTrimConfig(config.trim)}`);
    } else if (config.state === 'rabattage') {
      lines.push(`${label} Rabattage ${describeRabattageConfig(config.rabattage)}`);
    } else {
      lines.push(`${label} (${config.state})`);
    }
  }

  return lines;
};

const describeTrimConfig = (config: TrimConfig | undefined): string => {
  if (!config) {
    return '(custom)';
  }
  if (config.mode === 'preset') {
    switch (config.preset) {
      case 'normal':
        return 'N';
      case 'total':
        return 'T';
      default:
        return '(custom)';
    }
  }
  const tags: string[] = [];
  if (config.inside) {
    tags.push('i');
  }
  if (config.top) {
    tags.push('t');
  }
  if (config.outside) {
    tags.push('o');
  }
  return tags.length ? `(${tags.join(',')})` : '(custom)';
};

const describeMergedTrimConfig = (a: TrimConfig | undefined, b: TrimConfig | undefined): string => {
  let result = describeTrimConfig(a);
  const second = describeTrimConfig(b);
  if (!second || result === second) {
    return result;
  }
  if (result.startsWith('(') && second.startsWith('(')) {
    const combined = new Set<string>();
    const allowed = new Set(['i', 't', 'o']);
    result
      .slice(1, -1)
      .split(',')
      .map((value) => value.trim())
      .filter((tag) => allowed.has(tag))
      .forEach((tag) => combined.add(tag));
    second
      .slice(1, -1)
      .split(',')
      .map((value) => value.trim())
      .filter((tag) => allowed.has(tag))
      .forEach((tag) => combined.add(tag));
    if (combined.size > 0) {
      result = `(${Array.from(combined).join(',')})`;
    }
  }
  return result;
};

const describeRabattageConfig = (config: RabattageConfig | undefined): string => {
  if (!config) {
    return 'T';
  }
  if (config.option === 'partial') {
    const text = config.partialAmountText?.trim();
    return text ? `P: ${text}` : 'P';
  }
  if (config.option === 'total_no_roots') {
    return 'TnoRoots';
  }
  return 'T';
};

const describeMergedRabattageConfig = (
  a: RabattageConfig | undefined,
  b: RabattageConfig | undefined,
): string => {
  const first = describeRabattageConfig(a);
  const second = describeRabattageConfig(b);
  if (!second || first === second) {
    return first;
  }
  return first;
};

const formatCurrency = (value: string | number): string => {
  const numeric = typeof value === 'number' ? value : Number(value || 0);
  return currencyFormatter.format(Number.isNaN(numeric) ? 0 : numeric);
};

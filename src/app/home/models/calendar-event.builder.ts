import type { CreateCalendarEventRequest } from '../services/calendar-events.service.js';
import type { EntryModalPayload, HedgeConfig, HedgeId } from './entry-modal.models.js';

const HEDGE_LABELS: Record<HedgeId, string> = {
  'hedge-1': 'Front walkway (left)',
  'hedge-2': 'Left perimeter',
  'hedge-3': 'Front perimeter',
  'hedge-4': 'Right perimeter',
  'hedge-5': 'Back patio',
  'hedge-6': 'Driveway line',
  'hedge-7': 'Back perimeter',
  'hedge-8': 'Gate column',
};

const currencyFormatter = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

export const buildCalendarEventRequest = (
  payload: EntryModalPayload,
): CreateCalendarEventRequest | null => {
  if (!payload.calendar) {
    return null;
  }

  const { form, calendar } = payload;
  const summary = `${form.firstName} ${form.lastName} – ${form.jobType}`;
  const descriptionLines: string[] = [];
  descriptionLines.push(`Client: ${form.firstName} ${form.lastName}`);
  descriptionLines.push(`Address: ${form.address}`);
  descriptionLines.push(`Phone: ${form.phone}`);
  if (form.email) {
    descriptionLines.push(`Email: ${form.email}`);
  }
  descriptionLines.push(`Job type: ${form.jobType}`);
  descriptionLines.push(`Job value: ${formatCurrency(form.jobValue)}`);
  if (form.desiredBudget) {
    descriptionLines.push(`Desired budget: ${formatCurrency(form.desiredBudget)}`);
  }

  const hedgeLines = describeHedgePlan(payload.hedges);
  if (hedgeLines.length) {
    descriptionLines.push('Hedge plan:');
    hedgeLines.forEach((line) => descriptionLines.push(`- ${line}`));
  }

  if (form.additionalDetails?.trim()) {
    descriptionLines.push(`Additional details: ${form.additionalDetails.trim()}`);
  }
  if (calendar.notes?.trim()) {
    descriptionLines.push(`Calendar notes: ${calendar.notes.trim()}`);
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

const describeHedgePlan = (hedges: Record<HedgeId, HedgeConfig>): string[] =>
  Object.entries(hedges)
    .filter(([, config]) => config.state !== 'none')
    .map(([hedgeId, config]) => {
      const label = HEDGE_LABELS[hedgeId as HedgeId] ?? hedgeId;
      if (config.state === 'trim' && config.trim) {
        return `${label} Trim ${describeTrimConfig(config.trim)}`;
      }
      if (config.state === 'rabattage' && config.rabattage) {
        return `${label} Rabattage ${describeRabattageConfig(config.rabattage)}`;
      }
      return `${label} (${config.state})`;
    });

const describeTrimConfig = (config: HedgeConfig['trim']): string => {
  /* c8 ignore next */
  if (!config) {
    return '';
  }

  if (config.mode === 'preset' && config.preset) {
    return `(${capitalize(config.preset)} preset)`;
  }
  const selections = ['inside', 'top', 'outside'].filter((key) => config[key as keyof typeof config]);
  return selections.length ? `(${selections.map(capitalize).join(' + ')})` : '(custom)';
};

const describeRabattageConfig = (config: HedgeConfig['rabattage']): string => {
  /* c8 ignore next */
  if (!config) {
    return '';
  }
  if (config.option === 'partial') {
    return `(Partial${config.partialAmountText ? `: ${config.partialAmountText}` : ''})`;
  }
  if (config.option === 'total_no_roots') {
    return '(Total without roots)';
  }
  return '(Total)';
};

const formatCurrency = (value: string | number): string => {
  const numeric = typeof value === 'number' ? value : Number(value || 0);
  return currencyFormatter.format(Number.isNaN(numeric) ? 0 : numeric);
};

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);



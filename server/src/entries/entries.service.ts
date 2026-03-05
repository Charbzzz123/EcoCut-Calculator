import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  CreateEntryDto,
  HedgeConfigDto,
  RabattageConfigDto,
  TrimConfigDto,
} from './dto/create-entry.dto.js';
import type { UpdateClientDto } from './dto/update-client.dto.js';
import { EntriesRepository } from './entries.repository.js';
import type {
  ClientDetail,
  ClientSummary,
  StoredEntry,
} from './entries.types.js';

const HEDGE_IDS = [
  'hedge-1',
  'hedge-2',
  'hedge-3',
  'hedge-4',
  'hedge-5',
  'hedge-6',
  'hedge-7',
  'hedge-8',
] as const;

const HEDGE_LABELS: Record<string, string> = {
  'hedge-1': 'Front Left',
  'hedge-2': 'Left',
  'hedge-3': 'Back',
  'hedge-4': 'Right',
  'hedge-5': 'Right House',
  'hedge-6': 'Left House',
  'hedge-7': 'Front Right',
  'hedge-8': 'Parking',
};

type HedgeId = (typeof HEDGE_IDS)[number];
type HedgeConfigMap = Record<string, HedgeConfigDto>;

@Injectable()
export class EntriesService implements OnModuleInit {
  private entries: StoredEntry[] = [];
  private clients = new Map<string, ClientSummary>();

  constructor(private readonly repository: EntriesRepository) {}

  async onModuleInit(): Promise<void> {
    const stored = await this.repository.loadEntries();
    this.entries = stored;
    this.rebuildClientSummaries();
  }

  async createEntry(payload: CreateEntryDto): Promise<StoredEntry> {
    const created: StoredEntry = {
      ...payload,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.entries.push(created);
    this.upsertClientSummary(created);
    await this.repository.saveEntries(this.entries);
    return created;
  }

  listEntries(): StoredEntry[] {
    return [...this.entries];
  }

  listClients(): ClientSummary[] {
    return Array.from(this.clients.values()).sort((a, b) => {
      const aPast = a.lastJobDate ?? '';
      const bPast = b.lastJobDate ?? '';
      if (aPast && bPast) {
        return bPast.localeCompare(aPast);
      }
      if (aPast) {
        return -1;
      }
      if (bPast) {
        return 1;
      }
      const aUpcoming = a.nextJobDate ?? '';
      const bUpcoming = b.nextJobDate ?? '';
      if (aUpcoming && bUpcoming) {
        return aUpcoming.localeCompare(bUpcoming);
      }
      if (aUpcoming) {
        return -1;
      }
      if (bUpcoming) {
        return 1;
      }
      return 0;
    });
  }

  getClientDetails(clientId: string): ClientDetail {
    const summary = this.clients.get(clientId);
    if (!summary) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }

    const history = this.entries
      .filter((entry) => this.computeClientKey(entry) === clientId)
      .map((entry) => ({
        entryId: entry.id,
        createdAt: this.resolveJobTimestamp(entry),
        variant: entry.variant,
        jobValue: entry.form.jobValue,
        jobType: entry.form.jobType,
        location: entry.form.address,
        contactPhone: entry.form.phone,
        contactEmail: entry.form.email,
        desiredBudget: entry.form.desiredBudget,
        additionalDetails: entry.form.additionalDetails,
        calendar: entry.calendar,
        hedges: entry.hedges,
        hedgePlan: this.describeHedgePlan(entry.hedges),
        form: { ...entry.form },
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return { ...summary, history };
  }

  async updateEntry(
    entryId: string,
    payload: CreateEntryDto,
  ): Promise<StoredEntry> {
    const index = this.entries.findIndex((entry) => entry.id === entryId);
    if (index === -1) {
      throw new NotFoundException(`Entry ${entryId} not found`);
    }
    const preserved = this.entries[index];
    const updated: StoredEntry = {
      ...payload,
      id: preserved.id,
      createdAt: preserved.createdAt,
    };
    this.entries[index] = updated;
    await this.repository.saveEntries(this.entries);
    this.rebuildClientSummaries();
    return updated;
  }

  async deleteEntry(entryId: string): Promise<void> {
    const initialLength = this.entries.length;
    this.entries = this.entries.filter((entry) => entry.id !== entryId);
    if (this.entries.length === initialLength) {
      throw new NotFoundException(`Entry ${entryId} not found`);
    }
    await this.repository.saveEntries(this.entries);
    this.rebuildClientSummaries();
  }

  async updateClient(
    clientId: string,
    updates: UpdateClientDto,
  ): Promise<ClientSummary> {
    const trimmedUpdates = this.normalizeClientUpdates(updates);
    if (!Object.keys(trimmedUpdates).length) {
      return this.getClientDetails(clientId);
    }
    let matchedEntry: StoredEntry | null = null;
    this.entries = this.entries.map((entry) => {
      if (this.computeClientKey(entry) !== clientId) {
        return entry;
      }
      matchedEntry = entry;
      return {
        ...entry,
        form: {
          ...entry.form,
          ...trimmedUpdates,
        },
      };
    });
    if (!matchedEntry) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }
    const resolvedEntry: StoredEntry = matchedEntry;
    await this.repository.saveEntries(this.entries);
    this.rebuildClientSummaries();
    const newKey = this.computeClientKey({
      ...resolvedEntry,
      form: { ...resolvedEntry.form, ...trimmedUpdates },
    });
    const summary = this.clients.get(newKey);
    if (!summary) {
      throw new NotFoundException(`Client ${newKey} not found after update`);
    }
    return summary;
  }

  async deleteClient(clientId: string): Promise<void> {
    const before = this.entries.length;
    this.entries = this.entries.filter(
      (entry) => this.computeClientKey(entry) !== clientId,
    );
    if (this.entries.length === before) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }
    await this.repository.saveEntries(this.entries);
    this.rebuildClientSummaries();
  }

  private rebuildClientSummaries(): void {
    this.clients = new Map<string, ClientSummary>();
    for (const entry of this.entries) {
      this.upsertClientSummary(entry);
    }
  }

  private upsertClientSummary(entry: StoredEntry): void {
    const key = this.computeClientKey(entry);
    const existing = this.clients.get(key);
    const fullName = `${entry.form.firstName} ${entry.form.lastName}`.trim();
    const jobTimestamp = this.resolveJobTimestamp(entry);
    const now = new Date().toISOString();
    const isPast = jobTimestamp <= now;
    if (existing) {
      const updated: ClientSummary = {
        ...existing,
        firstName: entry.form.firstName,
        lastName: entry.form.lastName,
        fullName,
        address: entry.form.address,
        phone: entry.form.phone,
        email: entry.form.email,
        jobsCount: existing.jobsCount + 1,
        lastJobDate: existing.lastJobDate,
        nextJobDate: existing.nextJobDate ?? null,
        lastCalendarEventId:
          entry.calendar?.eventId ?? existing.lastCalendarEventId,
      };
      if (isPast) {
        updated.lastJobDate = this.pickLater(updated.lastJobDate, jobTimestamp);
      } else {
        updated.nextJobDate = this.pickSooner(
          updated.nextJobDate,
          jobTimestamp,
        );
      }
      this.clients.set(key, updated);
      return;
    }
    const summary: ClientSummary = {
      clientId: key,
      firstName: entry.form.firstName,
      lastName: entry.form.lastName,
      fullName,
      address: entry.form.address,
      phone: entry.form.phone,
      email: entry.form.email,
      jobsCount: 1,
      lastJobDate: isPast ? jobTimestamp : null,
      nextJobDate: isPast ? null : jobTimestamp,
      lastCalendarEventId: entry.calendar?.eventId,
    };
    this.clients.set(key, summary);
  }

  private resolveJobTimestamp(entry: StoredEntry): string {
    return entry.calendar?.start ?? entry.createdAt;
  }

  private computeClientKey(entry: StoredEntry): string {
    const { email, phone, firstName, lastName, address } = entry.form;
    if (email?.trim()) {
      return email.trim().toLowerCase();
    }
    const phoneDigits = phone?.replace(/\D/g, '');
    if (phoneDigits) {
      const addressKey = address?.trim().toLowerCase();
      const nameKey = `${firstName}::${lastName}`.toLowerCase();
      const discriminator =
        addressKey && addressKey.length > 0 ? addressKey : nameKey;
      return `${phoneDigits}::${discriminator}`;
    }
    return `${firstName}::${lastName}::${address}`.toLowerCase();
  }

  private pickLater(current: string | null, candidate: string): string {
    if (!current) {
      return candidate;
    }
    return current > candidate ? current : candidate;
  }

  private pickSooner(
    current: string | null | undefined,
    candidate: string,
  ): string {
    if (!current) {
      return candidate;
    }
    return current < candidate ? current : candidate;
  }

  private normalizeClientUpdates(updates: UpdateClientDto): UpdateClientDto {
    const normalized: UpdateClientDto = {};
    if (typeof updates.firstName === 'string') {
      normalized.firstName = updates.firstName.trim();
    }
    if (typeof updates.lastName === 'string') {
      normalized.lastName = updates.lastName.trim();
    }
    if (typeof updates.address === 'string') {
      normalized.address = updates.address.trim();
    }
    if (typeof updates.phone === 'string') {
      normalized.phone = updates.phone.trim();
    }
    if (typeof updates.email === 'string') {
      normalized.email = updates.email.trim();
    }
    return Object.fromEntries(
      Object.entries(normalized).filter(
        ([, value]) => value !== undefined && value !== '',
      ),
    ) as UpdateClientDto;
  }

  private describeHedgePlan(hedges: HedgeConfigMap): string[] {
    const handled = new Set<string>();
    const lines: string[] = [];
    const pair = (a: HedgeId, b: HedgeId) => {
      const first = hedges[a];
      const second = hedges[b];
      if (
        first &&
        second &&
        first.state !== 'none' &&
        first.state === second.state
      ) {
        handled.add(a);
        handled.add(b);
        if (first.state === 'trim') {
          lines.push(
            `Front Trim ${this.describeMergedTrim(first.trim, second.trim)}`,
          );
        } else if (first.state === 'rabattage') {
          lines.push(
            `Front Rabattage ${this.describeMergedRabattage(first.rabattage, second.rabattage)}`,
          );
        }
      }
    };
    pair('hedge-1', 'hedge-7');

    const orderedKeys: string[] = [
      ...HEDGE_IDS,
      ...Object.keys(hedges).filter(
        (key) => !HEDGE_IDS.includes(key as HedgeId),
      ),
    ];
    for (const key of orderedKeys) {
      if (handled.has(key)) {
        continue;
      }
      const config = hedges[key];
      if (!config || config.state === 'none') {
        continue;
      }
      const label = HEDGE_LABELS[key] ?? key;
      if (config.state === 'trim') {
        lines.push(`${label} Trim ${this.describeTrim(config.trim)}`);
      } else if (config.state === 'rabattage') {
        lines.push(
          `${label} Rabattage ${this.describeRabattage(config.rabattage)}`,
        );
      } else {
        lines.push(`${label} (${config.state as string})`);
      }
    }
    return lines;
  }

  private describeTrim(config?: TrimConfigDto): string {
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
  }

  private describeMergedTrim(a?: TrimConfigDto, b?: TrimConfigDto): string {
    const first = this.describeTrim(a);
    const second = this.describeTrim(b);
    if (!second || first === second) {
      return first;
    }
    if (first.startsWith('(') && second.startsWith('(')) {
      const combined = new Set<string>();
      const allowed = new Set(['i', 't', 'o']);
      first
        .slice(1, -1)
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => allowed.has(tag))
        .forEach((tag) => combined.add(tag));
      second
        .slice(1, -1)
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => allowed.has(tag))
        .forEach((tag) => combined.add(tag));
      if (combined.size > 0) {
        return `(${Array.from(combined).join(',')})`;
      }
    }
    return first;
  }

  private describeRabattage(config?: RabattageConfigDto): string {
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
  }

  private describeMergedRabattage(
    a?: RabattageConfigDto,
    b?: RabattageConfigDto,
  ): string {
    const first = this.describeRabattage(a);
    const second = this.describeRabattage(b);
    if (!second || first === second) {
      return first;
    }
    return first;
  }
}

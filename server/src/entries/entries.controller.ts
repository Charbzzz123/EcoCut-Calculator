import { Body, Controller, Get, Post } from '@nestjs/common';
import { EntriesService } from './entries.service.js';
import type { CreateEntryDto } from './dto/create-entry.dto.js';

@Controller('entries')
export class EntriesController {
  constructor(private readonly entries: EntriesService) {}

  @Post()
  create(@Body() body: CreateEntryDto) {
    return this.entries.createEntry(body);
  }

  @Get()
  listEntries() {
    return this.entries.listEntries();
  }

  @Get('clients')
  listClients() {
    return this.entries.listClients();
  }
}

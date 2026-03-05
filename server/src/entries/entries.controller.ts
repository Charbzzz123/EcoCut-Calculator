import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { EntriesService } from './entries.service.js';
import type { CreateEntryDto } from './dto/create-entry.dto.js';
import type { UpdateClientDto } from './dto/update-client.dto.js';

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
  @Patch(':entryId')
  updateEntry(@Param('entryId') entryId: string, @Body() body: CreateEntryDto) {
    return this.entries.updateEntry(entryId, body);
  }

  @Delete(':entryId')
  removeEntry(@Param('entryId') entryId: string) {
    return this.entries.deleteEntry(entryId);
  }

  @Get('clients')
  listClients() {
    return this.entries.listClients();
  }
  @Get('clients/:clientId')
  getClient(@Param('clientId') clientId: string) {
    return this.entries.getClientDetails(clientId);
  }

  @Patch('clients/:clientId')
  updateClient(@Param('clientId') clientId: string, @Body() body: UpdateClientDto) {
    return this.entries.updateClient(clientId, body);
  }

  @Delete('clients/:clientId')
  removeClient(@Param('clientId') clientId: string) {
    return this.entries.deleteClient(clientId);
  }
}

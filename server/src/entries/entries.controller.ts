import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { EntriesService } from './entries.service';
import type { CreateEntryDto } from './dto/create-entry.dto';
import type { UpdateClientDto } from './dto/update-client.dto';
import type { FindClientMatchDto } from './dto/find-client-match.dto';
import type { UpdateSalesStatusDto } from './entries.types';

@Controller('entries')
export class EntriesController {
  constructor(private readonly entries: EntriesService) {}

  @Post()
  create(@Body() body: CreateEntryDto) {
    return this.entries.createEntry(body);
  }

  @Get()
  listEntries(@Query('salesStatus') salesStatus?: string) {
    return this.entries.listEntries(salesStatus);
  }
  @Patch(':entryId')
  updateEntry(@Param('entryId') entryId: string, @Body() body: CreateEntryDto) {
    return this.entries.updateEntry(entryId, body);
  }

  @Patch(':entryId/sales-status')
  updateSalesStatus(
    @Param('entryId') entryId: string,
    @Body() body: UpdateSalesStatusDto,
  ) {
    return this.entries.updateSalesStatus(entryId, body);
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
  updateClient(
    @Param('clientId') clientId: string,
    @Body() body: UpdateClientDto,
  ) {
    return this.entries.updateClient(clientId, body);
  }

  @Delete('clients/:clientId')
  removeClient(@Param('clientId') clientId: string) {
    return this.entries.deleteClient(clientId);
  }

  @Post('clients/match')
  findClientMatch(@Body() body: FindClientMatchDto) {
    return this.entries.findClientMatch(body.form);
  }
}
